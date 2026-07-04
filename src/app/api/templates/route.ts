import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.advisoryTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  schema: z.object({ sections: z.array(z.any()) }),
  isDefault: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = templateSchema.parse(await req.json());

  if (body.isDefault) {
    await prisma.advisoryTemplate.updateMany({ data: { isDefault: false } });
  }

  const template = await prisma.advisoryTemplate.create({ data: body });

  await writeAuditLog({
    userId: session.user.id,
    action: "template.create",
    entity: "AdvisoryTemplate",
    entityId: template.id,
  });

  return NextResponse.json(template, { status: 201 });
}
