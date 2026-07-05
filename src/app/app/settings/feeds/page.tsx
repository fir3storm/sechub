"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Play, Plus, History } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RECOMMENDED_RSS_FEEDS } from "@/lib/ingestion/feeds-catalog";

interface Feed {
  id: string;
  name: string;
  type: string;
  url: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
}

export default function FeedsSettingsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [newFeed, setNewFeed] = useState({ name: "", type: "RSS", url: "" });

  const [backfillDays, setBackfillDays] = useState(60);
  const [refreshMinutes, setRefreshMinutes] = useState(60);

  const load = () =>
    Promise.all([
      fetch("/api/feeds").then((r) => r.json()).then(setFeeds),
      fetch("/api/settings?section=integrations")
        .then((r) => r.json())
        .then((s) => {
          setBackfillDays(s.ingest?.backfillDays ?? 60);
          setRefreshMinutes(s.ingest?.refreshIntervalMinutes ?? 60);
        }),
    ]);
  useEffect(() => { load(); }, []);

  const triggerIngest = async (feedId?: string, backfill = false) => {
    setRunning(backfill ? "backfill" : (feedId ?? "all"));
    await fetch("/api/ingest/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedId, backfill, daysBack: backfillDays }),
    });
    setRunning(null);
    load();
  };

  const addRecommended = async (name: string, url: string) => {
    await fetch("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "RSS", url }),
    });
    load();
  };

  const addFeed = async () => {
    await fetch("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newFeed.name,
        type: newFeed.type,
        url: newFeed.url || null,
      }),
    });
    setNewFeed({ name: "", type: "RSS", url: "" });
    load();
  };

  const toggleFeed = async (feed: Feed) => {
    await fetch(`/api/feeds/${feed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !feed.enabled }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/app/settings">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </Button>

      <PageHeader
        badge="SYS // Intel Feeds"
        title="Feed Pipeline"
        subtitle={`Auto-refresh every ${refreshMinutes} min · articles older than 60 days are purged`}
      >
        <Button variant="outline" onClick={() => triggerIngest(undefined, true)} disabled={!!running}>
          <History className="mr-2 h-4 w-4" />
          {running === "backfill" ? "Backfilling..." : `Backfill ${backfillDays} Days`}
        </Button>
        <Button onClick={() => triggerIngest()} disabled={!!running}>
          <Play className="mr-2 h-4 w-4" />
          {running === "all" ? "Running..." : "Run All"}
        </Button>
      </PageHeader>

      <div className="space-y-4">
        {feeds.map((feed) => (
          <Card key={feed.id}>
            <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base">{feed.name}</CardTitle>
                <p className="break-all text-sm text-muted-foreground">
                  {feed.type} {feed.url && `· ${feed.url}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleFeed(feed)}
                >
                  {feed.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => triggerIngest(feed.id)}
                  disabled={running === feed.id}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Last run:{" "}
                {feed.lastRunAt ? format(new Date(feed.lastRunAt), "PPp") : "Never"}
                {feed.lastRunStatus && ` · ${feed.lastRunStatus}`}
              </p>
              {feed.lastRunError && (
                <p className="text-xs text-red-500 mt-1">{feed.lastRunError}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended RSS Feeds</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {RECOMMENDED_RSS_FEEDS.map((f) => {
            const exists = feeds.some((feed) => feed.url === f.url);
            return (
              <div
                key={f.url}
                className="flex items-start justify-between gap-2 rounded-sm border border-cyan-500/10 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exists}
                  onClick={() => addRecommended(f.name, f.url)}
                >
                  {exists ? "Added" : "Add"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add RSS Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={newFeed.name}
              onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={newFeed.type} onValueChange={(v) => setNewFeed({ ...newFeed, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RSS">RSS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input
              value={newFeed.url}
              onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <Button onClick={addFeed}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feed
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
