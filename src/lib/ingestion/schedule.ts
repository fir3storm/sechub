import { ingestQueue } from "@/lib/ingestion/queue";
import {
  getIngestSettings,
  MIN_REFRESH_INTERVAL_MINUTES,
} from "@/lib/settings";

const SCHEDULED_JOB_NAME = "scheduled";
const SCHEDULED_JOB_ID = "scheduled-ingest";

export async function rescheduleIngestJob(intervalMinutes?: number): Promise<number> {
  const minutes =
    intervalMinutes ??
    (await getIngestSettings()).refreshIntervalMinutes;

  const every = Math.max(MIN_REFRESH_INTERVAL_MINUTES, minutes) * 60 * 1000;

  const repeatable = await ingestQueue.getRepeatableJobs();
  await Promise.all(
    repeatable
      .filter((job) => job.name === SCHEDULED_JOB_NAME || job.name === "all")
      .map((job) => ingestQueue.removeRepeatableByKey(job.key))
  );

  await ingestQueue.add(
    SCHEDULED_JOB_NAME,
    {},
    {
      repeat: { every },
      jobId: SCHEDULED_JOB_ID,
    }
  );

  return every / 60_000;
}
