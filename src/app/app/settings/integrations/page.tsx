"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Bot, Database, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader, CyberCard } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

interface IntegrationsState {
  deepseek: {
    model: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    hasApiKey: boolean;
  };
  nvd: { hasApiKey: boolean };
  ingest: { backfillDays: number; refreshIntervalMinutes: number; retentionDays: number };
}

function KeyStatus({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono-cyber text-[10px] uppercase tracking-wider",
        configured
          ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-400"
          : "border-amber-500/40 bg-amber-950/30 text-amber-400"
      )}
    >
      {configured ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {configured ? "Configured" : "Not set"}
    </span>
  );
}

export default function IntegrationsSettingsPage() {
  const [settings, setSettings] = useState<IntegrationsState | null>(null);
  const [deepseekKey, setDeepseekKey] = useState("");
  const [nvdKey, setNvdKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch("/api/settings?section=integrations")
      .then((r) => r.json())
      .then(setSettings);

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "integrations",
        data: {
          deepseek: {
            apiKey: deepseekKey || undefined,
            model: settings.deepseek.model,
            maxTokens: settings.deepseek.maxTokens,
            temperature: settings.deepseek.temperature,
            systemPrompt: settings.deepseek.systemPrompt,
          },
          nvd: {
            apiKey: nvdKey || undefined,
          },
          ingest: {
            backfillDays: settings.ingest.backfillDays,
            refreshIntervalMinutes: settings.ingest.refreshIntervalMinutes,
          },
        },
      }),
    });

    setDeepseekKey("");
    setNvdKey("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  };

  const clearKey = async (provider: "deepseek" | "nvd") => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "integrations",
        data: {
          [provider]: { clearApiKey: true },
        },
      }),
    });
    setSaving(false);
    load();
  };

  if (!settings) {
    return <p className="font-mono-cyber text-muted-foreground">Loading integrations...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/app/settings">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Systems Control
        </Link>
      </Button>

      <PageHeader
        badge="SYS // Integrations"
        title="API Keys & Config"
        subtitle="All keys stored encrypted in the database — no .env editing required"
      />

      <CyberCard title="DeepSeek AI" icon={Bot}>
        <div className="mb-4 flex items-center justify-between">
          <KeyStatus configured={settings.deepseek.hasApiKey} />
          {settings.deepseek.hasApiKey && (
            <Button type="button" variant="ghost" size="sm" onClick={() => clearKey("deepseek")}>
              Clear key
            </Button>
          )}
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/80">
              API Key
            </Label>
            <Input
              type="password"
              value={deepseekKey}
              onChange={(e) => setDeepseekKey(e.target.value)}
              placeholder={settings.deepseek.hasApiKey ? "••••••••••••  (leave blank to keep)" : "sk-..."}
            />
            <p className="text-xs text-muted-foreground">
              Get your key at{" "}
              <a
                href="https://platform.deepseek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                platform.deepseek.com
              </a>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              value={settings.deepseek.model}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  deepseek: { ...settings.deepseek, model: e.target.value },
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={settings.deepseek.maxTokens}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    deepseek: {
                      ...settings.deepseek,
                      maxTokens: parseInt(e.target.value, 10),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={settings.deepseek.temperature}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    deepseek: {
                      ...settings.deepseek,
                      temperature: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              rows={5}
              value={settings.deepseek.systemPrompt}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  deepseek: { ...settings.deepseek, systemPrompt: e.target.value },
                })
              }
            />
          </div>
        </div>
      </CyberCard>

      <CyberCard title="NVD (NIST Vulnerabilities)" icon={Database}>
        <div className="mb-4 flex items-center justify-between">
          <KeyStatus configured={settings.nvd.hasApiKey} />
          {settings.nvd.hasApiKey && (
            <Button type="button" variant="ghost" size="sm" onClick={() => clearKey("nvd")}>
              Clear key
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/80">
            NVD API Key (optional, speeds up CVE backfill)
          </Label>
          <Input
            type="password"
            value={nvdKey}
            onChange={(e) => setNvdKey(e.target.value)}
            placeholder={settings.nvd.hasApiKey ? "••••••••••••  (leave blank to keep)" : "Enter NVD API key"}
          />
          <p className="text-xs text-muted-foreground">
            Request a free key at{" "}
            <a
              href="https://nvd.nist.gov/developers/request-an-api-key"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              nvd.nist.gov/developers
            </a>
            . Without a key, ingestion is rate-limited to 5 requests / 30s.
          </p>
        </div>
      </CyberCard>

      <CyberCard title="Ingestion Defaults" icon={KeyRound}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/80">
              Auto-refresh interval (minutes)
            </Label>
            <Input
              type="number"
              min={30}
              max={1440}
              value={settings.ingest.refreshIntervalMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ingest: {
                    ...settings.ingest,
                    refreshIntervalMinutes: Math.max(30, parseInt(e.target.value, 10) || 60),
                  },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              All enabled threat feeds refresh on this schedule (minimum 30 min, default 60 min).
              Requires the ingest worker to be running.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/80">
              Backfill window (days)
            </Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={settings.ingest.backfillDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ingest: {
                    ...settings.ingest,
                    backfillDays: parseInt(e.target.value, 10) || 60,
                  },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Used when you click &quot;Backfill&quot; on the Intel Feeds page.
            </p>
          </div>
        </div>
        <p className="mt-4 border-t border-cyan-500/10 pt-4 text-xs text-muted-foreground">
          Articles older than {settings.ingest.retentionDays} days are automatically deleted on
          each scheduled refresh.
        </p>
      </CyberCard>

      <div className="flex items-center gap-4">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
        {saved && (
          <p className="font-mono-cyber text-sm text-emerald-400">// Settings encrypted & saved</p>
        )}
      </div>
    </div>
  );
}
