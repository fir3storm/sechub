import { cn } from "@/lib/utils";
import type { Severity } from "@prisma/client";

const threatClass: Record<Severity, string> = {
  critical: "threat-critical",
  high: "threat-high",
  medium: "threat-medium",
  low: "threat-low",
  info: "threat-info",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
        threatClass[severity],
        className
      )}
    >
      <span className={cn("status-dot", severity === "critical" && "status-dot-pulse")} />
      {severity}
    </span>
  );
}

export function CveBadge({ cve }: { cve: string }) {
  return <span className="cve-badge">{cve}</span>;
}

export function threatClassName(severity: Severity): string {
  return threatClass[severity];
}
