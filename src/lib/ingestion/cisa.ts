import { prisma } from "@/lib/db";
import { fetchNvdCve, cvssToSeverity } from "@/lib/ingestion/nvd";
import { writeAuditLog } from "@/lib/audit";
import { parseValidDateOrNow } from "@/lib/ingestion/dates";
import { formatIngestError } from "@/lib/ingestion/errors";
import { refreshNewsArticleSearchVector } from "@/lib/search/updateSearchVector";
import { assignArticleCategories } from "@/lib/ingestion/categorize";
import { getIngestSettings } from "@/lib/settings";
import { buildSummary } from "@/lib/ingestion/article-content";

const CISA_KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  notes?: string;
}

export async function ingestCisaKev(): Promise<{
  created: number;
  updated: number;
  skipped: number;
}> {
  const res = await fetch(CISA_KEV_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CISA KEV fetch failed: ${res.status}`);

  const data = await res.json();
  const entries: KevEntry[] = data.vulnerabilities ?? [];
  const ingestSettings = await getIngestSettings();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      const cveId = entry.cveID;
      const nvd = await fetchNvdCve(cveId);

      const device = `${entry.vendorProject.toLowerCase().replace(/\s+/g, "_")}:${entry.product.toLowerCase().replace(/\s+/g, "_")}`;
      const body = [
        entry.shortDescription,
        "",
        `Required Action: ${entry.requiredAction}`,
        `Due Date: ${entry.dueDate}`,
        entry.notes ? `Notes: ${entry.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const uniqueUrl = `https://www.cisa.gov/known-exploited-vulnerabilities-catalog#${cveId}`;

      const existing = await prisma.newsArticle.findFirst({
        where: {
          OR: [{ cveIds: { has: cveId } }, { sourceUrl: uniqueUrl }],
        },
      });

      const articleData = {
        title: `[KEV] ${entry.vulnerabilityName}`,
        summary: buildSummary(entry.shortDescription, ingestSettings.summaryMaxChars, entry.vulnerabilityName),
        body,
        sourceUrl: uniqueUrl,
        sourceName: "CISA KEV",
        publishedAt: parseValidDateOrNow(entry.dateAdded),
        severity: "critical" as const,
        cveIds: [cveId],
        cvssScore: nvd?.cvssScore ?? null,
        cvssVector: nvd?.cvssVector ?? null,
        affectedDevices: nvd?.affectedDevices.length ? nvd.affectedDevices : [device],
        affectedOs: nvd?.affectedOs ?? [],
        cpeList: nvd?.cpeList ?? [],
        rawMetadata: JSON.parse(JSON.stringify({ source: "cisa_kev", entry })),
        status: "ingested" as const,
      };

      if (existing) {
        await prisma.newsArticle.update({
          where: { id: existing.id },
          data: {
            ...articleData,
            severity: nvd ? cvssToSeverity(nvd.cvssScore) : "critical",
          },
        });
        await refreshNewsArticleSearchVector(existing.id);
        await assignArticleCategories(existing.id, articleData.title, articleData.body, [cveId]);
        updated++;
      } else {
        const createdArticle = await prisma.newsArticle.create({ data: articleData });
        await refreshNewsArticleSearchVector(createdArticle.id);
        await assignArticleCategories(createdArticle.id, articleData.title, articleData.body, [cveId]);
        created++;
      }
    } catch (err) {
      skipped++;
      console.warn(`CISA KEV ingest skipped ${entry.cveID}:`, formatIngestError(err));
    }
  }

  await writeAuditLog({
    action: "ingest.cisa_kev",
    metadata: { created, updated, skipped, total: entries.length },
  });

  return { created, updated, skipped };
}
