"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NewsCard, NewsArticleCardData } from "@/components/news/NewsCard";
import { Button } from "@/components/ui/button";
import { FileWarning } from "lucide-react";

export function NewsListClient({
  initialArticles,
  canCreateAdvisory,
}: {
  initialArticles: NewsArticleCardData[];
  canCreateAdvisory: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const createAdvisory = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    router.push(`/app/advisories/new?articles=${ids.join(",")}`);
  };

  return (
    <>
      {canCreateAdvisory && selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between cyber-panel border-cyan-400/30 p-3 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
          <span className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-400">
            {selected.size} target(s) locked
          </span>
          <Button onClick={createAdvisory} size="sm">
            <FileWarning className="mr-2 h-4 w-4" />
            Create Advisory
          </Button>
        </div>
      )}

      {initialArticles.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No articles match your filters.</p>
      ) : (
        initialArticles.map((article) => (
          <NewsCard
            key={article.id}
            article={article}
            selectable={canCreateAdvisory}
            selected={selected.has(article.id)}
            onSelect={toggleSelect}
          />
        ))
      )}
    </>
  );
}
