import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Plus, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdvisoryCard } from "@/components/advisory/AdvisoryCard";
import { getAdvisoryExcerpt } from "@/lib/advisory/markdown";
import { cn } from "@/lib/utils";

export default async function AdvisoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const { status } = await searchParams;
  const canEdit = hasMinRole(session!.user.role as Role, Role.Analyst);

  const advisories = await prisma.advisory.findMany({
    where: status ? { status: status as "draft" | "review" | "published" } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      template: { select: { name: true } },
    },
  });

  const counts = await prisma.advisory.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));
  const total = counts.reduce((s, c) => s + c._count.id, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="IR // Advisory Ops"
        title="Threat Bulletins"
        subtitle={`${total} advisories · ${countMap.draft ?? 0} draft · ${countMap.published ?? 0} published`}
      >
        {canEdit && (
          <Button asChild>
            <Link href="/app/advisories/new">
              <Plus className="mr-2 h-4 w-4" />
              New Bulletin
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "", label: "ALL", count: total },
          { key: "draft", label: "DRAFT", count: countMap.draft ?? 0 },
          { key: "review", label: "REVIEW", count: countMap.review ?? 0 },
          { key: "published", label: "PUBLISHED", count: countMap.published ?? 0 },
        ].map((s) => (
          <Button
            key={s.key || "all"}
            variant={status === s.key || (!status && !s.key) ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={s.key ? `/app/advisories?status=${s.key}` : "/app/advisories"}>
              {s.label}
              <span className={cn("ml-1.5 rounded-sm px-1.5 py-0.5 text-[10px]", status === s.key || (!status && !s.key) ? "bg-black/20" : "bg-cyan-950/50 text-cyan-500/70")}>
                {s.count}
              </span>
            </Link>
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {advisories.length === 0 ? (
          <div className="cyber-panel py-16 text-center">
            <FileWarning className="mx-auto mb-3 h-8 w-8 text-cyan-600/50" />
            <p className="font-mono-cyber text-sm text-muted-foreground">// No bulletins in queue</p>
            {canEdit && (
              <Button asChild className="mt-4" variant="outline">
                <Link href="/app/advisories/new">Create first advisory</Link>
              </Button>
            )}
          </div>
        ) : (
          advisories.map((adv) => (
            <AdvisoryCard
              key={adv.id}
              canEdit={canEdit}
              advisory={{
                id: adv.id,
                title: adv.title,
                status: adv.status,
                updatedAt: adv.updatedAt.toISOString(),
                excerpt: adv.aiGeneratedContent
                  ? getAdvisoryExcerpt(adv.aiGeneratedContent)
                  : null,
                templateName: adv.template?.name ?? null,
                linkedCount: adv.linkedArticleIds.length,
                hasAiContent: Boolean(adv.aiGeneratedContent),
                authorName: adv.createdBy.name ?? adv.createdBy.email,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
