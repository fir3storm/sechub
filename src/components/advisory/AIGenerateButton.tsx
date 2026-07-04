"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import type { FormData } from "@/lib/advisory/template";

export function AIGenerateButton({
  advisoryId,
  formData,
  disabled,
  onGenerated,
}: {
  advisoryId?: string;
  formData: FormData;
  disabled?: boolean;
  onGenerated: (content: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advisories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisoryId, formData }),
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
  );
}
