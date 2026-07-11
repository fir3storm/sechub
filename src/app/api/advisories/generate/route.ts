import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { checkAiRateLimit, generateAdvisoryWithAI } from "@/lib/ai/deepseek";
import { writeAuditLog } from "@/lib/audit";
import type { AdvisoryTemplateSchema, AISummaryMode, FormData } from "@/lib/advisory/template";
import { buildTemplatePromptBlock } from "@/lib/advisory/template";
import { MAX_LINKED_ARTICLES } from "@/lib/advisory/template";
import { snapshotAdvisoryRevision } from "@/lib/advisory/revisions";
import { z } from "zod";

const schema = z.object({
  advisoryId: z.string().optional(),
  linkedArticleIds: z.array(z.string()).max(MAX_LINKED_ARTICLES).optional(),
  formData: z.record(z.union([z.string(), z.array(z.string())])),
  summaryMode: z.enum(["executive", "technical", "soc_handoff"]).default("technical"),
  templateId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await checkAiRateLimit(session.user.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rate limited" },
      { status: 429 }
    );
  }

  const body = schema.parse(await req.json());
  let linkedArticleIds = body.linkedArticleIds ?? [];
  const advisoryId = body.advisoryId;
  const summaryMode = body.summaryMode as AISummaryMode;

  let existingAdvisory: { templateId: string | null; linkedArticleIds: string[] } | null = null;

  if (advisoryId) {
    const advisory = await prisma.advisory.findUnique({ where: { id: advisoryId } });
    if (!advisory) return NextResponse.json({ error: "Advisory not found" }, { status: 404 });

    existingAdvisory = advisory;

    if (linkedArticleIds.length === 0) {
      linkedArticleIds = advisory.linkedArticleIds;
    }

    await snapshotAdvisoryRevision({
      advisoryId,
      title: advisory.title,
      formData: advisory.formData as FormData,
      aiGeneratedContent: advisory.aiGeneratedContent,
      changeType: "ai_generate",
      summaryMode: summaryMode,
      createdById: session.user.id,
    });
  }

  const articles = linkedArticleIds.length
    ? await prisma.newsArticle.findMany({ where: { id: { in: linkedArticleIds.slice(0, MAX_LINKED_ARTICLES) } } })
    : [];

  let templateBlock: string | undefined;
  const templateId = body.templateId ?? existingAdvisory?.templateId ?? undefined;

  if (templateId) {
    const tmpl = await prisma.advisoryTemplate.findUnique({ where: { id: templateId } });
    if (tmpl?.schema) {
      templateBlock = buildTemplatePromptBlock(
        tmpl.schema as unknown as AdvisoryTemplateSchema,
        tmpl.threatType
      );
    }
  }

  try {
    const content = await generateAdvisoryWithAI(
      articles.map((a) => ({
        title: a.title,
        summary: a.summary,
        body: a.body,
        cveIds: a.cveIds,
        cvssScore: a.cvssScore,
        affectedDevices: a.affectedDevices,
        affectedOs: a.affectedOs,
        sourceName: a.sourceName,
      })),
      body.formData as FormData,
      summaryMode,
      templateBlock
    );

    if (advisoryId) {
      await prisma.advisory.update({
        where: { id: advisoryId },
        data: {
          aiGeneratedContent: content,
          formData: body.formData,
          aiSummaryMode: summaryMode,
        },
      });
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "advisory.ai_generate",
      entity: "Advisory",
      entityId: advisoryId,
      metadata: { summaryMode, articleCount: articles.length },
    });

    return NextResponse.json({ content, summaryMode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      { status: 500 }
    );
  }
}
