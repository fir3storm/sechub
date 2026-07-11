"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NewsCard, NewsArticleCardData } from "@/components/news/NewsCard";
import { Button } from "@/components/ui/button";
import { Archive, FileWarning, RefreshCw } from "lucide-react";
import { MAX_LINKED_ARTICLES } from "@/lib/advisory/template";

export function NewsListClient({
  initialArticles,
  canCreateAdvisory,
  canEdit,
}: {
  initialArticles: NewsArticleCardData[];
  canCreateAdvisory: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const createAdvisory = () => {
    const ids = [...selected].slice(0, MAX_LINKED_ARTICLES);
    if (ids.length === 0) return;
    router.push(`/app/advisories/new?articles=${ids.join(",")}`);
  };

  const bulkAction = async (action: "archive" | "enrich") => {
    const ids = [...selected];
    if (ids.length === 0) return;

    setBusy(action);
    try {
      const res = await fetch("/api/news/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const showBulkBar = canEdit && selected.size > 0;

  return (
    <>
      {showBulkBar && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 cyber-panel border-cyan-400/30 p-3 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
          <span className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-400">
            {selected.size} target(s) locked
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => bulkAction("enrich")}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${busy === "enrich" ? "animate-spin" : ""}`} />
              {busy === "enrich" ? "Enriching..." : "Bulk Enrich"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => bulkAction("archive")}
            >
              <Archive className="mr-2 h-4 w-4" />
              {busy === "archive" ? "Archiving..." : "Archive"}
            </Button>
            {canCreateAdvisory && (
              <Button onClick={createAdvisory} size="sm">
                <FileWarning className="mr-2 h-4 w-4" />
                Create Advisory
              </Button>
            )}
          </div>
        </div>
      )}

      {initialArticles.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No articles match your filters.</p>
      ) : (
        initialArticles.map((article) => (
          <NewsCard
            key={article.id}
            article={article}
            selectable={canEdit}
            selected={selected.has(article.id)}
            onSelect={toggleSelect}
            canEdit={canEdit}
          />
        ))
      )}
    </>
  );
}
