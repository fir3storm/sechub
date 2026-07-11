import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { refreshNewsArticleSearchVector } from "@/lib/search/updateSearchVector";
import { enrichArticlesByIds } from "@/lib/ingestion/enrich";
import { z } from "zod";

const bulkSchema = z.object({
  action: z.enum(["archive", "enrich"]),
  ids: z.array(z.string()).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { action, ids } = bulkSchema.parse(await req.json());

  if (action === "archive") {
    await prisma.newsArticle.updateMany({
      where: { id: { in: ids } },
      data: { status: "archived" },
    });

    for (const id of ids) {
      await refreshNewsArticleSearchVector(id);
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "news.bulk_archive",
      entity: "NewsArticle",
      metadata: { count: ids.length, ids },
    });

    return NextResponse.json({ success: true, archived: ids.length });
  }

  const result = await enrichArticlesByIds(ids);
  return NextResponse.json({ success: true, enrich: true, result });
}
