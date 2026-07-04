import { prisma } from "@/lib/db";
import { ingestNvdFeed } from "@/lib/ingestion/nvd-ingest";
import { ingestCisaKev } from "@/lib/ingestion/cisa";
import { ingestRssFeed } from "@/lib/ingestion/rss";
import { FeedType } from "@prisma/client";

export async function runIngestionForFeed(feedId: string, daysBack = 1) {
  const feed = await prisma.feedSource.findUnique({ where: { id: feedId } });
  if (!feed || !feed.enabled) {
    throw new Error("Feed not found or disabled");
  }

  try {
    let result: Record<string, number> = {};

    switch (feed.type) {
      case FeedType.NVD:
        result = await ingestNvdFeed(daysBack);
        break;
      case FeedType.CISA_KEV:
        result = await ingestCisaKev();
        break;
      case FeedType.RSS:
        if (!feed.url) throw new Error("RSS feed URL is required");
        result = await ingestRssFeed(feed.id, feed.url, feed.name, daysBack);
        break;
    }

    await prisma.feedSource.update({
      where: { id: feedId },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: "success",
        lastRunError: null,
      },
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.feedSource.update({
      where: { id: feedId },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: "error",
        lastRunError: message,
      },
    });
    throw err;
  }
}

export async function runAllEnabledFeeds(daysBack = 1) {
  const feeds = await prisma.feedSource.findMany({ where: { enabled: true } });
  const results = [];

  for (const feed of feeds) {
    try {
      const result = await runIngestionForFeed(feed.id, daysBack);
      results.push({ feedId: feed.id, name: feed.name, status: "success", result });
    } catch (err) {
      results.push({
        feedId: feed.id,
        name: feed.name,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

/** One-shot backfill for the last N days across all enabled feeds. */
export async function backfillAllFeeds(daysBack = 60) {
  return runAllEnabledFeeds(daysBack);
}
