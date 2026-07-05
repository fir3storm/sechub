import { prisma } from "../src/lib/db";
import { getDatabaseSchema } from "../src/lib/db-schema";

async function dropLegacyTriggers() {
  const schemas = ["public", "sechub"];
  for (const schema of schemas) {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS news_article_search_vector_trigger ON "${schema}"."NewsArticle"`
    );
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS "${schema}".news_article_search_vector_update()`
    );
  }
}

async function main() {
  const schema = getDatabaseSchema();
  await dropLegacyTriggers();

  const statements = [
    `ALTER TABLE "${schema}"."NewsArticle"
     ADD COLUMN IF NOT EXISTS search_vector tsvector`,
    `UPDATE "${schema}"."NewsArticle"
     SET search_vector =
       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
       setweight(to_tsvector('english', coalesce(body, '')), 'C') ||
       setweight(to_tsvector('simple', coalesce(array_to_string("cveIds", ' '), '')), 'A') ||
       setweight(to_tsvector('english', coalesce("sourceName", '')), 'D') ||
       setweight(to_tsvector('simple', coalesce(array_to_string("affectedDevices", ' '), '')), 'D') ||
       setweight(to_tsvector('simple', coalesce(array_to_string("affectedOs", ' '), '')), 'D')
     WHERE search_vector IS NULL`,
    `CREATE INDEX IF NOT EXISTS news_article_search_vector_idx
     ON "${schema}"."NewsArticle"
     USING GIN (search_vector)`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
    console.log("OK:", statement.split("\n")[0].slice(0, 72));
  }

  const [{ count }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*)::bigint AS count
     FROM "${schema}"."NewsArticle"
     WHERE search_vector IS NOT NULL`
  );
  console.log(`Indexed ${count} articles for full-text search (schema: ${schema}, no trigger).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
