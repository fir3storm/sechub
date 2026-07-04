import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const parsed = new URL(redisUrl);

export const ingestConnection = {
  host: parsed.hostname,
  port: parseInt(parsed.port || "6379", 10),
  password: parsed.password || undefined,
  maxRetriesPerRequest: null as null,
};

export const ingestQueue = new Queue("ingest", { connection: ingestConnection });
