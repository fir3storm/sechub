import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { refreshNewsArticleSearchVector } from "@/lib/search/updateSearchVector";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await prisma.newsArticle.findUnique({
    where: { id },
    include: {
      categories: { include: { category: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  cveIds: z.array(z.string()).optional(),
  cvssScore: z.number().optional().nullable(),
  status: z.enum(["ingested", "curated", "archived"]).optional(),
  categoryIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = updateSchema.parse(await req.json());

  if (body.categoryIds) {
    await prisma.newsArticleCategory.deleteMany({ where: { articleId: id } });
  }

  const article = await prisma.newsArticle.update({
    where: { id },
    data: {
      title: body.title,
      summary: body.summary,
      body: body.body,
      severity: body.severity,
      cveIds: body.cveIds?.map((c) => c.toUpperCase()),
      cvssScore: body.cvssScore,
      status: body.status ?? "curated",
      categories: body.categoryIds
        ? { create: body.categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    include: { categories: { include: { category: true } } },
  });

  await refreshNewsArticleSearchVector(article.id);

  await writeAuditLog({
    userId: session.user.id,
    action: "news.update",
    entity: "NewsArticle",
    entityId: id,
  });

  return NextResponse.json(article);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.newsArticle.update({
    where: { id },
    data: { status: "archived" },
  });

  await refreshNewsArticleSearchVector(id);

  await writeAuditLog({
    userId: session.user.id,
    action: "news.archive",
    entity: "NewsArticle",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
