import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { getAdvisoryRevision } from "@/lib/advisory/revisions";
import { diffLines } from "@/lib/advisory/diff";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const from = parseInt(req.nextUrl.searchParams.get("from") ?? "0", 10);
  const to = parseInt(req.nextUrl.searchParams.get("to") ?? "0", 10);

  if (!from || !to) {
    return NextResponse.json({ error: "from and to version required" }, { status: 400 });
  }

  const [revFrom, revTo] = await Promise.all([
    getAdvisoryRevision(id, from),
    getAdvisoryRevision(id, to),
  ]);

  if (!revFrom || !revTo) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const oldText = revFrom.aiGeneratedContent ?? "";
  const newText = revTo.aiGeneratedContent ?? "";

  return NextResponse.json({
    from: { version: revFrom.version, aiGeneratedContent: revFrom.aiGeneratedContent },
    to: { version: revTo.version, aiGeneratedContent: revTo.aiGeneratedContent },
    diff: diffLines(oldText, newText),
  });
}
