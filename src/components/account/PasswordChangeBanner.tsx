import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PasswordChangeBanner() {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-sm border border-amber-500/40 bg-amber-950/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>
          <span className="font-semibold">Security notice:</span> You are using a default password.
          Change it now to protect your account.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-500/40">
        <Link href="/app/account">Change password</Link>
      </Button>
    </div>
  );
}
