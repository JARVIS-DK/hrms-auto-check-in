import type { Db, CreateIndexesOptions, IndexSpecification } from "mongodb";
import { getDb } from "../db";
import { INDEX_SPECS, type IndexSpec } from "./index-specs";

/**
 * Apply every index, once per process.
 *
 * `createIndex` is idempotent, so this is safe on every cold start; the memo
 * just avoids the round-trips on warm invocations. Called from the cron route
 * so a deploy self-heals without anyone remembering to run a script.
 */
let ensured: Promise<void> | null = null;

export function ensureIndexes(): Promise<void> {
  if (!ensured) {
    ensured = build().catch((err) => {
      // Never cache a failure — the next invocation should try again.
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

export async function applyIndex(db: Db, spec: IndexSpec): Promise<void> {
  const options: CreateIndexesOptions = { name: spec.name };
  if (spec.unique) options.unique = true;
  if (spec.expireAfterSeconds !== undefined) options.expireAfterSeconds = spec.expireAfterSeconds;
  if (spec.collation) options.collation = spec.collation;

  await db.collection(spec.collection).createIndex(spec.keys as IndexSpecification, options);
}

/** Points at the script that diagnoses each index's usual failure cause. */
const REMEDY: Record<string, string> = {
  "users.email_ci":
    "two accounts whose emails differ only by letter case — run `npm run db:check-emails`",
  "scheduled_actions.user_date_action":
    "duplicate rows from before this index existed — run `npm run db:check-dupes`",
};

async function build(): Promise<void> {
  const db = await getDb();

  // Never throws. A missing index costs a guarantee or some speed; a thrown
  // error here would take down every cron tick, and attendance automation
  // failing outright is far worse than running without one index.
  await Promise.all(
    INDEX_SPECS.map(async (spec) => {
      try {
        await applyIndex(db, spec);
      } catch (err) {
        const key = `${spec.collection}.${spec.name}`;
        const remedy = REMEDY[key] ? ` Likely cause: ${REMEDY[key]}.` : "";
        console.error(
          `[INDEXES] Could not create ${key}.${remedy}`,
          err instanceof Error ? err.message : err
        );
      }
    })
  );
}
