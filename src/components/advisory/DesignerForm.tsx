"use client";

import { useState } from "react";
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
import type { AdvisoryTemplateSchema, FormData, TemplateField } from "@/lib/advisory/template";
import { Plus, Trash2, GripVertical } from "lucide-react";

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string | string[];
  onChange: (val: string | string[]) => void;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
        />
      );
    case "select":
      return (
        <Select value={(value as string) || ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect": {
      const items = (value as string[]) || [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      );
    }
    case "repeatable": {
      const items = (value as string[]) || [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={item}
                placeholder={field.placeholder}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      );
    }
    case "ordered-list": {
      const items = (value as string[]) || [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <GripVertical className="mt-2 h-4 w-4 text-muted-foreground" />
              <span className="mt-2 text-sm text-muted-foreground">{i + 1}.</span>
              <Textarea
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                rows={2}
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
            <Plus className="mr-1 h-4 w-4" /> Add step
          </Button>
        </div>
      );
    }
    default:
      return (
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
  }
}

export function DesignerForm({
  schema,
  formData,
  onChange,
}: {
  schema: AdvisoryTemplateSchema;
  formData: FormData;
  onChange: (data: FormData) => void;
}) {
  const updateField = (fieldId: string, value: string | string[]) => {
    onChange({ ...formData, [fieldId]: value });
  };

  return (
    <div className="space-y-8">
      {schema.sections.map((section) => (
        <div key={section.id} className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">{section.title}</h3>
          {section.fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </Label>
              <FieldRenderer
                field={field}
                value={formData[field.id] ?? (field.type === "repeatable" || field.type === "ordered-list" || field.type === "multiselect" ? [] : "")}
                onChange={(v) => updateField(field.id, v)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TemplateDesigner({
  schema,
  onChange,
}: {
  schema: AdvisoryTemplateSchema;
  onChange: (schema: AdvisoryTemplateSchema) => void;
}) {
  const [selectedSection, setSelectedSection] = useState(0);
  const section = schema.sections[selectedSection];

  const updateField = (fieldIndex: number, updates: Partial<TemplateField>) => {
    const sections = [...schema.sections];
    const fields = [...sections[selectedSection].fields];
    fields[fieldIndex] = { ...fields[fieldIndex], ...updates };
    sections[selectedSection] = { ...sections[selectedSection], fields };
    onChange({ sections });
  };

  const addField = () => {
    const sections = [...schema.sections];
    sections[selectedSection].fields.push({
      id: `field_${Date.now()}`,
      label: "New Field",
      type: "text",
    });
    onChange({ sections });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <Label>Sections</Label>
        {schema.sections.map((s, i) => (
          <Button
            key={s.id}
            type="button"
            variant={selectedSection === i ? "default" : "outline"}
            className="mr-2"
            onClick={() => setSelectedSection(i)}
          >
            {s.title}
          </Button>
        ))}
      </div>
      <div className="space-y-4">
        <Input
          value={section.title}
          onChange={(e) => {
            const sections = [...schema.sections];
            sections[selectedSection] = { ...section, title: e.target.value };
            onChange({ sections });
          }}
        />
        {section.fields.map((field, i) => (
          <div key={field.id} className="rounded border p-4 space-y-2">
            <Input
              value={field.label}
              onChange={(e) => updateField(i, { label: e.target.value })}
              placeholder="Field label"
            />
            <Select value={field.type} onValueChange={(v) => updateField(i, { type: v as TemplateField["type"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="textarea">Textarea</SelectItem>
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="multiselect">Multi-select</SelectItem>
                <SelectItem value="repeatable">Repeatable</SelectItem>
                <SelectItem value="ordered-list">Ordered list</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addField}>
          <Plus className="mr-1 h-4 w-4" /> Add field
        </Button>
      </div>
    </div>
  );
}
