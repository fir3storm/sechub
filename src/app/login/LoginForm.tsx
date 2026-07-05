"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Lock, Mail, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("ACCESS DENIED — Invalid credentials");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(
        "CONNECTION FAILED — Ensure SecHub is running at http://localhost:3001 and refresh the page"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-[#03060c] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_60%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="cyber-panel p-8">
          <span className="cyber-corner-tl" />
          <span className="cyber-corner-tr" />
          <span className="cyber-corner-bl" />
          <span className="cyber-corner-br" />

          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-sm border border-cyan-400/40 bg-cyan-950/50 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <Shield className="h-8 w-8 text-cyan-400" />
            </div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-[0.15em] text-cyan-50 cyber-glow-text">
              SecHub
            </h1>
            <p className="mt-2 font-mono-cyber text-xs uppercase tracking-[0.25em] text-cyan-500/70">
              Threat Intelligence Gateway
            </p>
            <div className="mt-4 flex items-center justify-center gap-4 font-mono-cyber text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="status-dot bg-emerald-400" /> ENCRYPTED
              </span>
              <span>|</span>
              <span>MFA READY</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/80">
                Operator ID
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sechub.local"
                  className="border-cyan-500/20 bg-black/40 pl-10 font-mono-cyber text-sm focus:border-cyan-400/50 focus:ring-cyan-400/20"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono-cyber text-xs uppercase tracking-wider text-cyan-500/80">
                Access Key
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-cyan-500/20 bg-black/40 pl-10 font-mono-cyber text-sm focus:border-cyan-400/50 focus:ring-cyan-400/20"
                  required
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-sm border border-red-500/40 bg-red-950/30 px-3 py-2 font-mono-cyber text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full border border-cyan-400/30 bg-cyan-500/20 font-display text-sm font-semibold uppercase tracking-widest text-cyan-100 hover:bg-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Initiate Session"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center font-mono-cyber text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Authorized personnel only · All access logged
        </p>
      </div>
    </div>
  );
}
