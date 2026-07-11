import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, FileWarning, Clock, BookOpen } from "lucide-react";
import { SeverityBadge, CveBadge } from "@/components/ui/severity-badge";
import { CyberCard } from "@/components/layout/PageHeader";
import { MIN_FULL_ARTICLE_LENGTH, stripHtmlTags } from "@/lib/ingestion/article-content";
import { getReadingStats } from "@/lib/news/article-format";
import { ArticleLead, ArticleReader } from "@/components/news/ArticleReader";
import { CveEnrichmentPanel } from "@/components/news/CveEnrichmentPanel";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const article = await prisma.newsArticle.findUnique({
    where: { id },
    include: {
      categories: { include: { category: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!article) notFound();

  const canEdit = hasMinRole(session!.user.role as Role, Role.Analyst);
  const plainBody = stripHtmlTags(article.body);
  const { words, minutes } = getReadingStats(article.body);
  const isShort = plainBody.length < MIN_FULL_ARTICLE_LENGTH;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <Button variant="ghost" asChild className="-ml-2">
        <Link href="/app/news">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Threat Feed
        </Link>
      </Button>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-sm border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 via-card/90 to-card/80 p-6 sm:p-8">
        <span className="cyber-corner-tl" />
        <span className="cyber-corner-br" />
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden
        />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={article.severity} />
            <span className="rounded-sm border border-cyan-500/30 bg-cyan-950/50 px-2.5 py-0.5 font-mono-cyber text-[10px] uppercase tracking-widest text-cyan-400/90">
              {article.sourceName}
            </span>
            {article.cvssScore != null && (
              <span className="font-mono-cyber text-xs text-amber-400">CVSS {article.cvssScore}</span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold leading-tight tracking-wide text-cyan-50 sm:text-4xl">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 font-mono-cyber text-xs text-muted-foreground">
            <span>Published {format(new Date(article.publishedAt), "PPP")}</span>
            <span className="flex items-center gap-1 text-cyan-500/70">
              <Clock className="h-3 w-3" />
              {minutes} min read
            </span>
            <span className="flex items-center gap-1 text-cyan-500/70">
              <BookOpen className="h-3 w-3" />
              {words.toLocaleString()} words
            </span>
          </div>

          {article.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {article.categories.map(({ category }) => (
                <span
                  key={category.slug}
                  className="rounded-sm border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider text-emerald-400/90"
                >
                  {category.name}
                </span>
              ))}
            </div>
          )}

          {article.cveIds.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {article.cveIds.map((cve) => (
                <CveBadge key={cve} cve={cve} />
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Lead summary */}
      {article.summary && article.summary !== plainBody.slice(0, article.summary.length) && (
        <section aria-label="Article summary">
          <p className="mb-3 font-mono-cyber text-[10px] uppercase tracking-[0.2em] text-cyan-500/70">
            // Intel Brief
          </p>
          <ArticleLead summary={article.summary} />
        </section>
      )}

      {/* Article body */}
      <section aria-label="Full article">
        <p className="mb-4 font-mono-cyber text-[10px] uppercase tracking-[0.2em] text-cyan-500/70">
          // Full Report
        </p>
        <CyberCard className="!p-0 overflow-hidden">
          <div className="border-b border-cyan-500/10 bg-cyan-950/20 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/60">
                Decrypted content stream
              </span>
            </div>
          </div>
          <div className="px-6 py-8 sm:px-8">
            <ArticleReader body={article.body} sourceUrl={article.sourceUrl} />
          </div>
        </CyberCard>

        {isShort && article.sourceUrl && (
          <p className="mt-4 rounded-sm border border-amber-500/30 bg-amber-950/20 px-4 py-3 font-mono-cyber text-xs text-amber-400/90">
            // Limited excerpt — view the original source for the complete article.
          </p>
        )}
      </section>

      {article.cveIds.length > 0 && <CveEnrichmentPanel cveIds={article.cveIds} />}

      {(article.affectedDevices.length > 0 || article.affectedOs.length > 0) && (
        <CyberCard title="Affected Systems">
          <div className="grid gap-4 sm:grid-cols-2">
            {article.affectedDevices.length > 0 && (
              <div className="rounded-sm border border-cyan-500/15 bg-cyan-950/20 p-4">
                <p className="mb-2 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
                  Devices
                </p>
                <ul className="space-y-1 text-sm text-slate-300">
                  {article.affectedDevices.map((d) => (
                    <li key={d} className="flex items-center gap-2">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {article.affectedOs.length > 0 && (
              <div className="rounded-sm border border-cyan-500/15 bg-cyan-950/20 p-4">
                <p className="mb-2 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
                  Operating Systems
                </p>
                <ul className="space-y-1 text-sm text-slate-300">
                  {article.affectedOs.map((os) => (
                    <li key={os} className="flex items-center gap-2">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                      {os}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CyberCard>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-cyan-500/20 pt-6">
        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono-cyber text-sm text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            View original source
          </a>
        )}
        {canEdit && (
          <Button asChild className="ml-auto">
            <Link href={`/app/advisories/new?articles=${article.id}`}>
              <FileWarning className="mr-2 h-4 w-4" />
              Create Advisory
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
