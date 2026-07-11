import { ShieldAlert, ExternalLink } from "lucide-react";
import { getCveEnrichments } from "@/lib/cve/enrichment";
import { CyberCard } from "@/components/layout/PageHeader";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { cn } from "@/lib/utils";

export async function CveEnrichmentPanel({ cveIds }: { cveIds: string[] }) {
  if (cveIds.length === 0) return null;

  const enrichments = await getCveEnrichments(cveIds);

  return (
    <CyberCard title="CVE Intelligence" icon={ShieldAlert}>
      <div className="space-y-4">
        {enrichments.map((item) => (
          <div
            key={item.cveId}
            className="rounded-sm border border-cyan-500/15 bg-cyan-950/20 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="cve-badge">{item.cveId}</span>
              <SeverityBadge severity={item.severity} />
              {item.inKev && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider",
                    "border-red-500/50 bg-red-950/40 text-red-400"
                  )}
                >
                  <span className="status-dot status-dot-pulse bg-red-400" />
                  CISA KEV — Known Exploited
                </span>
              )}
              {item.nvd?.cvssScore != null && (
                <span className="font-mono-cyber text-xs text-amber-400">
                  CVSS {item.nvd.cvssScore}
                </span>
              )}
            </div>

            {item.nvd?.description && (
              <p className="mb-3 text-sm leading-relaxed text-slate-300 line-clamp-3">
                {item.nvd.description}
              </p>
            )}

            {item.nvd?.cvssVector && (
              <p className="mb-3 font-mono-cyber text-[10px] text-muted-foreground break-all">
                {item.nvd.cvssVector}
              </p>
            )}

            {(item.nvd?.affectedDevices.length ?? 0) > 0 && (
              <div className="mb-2">
                <p className="mb-1 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
                  Affected products
                </p>
                <p className="text-xs text-slate-400">
                  {item.nvd!.affectedDevices.slice(0, 6).join(", ")}
                  {item.nvd!.affectedDevices.length > 6 && " …"}
                </p>
              </div>
            )}

            {(item.nvd?.cpeList.length ?? 0) > 0 && (
              <div className="mb-3">
                <p className="mb-1 font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/70">
                  CPE entries
                </p>
                <ul className="max-h-24 space-y-0.5 overflow-y-auto font-mono-cyber text-[10px] text-slate-500">
                  {item.nvd!.cpeList.slice(0, 5).map((cpe) => (
                    <li key={cpe} className="truncate">
                      {cpe}
                    </li>
                  ))}
                  {item.nvd!.cpeList.length > 5 && (
                    <li className="text-cyan-600/70">+{item.nvd!.cpeList.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${item.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono-cyber text-xs text-cyan-400 hover:underline"
              >
                NVD <ExternalLink className="h-3 w-3" />
              </a>
              {item.inKev && (
                <a
                  href={`https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search=${item.cveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono-cyber text-xs text-red-400 hover:underline"
                >
                  CISA KEV <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </CyberCard>
  );
}
