import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canAssignRole, hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
  role: z.nativeEnum(Role).default(Role.Viewer),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorRole = session.user.role as Role;
  const body = userSchema.parse(await req.json());

  if (!canAssignRole(actorRole, body.role)) {
    return NextResponse.json(
      { error: "You cannot assign that role with your clearance level" },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.create({
    data: {
      email: body.email.toLowerCase(),
      name: body.name,
      passwordHash,
      role: body.role,
      mustChangePassword: true,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "user.create",
    entity: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return NextResponse.json(user, { status: 201 });
}
