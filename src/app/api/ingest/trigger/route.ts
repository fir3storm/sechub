import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { runIngestionForFeed, runAllEnabledFeeds, backfillAllFeeds } from "@/lib/ingestion/runner";
import { getIngestSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { feedId, daysBack, backfill } = body as {
    feedId?: string;
    daysBack?: number;
    backfill?: boolean;
  };

  const ingestDefaults = await getIngestSettings();
  const range = backfill ? (daysBack ?? ingestDefaults.backfillDays) : (daysBack ?? 1);

  try {
    const result = feedId
      ? await runIngestionForFeed(feedId, range)
      : backfill
        ? await backfillAllFeeds(range)
        : await runAllEnabledFeeds(range);

    return NextResponse.json({ success: true, daysBack: range, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
