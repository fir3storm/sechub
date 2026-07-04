import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { z } from "zod";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = z.object({ role: z.nativeEnum(Role) }).parse(await req.json());

  const user = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user);
}
