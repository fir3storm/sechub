import { fetchNvdCve, cvssToSeverity, type NvdCveData } from "@/lib/ingestion/nvd";
import { getKevCveSet } from "@/lib/cve/kev-catalog";
import type { Severity } from "@prisma/client";

export interface CveEnrichment {
  cveId: string;
  inKev: boolean;
  severity: Severity;
  nvd: NvdCveData | null;
}

export async function getCveEnrichments(cveIds: string[]): Promise<CveEnrichment[]> {
  const unique = [...new Set(cveIds)].slice(0, 8);
  if (unique.length === 0) return [];

  const kevSet = await getKevCveSet();

  const results = await Promise.all(
    unique.map(async (cveId) => {
      const nvd = await fetchNvdCve(cveId);
      return {
        cveId,
        inKev: kevSet.has(cveId),
        severity: cvssToSeverity(nvd?.cvssScore ?? null),
        nvd,
      };
    })
  );

  return results;
}
