import { prisma } from "@/lib/db";
import { getAISettings } from "@/lib/settings";
import type { AISummaryMode, FormData } from "@/lib/advisory/template";
import { cleanAdvisoryMarkdown } from "@/lib/advisory/markdown";

interface ArticleContext {
  title: string;
  summary: string;
  body: string;
  cveIds: string[];
  cvssScore: number | null;
  affectedDevices: string[];
  affectedOs: string[];
  sourceName: string;
}

const MODE_INSTRUCTIONS: Record<AISummaryMode, string> = {
  executive:
    "MODE: Executive Brief. Write exactly 3 sentences total for the executive summary section. Keep the full advisory concise (under 400 words). Use plain language for C-suite readers. Still include all required section headings but keep each section brief.",
  technical:
    "MODE: Technical Deep-Dive. Provide comprehensive technical detail: CVE analysis, attack vectors, affected versions, detection logic, and step-by-step remediation. Include code blocks or command examples where helpful.",
  soc_handoff:
    "MODE: SOC Handoff. Structure the advisory for SOC analysts with these emphasis areas: Alert Priority, Detection Logic (SIEM queries / log sources), Containment Steps (numbered, actionable), Escalation Path, and IOC table. Use bullet points and clear severity callouts.",
};

function buildAdvisoryPrompt(
  articles: ArticleContext[],
  formData: FormData,
  mode: AISummaryMode,
  templateBlock?: string
): string {
  const articleBlock =
    articles.length > 1
      ? `This is a MERGED bulletin combining ${articles.length} related articles. Synthesize into one cohesive advisory. Deduplicate CVEs and IOCs. Use ### sub-headings per source where helpful.`
      : "";

  return `${MODE_INSTRUCTIONS[mode]}

${articleBlock}

${templateBlock ?? "Use standard security advisory sections with ## markdown headings."}

IMPORTANT FORMAT RULES:
- Output raw markdown only. Do NOT wrap the response in \`\`\`markdown or \`\`\` code fences.
- Use # for the document title once at the top, then ## for each section.
- Use bullet lists and numbered lists for IOCs, mitigations, and steps.
- Do not output JSON or HTML.

Generate a security advisory in markdown based on the following context.

## Linked Security News Articles
${JSON.stringify(
  articles.map((a) => ({
    title: a.title,
    summary: a.summary,
    cveIds: a.cveIds,
    cvssScore: a.cvssScore,
    affectedDevices: a.affectedDevices,
    affectedOs: a.affectedOs,
    source: a.sourceName,
  })),
  null,
  2
)}

## Current Form Field Values (incorporate and expand)
${JSON.stringify(formData, null, 2)}

Output a complete advisory in markdown with clear section headings matching the form fields.
Include actionable mitigation steps and references.`;
}

export async function generateAdvisoryWithAI(
  articles: ArticleContext[],
  formData: FormData,
  mode: AISummaryMode = "technical",
  templateBlock?: string
): Promise<string> {
  const settings = await getAISettings();
  if (!settings.apiKey) {
    throw new Error("Bramhashiv AI API key is not configured. Set it in Settings > AI.");
  }

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: mode === "executive" ? Math.min(settings.maxTokens, 2048) : settings.maxTokens,
      temperature: mode === "executive" ? 0.3 : settings.temperature,
      messages: [
        { role: "system", content: settings.systemPrompt },
        { role: "user", content: buildAdvisoryPrompt(articles, formData, mode, templateBlock) },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Bramhashiv AI API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content returned from Bramhashiv AI");
  return cleanAdvisoryMarkdown(content);
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

export async function checkAiRateLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const count = await prisma.auditLog.count({
    where: {
      userId,
      action: "advisory.ai_generate",
      createdAt: { gte: since },
    },
  });
  if (count >= RATE_LIMIT_MAX) {
    throw new Error("AI generation rate limit exceeded (10 per hour)");
  }
}

const SUMMARY_SYSTEM_PROMPT = `You are a cybersecurity news summarizer for a SOC platform.
Write a concise, factual summary of the article in 2-4 sentences.
Focus on the threat, affected systems, and key mitigations. No markdown.`;

export async function generateArticleSummary(
  title: string,
  body: string
): Promise<string | null> {
  const settings = await getAISettings();
  if (!settings.apiKey) return null;

  const excerpt = body.slice(0, 8000);

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 512,
        temperature: 0.3,
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Title: ${title}\n\nArticle:\n${excerpt}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
