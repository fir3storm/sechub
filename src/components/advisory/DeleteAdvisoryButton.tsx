"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DeleteAdvisoryButton({
  advisoryId,
  title,
  redirectTo = "/app/advisories",
  className,
  size = "sm",
}: {
  advisoryId: string;
  title: string;
  redirectTo?: string;
  className?: string;
  size?: "sm" | "default" | "icon";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const ok = window.confirm(
      `Delete "${title}"?\n\nThis permanently removes the advisory and all version history.`
    );
    if (!ok) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advisories/${advisoryId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setLoading(false);
    }
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size={size === "icon" ? "icon" : size}
        disabled={loading}
        onClick={handleDelete}
        className="border-red-500/30 text-red-400/90 hover:border-red-500/50 hover:bg-red-950/30 hover:text-red-300"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Trash2 className={size === "icon" ? "h-4 w-4" : "mr-2 h-4 w-4"} />
            {size !== "icon" && "Delete"}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
