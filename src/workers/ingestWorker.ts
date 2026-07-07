import "@/lib/load-env";
import { Worker } from "bullmq";
import { runIngestionForFeed, runAllEnabledFeeds } from "@/lib/ingestion/runner";
import { purgeOldNews } from "@/lib/ingestion/retention";
import { rescheduleIngestJob } from "@/lib/ingestion/schedule";
import { ingestConnection } from "@/lib/ingestion/queue";
import { getIngestSettings } from "@/lib/settings";
import { ensureSearchInfrastructure } from "@/lib/search/ensureSearchInfrastructure";

export async function startIngestWorker() {
  await ensureSearchInfrastructure();

  const worker = new Worker(
    "ingest",
    async (job) => {
      console.log(`[ingest] Running job: ${job.name} (id=${job.id})`);

      if (job.name === "scheduled") {
        const settings = await getIngestSettings();
        const ingestResult = await runAllEnabledFeeds(1);
        const purged = await purgeOldNews(settings.retentionDays);
        console.log(
          `[ingest] Scheduled fetch done — feeds: ${ingestResult.length}, purged: ${purged}`
        );
        return { ingestResult, purged, retentionDays: settings.retentionDays };
      }
      if (job.name === "all") {
        return runAllEnabledFeeds();
      }
      if (job.name === "feed" && job.data.feedId) {
        return runIngestionForFeed(job.data.feedId);
      }
      throw new Error(`Unknown job: ${job.name}`);
    },
    {
      connection: ingestConnection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[ingest] Job ${job.id} (${job.name}) completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ingest] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[ingest] Worker connection error:", err.message);
  });

  const minutes = await rescheduleIngestJob();
  console.log(`[ingest] Auto news fetcher active — every ${minutes} minutes`);
  console.log(`[ingest] Redis: ${ingestConnection.host}:${ingestConnection.port}/${ingestConnection.db}`);

  const shutdown = async () => {
    console.log("[ingest] Shutting down worker...");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return worker;
}

if (require.main === module) {
  startIngestWorker().catch((err) => {
    console.error("[ingest] Worker failed to start:", err);
    process.exit(1);
  });
}
