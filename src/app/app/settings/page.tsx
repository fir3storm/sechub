import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { Bot, Rss, Users, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

const settingsLinks = [
  {
    href: "/app/settings/integrations",
    title: "API Keys & Integrations",
    description: "Bramhashiv AI, NVD, ingestion — all keys in one place",
    icon: Bot,
    code: "SYS.KEYS",
  },
  {
    href: "/app/settings/feeds",
    title: "Intel Feeds",
    description: "NVD, CISA KEV, and RSS ingestion pipelines",
    icon: Rss,
    code: "SYS.FEED",
  },
  {
    href: "/app/settings/templates",
    title: "Bulletin Templates",
    description: "Advisory form schema designer",
    icon: FileText,
    code: "SYS.TPL",
  },
  {
    href: "/app/settings/users",
    title: "Access Control",
    description: "Operators, roles, and RBAC clearance",
    icon: Users,
    code: "SYS.RBAC",
  },
];

export default async function SettingsPage() {
  const session = await auth();
  if (!hasMinRole(session!.user.role as Role, Role.Admin)) {
    redirect("/app");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge="SYS // Configuration"
        title="Systems Control"
        subtitle="Platform configuration and administration"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="cyber-panel-hover group h-full p-5">
              <span className="cyber-corner-tl" />
              <span className="cyber-corner-br" />
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-cyan-500/30 bg-cyan-950/40">
                  <item.icon className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-mono-cyber text-[10px] text-cyan-600">{item.code}</p>
                  <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-cyan-50 group-hover:text-cyan-300">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
