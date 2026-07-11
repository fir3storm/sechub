import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { getAdvisoryRevision, snapshotAdvisoryRevision } from "@/lib/advisory/revisions";
import { writeAuditLog } from "@/lib/audit";
import type { FormData } from "@/lib/advisory/template";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, version: versionStr } = await params;
  const version = parseInt(versionStr, 10);
  if (!version) return NextResponse.json({ error: "Invalid version" }, { status: 400 });

  const revision = await getAdvisoryRevision(id, version);
  if (!revision) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = await prisma.advisory.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Advisory not found" }, { status: 404 });

  await snapshotAdvisoryRevision({
    advisoryId: id,
    title: current.title,
    formData: current.formData as FormData,
    aiGeneratedContent: current.aiGeneratedContent,
    changeType: "restore",
    summaryMode: current.aiSummaryMode,
    createdById: session.user.id,
  });

  const updated = await prisma.advisory.update({
    where: { id },
    data: {
      formData: revision.formData as object,
      aiGeneratedContent: revision.aiGeneratedContent,
      title: revision.title,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "advisory.restore",
    entity: "Advisory",
    entityId: id,
    metadata: { restoredVersion: version },
  });

  return NextResponse.json(updated);
}
