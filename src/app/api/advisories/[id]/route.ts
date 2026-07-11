import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { snapshotAdvisoryRevision } from "@/lib/advisory/revisions";
import type { FormData } from "@/lib/advisory/template";
import { MAX_LINKED_ARTICLES } from "@/lib/advisory/template";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const advisory = await prisma.advisory.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      template: true,
    },
  });

  if (!advisory) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(advisory);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  formData: z.record(z.union([z.string(), z.array(z.string())])).optional(),
  aiGeneratedContent: z.string().optional().nullable(),
  aiSummaryMode: z.enum(["executive", "technical", "soc_handoff"]).optional(),
  status: z.enum(["draft", "review", "published"]).optional(),
  linkedArticleIds: z.array(z.string()).max(MAX_LINKED_ARTICLES).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = updateSchema.parse(await req.json());

  const existing = await prisma.advisory.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentChanged =
    body.formData !== undefined ||
    body.aiGeneratedContent !== undefined ||
    body.title !== undefined;

  if (contentChanged) {
    await snapshotAdvisoryRevision({
      advisoryId: id,
      title: existing.title,
      formData: existing.formData as FormData,
      aiGeneratedContent: existing.aiGeneratedContent,
      changeType: body.status === "published" ? "publish" : "edit",
      summaryMode: existing.aiSummaryMode,
      createdById: session.user.id,
    });
  }

  const advisory = await prisma.advisory.update({
    where: { id },
    data: {
      title: body.title,
      formData: body.formData,
      aiGeneratedContent: body.aiGeneratedContent,
      aiSummaryMode: body.aiSummaryMode,
      status: body.status,
      linkedArticleIds: body.linkedArticleIds,
      publishedAt: body.status === "published" ? new Date() : undefined,
    },
  });

  if (body.status === "published") {
    await writeAuditLog({
      userId: session.user.id,
      action: "advisory.publish",
      entity: "Advisory",
      entityId: id,
    });
  }

  return NextResponse.json(advisory);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.advisory.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.advisory.delete({ where: { id } });

  await writeAuditLog({
    userId: session.user.id,
    action: "advisory.delete",
    entity: "Advisory",
    entityId: id,
    metadata: { title: existing.title },
  });

  return NextResponse.json({ success: true });
}
