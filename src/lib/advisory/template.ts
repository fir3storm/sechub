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

export type ThreatType = "general" | "ransomware" | "vulnerability" | "breach";

export type AISummaryMode = "executive" | "technical" | "soc_handoff";

export const MAX_LINKED_ARTICLES = 5;

export const THREAT_TYPE_LABELS: Record<ThreatType, string> = {
  general: "General Advisory",
  ransomware: "Ransomware",
  vulnerability: "Vulnerability / CVE",
  breach: "Data Breach",
};

export const AI_SUMMARY_MODE_LABELS: Record<AISummaryMode, string> = {
  executive: "Executive (3 sentences)",
  technical: "Technical (detailed)",
  soc_handoff: "SOC Handoff",
};

export const DEFAULT_ADVISORY_TEMPLATE: AdvisoryTemplateSchema = {
  sections: [
    {
      id: "summary",
      title: "Executive Summary",
      fields: [
        {
          id: "classification",
          label: "Classification",
          type: "select",
          options: [
            "TLP:CLEAR",
            "TLP:GREEN",
            "TLP:AMBER",
            "TLP:AMBER+STRICT",
            "TLP:RED",
            "INTERNAL USE ONLY",
          ],
          required: true,
        },
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
          placeholder: "IP, domain, hash, CVE, etc.",
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

export const RANSOMWARE_TEMPLATE: AdvisoryTemplateSchema = {
  sections: [
    {
      id: "summary",
      title: "Executive Summary",
      fields: [
        {
          id: "classification",
          label: "Classification",
          type: "select",
          options: ["TLP:AMBER", "TLP:AMBER+STRICT", "TLP:RED", "INTERNAL USE ONLY"],
          required: true,
        },
        { id: "executiveSummary", label: "Executive Summary", type: "textarea", required: true },
      ],
    },
    {
      id: "profile",
      title: "Ransomware Profile",
      fields: [
        { id: "ransomwareFamily", label: "Ransomware Family / Variant", type: "text", placeholder: "e.g. LockBit 3.0" },
        { id: "threatOverview", label: "Campaign Overview", type: "textarea", required: true },
        {
          id: "encryptionBehavior",
          label: "Encryption & Extortion Tactics",
          type: "textarea",
          placeholder: "File extensions, ransom note, leak site...",
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
      title: "Impact & Scope",
      fields: [
        { id: "affectedSystems", label: "Affected Systems", type: "multiselect" },
        { id: "businessImpact", label: "Business Impact", type: "textarea" },
      ],
    },
    {
      id: "ioc",
      title: "Indicators of Compromise",
      fields: [
        { id: "iocs", label: "IOCs (hashes, IPs, domains, mutexes)", type: "repeatable", required: true },
      ],
    },
    {
      id: "response",
      title: "Containment & Recovery",
      fields: [
        { id: "mitigationSteps", label: "Immediate Containment Steps", type: "ordered-list", required: true },
        { id: "recoverySteps", label: "Recovery & Restoration", type: "ordered-list" },
      ],
    },
    {
      id: "references",
      title: "References",
      fields: [
        { id: "references", label: "References", type: "repeatable" },
        { id: "distributionNotes", label: "Distribution Notes", type: "textarea" },
      ],
    },
  ],
};

export const VULNERABILITY_TEMPLATE: AdvisoryTemplateSchema = {
  sections: [
    {
      id: "summary",
      title: "Executive Summary",
      fields: [
        {
          id: "classification",
          label: "Classification",
          type: "select",
          options: ["TLP:CLEAR", "TLP:GREEN", "TLP:AMBER", "INTERNAL USE ONLY"],
          required: true,
        },
        { id: "executiveSummary", label: "Executive Summary", type: "textarea", required: true },
      ],
    },
    {
      id: "vuln",
      title: "Vulnerability Details",
      fields: [
        { id: "cveIds", label: "CVE IDs", type: "repeatable", placeholder: "CVE-2024-1234" },
        { id: "threatOverview", label: "Vulnerability Description", type: "textarea", required: true },
        {
          id: "cvssScore",
          label: "CVSS Score",
          type: "text",
          placeholder: "e.g. 9.8 (Critical)",
        },
        {
          id: "exploitStatus",
          label: "Exploit Status",
          type: "select",
          options: ["Actively Exploited (KEV)", "PoC Available", "Theoretical", "Unknown"],
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
      title: "Affected Products & Systems",
      fields: [
        { id: "affectedSystems", label: "Affected Products / Systems", type: "multiselect" },
        { id: "affectedVersions", label: "Affected Versions", type: "textarea" },
      ],
    },
    {
      id: "ioc",
      title: "Detection & IOCs",
      fields: [{ id: "iocs", label: "IOCs / Detection Signatures", type: "repeatable" }],
    },
    {
      id: "mitigation",
      title: "Remediation",
      fields: [
        { id: "mitigationSteps", label: "Remediation Steps", type: "ordered-list", required: true },
        { id: "workarounds", label: "Temporary Workarounds", type: "textarea" },
      ],
    },
    {
      id: "references",
      title: "References",
      fields: [
        { id: "references", label: "References", type: "repeatable" },
        { id: "distributionNotes", label: "Distribution Notes", type: "textarea" },
      ],
    },
  ],
};

export const BREACH_TEMPLATE: AdvisoryTemplateSchema = {
  sections: [
    {
      id: "summary",
      title: "Executive Summary",
      fields: [
        {
          id: "classification",
          label: "Classification",
          type: "select",
          options: ["TLP:AMBER", "TLP:AMBER+STRICT", "TLP:RED", "INTERNAL USE ONLY"],
          required: true,
        },
        { id: "executiveSummary", label: "Executive Summary", type: "textarea", required: true },
      ],
    },
    {
      id: "incident",
      title: "Incident Overview",
      fields: [
        { id: "threatOverview", label: "Incident Summary", type: "textarea", required: true },
        {
          id: "breachType",
          label: "Breach Type",
          type: "select",
          options: ["Data Exfiltration", "Unauthorized Access", "Ransomware + Exfil", "Third-Party", "Other"],
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
      id: "exposure",
      title: "Data Exposure",
      fields: [
        { id: "dataTypes", label: "Data Types Affected", type: "multiselect", placeholder: "PII, credentials, financial..." },
        { id: "estimatedRecords", label: "Estimated Records / Scope", type: "text" },
        { id: "affectedParties", label: "Affected Parties / Regions", type: "textarea" },
      ],
    },
    {
      id: "ioc",
      title: "Indicators & Attribution",
      fields: [{ id: "iocs", label: "IOCs / Threat Actor Indicators", type: "repeatable" }],
    },
    {
      id: "response",
      title: "Response Actions",
      fields: [
        { id: "mitigationSteps", label: "Recommended Response Steps", type: "ordered-list", required: true },
        { id: "notificationRequirements", label: "Notification / Compliance Notes", type: "textarea" },
      ],
    },
    {
      id: "references",
      title: "References",
      fields: [
        { id: "references", label: "References", type: "repeatable" },
        { id: "distributionNotes", label: "Distribution Notes", type: "textarea" },
      ],
    },
  ],
};

export const THREAT_TEMPLATE_SCHEMAS: Record<
  Exclude<ThreatType, "general">,
  AdvisoryTemplateSchema
> = {
  ransomware: RANSOMWARE_TEMPLATE,
  vulnerability: VULNERABILITY_TEMPLATE,
  breach: BREACH_TEMPLATE,
};

export type FormData = Record<string, string | string[]>;

export function buildDefaultFormData(schema: AdvisoryTemplateSchema): FormData {
  const data: FormData = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type === "repeatable" || field.type === "ordered-list" || field.type === "multiselect") {
        data[field.id] = [];
      } else if (field.id === "classification") {
        data[field.id] = "TLP:AMBER";
      } else {
        data[field.id] = "";
      }
    }
  }
  return data;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function highestSeverity(articles: Array<{ severity?: string; cvssScore?: number | null }>): string {
  const weight: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };
  const labels: Record<number, string> = {
    5: "Critical",
    4: "High",
    3: "Medium",
    2: "Low",
    1: "Info",
  };

  let best = 3;
  for (const a of articles) {
    if (a.cvssScore != null && a.cvssScore >= 9) return "Critical";
    if (a.cvssScore != null && a.cvssScore >= 7) best = Math.max(best, 4);
    const sev = (a as { severity?: string }).severity?.toLowerCase();
    if (sev && weight[sev]) best = Math.max(best, weight[sev]);
  }
  return labels[best] ?? "Medium";
}

export function prefillFromArticles(
  formData: FormData,
  articles: Array<{
    title: string;
    summary: string;
    sourceUrl: string | null;
    cveIds: string[];
    cvssScore?: number | null;
    severity?: string;
    affectedDevices: string[];
    affectedOs: string[];
  }>,
  threatType?: ThreatType
): FormData {
  const limited = articles.slice(0, MAX_LINKED_ARTICLES);

  const refs = dedupeStrings(
    limited.map((a) => a.sourceUrl || a.title).filter(Boolean) as string[]
  );

  const systems = dedupeStrings(limited.flatMap((a) => [...a.affectedDevices, ...a.affectedOs]));
  const allCves = dedupeStrings(limited.flatMap((a) => a.cveIds));
  const existingIocs = Array.isArray(formData.iocs) ? (formData.iocs as string[]) : [];
  const iocs = dedupeStrings([...existingIocs, ...allCves]);

  const threatParts = limited.map(
    (a, i) =>
      `### Source ${i + 1}: ${a.title}\n${a.summary}${a.cveIds.length ? `\nCVEs: ${a.cveIds.join(", ")}` : ""}${a.cvssScore != null ? `\nCVSS: ${a.cvssScore}` : ""}`
  );

  const mergedSummary =
    limited.length === 1
      ? limited[0].summary
      : `This bulletin consolidates ${limited.length} related intelligence signals:\n${limited.map((a) => `• ${a.title}`).join("\n")}`;

  const cvssScores = limited.map((a) => a.cvssScore).filter((s): s is number => s != null);
  const maxCvss = cvssScores.length ? Math.max(...cvssScores) : null;

  const base: FormData = {
    ...formData,
    executiveSummary: mergedSummary,
    threatOverview: threatParts.join("\n\n"),
    affectedSystems: systems,
    references: refs,
    iocs,
    riskRating: highestSeverity(limited),
  };

  if (threatType === "vulnerability" || allCves.length > 0) {
    base.cveIds = allCves;
    if (maxCvss != null) base.cvssScore = String(maxCvss);
  }

  if (threatType === "ransomware" && limited[0]) {
    const title = limited[0].title.toLowerCase();
    const families = ["lockbit", "blackcat", "alphv", "clop", "play", "akira", "royal"];
    const match = families.find((f) => title.includes(f));
    if (match) base.ransomwareFamily = match.charAt(0).toUpperCase() + match.slice(1);
  }

  if (threatType === "breach") {
    base.breachType = "Data Exfiltration";
  }

  return base;
}

export function inferThreatTypeFromArticles(
  articles: Array<{ title: string; summary: string; cveIds: string[]; categories?: { category: { name: string } }[] }>
): ThreatType {
  const text = articles
    .map((a) => `${a.title} ${a.summary}`.toLowerCase())
    .join(" ");

  if (/ransomware|ransom|encrypt|lockbit|blackcat|alphv/.test(text)) return "ransomware";
  if (/breach|leak|exfil|stolen data|data exposure/.test(text)) return "breach";
  if (articles.some((a) => a.cveIds.length > 0) || /cve-|vulnerabilit|zero-day|0-day|rce|cvss/.test(text)) {
    return "vulnerability";
  }

  const cats = articles.flatMap((a) => a.categories?.map((c) => c.category.name.toLowerCase()) ?? []);
  if (cats.some((c) => c.includes("ransomware"))) return "ransomware";
  if (cats.some((c) => c.includes("breach"))) return "breach";
  if (cats.some((c) => c.includes("vulnerabilit") || c.includes("zero-day"))) return "vulnerability";

  return "general";
}

export function getClassificationBanner(formData: FormData): string {
  const c = formData.classification;
  if (typeof c === "string" && c.trim()) return c.trim();
  return "TLP:AMBER — INTERNAL USE ONLY";
}
