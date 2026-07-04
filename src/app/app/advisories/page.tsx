import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Plus, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  draft: "border-amber-500/40 bg-amber-950/30 text-amber-400",
  review: "border-cyan-500/40 bg-cyan-950/30 text-cyan-400",
  published: "border-emerald-500/40 bg-emerald-950/30 text-emerald-400",
};

export default async function AdvisoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const { status } = await searchParams;
  const canCreate = hasMinRole(session!.user.role as Role, Role.Analyst);

  const advisories = await prisma.advisory.findMany({
    where: status ? { status: status as "draft" | "review" | "published" } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      template: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="IR // Advisory Ops"
        title="Threat Bulletins"
        subtitle="Security advisories and incident communications"
      >
        {canCreate && (
          <Button asChild>
            <Link href="/app/advisories/new">
              <Plus className="mr-2 h-4 w-4" />
              New Bulletin
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {["", "draft", "review", "published"].map((s) => (
          <Button
            key={s || "all"}
            variant={status === s || (!status && !s) ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={s ? `/app/advisories?status=${s}` : "/app/advisories"}>
              {s ? s.toUpperCase() : "ALL"}
            </Link>
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {advisories.length === 0 ? (
          <div className="cyber-panel py-16 text-center">
            <FileWarning className="mx-auto mb-3 h-8 w-8 text-cyan-600/50" />
            <p className="font-mono-cyber text-sm text-muted-foreground">// No bulletins in queue</p>
          </div>
        ) : (
          advisories.map((adv) => (
            <div key={adv.id} className="cyber-panel-hover p-5">
              <span className="cyber-corner-tl" />
              <span className="cyber-corner-br" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/app/advisories/${adv.id}`}
                    className="font-display text-lg font-semibold tracking-wide text-cyan-50 hover:text-cyan-300"
                  >
                    {adv.title}
                  </Link>
                  <p className="mt-1 font-mono-cyber text-xs text-muted-foreground">
                    {adv.createdBy.name ?? adv.createdBy.email} · UPD{" "}
                    {format(new Date(adv.updatedAt), "yyyy-MM-dd")}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-sm border px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider",
                    statusStyle[adv.status] ?? statusStyle.draft
                  )}
                >
                  {adv.status}
                </span>
              </div>
              {adv.aiGeneratedContent && (
                <p className="mt-3 line-clamp-2 border-t border-cyan-500/10 pt-3 text-sm text-slate-400">
                  {adv.aiGeneratedContent.slice(0, 200)}...
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
