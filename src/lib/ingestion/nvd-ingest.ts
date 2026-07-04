import { prisma } from "@/lib/db";
import { cvssToSeverity, fetchNvdCve, fetchRecentNvdCves } from "@/lib/ingestion/nvd";
import { writeAuditLog } from "@/lib/audit";
import { getNvdApiKey } from "@/lib/settings";

export async function ingestNvdFeed(
  daysBack = 1
): Promise<{ created: number; updated: number; total: number }> {
  const cveIds = await fetchRecentNvdCves(daysBack);
  let created = 0;
  let updated = 0;

  for (const cveId of cveIds) {
    const nvd = await fetchNvdCve(cveId);
    if (!nvd) continue;

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
      updated++;
    } else {
      await prisma.newsArticle.create({ data: articleData });
      created++;
    }

    // Respect NVD rate limits during large backfills
    if (cveIds.length > 50) {
      const hasKey = !!(await getNvdApiKey());
      await new Promise((r) => setTimeout(r, hasKey ? 300 : 1200));
    }
  }

  await writeAuditLog({
    action: "ingest.nvd",
    entity: "FeedSource",
    metadata: { created, updated, total: cveIds.length, daysBack },
  });

  return { created, updated, total: cveIds.length };
}
