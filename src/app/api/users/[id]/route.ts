import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = updateSchema.parse(await req.json());

  if (!body.role && !body.password) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const data: { role?: Role; passwordHash?: string; mustChangePassword?: boolean } = {};
  if (body.role) data.role = body.role;
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 12);
    data.mustChangePassword = true;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true },
  });

  if (body.password) {
    await writeAuditLog({
      userId: session.user.id,
      action: "user.password_reset",
      entity: "User",
      entityId: id,
    });
  }

  return NextResponse.json(user);
}
