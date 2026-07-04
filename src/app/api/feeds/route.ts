import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role, FeedType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feeds = await prisma.feedSource.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(feeds);
}

const feedSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(FeedType),
  url: z.string().url().optional().nullable(),
  enabled: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = feedSchema.parse(await req.json());
  const feed = await prisma.feedSource.create({ data: body });

  await writeAuditLog({
    userId: session.user.id,
    action: "feed.create",
    entity: "FeedSource",
    entityId: feed.id,
  });

  return NextResponse.json(feed, { status: 201 });
}
