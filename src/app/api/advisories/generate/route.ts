import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { checkAiRateLimit, generateAdvisoryWithAI } from "@/lib/ai/deepseek";
import { writeAuditLog } from "@/lib/audit";
import type { FormData } from "@/lib/advisory/template";
import { z } from "zod";

const schema = z.object({
  advisoryId: z.string().optional(),
  linkedArticleIds: z.array(z.string()).optional(),
  formData: z.record(z.union([z.string(), z.array(z.string())])),
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
  let advisoryId = body.advisoryId;

  if (advisoryId) {
    const advisory = await prisma.advisory.findUnique({ where: { id: advisoryId } });
    if (!advisory) return NextResponse.json({ error: "Advisory not found" }, { status: 404 });
    linkedArticleIds = advisory.linkedArticleIds;
  }

  const articles = linkedArticleIds.length
    ? await prisma.newsArticle.findMany({ where: { id: { in: linkedArticleIds } } })
    : [];

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
      body.formData as FormData
    );

    if (advisoryId) {
      await prisma.advisory.update({
        where: { id: advisoryId },
        data: { aiGeneratedContent: content, formData: body.formData },
      });
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "advisory.ai_generate",
      entity: "Advisory",
      entityId: advisoryId,
    });

    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      { status: 500 }
    );
  }
}
