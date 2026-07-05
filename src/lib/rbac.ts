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

/** Roles the actor may assign when creating or updating users. */
export function getAssignableRoles(actorRole: Role): Role[] {
  if (actorRole === Role.SuperAdmin) {
    return [Role.Viewer, Role.Analyst, Role.Admin, Role.SuperAdmin];
  }
  if (actorRole === Role.Admin) {
    return [Role.Viewer, Role.Analyst, Role.Admin];
  }
  return [];
}

export function canAssignRole(actorRole: Role, role: Role): boolean {
  return getAssignableRoles(actorRole).includes(role);
}

/** Whether actor may change or remove another user account. */
export function canManageUser(
  actorRole: Role,
  actorId: string,
  target: { id: string; role: Role }
): boolean {
  if (!hasMinRole(actorRole, Role.Admin)) return false;
  if (actorId === target.id) return false;
  if (target.role === Role.SuperAdmin && actorRole !== Role.SuperAdmin) return false;
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[target.role];
}

export function canCreateNews(role: Role): boolean {
  return hasMinRole(role, Role.Analyst);
}

export function canCreateAdvisory(role: Role): boolean {
  return hasMinRole(role, Role.Analyst);
}
