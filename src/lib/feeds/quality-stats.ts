import { prisma } from "@/lib/db";
import { stripHtmlTags } from "@/lib/ingestion/article-content";

export interface FeedQualityStat {
  feedId: string;
  feedName: string;
  feedType: string;
  articleCount: number;
  avgBodyLength: number;
  fullFetchRate: number;
  enrichedCount: number;
  shortCount: number;
}

function plainLength(body: string): number {
  return stripHtmlTags(body).trim().length;
}

function isFullFetch(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  const src = String(m.contentSource ?? "");
  return src.startsWith("full_page_fetch");
}

function wasEnriched(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  return Boolean(m.enrichment || m.enrichedAt);
}

export async function getFeedQualityStats(): Promise<FeedQualityStat[]> {
  const feeds = await prisma.feedSource.findMany({ orderBy: { name: "asc" } });
  const stats: FeedQualityStat[] = [];

  for (const feed of feeds) {
    let articles: { body: string; rawMetadata: unknown }[] = [];

    if (feed.type === "RSS" && feed.id) {
      articles = await prisma.newsArticle.findMany({
        where: {
          status: { not: "archived" },
          rawMetadata: { path: ["feedId"], equals: feed.id },
        },
        select: { body: true, rawMetadata: true },
      });
    } else if (feed.type === "NVD") {
      articles = await prisma.newsArticle.findMany({
        where: { status: { not: "archived" }, sourceName: "NVD" },
        select: { body: true, rawMetadata: true },
      });
    } else if (feed.type === "CISA_KEV") {
      articles = await prisma.newsArticle.findMany({
        where: { status: { not: "archived" }, sourceName: "CISA KEV" },
        select: { body: true, rawMetadata: true },
      });
    }

    const lengths = articles.map((a) => plainLength(a.body));
    const avgBodyLength =
      lengths.length > 0 ? Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length) : 0;
    const fullFetchCount = articles.filter((a) => isFullFetch(a.rawMetadata)).length;
    const enrichedCount = articles.filter((a) => wasEnriched(a.rawMetadata)).length;
    const shortCount = lengths.filter((n) => n < 400).length;

    stats.push({
      feedId: feed.id,
      feedName: feed.name,
      feedType: feed.type,
      articleCount: articles.length,
      avgBodyLength,
      fullFetchRate: articles.length ? Math.round((fullFetchCount / articles.length) * 100) : 0,
      enrichedCount,
      shortCount,
    });
  }

  return stats;
}
