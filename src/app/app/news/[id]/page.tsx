import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, FileWarning } from "lucide-react";
import { SeverityBadge, CveBadge } from "@/components/ui/severity-badge";
import { CyberCard } from "@/components/layout/PageHeader";
import { MIN_FULL_ARTICLE_LENGTH } from "@/lib/ingestion/article-content";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const bodyText = article.body.includes("<") ? stripHtml(article.body) : article.body;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <Button variant="ghost" asChild>
        <Link href="/app/news">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Threat Feed
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={article.severity} />
          <span className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/70">
            {article.sourceName}
          </span>
          {article.cvssScore != null && (
            <span className="font-mono-cyber text-xs text-amber-400">CVSS {article.cvssScore}</span>
          )}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-wide text-cyan-50">
          {article.title}
        </h1>
        <p className="font-mono-cyber text-sm text-muted-foreground">
          Published {format(new Date(article.publishedAt), "PPP")}
        </p>
      </div>

      {article.cveIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {article.cveIds.map((cve) => (
            <CveBadge key={cve} cve={cve} />
          ))}
        </div>
      )}

      <CyberCard title="Summary">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {article.summary}
        </p>
      </CyberCard>

      <CyberCard title="Full Article">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {bodyText}
        </div>
        {bodyText.length < MIN_FULL_ARTICLE_LENGTH && article.sourceUrl && (
          <p className="mt-4 font-mono-cyber text-xs text-amber-400/80">
            // RSS feed provided a short excerpt only — view the original source for the full article.
          </p>
        )}
      </CyberCard>

      {(article.affectedDevices.length > 0 || article.affectedOs.length > 0) && (
        <CyberCard title="Affected Systems">
          <div className="space-y-3 text-sm">
            {article.affectedDevices.length > 0 && (
              <div>
                <p className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/70">
                  Devices
                </p>
                <p className="text-slate-300">{article.affectedDevices.join(", ")}</p>
              </div>
            )}
            {article.affectedOs.length > 0 && (
              <div>
                <p className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/70">
                  Operating Systems
                </p>
                <p className="text-slate-300">{article.affectedOs.join(", ")}</p>
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
            className="inline-flex items-center gap-1.5 font-mono-cyber text-sm text-cyan-400 hover:underline"
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
