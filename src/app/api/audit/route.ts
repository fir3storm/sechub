import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit = 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
}
