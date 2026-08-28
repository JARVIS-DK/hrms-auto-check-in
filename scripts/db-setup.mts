/**
 * One-off database maintenance, run directly on Node's type stripping:
 *
 *   npm run db:setup          create every index (reports failures, never aborts early)
 *   npm run db:check-emails   accounts whose emails collide case-insensitively
 *   npm run db:check-dupes    duplicate scheduled_actions rows
 *   npm run db:fix-dupes      dry-run the dedupe;  -- --apply  to actually delete
 *
 * The cron route also calls ensureIndexes() on each cold start, so this is for
 * bootstrapping a fresh database or diagnosing a failed index by hand.
 *
 * Imports only index-specs.ts, which is deliberately import-free — Node
 * resolves ESM specifiers literally and will not find extensionless ones.
 */
import "dotenv/config";
import { MongoClient, type Db, type ObjectId } from "mongodb";
import {
  INDEX_SPECS,
  INDEXED_COLLECTIONS,
  type IndexSpec,
} from "../src/lib/models/index-specs.ts";

/** Mirrors normalizeEmail() in src/lib/account.ts. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function applyIndex(db: Db, spec: IndexSpec) {
  const options: Record<string, unknown> = { name: spec.name };
  if (spec.unique) options.unique = true;
  if (spec.expireAfterSeconds !== undefined) options.expireAfterSeconds = spec.expireAfterSeconds;
  if (spec.collation) options.collation = spec.collation;
  return db.collection(spec.collection).createIndex(spec.keys, options);
}

const REMEDY: Record<string, string> = {
  "users.email_ci": "npm run db:check-emails",
  "scheduled_actions.user_date_action": "npm run db:check-dupes",
};

async function createIndexes(db: Db) {
  const failures: string[] = [];

  // Every index is attempted. One collection with conflicting data must not
  // stop the other nine indexes from being created.
  for (const spec of INDEX_SPECS) {
    const key = `${spec.collection}.${spec.name}`;
    try {
      await applyIndex(db, spec);
      console.log(`  ok    ${key}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The driver's message repeats the whole build-failure preamble; the
      // useful part is the dup key at the end.
      const brief = message.split("::").pop()?.trim() ?? message;
      console.log(`  FAIL  ${key}`);
      console.log(`        ${brief}`);
      if (REMEDY[key]) console.log(`        diagnose with: ${REMEDY[key]}`);
      failures.push(key);
    }
  }

  console.log("\nIndexes now present:");
  for (const name of INDEXED_COLLECTIONS) {
    const indexes = await db.collection(name).indexes();
    console.log(`  ${name}: ${indexes.map((i) => i.name).join(", ")}`);
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} index(es) could not be created: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

/**
 * The case-insensitive unique index on users.email cannot be built while two
 * accounts differ only by letter case. Merging them is a judgement call, so
 * this only reports.
 */
async function checkEmails(db: Db) {
  const users = await db
    .collection<{ _id: number; email: string; name: string; createdAt: Date }>("users")
    .find({}, { projection: { email: 1, name: 1, createdAt: 1 } })
    .toArray();

  const byNormalized = new Map<string, typeof users>();
  for (const user of users) {
    const key = normalizeEmail(user.email);
    byNormalized.set(key, [...(byNormalized.get(key) ?? []), user]);
  }

  const collisions = [...byNormalized.entries()].filter(([, group]) => group.length > 1);
  const denormalized = users.filter((u) => u.email !== normalizeEmail(u.email));

  console.log(`Checked ${users.length} account(s).\n`);

  if (collisions.length === 0) {
    console.log("No case-insensitive email collisions — users.email_ci can build.");
  } else {
    console.log(`${collisions.length} collision(s) — resolve before the unique index can build:`);
    for (const [key, group] of collisions) {
      console.log(`  ${key}`);
      for (const u of group) {
        const created = u.createdAt instanceof Date ? u.createdAt.toISOString() : "?";
        console.log(`    _id=${u._id} "${u.email}" (${u.name}, created ${created})`);
      }
    }
    process.exitCode = 1;
  }

  if (denormalized.length > 0) {
    console.log(
      `\n${denormalized.length} account(s) stored with non-normalized casing. These still sign ` +
        "in via the collation fallback, and are normalized on their next password reset:"
    );
    for (const u of denormalized) console.log(`  _id=${u._id} "${u.email}"`);
  }
}

interface ScheduledRow {
  _id: ObjectId;
  userId: number;
  date: string;
  action: string;
  targetTime?: string;
  executed?: boolean;
  result?: string;
}

interface DupeGroup {
  _id: { userId: number; date: string; action: string };
  count: number;
  docs: ScheduledRow[];
}

async function findDupeGroups(db: Db): Promise<DupeGroup[]> {
  return db
    .collection("scheduled_actions")
    .aggregate<DupeGroup>([
      {
        $group: {
          _id: { userId: "$userId", date: "$date", action: "$action" },
          count: { $sum: 1 },
          docs: { $push: "$$ROOT" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { "_id.date": 1, "_id.userId": 1, "_id.action": 1 } },
    ])
    .toArray();
}

/**
 * Which row of a duplicate group survives.
 *
 * Never discard evidence that a check-in actually succeeded, then prefer a row
 * that records an execution at all, then fall back to the oldest — ObjectIds
 * lead with a timestamp, so lexicographic order is creation order.
 */
function rank(row: ScheduledRow): number {
  if (row.result === "success") return 3;
  if (row.executed) return 2;
  return 1;
}

function pickKeeper(docs: ScheduledRow[]): ScheduledRow {
  return [...docs].sort((a, b) => {
    const diff = rank(b) - rank(a);
    if (diff !== 0) return diff;
    return String(a._id).localeCompare(String(b._id));
  })[0];
}

function describe(row: ScheduledRow): string {
  const state = row.executed ? (row.result ?? "executed") : "pending";
  return `_id=${String(row._id)} target=${row.targetTime ?? "?"} ${state}`;
}

async function checkDupes(db: Db) {
  const groups = await findDupeGroups(db);

  if (groups.length === 0) {
    console.log("No duplicate scheduled_actions — the unique index can build.");
    return;
  }

  const extra = groups.reduce((n, g) => n + g.count - 1, 0);
  console.log(
    `${groups.length} duplicated key(s), ${extra} redundant row(s).\n` +
      "These predate the unique index and are what blocks it from building.\n"
  );

  for (const group of groups) {
    const keeper = pickKeeper(group.docs);
    console.log(`  user#${group._id.userId} ${group._id.date} ${group._id.action}`);
    for (const doc of group.docs) {
      const mark = String(doc._id) === String(keeper._id) ? "keep  " : "delete";
      console.log(`    ${mark} ${describe(doc)}`);
    }
  }

  console.log("\nRun `npm run db:fix-dupes` to preview, then add `-- --apply` to delete.");
  process.exitCode = 1;
}

async function fixDupes(db: Db, apply: boolean) {
  const groups = await findDupeGroups(db);

  if (groups.length === 0) {
    console.log("No duplicate scheduled_actions — nothing to do.");
    return;
  }

  const doomed: ScheduledRow[] = [];
  for (const group of groups) {
    const keeper = pickKeeper(group.docs);
    for (const doc of group.docs) {
      if (String(doc._id) !== String(keeper._id)) doomed.push(doc);
    }
  }

  if (!apply) {
    console.log(
      `DRY RUN — would delete ${doomed.length} row(s) across ${groups.length} key(s).\n` +
        "Nothing has been changed. Re-run with `-- --apply` to delete.\n"
    );
    for (const group of groups) {
      const keeper = pickKeeper(group.docs);
      console.log(`  user#${group._id.userId} ${group._id.date} ${group._id.action}`);
      console.log(`    keep   ${describe(keeper)}`);
      for (const doc of group.docs) {
        if (String(doc._id) !== String(keeper._id)) console.log(`    delete ${describe(doc)}`);
      }
    }
    return;
  }

  const result = await db
    .collection("scheduled_actions")
    .deleteMany({ _id: { $in: doomed.map((d) => d._id) } });

  console.log(`Deleted ${result.deletedCount} redundant row(s).`);

  const remaining = await findDupeGroups(db);
  if (remaining.length > 0) {
    console.log(`${remaining.length} duplicate key(s) still present — re-run to inspect.`);
    process.exitCode = 1;
    return;
  }

  console.log("No duplicates remain. Creating the unique index...");
  const spec = INDEX_SPECS.find(
    (s) => s.collection === "scheduled_actions" && s.name === "user_date_action"
  )!;
  await applyIndex(db, spec);
  console.log("  ok    scheduled_actions.user_date_action");
}

const COMMANDS = ["indexes", "check-emails", "check-dupes", "fix-dupes"] as const;
type Command = (typeof COMMANDS)[number];

async function main() {
  const command = (process.argv[2] ?? "indexes") as Command;
  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command "${command}" — expected one of: ${COMMANDS.join(", ")}`);
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    console.log(`Database: ${db.databaseName}\n`);

    if (command === "indexes") await createIndexes(db);
    else if (command === "check-emails") await checkEmails(db);
    else if (command === "check-dupes") await checkDupes(db);
    else await fixDupes(db, process.argv.includes("--apply"));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
