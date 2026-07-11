import { prisma } from "@/lib/db";
import type { FormData } from "@/lib/advisory/template";

export type RevisionChangeType = "create" | "edit" | "ai_generate" | "publish" | "restore";

export async function getNextRevisionVersion(advisoryId: string): Promise<number> {
  const latest = await prisma.advisoryRevision.findFirst({
    where: { advisoryId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function snapshotAdvisoryRevision(args: {
  advisoryId: string;
  title: string;
  formData: FormData | Record<string, unknown>;
  aiGeneratedContent: string | null;
  changeType: RevisionChangeType;
  summaryMode?: string | null;
  createdById: string;
}) {
  const version = await getNextRevisionVersion(args.advisoryId);

  return prisma.advisoryRevision.create({
    data: {
      advisoryId: args.advisoryId,
      version,
      title: args.title,
      formData: args.formData as object,
      aiGeneratedContent: args.aiGeneratedContent,
      changeType: args.changeType,
      summaryMode: args.summaryMode ?? null,
      createdById: args.createdById,
    },
  });
}

export async function listAdvisoryRevisions(advisoryId: string) {
  return prisma.advisoryRevision.findMany({
    where: { advisoryId },
    orderBy: { version: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getAdvisoryRevision(advisoryId: string, version: number) {
  return prisma.advisoryRevision.findUnique({
    where: { advisoryId_version: { advisoryId, version } },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}
