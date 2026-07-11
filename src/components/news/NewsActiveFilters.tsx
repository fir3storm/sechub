"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FILTER_LABELS: Record<string, string> = {
  q: "Search",
  category: "Category",
  device: "Device",
  os: "OS",
  cve: "CVE",
  source: "Source",
  short: "Short only",
  severity: "Severity",
  from: "From",
  to: "To",
  cvssMin: "CVSS min",
  cvssMax: "CVSS max",
};

export function NewsActiveFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const chips: { key: string; label: string; value: string }[] = [];

  for (const [key, label] of Object.entries(FILTER_LABELS)) {
    if (key === "category" || key === "severity") {
      const values = searchParams.getAll(key);
      values.forEach((v) => chips.push({ key, label, value: v }));
    } else {
      const v = searchParams.get(key);
      if (!v) continue;
      if (key === "short" && v !== "1" && v !== "true") continue;
      chips.push({ key, label, value: key === "short" ? "Under 400 chars" : v });
    }
  }

  if (chips.length === 0) return null;

  const removeFilter = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "category" || key === "severity") {
      const remaining = params.getAll(key).filter((v) => v !== value);
      params.delete(key);
      remaining.forEach((v) => params.append(key, v));
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/app/news?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/60">
        Active filters
      </span>
      {chips.map((chip, i) => (
        <button
          key={`${chip.key}-${chip.value}-${i}`}
          type="button"
          onClick={() => removeFilter(chip.key, chip.value)}
          className="inline-flex items-center gap-1 rounded-sm border border-cyan-500/25 bg-cyan-950/30 px-2 py-1 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-300/90 transition-colors hover:border-cyan-400/40 hover:bg-cyan-950/50"
        >
          <span className="text-cyan-500/60">{chip.label}:</span>
          <span className="max-w-[12rem] truncate normal-case">{chip.value}</span>
          <X className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 font-mono-cyber text-[10px] uppercase tracking-wider"
        onClick={() => router.push("/app/news")}
      >
        Clear all
      </Button>
    </div>
  );
}
