import {
  LayoutDashboard,
  Newspaper,
  FileWarning,
  Settings,
  Shield,
  ScrollText,
  KeyRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@prisma/client";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole: Role;
}

export const navItems: NavItem[] = [
  { href: "/app", label: "Command Center", icon: LayoutDashboard, minRole: Role.Viewer },
  { href: "/app/news", label: "Threat Feed", icon: Newspaper, minRole: Role.Viewer },
  { href: "/app/advisories", label: "Advisories", icon: FileWarning, minRole: Role.Viewer },
  { href: "/app/account", label: "Account", icon: KeyRound, minRole: Role.Viewer },
  { href: "/app/settings/users", label: "Operators", icon: Users, minRole: Role.Admin },
  { href: "/app/audit", label: "Audit Trail", icon: ScrollText, minRole: Role.Admin },
  { href: "/app/settings", label: "Systems", icon: Settings, minRole: Role.Admin },
];

export const brandIcon = Shield;
