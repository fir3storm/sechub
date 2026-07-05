import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { Role } from "@prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <AppShell userRole={session.user.role as Role} userName={session.user.name}>
      {children}
    </AppShell>
  );
}
