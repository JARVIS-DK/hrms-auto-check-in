/**
 * Index definitions, kept free of relative imports.
 *
 * scripts/db-setup.ts runs on Node's type stripping, which resolves ESM
 * specifiers literally — anything this module imported would have to carry a
 * .ts extension too. Keeping it a leaf lets both the app and the script read
 * the same definitions.
 */

/** Case-insensitive email matching (strength 2 ignores case and accents). */
export const EMAIL_COLLATION = { locale: "en", strength: 2 } as const;

export interface IndexSpec {
  collection: string;
  keys: Record<string, 1 | -1>;
  name: string;
  unique?: boolean;
  expireAfterSeconds?: number;
  collation?: typeof EMAIL_COLLATION;
}

export const INDEX_SPECS: IndexSpec[] = [
  // The guard that stops two overlapping cron ticks from creating two rows for
  // the same user/day/action with different target times.
  {
    collection: "scheduled_actions",
    keys: { userId: 1, date: 1, action: 1 },
    name: "user_date_action",
    unique: true,
  },

  { collection: "settings", keys: { userId: 1 }, name: "user", unique: true },

  { collection: "logs", keys: { userId: 1, executedAt: -1 }, name: "user_executed" },
  { collection: "logs", keys: { executedAt: -1 }, name: "executed" },

  { collection: "leaves", keys: { userId: 1, date: 1 }, name: "user_date", unique: true },

  { collection: "holidays", keys: { date: 1 }, name: "date", unique: true },

  { collection: "password_resets", keys: { token: 1 }, name: "token", unique: true },
  // Reset rows are worthless once expired; let Mongo reap them.
  { collection: "password_resets", keys: { expiresAt: 1 }, name: "ttl", expireAfterSeconds: 0 },

  { collection: "invites", keys: { token: 1 }, name: "token", unique: true },
  { collection: "invites", keys: { email: 1 }, name: "email" },

  // Cannot build while two accounts differ only by letter case — see
  // `npm run db:check-emails`.
  {
    collection: "users",
    keys: { email: 1 },
    name: "email_ci",
    unique: true,
    collation: EMAIL_COLLATION,
  },
];

export const INDEXED_COLLECTIONS = [...new Set(INDEX_SPECS.map((s) => s.collection))];
