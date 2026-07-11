const CISA_KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedIds: Set<string> | null = null;
let cachedAt = 0;

export async function getKevCveSet(): Promise<Set<string>> {
  if (cachedIds && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedIds;
  }

  try {
    const res = await fetch(CISA_KEV_URL, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return cachedIds ?? new Set();

    const data = await res.json();
    const ids = new Set<string>(
      (data.vulnerabilities ?? []).map((v: { cveID: string }) => v.cveID)
    );
    cachedIds = ids;
    cachedAt = Date.now();
    return ids;
  } catch {
    return cachedIds ?? new Set();
  }
}

export async function isCveInKev(cveId: string): Promise<boolean> {
  const set = await getKevCveSet();
  return set.has(cveId);
}
