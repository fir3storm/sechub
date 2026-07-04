import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function writeAuditLog(params: {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: params.metadata ?? undefined,
    },
  });
}
