"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader, CyberCard } from "@/components/layout/PageHeader";

export function AccountPasswordForm({
  email,
  mustChangePassword,
}: {
  email: string;
  mustChangePassword: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Failed to update password");
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await update({ mustChangePassword: false });
      router.refresh();
      router.push("/app");
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {mustChangePassword && (
        <div className="flex items-start gap-3 rounded-sm border border-amber-500/40 bg-amber-950/30 px-4 py-3 font-mono-cyber text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Your account is using a default or temporary password. Change it below before
            continuing normal operations.
          </p>
        </div>
      )}

      <CyberCard title="Change Password" icon={KeyRound}>
        <p className="mb-4 text-sm text-muted-foreground">
          Signed in as <span className="font-mono-cyber text-cyan-400">{email}</span>
        </p>

        <form onSubmit={submit} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Password updated successfully
            </div>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CyberCard>

      {!mustChangePassword && (
        <Button variant="ghost" asChild>
          <Link href="/app">Back to Command Center</Link>
        </Button>
      )}
    </div>
  );
}
