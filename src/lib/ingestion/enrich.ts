import { prisma } from "@/lib/db";
import { getIngestSettings } from "@/lib/settings";
import { buildSummary, isShortContent, stripHtmlTags } from "@/lib/ingestion/article-content";
import { delayBetweenFetches, fetchFullArticle } from "@/lib/ingestion/article-extractor";
import { generateArticleSummary } from "@/lib/ai/deepseek";
import { refreshNewsArticleSearchVector } from "@/lib/search/updateSearchVector";
import { writeAuditLog } from "@/lib/audit";
import { formatIngestError } from "@/lib/ingestion/errors";

export async function enrichShortArticles(options?: {
  limit?: number;
  feedId?: string;
}): Promise<{ enriched: number; skipped: number; failed: number }> {
  const settings = await getIngestSettings();
  const limit = options?.limit ?? 50;

  let sourceNameFilter: string | undefined;
  if (options?.feedId) {
    const feed = await prisma.feedSource.findUnique({ where: { id: options.feedId } });
    if (!feed) return { enriched: 0, skipped: 0, failed: 0 };
    sourceNameFilter = feed.name;
  }

  const articles = await prisma.newsArticle.findMany({
    where: {
      sourceUrl: { not: null },
      sourceName: sourceNameFilter
        ? sourceNameFilter
        : { notIn: ["NVD", "CISA KEV"] },
    },
    orderBy: { publishedAt: "desc" },
    take: limit * 5,
  });

  const candidates = articles
    .filter((a) => a.sourceUrl && isShortContent(a.body))
    .slice(0, limit);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const article of candidates) {
    try {
      const fetched = await fetchFullArticle(article.sourceUrl!);
      if (enriched + skipped + failed > 0) await delayBetweenFetches(800);

      if (!fetched || fetched.text.length <= stripHtmlTags(article.body).length) {
        skipped++;
        continue;
      }

      let summary = buildSummary(fetched.text, settings.summaryMaxChars, article.title);
      if (settings.aiSummarizeAtIngest) {
        const aiSummary = await generateArticleSummary(article.title, fetched.text);
        if (aiSummary) summary = aiSummary;
      }

      const storedBody = fetched.html ?? fetched.text;

      const existingMeta =
        article.rawMetadata && typeof article.rawMetadata === "object"
          ? (article.rawMetadata as Record<string, unknown>)
          : {};

      await prisma.newsArticle.update({
        where: { id: article.id },
        data: {
          body: storedBody,
          summary,
          rawMetadata: JSON.parse(
            JSON.stringify({
              ...existingMeta,
              enrichment: {
                at: new Date().toISOString(),
                method: fetched.html ? "full_page_fetch_html" : "full_page_fetch",
                previousBodyLength: stripHtmlTags(article.body).length,
                newBodyLength: fetched.text.length,
                wordCount: fetched.wordCount,
              },
            })
          ),
        },
      });
      await refreshNewsArticleSearchVector(article.id);
      enriched++;
    } catch (err) {
      failed++;
      console.warn(`Enrich failed for ${article.id}:`, formatIngestError(err));
    }
  }

  await writeAuditLog({
    action: "ingest.enrich",
    entity: "NewsArticle",
    metadata: { enriched, skipped, failed, limit, feedId: options?.feedId },
  });

  return { enriched, skipped, failed };
}
