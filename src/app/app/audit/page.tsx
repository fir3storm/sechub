import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AuditPage() {
  const session = await auth();
  if (!hasMinRole(session!.user.role as Role, Role.Admin)) {
    redirect("/app");
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Recent platform activity</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 100 events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Entity</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM d, HH:mm")}
                    </td>
                    <td className="py-2 pr-4">
                      {log.user?.name ?? log.user?.email ?? "System"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{log.action}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {log.entity}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
