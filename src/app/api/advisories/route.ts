import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const advisories = await prisma.advisory.findMany({
    where: status ? { status: status as "draft" | "review" | "published" } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(advisories);
}

const createSchema = z.object({
  title: z.string().min(1),
  templateId: z.string().optional().nullable(),
  linkedArticleIds: z.array(z.string()).default([]),
  formData: z.record(z.union([z.string(), z.array(z.string())])),
  status: z.enum(["draft", "review", "published"]).default("draft"),
  aiGeneratedContent: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.parse(await req.json());

  const advisory = await prisma.advisory.create({
    data: {
      title: body.title,
      templateId: body.templateId,
      linkedArticleIds: body.linkedArticleIds,
      formData: body.formData,
      aiGeneratedContent: body.aiGeneratedContent,
      status: body.status,
      publishedAt: body.status === "published" ? new Date() : null,
      createdById: session.user.id,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: body.status === "published" ? "advisory.publish" : "advisory.create",
    entity: "Advisory",
    entityId: advisory.id,
  });

  return NextResponse.json(advisory, { status: 201 });
}
