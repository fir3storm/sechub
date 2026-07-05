import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getPublicIntegrationsSettings } from "@/lib/settings";
import { AlertTriangle, FileWarning, Newspaper, ShieldAlert, Activity, Zap } from "lucide-react";
import { format, subDays } from "date-fns";
import Link from "next/link";
import { PageHeader, CyberCard } from "@/components/layout/PageHeader";
import { SeverityBadge, CveBadge } from "@/components/ui/severity-badge";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const weekAgo = subDays(new Date(), 7);

  const [
    totalNews,
    criticalNews,
    kevThisWeek,
    draftAdvisories,
    publishedAdvisories,
    recentCritical,
    integrations,
  ] = await Promise.all([
    prisma.newsArticle.count({ where: { status: { not: "archived" } } }),
    prisma.newsArticle.count({
      where: { severity: "critical", status: { not: "archived" } },
    }),
    prisma.newsArticle.count({
      where: { sourceName: "CISA KEV", ingestedAt: { gte: weekAgo } },
    }),
    prisma.advisory.count({ where: { status: "draft" } }),
    prisma.advisory.count({ where: { status: "published" } }),
    prisma.newsArticle.findMany({
      where: { severity: { in: ["critical", "high"] }, status: { not: "archived" } },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        severity: true,
        publishedAt: true,
        cveIds: true,
      },
    }),
    getPublicIntegrationsSettings(),
  ]);

  const systemStatus = [
    { label: "Threat Feed", status: "ACTIVE", color: "text-emerald-400" },
    {
      label: "NVD Ingestion",
      status: integrations.nvd.hasApiKey ? "ACTIVE" : "STANDBY",
      color: integrations.nvd.hasApiKey ? "text-emerald-400" : "text-cyan-400",
    },
    { label: "CISA KEV", status: "ACTIVE", color: "text-emerald-400" },
    {
      label: "AI Engine",
      status: integrations.deepseek.hasApiKey ? "ONLINE" : "CONFIGURE",
      color: integrations.deepseek.hasApiKey ? "text-emerald-400" : "text-amber-400",
    },
  ];

  const stats = [
    {
      label: "Intel Feed",
      value: totalNews,
      icon: Newspaper,
      href: "/app/news",
      accent: "text-cyan-400",
      glow: "hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]",
    },
    {
      label: "Critical Threats",
      value: criticalNews,
      icon: AlertTriangle,
      href: "/app/news?severity=critical",
      accent: "text-red-400",
      glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]",
    },
    {
      label: "KEV / 7 Days",
      value: kevThisWeek,
      icon: ShieldAlert,
      href: "/app/news?source=CISA+KEV",
      accent: "text-orange-400",
      glow: "hover:shadow-[0_0_20px_rgba(251,146,60,0.1)]",
    },
    {
      label: "Draft Bulletins",
      value: draftAdvisories,
      icon: FileWarning,
      href: "/app/advisories?status=draft",
      accent: "text-amber-400",
      glow: "hover:shadow-[0_0_20px_rgba(251,191,36,0.1)]",
    },
    {
      label: "Published",
      value: publishedAdvisories,
      icon: Zap,
      href: "/app/advisories?status=published",
      accent: "text-emerald-400",
      glow: "hover:shadow-[0_0_20px_rgba(52,211,153,0.1)]",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        badge="SOC // Command Center"
        title="Threat Overview"
        subtitle={`Operator: ${session?.user?.name ?? session?.user?.email} · ${format(new Date(), "yyyy-MM-dd HH:mm")} UTC`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <div className={cn("cyber-panel-hover group p-4", stat.glow)}>
              <span className="cyber-corner-tl" />
              <span className="cyber-corner-br" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono-cyber text-[10px] uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className={cn("mt-2 font-display text-2xl font-bold sm:text-3xl", stat.accent)}>
                    {stat.value}
                  </p>
                </div>
                <stat.icon className={cn("h-5 w-5 opacity-60", stat.accent)} />
              </div>
              <div className="mt-3 h-0.5 w-full bg-gradient-to-r from-cyan-500/40 via-cyan-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <CyberCard title="Priority Threat Queue" icon={Activity} className="lg:col-span-2">
          {recentCritical.length === 0 ? (
            <p className="font-mono-cyber text-sm text-muted-foreground">
              // No critical threats in queue
            </p>
          ) : (
            <ul className="space-y-1">
              {recentCritical.map((item, i) => (
                <li
                  key={item.id}
                  className="group flex items-start justify-between gap-4 rounded-sm border border-transparent px-3 py-3 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/5"
                >
                  <div className="flex gap-3">
                    <span className="font-mono-cyber text-xs text-cyan-600/50">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <Link
                        href={`/app/news/${item.id}`}
                        className="font-medium text-cyan-50 transition-colors group-hover:text-cyan-300"
                      >
                        {item.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {item.cveIds.length > 0 ? (
                          item.cveIds.map((cve) => <CveBadge key={cve} cve={cve} />)
                        ) : (
                          <span className="font-mono-cyber text-xs text-muted-foreground">NO CVE</span>
                        )}
                        <span className="font-mono-cyber text-xs text-muted-foreground">
                          {format(new Date(item.publishedAt), "yyyy-MM-dd")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <SeverityBadge severity={item.severity} />
                </li>
              ))}
            </ul>
          )}
        </CyberCard>

        <CyberCard title="System Status" icon={ShieldAlert}>
          <div className="space-y-4 font-mono-cyber text-xs">
            {systemStatus.map((s) => (
              <div key={s.label} className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
                <span className="text-muted-foreground">{s.label}</span>
                <span className={cn("flex items-center gap-1.5", s.color)}>
                  <span className="status-dot bg-current" />
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </CyberCard>
      </div>
    </div>
  );
}
