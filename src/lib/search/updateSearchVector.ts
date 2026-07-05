import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getDatabaseSchema } from "@/lib/db-schema";

/** Recompute full-text search vector for one article (no DB trigger required). */
export async function refreshNewsArticleSearchVector(articleId: string): Promise<void> {
  try {
    const schema = getDatabaseSchema();
    await prisma.$executeRaw`
      UPDATE ${Prisma.raw(`"${schema}"."NewsArticle"`)}
      SET search_vector =
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(body, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(array_to_string("cveIds", ' '), '')), 'A') ||
        setweight(to_tsvector('english', coalesce("sourceName", '')), 'D') ||
        setweight(to_tsvector('simple', coalesce(array_to_string("affectedDevices", ' '), '')), 'D') ||
        setweight(to_tsvector('simple', coalesce(array_to_string("affectedOs", ' '), '')), 'D')
      WHERE id = ${articleId}
    `;
  } catch (err) {
    console.warn(`[fts] refresh skipped for ${articleId}:`, err);
  }
}
