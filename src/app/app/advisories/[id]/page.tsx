"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DesignerForm } from "@/components/advisory/DesignerForm";
import { AIGenerateButton } from "@/components/advisory/AIGenerateButton";
import { AdvisoryPreview } from "@/components/advisory/AdvisoryPreview";
import { VersionHistoryPanel } from "@/components/advisory/VersionHistoryPanel";
import { DeleteAdvisoryButton } from "@/components/advisory/DeleteAdvisoryButton";
import { AdvisoryTemplateSchema, AISummaryMode, FormData } from "@/lib/advisory/template";
import { ArrowLeft, ChevronDown, ChevronUp, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  draft: "border-amber-500/40 bg-amber-950/30 text-amber-400",
  review: "border-cyan-500/40 bg-cyan-950/30 text-cyan-400",
  published: "border-emerald-500/40 bg-emerald-950/30 text-emerald-400",
};

export default function AdvisoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [advisory, setAdvisory] = useState<{
    id: string;
    title: string;
    status: string;
    formData: FormData;
    aiGeneratedContent: string | null;
    aiSummaryMode: string | null;
    linkedArticleIds: string[];
    templateId: string | null;
    updatedAt: string;
    template: { schema: AdvisoryTemplateSchema; name: string } | null;
  } | null>(null);
  const [linkedTitles, setLinkedTitles] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({});
  const [title, setTitle] = useState("");
  const [aiContent, setAiContent] = useState("");
  const [summaryMode, setSummaryMode] = useState<AISummaryMode>("technical");
  const [formOpen, setFormOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/advisories/${id}`)
      .then((r) => r.json())
      .then(async (data) => {
        setAdvisory(data);
        setTitle(data.title);
        setFormData(data.formData as FormData);
        setAiContent(data.aiGeneratedContent ?? "");
        setSummaryMode((data.aiSummaryMode as AISummaryMode) ?? "technical");
        setFormOpen(!data.aiGeneratedContent);

        if (data.linkedArticleIds?.length) {
          const articles = await Promise.all(
            data.linkedArticleIds.map((aid: string) =>
              fetch(`/api/news/${aid}`).then((r) => r.json())
            )
          );
          setLinkedTitles(articles.map((a: { title: string }) => a.title));
        }
      });
  }, [id]);

  const save = async (status?: string) => {
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch(`/api/advisories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        formData,
        aiGeneratedContent: aiContent,
        aiSummaryMode: summaryMode,
        status: status ?? advisory?.status,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setAdvisory((a) => (a ? { ...a, status: updated.status, title: updated.title } : a));
      setSaveMsg(status === "published" ? "Published successfully" : "Changes saved");
      if (status === "published") router.refresh();
    } else {
      setSaveMsg("Save failed");
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([aiContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    window.open(`/api/advisories/${id}/pdf`, "_blank", "noopener,noreferrer");
  };

  if (!advisory) {
    return (
      <div className="cyber-panel animate-pulse p-8">
        <p className="font-mono-cyber text-sm text-muted-foreground">// Loading advisory...</p>
      </div>
    );
  }

  const schema = advisory.template?.schema ?? { sections: [] };

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/app/advisories">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-display text-xl font-bold sm:text-2xl"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider",
                statusStyle[advisory.status] ?? statusStyle.draft
              )}
            >
              {advisory.status}
            </span>
            <span className="text-sm text-muted-foreground">
              {advisory.template?.name ?? "Template"} · Updated{" "}
              {format(new Date(advisory.updatedAt), "PPP")}
            </span>
            {advisory.aiSummaryMode && (
              <span className="text-xs text-violet-400">AI: {advisory.aiSummaryMode}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VersionHistoryPanel advisoryId={advisory.id} onRestore={setAiContent} />
          <DeleteAdvisoryButton advisoryId={advisory.id} title={title} />
        </div>
      </div>

      {linkedTitles.length > 0 && (
        <div className="rounded-sm border border-cyan-500/20 bg-cyan-950/20 p-4">
          <p className="font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
            Linked articles ({linkedTitles.length})
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {advisory.linkedArticleIds.map((aid, i) => (
              <li key={aid}>
                <Link href={`/app/news/${aid}`} className="text-cyan-400 hover:underline">
                  {linkedTitles[i] ?? aid}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schema.sections.length > 0 && (
        <div className="cyber-panel overflow-hidden">
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            className="flex w-full items-center justify-between border-b border-cyan-500/10 px-4 py-3 text-left font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/70 hover:bg-cyan-950/20"
          >
            Template fields
            {formOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {formOpen && (
            <div className="p-4">
              <DesignerForm schema={schema} formData={formData} onChange={setFormData} />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <AIGenerateButton
          advisoryId={advisory.id}
          linkedArticleIds={advisory.linkedArticleIds}
          templateId={advisory.templateId}
          formData={formData}
          summaryMode={summaryMode}
          onSummaryModeChange={setSummaryMode}
          onGenerated={(c) => {
            setAiContent(c);
            setFormOpen(false);
          }}
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="outline" onClick={() => save()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {advisory.status === "draft" && (
            <Button variant="outline" onClick={() => save("review")} disabled={saving}>
              Mark Review
            </Button>
          )}
          {advisory.status !== "published" && (
            <Button onClick={() => save("published")} disabled={saving}>
              Publish
            </Button>
          )}
          {aiContent && (
            <>
              <Button variant="outline" onClick={downloadMarkdown}>
                <Download className="mr-2 h-4 w-4" />
                Markdown
              </Button>
              <Button variant="outline" onClick={downloadPdf}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {saveMsg && (
        <p className="font-mono-cyber text-xs text-emerald-400">// {saveMsg}</p>
      )}

      {aiContent ? (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wider text-cyan-100/90">
            Advisory Preview
          </h2>
          <AdvisoryPreview
            title={title}
            content={aiContent}
            formData={formData}
            templateName={advisory.template?.name}
            summaryMode={summaryMode}
            linkedCount={advisory.linkedArticleIds.length}
          />
        </div>
      ) : (
        <div className="cyber-panel border-dashed py-12 text-center">
          <p className="font-mono-cyber text-sm text-muted-foreground">
            // Generate with AI to see the branded advisory preview
          </p>
        </div>
      )}
    </div>
  );
}
