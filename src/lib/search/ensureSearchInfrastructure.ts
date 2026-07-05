import { prisma } from "@/lib/db";
import { getDatabaseSchema } from "@/lib/db-schema";

const LEGACY_SCHEMAS = ["public", "sechub"];

/** Drop all legacy FTS triggers/functions that break Prisma inserts. */
async function dropLegacyFtsObjects(): Promise<void> {
  for (const schema of LEGACY_SCHEMAS) {
    try {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS news_article_search_vector_trigger ON "${schema}"."NewsArticle"`
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${schema}".news_article_search_vector_update() CASCADE`
      );
    } catch {
      // Schema or table may not exist on this database.
    }
  }
}

/** Ensure search_vector column + index exist; never install DB triggers. */
export async function ensureSearchInfrastructure(): Promise<void> {
  await dropLegacyFtsObjects();

  const schema = getDatabaseSchema();
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."NewsArticle"
     ADD COLUMN IF NOT EXISTS search_vector tsvector`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS news_article_search_vector_idx
     ON "${schema}"."NewsArticle"
     USING GIN (search_vector)`
  );
}

/** Backfill search vectors for rows missing them. */
export async function backfillSearchVectors(): Promise<bigint> {
  const schema = getDatabaseSchema();
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "${schema}"."NewsArticle"
     SET search_vector =
       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
       setweight(to_tsvector('english', coalesce(body, '')), 'C') ||
       setweight(to_tsvector('simple', coalesce(array_to_string("cveIds", ' '), '')), 'A') ||
       setweight(to_tsvector('english', coalesce("sourceName", '')), 'D') ||
       setweight(to_tsvector('simple', coalesce(array_to_string("affectedDevices", ' '), '')), 'D') ||
       setweight(to_tsvector('simple', coalesce(array_to_string("affectedOs", ' '), '')), 'D')
     WHERE search_vector IS NULL`
  );
  return BigInt(updated);
}
