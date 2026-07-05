"use client";

import { format } from "date-fns";
import Link from "next/link";
import { Severity } from "@prisma/client";
import { Checkbox } from "@/components/ui/checkbox";
import { SeverityBadge, CveBadge } from "@/components/ui/severity-badge";
import { cn } from "@/lib/utils";

export interface NewsArticleCardData {
  id: string;
  title: string;
  summary: string;
  publishedAt: Date | string;
  severity: Severity;
  sourceName: string;
  cveIds: string[];
  cvssScore: number | null;
  categories?: { category: { name: string; slug: string } }[];
}

export function NewsCard({
  article,
  selectable,
  selected,
  onSelect,
}: {
  article: NewsArticleCardData;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "cyber-panel-hover group p-5",
        selected && "border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.15)]"
      )}
    >
      <span className="cyber-corner-tl" />
      <span className="cyber-corner-br" />

      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={(c) => onSelect?.(article.id, !!c)}
            className="mt-1 border-cyan-500/40 data-[state=checked]:bg-cyan-500 data-[state=checked]:text-black"
          />
        )}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={article.severity} />
            {article.cvssScore != null && (
              <span className="font-mono-cyber text-xs text-amber-400/80">
                CVSS {article.cvssScore.toFixed(1)}
              </span>
            )}
            <span className="rounded-sm border border-cyan-500/20 bg-cyan-950/30 px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
              {article.sourceName}
            </span>
          </div>

          <h3 className="font-display text-base font-semibold leading-snug tracking-wide text-cyan-50 sm:text-lg">
            <Link
              href={`/app/news/${article.id}`}
              className="transition-colors hover:text-cyan-300 hover:underline decoration-cyan-500/40 underline-offset-4"
            >
              {article.title}
            </Link>
          </h3>

          <p className="line-clamp-2 text-sm text-slate-400">{article.summary}</p>

          <div className="flex flex-wrap items-center gap-2 border-t border-cyan-500/10 pt-3">
            <span className="font-mono-cyber text-[10px] text-muted-foreground">
              {format(new Date(article.publishedAt), "yyyy-MM-dd HH:mm")}
            </span>
            {article.cveIds.slice(0, 3).map((cve) => (
              <CveBadge key={cve} cve={cve} />
            ))}
            {article.categories?.map((c) => (
              <span
                key={c.category.slug}
                className="rounded-sm border border-emerald-500/20 bg-emerald-950/30 px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider text-emerald-400/80"
              >
                {c.category.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
