import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { EditNewsForm } from "./EditNewsForm";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!hasMinRole(session!.user.role as Role, Role.Analyst)) {
    redirect(`/app/news/${id}`);
  }

  const [article, categories] = await Promise.all([
    prisma.newsArticle.findUnique({
      where: { id },
      include: { categories: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!article) notFound();

  return (
    <EditNewsForm
      articleId={article.id}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      initial={{
        title: article.title,
        summary: article.summary,
        body: article.body,
        severity: article.severity,
        cveIds: article.cveIds,
        cvssScore: article.cvssScore,
        categoryIds: article.categories.map((c) => c.categoryId),
      }}
    />
  );
}
