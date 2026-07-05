import { prisma } from "../src/lib/db";
import {
  backfillSearchVectors,
  ensureSearchInfrastructure,
} from "../src/lib/search/ensureSearchInfrastructure";
import { getDatabaseSchema } from "../src/lib/db-schema";

async function main() {
  const schema = getDatabaseSchema();
  await ensureSearchInfrastructure();
  const updated = await backfillSearchVectors();

  const [{ count }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*)::bigint AS count
     FROM "${schema}"."NewsArticle"
     WHERE search_vector IS NOT NULL`
  );
  console.log(`Backfilled ${updated} rows; ${count} articles indexed (schema: ${schema}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
