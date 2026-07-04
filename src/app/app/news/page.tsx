import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { searchNews } from "@/lib/search/fullTextSearch";
import { NewsCard } from "@/components/news/NewsCard";
import { NewsFilters } from "@/components/news/NewsFilters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { NewsListClient } from "@/components/news/NewsListClient";
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

  const { articles, total, page, totalPages } = await searchNews({
    ...params,
    page: String(searchParams.page ?? "1"),
    limit: "20",
  });

  return { articles, total, page, totalPages };
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

  const canCreate = hasMinRole(session!.user.role as Role, Role.Analyst);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="TI // Threat Feed"
        title="Intelligence Stream"
        subtitle={`${total} signals detected in current filter scope`}
      >
        {canCreate && (
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
            <NewsFilters options={filterOptions} />
          </Suspense>
        </div>
        <div className="lg:col-span-3 space-y-4">
          <NewsListClient initialArticles={articles} canCreateAdvisory={canCreate} />

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
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
