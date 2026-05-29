import dns from "dns";
import { MongoClient, Db } from "mongodb";

// Cloudflare WARP's local DNS proxy (127.0.2.2) refuses SRV queries.
// Force Node.js to use Google/Cloudflare public DNS for resolution.
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const MONGODB_URI = process.env.MONGODB_URI!;

let cached: { client: MongoClient; db: Db } | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached.db;

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  cached = { client, db };
  return db;
}
