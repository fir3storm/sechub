"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Revision {
  version: number;
  changeType: string;
  summaryMode: string | null;
  createdAt: string;
  createdBy: { name: string | null; email: string };
}

interface CompareResult {
  from: { version: number; aiGeneratedContent: string | null };
  to: { version: number; aiGeneratedContent: string | null };
  diff: { type: string; line: string }[];
}

export function VersionHistoryPanel({
  advisoryId,
  onRestore,
}: {
  advisoryId: string;
  onRestore?: (content: string) => void;
}) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [compareFrom, setCompareFrom] = useState<string>("");
  const [compareTo, setCompareTo] = useState<string>("");
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    fetch(`/api/advisories/${advisoryId}/revisions`)
      .then((r) => r.json())
      .then(setRevisions)
      .catch(() => setRevisions([]));
  };

  useEffect(() => {
    if (open) load();
  }, [advisoryId, open]);

  const runCompare = async () => {
    if (!compareFrom || !compareTo) return;
    const res = await fetch(
      `/api/advisories/${advisoryId}/revisions/compare?from=${compareFrom}&to=${compareTo}`
    );
    if (res.ok) setCompare(await res.json());
  };

  const restore = async (version: number) => {
    const res = await fetch(`/api/advisories/${advisoryId}/revisions/${version}/restore`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      onRestore?.(data.aiGeneratedContent ?? "");
      load();
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <History className="mr-2 h-4 w-4" />
        Version History
      </Button>
    );
  }

  return (
    <div className="cyber-panel space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-100">
          Version History
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No revisions saved yet.</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {revisions.map((r) => (
            <li
              key={r.version}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-cyan-500/10 px-3 py-2"
            >
              <div>
                <span className="font-mono-cyber text-cyan-400">v{r.version}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-xs uppercase text-muted-foreground">{r.changeType.replace("_", " ")}</span>
                {r.summaryMode && (
                  <span className="ml-2 text-xs text-violet-400">{r.summaryMode}</span>
                )}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(r.createdAt), "PPp")} · {r.createdBy.name || r.createdBy.email}
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => restore(r.version)}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}

      {revisions.length >= 2 && (
        <div className="space-y-3 border-t border-cyan-500/10 pt-4">
          <p className="font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
            Compare versions
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={compareFrom} onValueChange={setCompareFrom}>
              <SelectTrigger className="w-24"><SelectValue placeholder="From" /></SelectTrigger>
              <SelectContent>
                {revisions.map((r) => (
                  <SelectItem key={r.version} value={String(r.version)}>v{r.version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">→</span>
            <Select value={compareTo} onValueChange={setCompareTo}>
              <SelectTrigger className="w-24"><SelectValue placeholder="To" /></SelectTrigger>
              <SelectContent>
                {revisions.map((r) => (
                  <SelectItem key={r.version} value={String(r.version)}>v{r.version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" onClick={runCompare}>
              Diff
            </Button>
          </div>

          {compare && (
            <pre className="max-h-64 overflow-auto rounded-sm border border-cyan-500/15 bg-black/40 p-3 font-mono text-xs">
              {compare.diff.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    line.type === "add" && "text-emerald-400",
                    line.type === "remove" && "text-red-400/90",
                    line.type === "same" && "text-slate-500"
                  )}
                >
                  {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                  {line.line}
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
