"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { canManageUser, getAssignableRoles } from "@/lib/rbac";
import { Role } from "@prisma/client";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface Actor {
  id: string;
  role: Role;
}

function UserRow({
  user,
  actor,
  assignableRoles,
  onUpdated,
}: {
  user: User;
  actor: Actor;
  assignableRoles: Role[];
  onUpdated: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const manageable = canManageUser(actor.role, actor.id, {
    id: user.id,
    role: user.role as Role,
  });

  const updateRole = async (role: string) => {
    setError("");
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update role");
      return;
    }
    onUpdated();
  };

  const resetPassword = async () => {
    if (newPassword.length < 8) return;
    setResetting(true);
    setError("");
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to reset password");
      setResetting(false);
      return;
    }
    setNewPassword("");
    setResetting(false);
    onUpdated();
  };

  const deleteUser = async () => {
    if (!confirm(`Remove operator ${user.email}?`)) return;
    setDeleting(true);
    setError("");
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete user");
      setDeleting(false);
      return;
    }
    onUpdated();
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{user.name ?? user.email}</p>
            <p className="break-all text-sm text-muted-foreground">
              {user.email} · Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
            </p>
            {user.id === actor.id && (
              <p className="mt-1 text-xs text-cyan-500/80">This is your account</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {manageable ? (
              <Select value={user.role} onValueChange={updateRole}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="rounded-sm border border-cyan-500/20 px-3 py-2 font-mono-cyber text-xs uppercase text-cyan-400">
                {user.role}
              </span>
            )}
            {manageable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-400 hover:bg-red-950/30"
                disabled={deleting}
                onClick={deleteUser}
              >
                <Trash2 className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{deleting ? "..." : "Remove"}</span>
              </Button>
            )}
          </div>
        </div>

        {manageable && (
          <div className="flex flex-col gap-2 border-t border-cyan-500/10 pt-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label className="text-xs">Reset password</Label>
              <Input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={resetting || newPassword.length < 8}
              onClick={resetPassword}
            >
              {resetting ? "Saving..." : "Set password"}
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [actor, setActor] = useState<Actor | null>(null);
  const [form, setForm] = useState<{
    email: string;
    name: string;
    password: string;
    role: Role;
  }>({ email: "", name: "", password: "", role: Role.Viewer });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const assignableRoles = actor ? getAssignableRoles(actor.role) : [];

  const load = async () => {
    const [usersRes, accountRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/account"),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (accountRes.ok) {
      const account = await accountRes.json();
      setActor({ id: account.id, role: account.role as Role });
      if (!getAssignableRoles(account.role as Role).includes(form.role as Role)) {
        setForm((f) => ({ ...f, role: Role.Viewer }));
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createUser = async () => {
    setError("");
    setMessage("");
    if (!form.email || form.password.length < 8) {
      setError("Email and password (min 8 characters) are required");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create user");
      return;
    }
    setForm({ email: "", name: "", password: "", role: Role.Viewer });
    setMessage(`Operator ${data.email} created — they must change password on first login`);
    load();
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="w-fit">
        <Link href="/app/settings">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </Button>

      <PageHeader
        badge="SYS // RBAC"
        title="Operators"
        subtitle="Add admin users, assign roles, and manage access"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-cyan-400" />
            Add operator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Display name"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin: settings & users · Analyst: create content · Viewer: read only
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <Button onClick={createUser} disabled={creating} className="w-full sm:w-auto">
            {creating ? "Creating..." : "Create operator"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="font-mono-cyber text-xs uppercase tracking-wider text-muted-foreground">
          {users.length} operator{users.length === 1 ? "" : "s"}
        </p>
        {actor &&
          users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              actor={actor}
              assignableRoles={assignableRoles}
              onUpdated={load}
            />
          ))}
      </div>
    </div>
  );
}
