import Parser from "rss-parser";
import { prisma } from "@/lib/db";
import { extractCveIds } from "@/lib/search/buildQuery";
import { fetchNvdCve, cvssToSeverity } from "@/lib/ingestion/nvd";
import { writeAuditLog } from "@/lib/audit";
import { parseValidDate } from "@/lib/ingestion/dates";
import { formatIngestError } from "@/lib/ingestion/errors";
import { refreshNewsArticleSearchVector } from "@/lib/search/updateSearchVector";
import { getIngestSettings } from "@/lib/settings";
import { buildSummary, extractRssBody, isShortContent, stripHtmlTags } from "@/lib/ingestion/article-content";
import { delayBetweenFetches, fetchFullArticle } from "@/lib/ingestion/article-extractor";
import { generateArticleSummary } from "@/lib/ai/deepseek";
import { stripAdsFromHtml } from "@/lib/news/strip-ads-server";

const parser = new Parser({
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
  },
});

export interface RssIngestOptions {
  fetchFullPage?: boolean;
}

export async function ingestRssFeed(
  feedId: string,
  url: string,
  sourceName: string,
  daysBack = 60,
  options: RssIngestOptions = {}
): Promise<{ created: number; updated: number; skipped: number }> {
  const ingestSettings = await getIngestSettings();
  const feedFullPage = options.fetchFullPage ?? true;
  const shouldFetchFullPage = ingestSettings.fetchFullPage && feedFullPage;

  const feed = await parser.parseURL(url);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let fetchedCount = 0;

  for (const item of feed.items) {
    try {
      if (!item.title || !item.link) {
        skipped++;
        continue;
      }

      const pubDate = parseValidDate(item.pubDate);
      if (!pubDate || pubDate < cutoff) {
        skipped++;
        continue;
      }

      const itemWithEncoded = item as { contentEncoded?: string };
      const contentEncoded =
        itemWithEncoded.contentEncoded ??
        (typeof (item as unknown as Record<string, unknown>)["content:encoded"] === "string"
          ? ((item as unknown as Record<string, unknown>)["content:encoded"] as string)
          : undefined);

      const { body: rssPlain, bodyHtml, source: rssSource, rawLengths } = extractRssBody({
        contentEncoded,
        content: item.content,
        summary: item.summary,
      });

      const sourceHost = (() => {
        try {
          return new URL(item.link!).hostname.replace(/^www\./, "");
        } catch {
          return undefined;
        }
      })();

      const cleanedBodyHtml = bodyHtml
        ? stripAdsFromHtml(bodyHtml, { sourceHost })
        : null;

      let body = cleanedBodyHtml || rssPlain || item.title;
      let plainLength = (cleanedBodyHtml ? stripHtmlTags(cleanedBodyHtml).length : rssPlain.length);
      let contentSource: string = rssSource;

      if (shouldFetchFullPage && isShortContent(rssPlain || body) && item.link) {
        if (fetchedCount > 0) await delayBetweenFetches();
        const fetched = await fetchFullArticle(item.link);
        fetchedCount++;

        if (fetched && fetched.text.length > plainLength) {
          body = fetched.html ?? fetched.text;
          plainLength = fetched.text.length;
          contentSource = fetched.html ? "full_page_fetch_html" : "full_page_fetch";
        }
      }

      const existing = await prisma.newsArticle.findUnique({
        where: { sourceUrl: item.link },
      });

      if (existing) {
        if (!ingestSettings.enrichExisting) {
          skipped++;
          continue;
        }

        if (plainLength <= stripHtmlTags(existing.body).length) {
          skipped++;
          continue;
        }

        let summary = buildSummary(body, ingestSettings.summaryMaxChars, item.title);
        if (ingestSettings.aiSummarizeAtIngest) {
          const aiSummary = await generateArticleSummary(item.title, body);
          if (aiSummary) summary = aiSummary;
        }

        const existingMeta =
          existing.rawMetadata && typeof existing.rawMetadata === "object"
            ? (existing.rawMetadata as Record<string, unknown>)
            : {};

        await prisma.newsArticle.update({
          where: { id: existing.id },
          data: {
            summary,
            body,
            rawMetadata: JSON.parse(
              JSON.stringify({
                ...existingMeta,
                source: "rss",
                feedId,
                rssSource,
                contentSource,
                rawLengths,
                enrichedAt: new Date().toISOString(),
                item: { title: item.title, link: item.link },
              })
            ),
          },
        });
        await refreshNewsArticleSearchVector(existing.id);
        updated++;
        continue;
      }

      const text = `${item.title} ${stripHtmlTags(body)}`;
      const cveIds = extractCveIds(text);

      let nvd = null;
      if (cveIds.length > 0) {
        nvd = await fetchNvdCve(cveIds[0]);
      }

      let summary = buildSummary(body, ingestSettings.summaryMaxChars, item.title);
      if (ingestSettings.aiSummarizeAtIngest && body.length > 200) {
        const aiSummary = await generateArticleSummary(item.title, body);
        if (aiSummary) summary = aiSummary;
      }

      const createdArticle = await prisma.newsArticle.create({
        data: {
          title: item.title,
          summary,
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
            JSON.stringify({
              source: "rss",
              feedId,
              rssSource,
              contentSource,
              rawLengths,
              item: { title: item.title, link: item.link },
            })
          ),
          status: "ingested",
        },
      });
      await refreshNewsArticleSearchVector(createdArticle.id);
      created++;
    } catch (err) {
      skipped++;
      console.warn(`RSS ingest skipped item "${item.title ?? "unknown"}":`, formatIngestError(err));
    }
  }

  await writeAuditLog({
    action: "ingest.rss",
    entity: "FeedSource",
    entityId: feedId,
    metadata: { created, updated, skipped, url, daysBack, fetchedCount },
  });

  return { created, updated, skipped };
}
