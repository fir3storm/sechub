"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Download, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteAdvisoryButton } from "@/components/advisory/DeleteAdvisoryButton";
import { cn } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  draft: "border-amber-500/40 bg-amber-950/30 text-amber-400",
  review: "border-cyan-500/40 bg-cyan-950/30 text-cyan-400",
  published: "border-emerald-500/40 bg-emerald-950/30 text-emerald-400",
};

export interface AdvisoryCardData {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  excerpt: string | null;
  templateName: string | null;
  linkedCount: number;
  hasAiContent: boolean;
  authorName: string;
}

export function AdvisoryCard({
  advisory,
  canEdit,
}: {
  advisory: AdvisoryCardData;
  canEdit: boolean;
}) {
  return (
    <div className="cyber-panel-hover group p-5">
      <span className="cyber-corner-tl" />
      <span className="cyber-corner-br" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/app/advisories/${advisory.id}`}
            className="font-display text-lg font-semibold tracking-wide text-cyan-50 hover:text-cyan-300"
          >
            {advisory.title}
          </Link>
          <p className="mt-1 font-mono-cyber text-xs text-muted-foreground">
            {advisory.authorName} · UPD {format(new Date(advisory.updatedAt), "yyyy-MM-dd")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {advisory.templateName && (
              <span className="rounded-sm border border-cyan-500/20 bg-cyan-950/30 px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
                {advisory.templateName}
              </span>
            )}
            {advisory.linkedCount > 0 && (
              <span className="rounded-sm border border-emerald-500/20 bg-emerald-950/30 px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider text-emerald-400/80">
                {advisory.linkedCount} source{advisory.linkedCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={cn(
              "rounded-sm border px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider",
              statusStyle[advisory.status] ?? statusStyle.draft
            )}
          >
            {advisory.status}
          </span>
          {canEdit && (
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {advisory.hasAiContent && (
                <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                  <a
                    href={`/api/advisories/${advisory.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <DeleteAdvisoryButton
                advisoryId={advisory.id}
                title={advisory.title}
                size="icon"
              />
            </div>
          )}
        </div>
      </div>
      {advisory.excerpt ? (
        <p className="mt-3 line-clamp-2 border-t border-cyan-500/10 pt-3 text-sm text-slate-400">
          {advisory.excerpt}
        </p>
      ) : (
        <p className="mt-3 flex items-center gap-2 border-t border-cyan-500/10 pt-3 font-mono-cyber text-xs text-muted-foreground">
          <FileWarning className="h-3.5 w-3.5" />
          No AI content yet — open to generate
        </p>
      )}
    </div>
  );
}
