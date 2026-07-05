"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Role } from "@prisma/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { brandIcon } from "@/components/layout/nav-items";

const BrandIcon = brandIcon;

export function AppShell({
  userRole,
  userName,
  children,
}: {
  userRole: Role;
  userName?: string | null;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <div className="hidden h-full shrink-0 lg:block">
        <Sidebar userRole={userRole} userName={userName} className="h-full" />
      </div>

      {navOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(100vw-3rem,16rem)] lg:hidden">
            <Sidebar
              userRole={userRole}
              userName={userName}
              onNavigate={() => setNavOpen(false)}
              className="h-full shadow-[0_0_40px_rgba(34,211,238,0.15)]"
            />
          </div>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-cyan-500/20 bg-[#040810]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 border-cyan-500/30"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <BrandIcon className="h-5 w-5 shrink-0 text-cyan-400" />
            <span className="truncate font-display text-sm font-bold uppercase tracking-widest text-cyan-50">
              SecHub
            </span>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-emerald-500/[0.02]" />
          <div className="relative p-4 pb-12 sm:p-6 sm:pb-14 lg:p-8 lg:pb-16">{children}</div>
        </main>
      </div>
    </div>
  );
}
