"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

export function EditNewsForm({
  articleId,
  categories,
  initial,
}: {
  articleId: string;
  categories: { id: string; name: string }[];
  initial: {
    title: string;
    summary: string;
    body: string;
    severity: string;
    cveIds: string[];
    cvssScore: number | null;
    categoryIds: string[];
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: initial.title,
    summary: initial.summary,
    body: initial.body,
    severity: initial.severity,
    cveIds: initial.cveIds.join(", "),
    cvssScore: initial.cvssScore != null ? String(initial.cvssScore) : "",
    categoryIds: initial.categoryIds,
  });

  const toggleCategory = (id: string) => {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/news/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        summary: form.summary,
        body: form.body,
        severity: form.severity,
        cveIds: form.cveIds.split(",").map((s) => s.trim()).filter(Boolean),
        cvssScore: form.cvssScore ? parseFloat(form.cvssScore) : null,
        categoryIds: form.categoryIds,
        status: "curated",
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update article");
      return;
    }

    router.push(`/app/news/${articleId}`);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" asChild>
        <Link href={`/app/news/${articleId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to article
        </Link>
      </Button>

      <h1 className="font-display text-2xl font-bold text-cyan-50">Edit Threat Feed Article</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Summary</Label>
          <Textarea
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={12}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["critical", "high", "medium", "low", "info"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CVSS Score</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={form.cvssScore}
              onChange={(e) => setForm({ ...form, cvssScore: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>CVE IDs (comma-separated)</Label>
          <Input
            value={form.cveIds}
            onChange={(e) => setForm({ ...form, cveIds: e.target.value })}
            placeholder="CVE-2024-1234, CVE-2024-5678"
          />
        </div>
        {categories.length > 0 && (
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`rounded-sm border px-2 py-1 text-xs font-mono-cyber uppercase tracking-wider transition-colors ${
                    form.categoryIds.includes(cat.id)
                      ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-400"
                      : "border-cyan-500/20 text-slate-400 hover:border-cyan-500/40"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
