"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DesignerForm } from "@/components/advisory/DesignerForm";
import { AIGenerateButton } from "@/components/advisory/AIGenerateButton";
import { MarkdownPreview } from "@/components/advisory/MarkdownPreview";
import {
  AdvisoryTemplateSchema,
  AISummaryMode,
  FormData,
  MAX_LINKED_ARTICLES,
  THREAT_TYPE_LABELS,
  ThreatType,
  buildDefaultFormData,
  inferThreatTypeFromArticles,
  prefillFromArticles,
} from "@/lib/advisory/template";
import { ArrowLeft, Download } from "lucide-react";

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  threatType: string | null;
  schema: AdvisoryTemplateSchema;
  isDefault: boolean;
}

export default function NewAdvisoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawArticleIds = (searchParams.get("articles") ?? "").split(",").filter(Boolean);
  const articleIds = rawArticleIds.slice(0, MAX_LINKED_ARTICLES);

  const [title, setTitle] = useState("Security Advisory");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [schema, setSchema] = useState<AdvisoryTemplateSchema | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [aiContent, setAiContent] = useState("");
  const [summaryMode, setSummaryMode] = useState<AISummaryMode>("technical");
  const [advisoryId, setAdvisoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkedTitles, setLinkedTitles] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const templatesRes = await fetch("/api/templates");
      const tmplList: TemplateOption[] = await templatesRes.json();
      setTemplates(tmplList);

      let selected = tmplList.find((t) => t.isDefault) ?? tmplList[0];
      let data = buildDefaultFormData(selected.schema);

      if (articleIds.length > 0) {
        const articles = await Promise.all(
          articleIds.map((id) => fetch(`/api/news/${id}`).then((r) => r.json()))
        );
        setLinkedTitles(articles.map((a: { title: string }) => a.title));

        const inferred = inferThreatTypeFromArticles(articles);
        const matched =
          tmplList.find((t) => t.threatType === inferred) ??
          tmplList.find((t) => t.isDefault) ??
          selected;
        selected = matched;
        data = buildDefaultFormData(selected.schema);
        data = prefillFromArticles(data, articles, (selected.threatType as ThreatType) ?? "general");

        if (articles.length === 1 && articles[0]?.title) {
          setTitle(`Advisory: ${articles[0].title.slice(0, 80)}`);
        } else if (articles.length > 1) {
          setTitle(`Merged Bulletin (${articles.length} articles)`);
        }
      }

      setSchema(selected.schema);
      setTemplateId(selected.id);
      setFormData(data);
    }
    load();
  }, [articleIds.join(",")]);

  const switchTemplate = (id: string) => {
    const tmpl = templates.find((t) => t.id === id);
    if (!tmpl) return;
    setTemplateId(id);
    setSchema(tmpl.schema);
    setFormData((prev) => {
      const fresh = buildDefaultFormData(tmpl.schema);
      for (const [k, v] of Object.entries(prev)) {
        if (k in fresh) fresh[k] = v;
      }
      return fresh;
    });
  };

  const save = async (status: "draft" | "published") => {
    setSaving(true);
    const payload = {
      title,
      templateId,
      linkedArticleIds: articleIds,
      formData,
      aiGeneratedContent: aiContent || null,
      aiSummaryMode: summaryMode,
      status,
    };

    const url = advisoryId ? `/api/advisories/${advisoryId}` : "/api/advisories";
    const method = advisoryId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      const adv = await res.json();
      setAdvisoryId(adv.id);
      if (status === "published") router.push(`/app/advisories/${adv.id}`);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([aiContent || JSON.stringify(formData, null, 2)], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!advisoryId) return;
    window.open(`/api/advisories/${advisoryId}/pdf`, "_blank", "noopener,noreferrer");
  };

  if (!schema) return <p>Loading template...</p>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/app/advisories">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </Button>

      <h1 className="text-3xl font-bold">Create Advisory</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Advisory Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Threat Type Template</Label>
          <Select value={templateId ?? ""} onValueChange={switchTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.threatType && t.threatType !== "general"
                    ? ` (${THREAT_TYPE_LABELS[t.threatType as ThreatType] ?? t.threatType})`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {articleIds.length > 0 && (
        <div className="rounded-sm border border-cyan-500/20 bg-cyan-950/20 p-4">
          <p className="font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
            Merged bulletin · {articleIds.length} article{articleIds.length > 1 ? "s" : ""}
            {rawArticleIds.length > MAX_LINKED_ARTICLES && (
              <span className="ml-2 text-amber-400">(max {MAX_LINKED_ARTICLES} applied)</span>
            )}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {linkedTitles.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-cyan-500">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DesignerForm schema={schema} formData={formData} onChange={setFormData} />

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <AIGenerateButton
          advisoryId={advisoryId ?? undefined}
          linkedArticleIds={articleIds}
          formData={formData}
          summaryMode={summaryMode}
          onSummaryModeChange={setSummaryMode}
          onGenerated={setAiContent}
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="outline" onClick={() => save("draft")} disabled={saving}>
            Save Draft
          </Button>
          <Button onClick={() => save("published")} disabled={saving}>
            Publish
          </Button>
          {aiContent && (
            <Button variant="outline" onClick={downloadMarkdown}>
              <Download className="mr-2 h-4 w-4" />
              Export Markdown
            </Button>
          )}
          {aiContent && advisoryId && (
            <Button variant="outline" onClick={downloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {aiContent && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">AI Preview</h2>
          <MarkdownPreview content={aiContent} />
        </div>
      )}
    </div>
  );
}
