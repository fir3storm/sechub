import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { searchNews } from "@/lib/search/fullTextSearch";
import { buildSearchSnippet } from "@/lib/search/highlights";
import { stripHtmlTags, MIN_FULL_ARTICLE_LENGTH } from "@/lib/ingestion/article-content";
import { NewsFiltersPanel } from "@/components/news/NewsFiltersPanel";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { NewsListClient } from "@/components/news/NewsListClient";
import { NewsActiveFilters } from "@/components/news/NewsActiveFilters";
import { PageHeader } from "@/components/layout/PageHeader";

async function getFilterOptions() {
  const [categories, articles] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.newsArticle.findMany({
      where: { status: { not: "archived" } },
      select: { affectedDevices: true, affectedOs: true, sourceName: true },
    }),
  ]);

  const devices = [...new Set(articles.flatMap((a) => a.affectedDevices))].sort();
  const osList = [...new Set(articles.flatMap((a) => a.affectedOs))].sort();
  const sources = [...new Set(articles.map((a) => a.sourceName))].sort();

  return {
    categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
    devices,
    osList,
    sources,
  };
}

async function getArticles(searchParams: Record<string, string | string[] | undefined>) {
  const params: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined) params[k] = v;
  }

  const q = typeof params.q === "string" ? params.q : undefined;
  const result = await searchNews({
    ...params,
    page: String(searchParams.page ?? "1"),
    limit: "20",
  });

  const snippets = "snippets" in result ? result.snippets : new Map<string, string>();

  const articles = result.articles.map((article) => {
    const plainLen = stripHtmlTags(article.body).length;
    const dbSnippet = snippets.get(article.id);
    const searchSnippet =
      dbSnippet ||
      (q?.trim() ? buildSearchSnippet(article.title, article.summary, q.trim()) : undefined);

    return {
      id: article.id,
      title: article.title,
      summary: article.summary,
      publishedAt: article.publishedAt,
      severity: article.severity,
      sourceName: article.sourceName,
      cveIds: article.cveIds,
      cvssScore: article.cvssScore,
      categories: article.categories,
      searchSnippet,
      isShort: plainLen < MIN_FULL_ARTICLE_LENGTH,
    };
  });

  return {
    articles,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  };
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = await searchParams;
  const [filterOptions, { articles, total, page, totalPages }] = await Promise.all([
    getFilterOptions(),
    getArticles(params),
  ]);

  const canEdit = hasMinRole(session!.user.role as Role, Role.Analyst);
  const shortFilter =
    params.short === "1" ||
    params.short === "true" ||
    (Array.isArray(params.short) && params.short.some((v) => v === "1" || v === "true"));

  return (
    <div className="space-y-6">
      <PageHeader
        badge="TI // Threat Feed"
        title="Intelligence Stream"
        subtitle={
          shortFilter
            ? `${total} short/stale articles (under 400 chars)`
            : `${total} signals detected in current filter scope`
        }
      >
        {canEdit && (
          <Button asChild>
            <Link href="/app/news/new">
              <Plus className="mr-2 h-4 w-4" />
              Ingest Manual
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Suspense fallback={<div>Loading filters...</div>}>
            <NewsFiltersPanel options={filterOptions} />
          </Suspense>
        </div>
        <div className="space-y-4 lg:col-span-3">
          <Suspense fallback={null}>
            <NewsActiveFilters />
          </Suspense>
          <NewsListClient
            initialArticles={articles}
            canCreateAdvisory={canEdit}
            canEdit={canEdit}
          />

          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link
                    href={{
                      pathname: "/app/news",
                      query: { ...params, page: String(p) },
                    }}
                  >
                    {p}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
