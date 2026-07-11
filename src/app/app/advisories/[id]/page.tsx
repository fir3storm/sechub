"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { DesignerForm } from "@/components/advisory/DesignerForm";
import { AIGenerateButton } from "@/components/advisory/AIGenerateButton";
import { MarkdownPreview } from "@/components/advisory/MarkdownPreview";
import { VersionHistoryPanel } from "@/components/advisory/VersionHistoryPanel";
import { AdvisoryTemplateSchema, AISummaryMode, FormData } from "@/lib/advisory/template";
import { ArrowLeft, Download } from "lucide-react";

export default function AdvisoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [advisory, setAdvisory] = useState<{
    id: string;
    title: string;
    status: string;
    formData: FormData;
    aiGeneratedContent: string | null;
    aiSummaryMode: string | null;
    linkedArticleIds: string[];
    updatedAt: string;
    template: { schema: AdvisoryTemplateSchema; name: string } | null;
  } | null>(null);
  const [linkedTitles, setLinkedTitles] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({});
  const [aiContent, setAiContent] = useState("");
  const [summaryMode, setSummaryMode] = useState<AISummaryMode>("technical");

  useEffect(() => {
    fetch(`/api/advisories/${id}`)
      .then((r) => r.json())
      .then(async (data) => {
        setAdvisory(data);
        setFormData(data.formData as FormData);
        setAiContent(data.aiGeneratedContent ?? "");
        setSummaryMode((data.aiSummaryMode as AISummaryMode) ?? "technical");

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
    await fetch(`/api/advisories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formData,
        aiGeneratedContent: aiContent,
        aiSummaryMode: summaryMode,
        status: status ?? advisory?.status,
      }),
    });
    if (status) window.location.reload();
  };

  const downloadMarkdown = () => {
    const blob = new Blob([aiContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${advisory?.title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!advisory?.id) return;
    window.open(`/api/advisories/${advisory.id}/pdf`, "_blank", "noopener,noreferrer");
  };

  if (!advisory) return <p>Loading...</p>;

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
        <div>
          <h1 className="text-3xl font-bold">{advisory.title}</h1>
          <p className="text-sm text-muted-foreground">
            {advisory.status} · {advisory.template?.name ?? "Template"} · Updated{" "}
            {format(new Date(advisory.updatedAt), "PPP")}
            {advisory.aiSummaryMode && (
              <span className="ml-2 text-violet-400">· AI mode: {advisory.aiSummaryMode}</span>
            )}
          </p>
        </div>
        <VersionHistoryPanel advisoryId={advisory.id} onRestore={setAiContent} />
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
        <DesignerForm schema={schema} formData={formData} onChange={setFormData} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <AIGenerateButton
          advisoryId={advisory.id}
          linkedArticleIds={advisory.linkedArticleIds}
          formData={formData}
          summaryMode={summaryMode}
          onSummaryModeChange={setSummaryMode}
          onGenerated={setAiContent}
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="outline" onClick={() => save()}>Save</Button>
          {advisory.status !== "published" && (
            <Button onClick={() => save("published")}>Publish</Button>
          )}
          {aiContent && (
            <Button variant="outline" onClick={downloadMarkdown}>
              <Download className="mr-2 h-4 w-4" />
              Export Markdown
            </Button>
          )}
          {aiContent && (
            <Button variant="outline" onClick={downloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {aiContent && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Advisory Content</h2>
          <MarkdownPreview content={aiContent} />
        </div>
      )}
    </div>
  );
}
