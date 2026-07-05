"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Role } from "@prisma/client";
import { hasMinRole } from "@/lib/rbac";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { brandIcon, navItems } from "@/components/layout/nav-items";

const BrandIcon = brandIcon;

export function Sidebar({
  userRole,
  userName,
  onNavigate,
  className,
}: {
  userRole: Role;
  userName?: string | null;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "nav-rail-glow relative z-10 flex h-full w-64 flex-col border-r border-cyan-500/20 bg-[#040810]/95 backdrop-blur-xl",
        className
      )}
    >
      <div className="relative border-b border-cyan-500/20 px-5 py-5 lg:py-6">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-cyan-400/40 bg-cyan-950/50">
            <BrandIcon className="h-6 w-6 text-cyan-400" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 status-dot status-dot-pulse" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold uppercase tracking-widest text-cyan-50 cyber-glow-text">
              SecHub
            </p>
            <p className="font-mono-cyber text-[10px] uppercase tracking-[0.2em] text-cyan-500/70">
              TI // SOC Platform
            </p>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4 flex items-center gap-2 rounded-sm border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
        <Radio className="h-3 w-3 shrink-0 text-emerald-400" />
        <span className="font-mono-cyber text-[10px] uppercase tracking-wider text-emerald-400/90">
          Systems Online
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <p className="mb-2 px-3 font-mono-cyber text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Navigation
        </p>
        {navItems
          .filter((item) => hasMinRole(userRole, item.minRole))
          .map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-sm border px-3 py-2.5 text-sm transition-all",
                  active
                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.1)]"
                    : "border-transparent text-slate-400 hover:border-cyan-500/20 hover:bg-cyan-500/5 hover:text-cyan-200"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-cyan-400" : "text-slate-500 group-hover:text-cyan-500"
                  )}
                />
                <span className="font-medium tracking-wide">{item.label}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 status-dot" />
                )}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-cyan-500/20 bg-black/30 p-4">
        <div className="mb-3 rounded-sm border border-cyan-500/10 bg-cyan-950/20 p-3">
          <p className="truncate text-sm font-medium text-cyan-50">{userName ?? "Operator"}</p>
          <p className="font-mono-cyber text-[10px] uppercase tracking-wider text-cyan-500/60">
            Clearance: {userRole}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start border border-transparent font-mono-cyber text-xs uppercase tracking-wider text-slate-500 hover:border-red-500/30 hover:bg-red-950/20 hover:text-red-400"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Terminate Session
        </Button>
      </div>
    </aside>
  );
}
