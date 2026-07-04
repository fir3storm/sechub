"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateDesigner } from "@/components/advisory/DesignerForm";
import { AdvisoryTemplateSchema, DEFAULT_ADVISORY_TEMPLATE } from "@/lib/advisory/template";
import { ArrowLeft } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  schema: AdvisoryTemplateSchema;
  isDefault: boolean;
}

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [schema, setSchema] = useState<AdvisoryTemplateSchema>(DEFAULT_ADVISORY_TEMPLATE);

  const load = () =>
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: Template[]) => {
        setTemplates(data);
        const def = data.find((t) => t.isDefault) ?? data[0];
        if (def && !selected) {
          setSelected(def);
          setSchema(def.schema);
        }
      });

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!selected) return;
    await fetch(`/api/templates/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema }),
    });
    load();
  };

  const createNew = async () => {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Template",
        schema: DEFAULT_ADVISORY_TEMPLATE,
      }),
    });
    const tmpl = await res.json();
    setSelected(tmpl);
    setSchema(tmpl.schema);
    load();
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/app/settings">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Advisory Templates</h1>
        <Button onClick={createNew}>New Template</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <Button
            key={t.id}
            variant={selected?.id === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelected(t);
              setSchema(t.schema);
            }}
          >
            {t.name} {t.isDefault && "(default)"}
          </Button>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Design: {selected.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                onBlur={async () => {
                  await fetch(`/api/templates/${selected.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: selected.name }),
                  });
                }}
              />
            </div>
            <TemplateDesigner schema={schema} onChange={setSchema} />
            <Button onClick={save}>Save Template</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
