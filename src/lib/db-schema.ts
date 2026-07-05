/** Postgres schema from DATABASE_URL (?schema=public), default public. */
export function getDatabaseSchema(): string {
  const url = process.env.DATABASE_URL ?? "";
  const match = url.match(/[?&]schema=([^&]+)/i);
  const schema = match ? decodeURIComponent(match[1]) : "public";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid database schema: ${schema}`);
  }
  return schema;
}

export function qualifiedTable(table: string): string {
  return `"${getDatabaseSchema()}"."${table}"`;
}
