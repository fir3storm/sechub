import { Prisma, Severity } from "@prisma/client";

export interface NewsSearchParams {
  q?: string;
  category?: string | string[];
  device?: string | string[];
  os?: string | string[];
  cve?: string;
  from?: string;
  to?: string;
  cvssMin?: string;
  cvssMax?: string;
  severity?: string | string[];
  source?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function buildNewsWhere(params: NewsSearchParams): Prisma.NewsArticleWhereInput {
  const where: Prisma.NewsArticleWhereInput = {
    status: { not: "archived" },
  };

  // Text search is handled by PostgreSQL full-text search in fullTextSearch.ts

  const categories = toArray(params.category);
  if (categories.length > 0) {
    where.categories = {
      some: { category: { slug: { in: categories } } },
    };
  }

  const devices = toArray(params.device);
  if (devices.length > 0) {
    where.affectedDevices = { hasSome: devices };
  }

  const osList = toArray(params.os);
  if (osList.length > 0) {
    where.affectedOs = { hasSome: osList };
  }

  if (params.cve) {
    const cve = String(params.cve).toUpperCase();
    if (/^CVE-\d{4}-\d+$/.test(cve)) {
      where.cveIds = { has: cve };
    }
  }

  if (params.from || params.to) {
    where.publishedAt = {};
    if (params.from) where.publishedAt.gte = new Date(params.from);
    if (params.to) where.publishedAt.lte = new Date(params.to);
  }

  if (params.cvssMin || params.cvssMax) {
    where.cvssScore = {};
    if (params.cvssMin) where.cvssScore.gte = parseFloat(params.cvssMin);
    if (params.cvssMax) where.cvssScore.lte = parseFloat(params.cvssMax);
  }

  const severities = toArray(params.severity) as Severity[];
  if (severities.length > 0) {
    where.severity = { in: severities };
  }

  if (params.source) {
    where.sourceName = { equals: params.source, mode: "insensitive" };
  }

  return where;
}

export function buildNewsOrderBy(
  sort?: string
): Prisma.NewsArticleOrderByWithRelationInput | Prisma.NewsArticleOrderByWithRelationInput[] {
  switch (sort) {
    case "severity":
      return { severity: "desc" };
    case "cvss":
      return { cvssScore: "desc" };
    default:
      return { publishedAt: "desc" };
  }
}

export function severityWeight(severity: Severity): number {
  return SEVERITY_ORDER[severity] ?? 0;
}

export async function searchNewsRaw(
  params: NewsSearchParams,
  prismaClient: {
    newsArticle: {
      findMany: (args: Prisma.NewsArticleFindManyArgs) => Promise<unknown[]>;
      count: (args: Prisma.NewsArticleCountArgs) => Promise<number>;
    };
  }
) {
  const { searchNews: unifiedSearch } = await import("@/lib/search/fullTextSearch");
  if (params.q?.trim()) {
    return unifiedSearch(params);
  }

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(params.limit ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where = buildNewsWhere(params);
  const orderBy = buildNewsOrderBy(params.sort);

  const [articles, total] = await Promise.all([
    prismaClient.newsArticle.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        categories: { include: { category: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prismaClient.newsArticle.count({ where }),
  ]);

  return { articles, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export const CVE_REGEX = /CVE-\d{4}-\d{4,}/gi;

export function extractCveIds(text: string): string[] {
  const matches = text.match(CVE_REGEX) ?? [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}
