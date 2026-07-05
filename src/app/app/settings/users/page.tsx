"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
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
import { ArrowLeft } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const ROLES = ["Viewer", "Analyst", "Admin", "SuperAdmin"];

function UserRow({ user, onUpdated }: { user: User; onUpdated: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const updateRole = async (role: string) => {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    onUpdated();
  };

  const resetPassword = async () => {
    if (newPassword.length < 8) return;
    setResetting(true);
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    setNewPassword("");
    setResetting(false);
    onUpdated();
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{user.name ?? user.email}</p>
            <p className="text-sm text-muted-foreground">
              {user.email} · Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
            </p>
          </div>
          <Select value={user.role} onValueChange={updateRole}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 border-t border-cyan-500/10 pt-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label className="text-xs">Reset password (admin)</Label>
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
            disabled={resetting || newPassword.length < 8}
            onClick={resetPassword}
          >
            {resetting ? "Saving..." : "Set password"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "Viewer" });

  const load = () => fetch("/api/users").then((r) => r.json()).then(setUsers);
  useEffect(() => { load(); }, []);

  const createUser = async () => {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ email: "", name: "", password: "", role: "Viewer" });
    load();
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/app/settings">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </Button>

      <h1 className="text-3xl font-bold">Users & Roles</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={createUser}>Create User</Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {users.map((user) => (
          <UserRow key={user.id} user={user} onUpdated={load} />
        ))}
      </div>
    </div>
  );
}
