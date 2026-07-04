export interface TemplateField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "repeatable" | "ordered-list";
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface TemplateSection {
  id: string;
  title: string;
  fields: TemplateField[];
}

export interface AdvisoryTemplateSchema {
  sections: TemplateSection[];
}

export const DEFAULT_ADVISORY_TEMPLATE: AdvisoryTemplateSchema = {
  sections: [
    {
      id: "summary",
      title: "Executive Summary",
      fields: [
        {
          id: "executiveSummary",
          label: "Executive Summary",
          type: "textarea",
          required: true,
          placeholder: "Brief overview for leadership...",
        },
      ],
    },
    {
      id: "threat",
      title: "Threat Details",
      fields: [
        {
          id: "threatOverview",
          label: "Threat Overview",
          type: "textarea",
          required: true,
        },
        {
          id: "riskRating",
          label: "Risk Rating",
          type: "select",
          options: ["Critical", "High", "Medium", "Low"],
          required: true,
        },
      ],
    },
    {
      id: "impact",
      title: "Impact",
      fields: [
        {
          id: "affectedSystems",
          label: "Affected Systems",
          type: "multiselect",
          placeholder: "Select or add affected systems",
        },
      ],
    },
    {
      id: "ioc",
      title: "Indicators of Compromise",
      fields: [
        {
          id: "iocs",
          label: "IOCs",
          type: "repeatable",
          placeholder: "IP, domain, hash, etc.",
        },
      ],
    },
    {
      id: "mitigation",
      title: "Mitigation",
      fields: [
        {
          id: "mitigationSteps",
          label: "Mitigation Steps",
          type: "ordered-list",
          required: true,
        },
      ],
    },
    {
      id: "references",
      title: "References",
      fields: [
        {
          id: "references",
          label: "References",
          type: "repeatable",
        },
        {
          id: "distributionNotes",
          label: "Distribution Notes",
          type: "textarea",
        },
      ],
    },
  ],
};

export type FormData = Record<string, string | string[]>;

export function buildDefaultFormData(schema: AdvisoryTemplateSchema): FormData {
  const data: FormData = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type === "repeatable" || field.type === "ordered-list" || field.type === "multiselect") {
        data[field.id] = [];
      } else {
        data[field.id] = "";
      }
    }
  }
  return data;
}

export function prefillFromArticles(
  formData: FormData,
  articles: Array<{
    title: string;
    summary: string;
    sourceUrl: string | null;
    cveIds: string[];
    affectedDevices: string[];
    affectedOs: string[];
  }>
): FormData {
  const refs = articles
    .map((a) => a.sourceUrl || a.title)
    .filter(Boolean) as string[];

  const systems = [
    ...new Set(articles.flatMap((a) => [...a.affectedDevices, ...a.affectedOs])),
  ];

  const threatParts = articles.map(
    (a) => `${a.title}: ${a.summary}${a.cveIds.length ? ` (${a.cveIds.join(", ")})` : ""}`
  );

  return {
    ...formData,
    threatOverview: threatParts.join("\n\n"),
    affectedSystems: systems,
    references: refs,
  };
}
