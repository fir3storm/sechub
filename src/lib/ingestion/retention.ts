import { subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function purgeOldNews(retentionDays: number): Promise<number> {
  const cutoff = subDays(new Date(), retentionDays);

  const result = await prisma.newsArticle.deleteMany({
    where: { publishedAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    await writeAuditLog({
      action: "ingest.purge",
      entity: "NewsArticle",
      metadata: { deleted: result.count, retentionDays, cutoff: cutoff.toISOString() },
    });
  }

  return result.count;
}
