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
  const body = z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      schema: z.object({ sections: z.array(z.any()) }).optional(),
      isDefault: z.boolean().optional(),
    })
    .parse(await req.json());

  if (body.isDefault) {
    await prisma.advisoryTemplate.updateMany({ data: { isDefault: false } });
  }

  const template = await prisma.advisoryTemplate.update({ where: { id }, data: body });
  return NextResponse.json(template);
}
