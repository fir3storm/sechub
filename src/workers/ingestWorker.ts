import { Worker } from "bullmq";
import { runIngestionForFeed, runAllEnabledFeeds } from "@/lib/ingestion/runner";
import { purgeOldNews } from "@/lib/ingestion/retention";
import { rescheduleIngestJob } from "@/lib/ingestion/schedule";
import { ingestConnection } from "@/lib/ingestion/queue";
import { getIngestSettings } from "@/lib/settings";

export function startIngestWorker() {
  const worker = new Worker(
    "ingest",
    async (job) => {
      if (job.name === "scheduled") {
        const settings = await getIngestSettings();
        const ingestResult = await runAllEnabledFeeds(1);
        const purged = await purgeOldNews(settings.retentionDays);
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
    { connection: ingestConnection }
  );

  worker.on("completed", (job) => {
    console.log(`[ingest] Job ${job.id} (${job.name}) completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ingest] Job ${job?.id} failed:`, err.message);
  });

  rescheduleIngestJob()
    .then((minutes) => {
      console.log(`[ingest] Worker started, auto-refresh every ${minutes} minutes`);
    })
    .catch((err) => {
      console.error("[ingest] Failed to register schedule:", err.message);
    });

  return worker;
}

if (require.main === module) {
  startIngestWorker();
}
