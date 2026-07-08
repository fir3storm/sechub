import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { renderAdvisoryPdf } from "@/lib/pdf/advisory-pdf";

function safeFilename(name: string): string {
  return (name || "advisory")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !hasMinRole(session.user.role as Role, Role.Analyst)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;
  const advisory = await prisma.advisory.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  if (!advisory) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const markdown =
    advisory.aiGeneratedContent ||
    `# ${advisory.title}\n\n_No AI-generated content yet._\n`;

  const author = advisory.createdBy?.name || advisory.createdBy?.email || null;

  const pdf = await renderAdvisoryPdf({
    meta: {
      title: advisory.title,
      status: advisory.status,
      updatedAt: advisory.updatedAt,
      author,
    },
    markdown,
  });

  const filename = `${safeFilename(advisory.title)}.pdf`;

  // Next.js Response BodyInit typing doesn't accept Buffer directly in some TS configs.
  // Convert to Uint8Array to satisfy BodyInit.
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

