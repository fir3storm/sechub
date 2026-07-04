import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Role } from "@prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar userRole={session.user.role as Role} userName={session.user.name} />
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-emerald-500/[0.02]" />
        <div className="relative p-6 pb-16 lg:p-8 lg:pb-20">{children}</div>
      </main>
    </div>
  );
}
