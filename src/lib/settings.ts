import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto/settings";

export const AI_SETTING_KEYS = {
  apiKey: "deepseek.api_key",
  model: "deepseek.model",
  maxTokens: "deepseek.max_tokens",
  temperature: "deepseek.temperature",
  systemPrompt: "deepseek.system_prompt",
} as const;

export const NVD_SETTING_KEYS = {
  apiKey: "nvd.api_key",
} as const;

export const INGEST_SETTING_KEYS = {
  backfillDays: "ingest.backfill_days",
  refreshIntervalMinutes: "ingest.refresh_interval_minutes",
  retentionDays: "ingest.retention_days",
} as const;

export const MIN_REFRESH_INTERVAL_MINUTES = 30;

const AI_DEFAULTS = {
  model: "deepseek-chat",
  maxTokens: "4096",
  temperature: "0.7",
  systemPrompt: `You are a cybersecurity advisory writer for an enterprise security team.
Write clear, actionable security advisories in markdown format.
Include sections matching the template fields provided.
Use professional tone. Prioritize accuracy and mitigation steps.`,
};

const INGEST_DEFAULTS = {
  backfillDays: "60",
  refreshIntervalMinutes: "60",
  retentionDays: "60",
};

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting) return null;
  if (setting.encrypted) return decrypt(setting.value);
  return setting.value;
}

export async function setSetting(
  key: string,
  value: string,
  encrypted = false
): Promise<void> {
  const stored = encrypted ? encrypt(value) : value;
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: stored, encrypted },
    update: { value: stored, encrypted },
  });
}

export async function deleteSetting(key: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}

export async function getAISettings() {
  const [apiKey, model, maxTokens, temperature, systemPrompt] = await Promise.all([
    getSetting(AI_SETTING_KEYS.apiKey),
    getSetting(AI_SETTING_KEYS.model),
    getSetting(AI_SETTING_KEYS.maxTokens),
    getSetting(AI_SETTING_KEYS.temperature),
    getSetting(AI_SETTING_KEYS.systemPrompt),
  ]);

  return {
    apiKey,
    model: model ?? AI_DEFAULTS.model,
    maxTokens: parseInt(maxTokens ?? AI_DEFAULTS.maxTokens, 10),
    temperature: parseFloat(temperature ?? AI_DEFAULTS.temperature),
    systemPrompt: systemPrompt ?? AI_DEFAULTS.systemPrompt,
  };
}

export async function getNvdApiKey(): Promise<string | null> {
  return (await getSetting(NVD_SETTING_KEYS.apiKey)) ?? process.env.NVD_API_KEY ?? null;
}

export async function getIngestSettings() {
  const [backfillDays, refreshIntervalMinutes, retentionDays] = await Promise.all([
    getSetting(INGEST_SETTING_KEYS.backfillDays),
    getSetting(INGEST_SETTING_KEYS.refreshIntervalMinutes),
    getSetting(INGEST_SETTING_KEYS.retentionDays),
  ]);

  const parsedRefresh = parseInt(
    refreshIntervalMinutes ?? INGEST_DEFAULTS.refreshIntervalMinutes,
    10
  );

  return {
    backfillDays: parseInt(backfillDays ?? INGEST_DEFAULTS.backfillDays, 10),
    refreshIntervalMinutes: Math.max(MIN_REFRESH_INTERVAL_MINUTES, parsedRefresh),
    retentionDays: parseInt(retentionDays ?? INGEST_DEFAULTS.retentionDays, 10),
  };
}

export async function getPublicIntegrationsSettings() {
  const [ai, nvdKey, ingest] = await Promise.all([
    getAISettings(),
    getNvdApiKey(),
    getIngestSettings(),
  ]);

  return {
    deepseek: {
      model: ai.model,
      maxTokens: ai.maxTokens,
      temperature: ai.temperature,
      systemPrompt: ai.systemPrompt,
      hasApiKey: !!ai.apiKey,
    },
    nvd: {
      hasApiKey: !!nvdKey,
    },
    ingest: {
      backfillDays: ingest.backfillDays,
      refreshIntervalMinutes: ingest.refreshIntervalMinutes,
      retentionDays: ingest.retentionDays,
    },
  };
}

/** @deprecated use getPublicIntegrationsSettings */
export async function getPublicAISettings() {
  const s = await getPublicIntegrationsSettings();
  return { ...s.deepseek, hasApiKey: s.deepseek.hasApiKey };
}
