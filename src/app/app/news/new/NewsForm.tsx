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

export default function NewNewsPage({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    summary: "",
    body: "",
    severity: "medium",
    cveIds: "",
    cvssScore: "",
    sourceUrl: "",
    categoryIds: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cveIds: form.cveIds.split(",").map((s) => s.trim()).filter(Boolean),
        cvssScore: form.cvssScore ? parseFloat(form.cvssScore) : null,
        sourceUrl: form.sourceUrl || null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create article");
      return;
    }

    const article = await res.json();
    router.push(`/app/news/${article.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/app/news">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </Button>

      <h1 className="text-3xl font-bold">Add News Article</h1>

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
            rows={8}
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
        <div className="space-y-2">
          <Label>Source URL</Label>
          <Input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Article"}
        </Button>
      </form>
    </div>
  );
}
