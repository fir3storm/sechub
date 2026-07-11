import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { getFeedQualityStats } from "@/lib/feeds/quality-stats";

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = await getFeedQualityStats();
  return NextResponse.json(stats);
}
