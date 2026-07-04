const NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";

export interface NvdCveData {
  cveId: string;
  description: string;
  cvssScore: number | null;
  cvssVector: string | null;
  cpeList: string[];
  affectedDevices: string[];
  affectedOs: string[];
  publishedAt: Date;
  lastModified: Date;
}

function parseCpe(cpe: string): { device: string | null; os: string | null } {
  const parts = cpe.split(":");
  if (parts.length < 6) return { device: null, os: null };
  const part = parts[2];
  const vendor = parts[3]?.toLowerCase();
  const product = parts[4]?.toLowerCase();
  if (!vendor || !product) return { device: null, os: null };

  if (part === "o") return { device: null, os: `${vendor}:${product}` };
  if (part === "a" || part === "h") return { device: `${vendor}:${product}`, os: null };
  return { device: null, os: null };
}

import { getNvdApiKey } from "@/lib/settings";

async function nvdHeadersWithKey(): Promise<HeadersInit> {
  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = await getNvdApiKey();
  if (apiKey) headers["apiKey"] = apiKey;
  return headers;
}

function fmtNvdDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T00:00:00.000`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchNvdCve(cveId: string): Promise<NvdCveData | null> {
  const res = await fetch(`${NVD_API}?cveId=${cveId}`, {
    headers: await nvdHeadersWithKey(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const item = data.vulnerabilities?.[0]?.cve;
  if (!item) return null;

  const descriptions =
    item.descriptions?.find((d: { lang: string }) => d.lang === "en")?.value ?? "";
  const metrics = item.metrics?.cvssMetricV31?.[0] ?? item.metrics?.cvssMetricV30?.[0];
  const cvssScore = metrics?.cvssData?.baseScore ?? null;
  const cvssVector = metrics?.cvssData?.vectorString ?? null;

  const cpeList: string[] = [];
  const devices = new Set<string>();
  const osSet = new Set<string>();

  for (const config of item.configurations ?? []) {
    for (const node of config.nodes ?? []) {
      for (const match of node.cpeMatch ?? []) {
        if (match.criteria) {
          cpeList.push(match.criteria);
          const parsed = parseCpe(match.criteria);
          if (parsed.device) devices.add(parsed.device);
          if (parsed.os) osSet.add(parsed.os);
        }
      }
    }
  }

  return {
    cveId: item.id,
    description: descriptions,
    cvssScore,
    cvssVector,
    cpeList,
    affectedDevices: [...devices],
    affectedOs: [...osSet],
    publishedAt: new Date(item.published),
    lastModified: new Date(item.lastModified),
  };
}

/** Fetch CVE IDs published or modified within the last N days (paginated). */
export async function fetchRecentNvdCves(daysBack = 1): Promise<string[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);

  const allIds: string[] = [];
  let startIndex = 0;
  const resultsPerPage = 500;
  const delayMs = (await getNvdApiKey()) ? 600 : 6500;

  while (true) {
    const url =
      `${NVD_API}?pubStartDate=${fmtNvdDate(start)}&pubEndDate=${fmtNvdDate(end)}` +
      `&resultsPerPage=${resultsPerPage}&startIndex=${startIndex}`;

    const res = await fetch(url, { headers: await nvdHeadersWithKey() });
    if (!res.ok) break;

    const data = await res.json();
    const batch = (data.vulnerabilities ?? []).map(
      (v: { cve: { id: string } }) => v.cve.id
    );
    allIds.push(...batch);

    const total = data.totalResults ?? 0;
    startIndex += resultsPerPage;
    if (startIndex >= total || batch.length === 0) break;

    await sleep(delayMs);
  }

  return [...new Set(allIds)];
}

export function cvssToSeverity(score: number | null): "critical" | "high" | "medium" | "low" | "info" {
  if (score === null) return "medium";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "info";
}
