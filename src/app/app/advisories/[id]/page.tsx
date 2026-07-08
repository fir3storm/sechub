"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { DesignerForm } from "@/components/advisory/DesignerForm";
import { AIGenerateButton } from "@/components/advisory/AIGenerateButton";
import { MarkdownPreview } from "@/components/advisory/MarkdownPreview";
import { AdvisoryTemplateSchema, FormData } from "@/lib/advisory/template";
import { ArrowLeft, Download } from "lucide-react";

export default function AdvisoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [advisory, setAdvisory] = useState<{
    id: string;
    title: string;
    status: string;
    formData: FormData;
    aiGeneratedContent: string | null;
    linkedArticleIds: string[];
    updatedAt: string;
    template: { schema: AdvisoryTemplateSchema } | null;
  } | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [aiContent, setAiContent] = useState("");

  useEffect(() => {
    fetch(`/api/advisories/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAdvisory(data);
        setFormData(data.formData as FormData);
        setAiContent(data.aiGeneratedContent ?? "");
      });
  }, [id]);

  const save = async (status?: string) => {
    await fetch(`/api/advisories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formData,
        aiGeneratedContent: aiContent,
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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{advisory.title}</h1>
          <p className="text-sm text-muted-foreground">
            {advisory.status} · Updated {format(new Date(advisory.updatedAt), "PPP")}
          </p>
        </div>
      </div>

      {schema.sections.length > 0 && (
        <DesignerForm schema={schema} formData={formData} onChange={setFormData} />
      )}

      <div className="flex flex-wrap gap-3">
        <AIGenerateButton
          advisoryId={advisory.id}
          formData={formData}
          onGenerated={setAiContent}
        />
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

      {aiContent && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Advisory Content</h2>
          <MarkdownPreview content={aiContent} />
        </div>
      )}
    </div>
  );
}
