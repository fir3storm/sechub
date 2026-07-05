import { prisma } from "@/lib/db";
import { cvssToSeverity, fetchNvdCve, fetchRecentNvdCves } from "@/lib/ingestion/nvd";
import { writeAuditLog } from "@/lib/audit";
import { getNvdApiKey } from "@/lib/settings";
import { formatIngestError } from "@/lib/ingestion/errors";
import { refreshNewsArticleSearchVector } from "@/lib/search/updateSearchVector";

export async function ingestNvdFeed(
  daysBack = 1
): Promise<{ created: number; updated: number; skipped: number; total: number }> {
  const cveIds = await fetchRecentNvdCves(daysBack);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const cveId of cveIds) {
    try {
      const nvd = await fetchNvdCve(cveId);
      if (!nvd) {
        skipped++;
        continue;
      }

      const existing = await prisma.newsArticle.findFirst({
        where: { cveIds: { has: cveId } },
      });

      const articleData = {
        title: `${cveId} - NVD Vulnerability`,
        summary: nvd.description.slice(0, 500),
        body: nvd.description,
        sourceUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
        sourceName: "NVD",
        publishedAt: nvd.publishedAt,
        severity: cvssToSeverity(nvd.cvssScore),
        cveIds: [cveId],
        cvssScore: nvd.cvssScore,
        cvssVector: nvd.cvssVector,
        affectedDevices: nvd.affectedDevices,
        affectedOs: nvd.affectedOs,
        cpeList: nvd.cpeList,
        rawMetadata: JSON.parse(JSON.stringify({ source: "nvd", lastModified: nvd.lastModified })),
        status: "ingested" as const,
      };

      if (existing) {
        await prisma.newsArticle.update({ where: { id: existing.id }, data: articleData });
        await refreshNewsArticleSearchVector(existing.id);
        updated++;
      } else {
        const createdArticle = await prisma.newsArticle.create({ data: articleData });
        await refreshNewsArticleSearchVector(createdArticle.id);
        created++;
      }

      if (cveIds.length > 50) {
        const hasKey = !!(await getNvdApiKey());
        await new Promise((r) => setTimeout(r, hasKey ? 300 : 1200));
      }
    } catch (err) {
      skipped++;
      console.warn(`NVD ingest skipped ${cveId}:`, formatIngestError(err));
    }
  }

  await writeAuditLog({
    action: "ingest.nvd",
    entity: "FeedSource",
    metadata: { created, updated, skipped, total: cveIds.length, daysBack },
  });

  return { created, updated, skipped, total: cveIds.length };
}
