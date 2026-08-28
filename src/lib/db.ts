import dns from "dns";
import { MongoClient, Db } from "mongodb";

// Cloudflare WARP's local DNS proxy (127.0.2.2) refuses SRV queries.
// Force Node.js to use Google/Cloudflare public DNS for resolution.
// Only in development — in production the platform resolver is correct and
// overriding it costs latency and breaks private networking.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
}

const MONGODB_URI = process.env.MONGODB_URI!;

// Cache the *promise*, not the resolved client: concurrent callers during a
// cold start would otherwise each open their own MongoClient. Held on
// globalThis so dev HMR reuses one connection instead of leaking one per reload.
const globalForMongo = globalThis as unknown as {
  _mongoConn?: Promise<{ client: MongoClient; db: Db }>;
};

function connect(): Promise<{ client: MongoClient; db: Db }> {
  return MongoClient.connect(MONGODB_URI).then((client) => ({
    client,
    db: client.db(),
  }));
}

export async function getDb(): Promise<Db> {
  if (!globalForMongo._mongoConn) {
    globalForMongo._mongoConn = connect().catch((err) => {
      // Don't cache a failed connection — the next request should retry.
      globalForMongo._mongoConn = undefined;
      throw err;
    });
  }
  const { db } = await globalForMongo._mongoConn;
  return db;
}
