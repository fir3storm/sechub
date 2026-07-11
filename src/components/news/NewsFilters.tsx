"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

interface FilterOptions {
  categories: { slug: string; name: string }[];
  devices: string[];
  osList: string[];
  sources: string[];
}

export function NewsFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const get = (key: string) => searchParams.get(key) ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (value === null || value === "") continue;
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else {
          params.set(key, value);
        }
      }
      params.delete("page");
      startTransition(() => router.push(`/app/news?${params.toString()}`));
    },
    [router, searchParams]
  );

  const selectedCategories = searchParams.getAll("category");
  const cvssMin = parseFloat(get("cvssMin") || "0");
  const cvssMax = parseFloat(get("cvssMax") || "10");

  return (
    <div className="cyber-panel p-5">
      <span className="cyber-corner-tl" />
      <span className="cyber-corner-br" />
      <div className="mb-4 flex items-center gap-2 border-b border-cyan-500/10 pb-3">
        <Filter className="h-4 w-4 text-cyan-400" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-100/90">
          Query Filters
        </h3>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Search</Label>
          <Input
            defaultValue={get("q")}
            placeholder='Full-text: ransomware, "zero day", -phishing'
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParams({ q: (e.target as HTMLInputElement).value || null });
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>CVE ID</Label>
          <Input
            defaultValue={get("cve")}
            placeholder="CVE-2024-1234"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParams({ cve: (e.target as HTMLInputElement).value || null });
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>From</Label>
            <Input
              type="date"
              defaultValue={get("from")}
              onChange={(e) => updateParams({ from: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="date"
              defaultValue={get("to")}
              onChange={(e) => updateParams({ to: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sort</Label>
          <Select value={get("sort") || (get("q") ? "relevance" : "newest")} onValueChange={(v) => updateParams({ sort: v === (get("q") ? "relevance" : "newest") ? null : v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="severity">Severity</SelectItem>
              <SelectItem value="cvss">CVSS Score</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={get("short") === "1" || get("short") === "true"}
            onCheckedChange={(checked) =>
              updateParams({ short: checked ? "1" : null })
            }
          />
          <span>
            Short / stale only
            <span className="ml-1 block text-xs text-muted-foreground">Body under 400 chars</span>
          </span>
        </label>

        <div className="space-y-2">
          <Label>Source</Label>
          <Select value={get("source") || "all"} onValueChange={(v) => updateParams({ source: v === "all" ? null : v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {options.sources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>CVSS Range: {cvssMin} – {cvssMax}</Label>
          <Slider
            min={0}
            max={10}
            step={0.5}
            value={[cvssMin, cvssMax]}
            onValueCommit={([min, max]) =>
              updateParams({
                cvssMin: min > 0 ? String(min) : null,
                cvssMax: max < 10 ? String(max) : null,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Categories</Label>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {options.categories.map((cat) => (
              <label key={cat.slug} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedCategories.includes(cat.slug)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedCategories, cat.slug]
                      : selectedCategories.filter((c) => c !== cat.slug);
                    updateParams({ category: next.length ? next : null });
                  }}
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        {options.devices.length > 0 && (
          <div className="space-y-2">
            <Label>Device</Label>
            <Select
              value={get("device") || "all"}
              onValueChange={(v) => updateParams({ device: v === "all" ? null : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All devices</SelectItem>
                {options.devices.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {options.osList.length > 0 && (
          <div className="space-y-2">
            <Label>OS</Label>
            <Select
              value={get("os") || "all"}
              onValueChange={(v) => updateParams({ os: v === "all" ? null : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All OS</SelectItem>
                {options.osList.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full"
          disabled={isPending}
          onClick={() => router.push("/app/news")}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
