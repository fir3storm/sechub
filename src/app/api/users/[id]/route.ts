import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canAssignRole, canManageUser, hasMinRole } from "@/lib/rbac";
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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const actorRole = session.user.role as Role;
  if (!canManageUser(actorRole, session.user.id, target)) {
    return NextResponse.json({ error: "You cannot modify this user" }, { status: 403 });
  }

  if (body.role && !canAssignRole(actorRole, body.role)) {
    return NextResponse.json({ error: "You cannot assign that role" }, { status: 403 });
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
  if (body.role) {
    await writeAuditLog({
      userId: session.user.id,
      action: "user.role_change",
      entity: "User",
      entityId: id,
      metadata: { role: body.role },
    });
  }

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const actorRole = session.user.role as Role;
  if (!canManageUser(actorRole, session.user.id, target)) {
    return NextResponse.json({ error: "You cannot delete this user" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id } });

  await writeAuditLog({
    userId: session.user.id,
    action: "user.delete",
    entity: "User",
    entityId: id,
    metadata: { email: target.email },
  });

  return NextResponse.json({ success: true });
}
