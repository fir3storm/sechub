import { Prisma, Severity } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getDatabaseSchema } from "@/lib/db-schema";
import {
  buildNewsOrderBy,
  buildNewsWhere,
  type NewsSearchParams,
} from "@/lib/search/buildQuery";

const CVE_PATTERN = /^CVE-\d{4}-\d+$/i;

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function buildFtsConditions(params: NewsSearchParams): Prisma.Sql[] {
  const schema = getDatabaseSchema();
  const conditions: Prisma.Sql[] = [Prisma.sql`na.status != 'archived'`];

  const q = params.q?.trim();
  if (q) {
    if (CVE_PATTERN.test(q)) {
      const cve = q.toUpperCase();
      conditions.push(
        Prisma.sql`(
          na.search_vector @@ websearch_to_tsquery('english', ${q})
          OR na.search_vector @@ plainto_tsquery('english', ${q})
          OR ${cve} = ANY(na."cveIds")
        )`
      );
    } else {
      conditions.push(
        Prisma.sql`(
          na.search_vector @@ websearch_to_tsquery('english', ${q})
          OR na.search_vector @@ plainto_tsquery('english', ${q})
        )`
      );
    }
  }

  const categories = toArray(params.category);
  if (categories.length > 0) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM ${Prisma.raw(`"${schema}"."NewsArticleCategory"`)} nac
      INNER JOIN ${Prisma.raw(`"${schema}"."Category"`)} c ON c.id = nac."categoryId"
      WHERE nac."articleId" = na.id AND c.slug IN (${Prisma.join(categories)})
    )`);
  }

  const devices = toArray(params.device);
  if (devices.length > 0) {
    conditions.push(
      Prisma.sql`na."affectedDevices" && ARRAY[${Prisma.join(devices)}]::text[]`
    );
  }

  const osList = toArray(params.os);
  if (osList.length > 0) {
    conditions.push(
      Prisma.sql`na."affectedOs" && ARRAY[${Prisma.join(osList)}]::text[]`
    );
  }

  if (params.cve) {
    const cve = String(params.cve).toUpperCase();
    if (CVE_PATTERN.test(cve)) {
      conditions.push(Prisma.sql`${cve} = ANY(na."cveIds")`);
    } else {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM unnest(na."cveIds") AS c(id)
          WHERE c.id ILIKE ${`${cve}%`}
        )`
      );
    }
  }

  if (params.from) {
    conditions.push(Prisma.sql`na."publishedAt" >= ${new Date(params.from)}`);
  }
  if (params.to) {
    conditions.push(Prisma.sql`na."publishedAt" <= ${new Date(params.to)}`);
  }

  if (params.cvssMin) {
    conditions.push(Prisma.sql`na."cvssScore" >= ${parseFloat(params.cvssMin)}`);
  }
  if (params.cvssMax) {
    conditions.push(Prisma.sql`na."cvssScore" <= ${parseFloat(params.cvssMax)}`);
  }

  const severities = toArray(params.severity) as Severity[];
  if (severities.length > 0) {
    conditions.push(Prisma.sql`na.severity::text IN (${Prisma.join(severities)})`);
  }

  if (params.source) {
    conditions.push(Prisma.sql`lower(na."sourceName") = lower(${params.source})`);
  }

  return conditions;
}

function buildFtsOrderBy(params: NewsSearchParams): Prisma.Sql {
  const q = params.q?.trim();

  switch (params.sort) {
    case "severity":
      return Prisma.sql`CASE na.severity
        WHEN 'critical' THEN 5
        WHEN 'high' THEN 4
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 2
        ELSE 1
      END DESC, na."publishedAt" DESC`;
    case "cvss":
      return Prisma.sql`na."cvssScore" DESC NULLS LAST, na."publishedAt" DESC`;
    case "newest":
      return Prisma.sql`na."publishedAt" DESC`;
    default:
      if (q) {
        return Prisma.sql`ts_rank_cd(na.search_vector, websearch_to_tsquery('english', ${q})) DESC, na."publishedAt" DESC`;
      }
      return Prisma.sql`na."publishedAt" DESC`;
  }
}

const articleInclude = {
  categories: { include: { category: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.NewsArticleInclude;

async function searchNewsWithFullText(params: NewsSearchParams) {
  const schema = getDatabaseSchema();
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(params.limit ?? "20", 10)));
  const skip = (page - 1) * limit;
  const whereClause = Prisma.join(buildFtsConditions(params), " AND ");
  const orderClause = buildFtsOrderBy(params);

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT na.id
      FROM ${Prisma.raw(`"${schema}"."NewsArticle"`)} na
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ${limit} OFFSET ${skip}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM ${Prisma.raw(`"${schema}"."NewsArticle"`)} na
      WHERE ${whereClause}
    `,
  ]);

  const ids = idRows.map((row) => row.id);
  const total = Number(countRows[0]?.count ?? 0);

  if (ids.length === 0) {
    return { articles: [], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const articles = await prisma.newsArticle.findMany({
    where: { id: { in: ids } },
    include: articleInclude,
  });

  const order = new Map(ids.map((id, index) => [id, index]));
  articles.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { articles, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function searchNewsWithPrisma(params: NewsSearchParams) {
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(params.limit ?? "20", 10)));
  const skip = (page - 1) * limit;

  let where = buildNewsWhere(params);

  if (params.cve) {
    const cve = String(params.cve).toUpperCase();
    if (CVE_PATTERN.test(cve)) {
      where = { ...where, cveIds: { has: cve } };
    } else {
      const all = await prisma.newsArticle.findMany({
        where: buildNewsWhere({ ...params, cve: undefined }),
        select: { id: true, cveIds: true },
      });
      const ids = all
        .filter((article) => article.cveIds.some((id) => id.startsWith(cve)))
        .map((article) => article.id);
      where = { ...where, id: { in: ids.length ? ids : ["__none__"] } };
    }
  }

  const [articles, total] = await Promise.all([
    prisma.newsArticle.findMany({
      where,
      orderBy: buildNewsOrderBy(params.sort),
      skip,
      take: limit,
      include: articleInclude,
    }),
    prisma.newsArticle.count({ where }),
  ]);

  return { articles, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function searchNews(params: NewsSearchParams) {
  if (params.q?.trim()) {
    return searchNewsWithFullText(params);
  }
  return searchNewsWithPrisma(params);
}
