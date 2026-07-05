import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountPasswordForm } from "@/components/account/AccountPasswordForm";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, mustChangePassword: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        badge="SEC // Operator"
        title="Account Security"
        subtitle="Update your login credentials"
      />
      <AccountPasswordForm
        email={user.email}
        mustChangePassword={user.mustChangePassword}
      />
    </div>
  );
}
