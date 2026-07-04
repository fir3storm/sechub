import { prisma } from "@/lib/db";
import { fetchNvdCve, cvssToSeverity } from "@/lib/ingestion/nvd";
import { writeAuditLog } from "@/lib/audit";

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

export async function ingestCisaKev(): Promise<{ created: number; updated: number }> {
  const res = await fetch(CISA_KEV_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CISA KEV fetch failed: ${res.status}`);

  const data = await res.json();
  const entries: KevEntry[] = data.vulnerabilities ?? [];
  let created = 0;
  let updated = 0;

  for (const entry of entries) {
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

    const existing = await prisma.newsArticle.findFirst({
      where: {
        OR: [{ cveIds: { has: cveId } }, { sourceUrl: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog` }],
      },
    });

    const uniqueUrl = `https://www.cisa.gov/known-exploited-vulnerabilities-catalog#${cveId}`;

    const articleData = {
      title: `[KEV] ${entry.vulnerabilityName}`,
      summary: entry.shortDescription.slice(0, 500),
      body,
      sourceUrl: uniqueUrl,
      sourceName: "CISA KEV",
      publishedAt: new Date(entry.dateAdded),
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
      updated++;
    } else {
      await prisma.newsArticle.create({ data: articleData });
      created++;
    }
  }

  await writeAuditLog({
    action: "ingest.cisa_kev",
    metadata: { created, updated, total: entries.length },
  });

  return { created, updated };
}
