import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { searchNews } from "@/lib/search/fullTextSearch";
import { refreshNewsArticleSearchVector } from "@/lib/search/updateSearchVector";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const multiParams: Record<string, string | string[]> = { ...params };
  for (const key of ["category", "device", "os", "severity"]) {
    const vals = req.nextUrl.searchParams.getAll(key);
    if (vals.length > 1) multiParams[key] = vals;
  }

  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(params.limit ?? "20"), 10)));

  const result = await searchNews({
    ...multiParams,
    page: String(page),
    limit: String(limit),
  });

  return NextResponse.json(result);
}

const createSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  sourceName: z.string().default("manual"),
  sourceUrl: z.string().url().optional().nullable(),
  publishedAt: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).default("medium"),
  cveIds: z.array(z.string()).default([]),
  cvssScore: z.number().optional().nullable(),
  categoryIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.parse(await req.json());

  const article = await prisma.newsArticle.create({
    data: {
      title: body.title,
      summary: body.summary,
      body: body.body,
      sourceName: body.sourceName,
      sourceUrl: body.sourceUrl,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
      severity: body.severity,
      cveIds: body.cveIds.map((c) => c.toUpperCase()),
      cvssScore: body.cvssScore,
      status: "curated",
      createdById: session.user.id,
      categories: {
        create: body.categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
    include: { categories: { include: { category: true } } },
  });

  await refreshNewsArticleSearchVector(article.id);

  await writeAuditLog({
    userId: session.user.id,
    action: "news.create",
    entity: "NewsArticle",
    entityId: article.id,
  });

  return NextResponse.json(article, { status: 201 });
}
