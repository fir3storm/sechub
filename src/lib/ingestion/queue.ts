import { Queue } from "bullmq";
import { loadEnvFile } from "@/lib/load-env";

function parseRedisUrl(redisUrl: string) {
  loadEnvFile();
  const parsed = new URL(redisUrl);
  const dbPath = parsed.pathname?.replace(/^\//, "");
  const db = dbPath ? parseInt(dbPath, 10) : 0;

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isNaN(db) ? 0 : db,
    maxRetriesPerRequest: null as null,
  };
}

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const ingestConnection = parseRedisUrl(redisUrl);

export const ingestQueue = new Queue("ingest", { connection: ingestConnection });
