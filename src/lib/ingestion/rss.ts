import Parser from "rss-parser";
import { prisma } from "@/lib/db";
import { extractCveIds } from "@/lib/search/buildQuery";
import { fetchNvdCve, cvssToSeverity } from "@/lib/ingestion/nvd";
import { writeAuditLog } from "@/lib/audit";

const parser = new Parser();

export async function ingestRssFeed(
  feedId: string,
  url: string,
  sourceName: string,
  daysBack = 60
): Promise<{ created: number; skipped: number }> {
  const feed = await parser.parseURL(url);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  let created = 0;
  let skipped = 0;

  for (const item of feed.items) {
    if (!item.title || !item.link) {
      skipped++;
      continue;
    }

    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
    if (pubDate < cutoff) {
      skipped++;
      continue;
    }

    const existing = await prisma.newsArticle.findUnique({
      where: { sourceUrl: item.link },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const rawBody =
      (item as { ["content:encoded"]?: string }).["content:encoded"] ||
      item.content ||
      item.contentSnippet ||
      item.summary ||
      "";
    const body = rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const text = `${item.title} ${body}`;
    const cveIds = extractCveIds(text);

    let nvd = null;
    if (cveIds.length > 0) {
      nvd = await fetchNvdCve(cveIds[0]);
    }

    await prisma.newsArticle.create({
      data: {
        title: item.title,
        summary: body.slice(0, 500) || item.title,
        body: body || item.title,
        sourceUrl: item.link,
        sourceName,
        publishedAt: pubDate,
        severity: nvd ? cvssToSeverity(nvd.cvssScore) : "medium",
        cveIds,
        cvssScore: nvd?.cvssScore ?? null,
        cvssVector: nvd?.cvssVector ?? null,
        affectedDevices: nvd?.affectedDevices ?? [],
        affectedOs: nvd?.affectedOs ?? [],
        cpeList: nvd?.cpeList ?? [],
        rawMetadata: JSON.parse(
          JSON.stringify({ source: "rss", feedId, item: { title: item.title, link: item.link } })
        ),
        status: "ingested",
      },
    });
    created++;
  }

  await writeAuditLog({
    action: "ingest.rss",
    entity: "FeedSource",
    entityId: feedId,
    metadata: { created, skipped, url, daysBack },
  });

  return { created, skipped };
}
