"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ArticleLead, ArticleReader } from "@/components/news/ArticleReader";
import { CyberCard } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(body: string): TocItem[] {
  if (!body.includes("<")) return [];
  if (typeof DOMParser === "undefined") return [];

  const doc = new DOMParser().parseFromString(body, "text/html");
  const items: TocItem[] = [];
  doc.querySelectorAll("h2, h3").forEach((el, i) => {
    const text = (el.textContent || "").trim();
    if (!text) return;
    items.push({
      id: `sec-${i}-${text.slice(0, 20).replace(/\W+/g, "-").toLowerCase()}`,
      text,
      level: el.tagName === "H2" ? 2 : 3,
    });
  });
  return items;
}

export function ArticleDetailClient({
  body,
  sourceUrl,
  summary,
  showLead,
}: {
  body: string;
  sourceUrl?: string | null;
  summary: string;
  showLead: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [briefOpen, setBriefOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const toc = useMemo(() => extractToc(body), [body]);
  const showToc = toc.length >= 3;

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);

      if (toc.length === 0) return;
      for (let i = toc.length - 1; i >= 0; i--) {
        const el = document.getElementById(toc[i].id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(toc[i].id);
          return;
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);

  return (
    <>
      <div className="fixed left-0 top-0 z-50 h-0.5 w-full bg-cyan-950/80">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {showLead && (
        <section aria-label="Article summary" className="lg:hidden">
          <button
            type="button"
            onClick={() => setBriefOpen((o) => !o)}
            className="mb-3 flex w-full items-center justify-between font-mono-cyber text-[10px] uppercase tracking-[0.2em] text-cyan-500/70"
          >
            // Intel Brief
            {briefOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {briefOpen && <ArticleLead summary={summary} />}
        </section>
      )}

      {showLead && (
        <section aria-label="Article summary" className="hidden lg:block">
          <p className="mb-3 font-mono-cyber text-[10px] uppercase tracking-[0.2em] text-cyan-500/70">
            // Intel Brief
          </p>
          <ArticleLead summary={summary} />
        </section>
      )}

      <section aria-label="Full article" className="relative">
        <p className="mb-4 font-mono-cyber text-[10px] uppercase tracking-[0.2em] text-cyan-500/70">
          // Full Report
        </p>

        <div className={cn("grid gap-6", showToc && "xl:grid-cols-[1fr_14rem]")}>
          <CyberCard className="!p-0 overflow-hidden">
            <div className="border-b border-cyan-500/10 bg-cyan-950/20 px-4 py-2 sm:px-6 sm:py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/60">
                  Decrypted content stream
                </span>
              </div>
            </div>
            <div className="px-4 py-6 sm:px-8 sm:py-8 article-mobile">
              <ArticleReader body={body} sourceUrl={sourceUrl} headingIds={toc} />
            </div>
          </CyberCard>

          {showToc && (
            <nav
              aria-label="Table of contents"
              className="hidden xl:block sticky top-20 max-h-[70vh] overflow-y-auto rounded-sm border border-cyan-500/15 bg-cyan-950/30 p-3 text-xs"
            >
              <p className="mb-2 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/60">
                Contents
              </p>
              <ul className="space-y-1">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={cn(
                        "block py-0.5 text-slate-400 transition-colors hover:text-cyan-300",
                        item.level === 3 && "pl-3",
                        activeSection === item.id && "text-cyan-400"
                      )}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
