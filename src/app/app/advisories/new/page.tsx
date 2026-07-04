"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DesignerForm } from "@/components/advisory/DesignerForm";
import { AIGenerateButton } from "@/components/advisory/AIGenerateButton";
import { MarkdownPreview } from "@/components/advisory/MarkdownPreview";
import {
  AdvisoryTemplateSchema,
  FormData,
  buildDefaultFormData,
  prefillFromArticles,
} from "@/lib/advisory/template";
import { ArrowLeft, Download } from "lucide-react";

export default function NewAdvisoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const articleIds = (searchParams.get("articles") ?? "").split(",").filter(Boolean);

  const [title, setTitle] = useState("Security Advisory");
  const [schema, setSchema] = useState<AdvisoryTemplateSchema | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [aiContent, setAiContent] = useState("");
  const [advisoryId, setAdvisoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const templatesRes = await fetch("/api/templates");
      const templates = await templatesRes.json();
      const tmpl = templates.find((t: { isDefault: boolean }) => t.isDefault) ?? templates[0];
      if (tmpl) {
        setSchema(tmpl.schema as AdvisoryTemplateSchema);
        setTemplateId(tmpl.id);
        let data = buildDefaultFormData(tmpl.schema as AdvisoryTemplateSchema);

        if (articleIds.length > 0) {
          const articles = await Promise.all(
            articleIds.map((id) => fetch(`/api/news/${id}`).then((r) => r.json()))
          );
          data = prefillFromArticles(data, articles);
          if (articles[0]?.title) {
            setTitle(`Advisory: ${articles[0].title.slice(0, 80)}`);
          }
        }
        setFormData(data);
      }
    }
    load();
  }, [articleIds.join(",")]);

  const save = async (status: "draft" | "published") => {
    setSaving(true);
    const payload = {
      title,
      templateId,
      linkedArticleIds: articleIds,
      formData,
      aiGeneratedContent: aiContent || null,
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

      <div className="space-y-2">
        <Label>Advisory Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {articleIds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Linked to {articleIds.length} news article(s)
        </p>
      )}

      <DesignerForm schema={schema} formData={formData} onChange={setFormData} />

      <div className="flex flex-wrap gap-3 border-t pt-6">
        <AIGenerateButton
          advisoryId={advisoryId ?? undefined}
          formData={formData}
          onGenerated={setAiContent}
        />
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
