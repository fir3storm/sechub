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
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">AI Summary Mode</Label>
        <Select value={mode} onValueChange={(v) => handleModeChange(v as AISummaryMode)}>
          <SelectTrigger className="w-[220px]">
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
      </div>
      <div className="space-y-2">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || loading}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate with AI
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
