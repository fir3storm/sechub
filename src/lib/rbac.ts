import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

const ROLE_HIERARCHY: Record<Role, number> = {
  Viewer: 1,
  Analyst: 2,
  Admin: 3,
  SuperAdmin: 4,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(minRole: Role) {
  const session = await requireAuth();
  const role = session.user.role as Role;
  if (!hasMinRole(role, minRole)) {
    throw new Error("Forbidden");
  }
  return session;
}

export function canAccessSettings(role: Role): boolean {
  return hasMinRole(role, Role.Admin);
}

export function canManageUsers(role: Role): boolean {
  return hasMinRole(role, Role.Admin);
}

export function canCreateNews(role: Role): boolean {
  return hasMinRole(role, Role.Analyst);
}

export function canCreateAdvisory(role: Role): boolean {
  return hasMinRole(role, Role.Analyst);
}
