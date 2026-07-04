import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import NewsForm from "./NewsForm";

export default async function NewNewsPage() {
  const session = await auth();
  if (!hasMinRole(session!.user.role as Role, Role.Analyst)) {
    redirect("/app/news");
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return <NewsForm categories={categories} />;
}
