import { prisma } from "@/lib/db";
import { getAISettings } from "@/lib/settings";
import type { FormData } from "@/lib/advisory/template";

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

function buildAdvisoryPrompt(articles: ArticleContext[], formData: FormData): string {
  return `Generate a security advisory in markdown based on the following context.

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
  formData: FormData
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
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      messages: [
        { role: "system", content: settings.systemPrompt },
        { role: "user", content: buildAdvisoryPrompt(articles, formData) },
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
  return content;
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
