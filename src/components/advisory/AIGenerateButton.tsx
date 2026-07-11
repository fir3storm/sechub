"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import type { AISummaryMode, FormData } from "@/lib/advisory/template";
import { AI_SUMMARY_MODE_LABELS } from "@/lib/advisory/template";

export function AIGenerateButton({
  advisoryId,
  linkedArticleIds,
  formData,
  summaryMode,
  onSummaryModeChange,
  disabled,
  onGenerated,
}: {
  advisoryId?: string;
  linkedArticleIds?: string[];
  formData: FormData;
  summaryMode?: AISummaryMode;
  onSummaryModeChange?: (mode: AISummaryMode) => void;
  disabled?: boolean;
  onGenerated: (content: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AISummaryMode>(summaryMode ?? "technical");

  const handleModeChange = (v: AISummaryMode) => {
    setMode(v);
    onSummaryModeChange?.(v);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advisories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advisoryId,
          linkedArticleIds,
          formData,
          summaryMode: mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      onGenerated(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Label
          htmlFor="ai-summary-mode"
          className="shrink-0 text-xs text-muted-foreground whitespace-nowrap"
        >
          AI Summary Mode
        </Label>
        <Select value={mode} onValueChange={(v) => handleModeChange(v as AISummaryMode)}>
          <SelectTrigger id="ai-summary-mode" className="h-10 w-[200px] sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(AI_SUMMARY_MODE_LABELS) as AISummaryMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {AI_SUMMARY_MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || loading}
          className="h-10 bg-violet-600 hover:bg-violet-700"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate with AI
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
