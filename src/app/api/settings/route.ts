import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import {
  getPublicIntegrationsSettings,
  setSetting,
  deleteSetting,
  AI_SETTING_KEYS,
  NVD_SETTING_KEYS,
  INGEST_SETTING_KEYS,
  MIN_REFRESH_INTERVAL_MINUTES,
} from "@/lib/settings";
import { rescheduleIngestJob } from "@/lib/ingestion/schedule";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const section = req.nextUrl.searchParams.get("section");

  if (section === "integrations" || section === "ai") {
    return NextResponse.json(await getPublicIntegrationsSettings());
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}

const integrationsSchema = z.object({
  deepseek: z
    .object({
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
      model: z.string().optional(),
      maxTokens: z.number().optional(),
      temperature: z.number().optional(),
      systemPrompt: z.string().optional(),
    })
    .optional(),
  nvd: z
    .object({
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
    })
    .optional(),
  ingest: z
    .object({
      backfillDays: z.number().min(1).max(365).optional(),
      refreshIntervalMinutes: z.number().min(MIN_REFRESH_INTERVAL_MINUTES).max(1440).optional(),
      summaryMaxChars: z.number().min(200).max(10000).optional(),
      fetchFullPage: z.boolean().optional(),
      enrichExisting: z.boolean().optional(),
      aiSummarizeAtIngest: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const section = body.section as string;
  const data = body.data ?? body;

  if (section === "integrations" || section === "ai") {
    const parsed = integrationsSchema.parse(data);

    if (parsed.deepseek) {
      const d = parsed.deepseek;
      if (d.clearApiKey) await deleteSetting(AI_SETTING_KEYS.apiKey);
      else if (d.apiKey) await setSetting(AI_SETTING_KEYS.apiKey, d.apiKey, true);
      if (d.model) await setSetting(AI_SETTING_KEYS.model, d.model);
      if (d.maxTokens) await setSetting(AI_SETTING_KEYS.maxTokens, String(d.maxTokens));
      if (d.temperature !== undefined) {
        await setSetting(AI_SETTING_KEYS.temperature, String(d.temperature));
      }
      if (d.systemPrompt !== undefined) {
        await setSetting(AI_SETTING_KEYS.systemPrompt, d.systemPrompt);
      }
    }

    if (parsed.nvd) {
      if (parsed.nvd.clearApiKey) await deleteSetting(NVD_SETTING_KEYS.apiKey);
      else if (parsed.nvd.apiKey) await setSetting(NVD_SETTING_KEYS.apiKey, parsed.nvd.apiKey, true);
    }

    if (parsed.ingest?.backfillDays) {
      await setSetting(INGEST_SETTING_KEYS.backfillDays, String(parsed.ingest.backfillDays));
    }
    if (parsed.ingest?.refreshIntervalMinutes) {
      await setSetting(
        INGEST_SETTING_KEYS.refreshIntervalMinutes,
        String(parsed.ingest.refreshIntervalMinutes)
      );
      try {
        await rescheduleIngestJob(parsed.ingest.refreshIntervalMinutes);
      } catch (error) {
        console.error("[settings] Failed to reschedule ingest job:", error);
      }
    }
    if (parsed.ingest?.summaryMaxChars) {
      await setSetting(INGEST_SETTING_KEYS.summaryMaxChars, String(parsed.ingest.summaryMaxChars));
    }
    if (parsed.ingest?.fetchFullPage !== undefined) {
      await setSetting(INGEST_SETTING_KEYS.fetchFullPage, String(parsed.ingest.fetchFullPage));
    }
    if (parsed.ingest?.enrichExisting !== undefined) {
      await setSetting(INGEST_SETTING_KEYS.enrichExisting, String(parsed.ingest.enrichExisting));
    }
    if (parsed.ingest?.aiSummarizeAtIngest !== undefined) {
      await setSetting(
        INGEST_SETTING_KEYS.aiSummarizeAtIngest,
        String(parsed.ingest.aiSummarizeAtIngest)
      );
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "settings.integrations_update",
      entity: "AppSetting",
    });

    return NextResponse.json(await getPublicIntegrationsSettings());
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}
