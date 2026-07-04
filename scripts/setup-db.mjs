import pg from "pg";

const client = new pg.Client({
  connectionString: "postgresql://aml_app:dev@localhost:5432/postgres",
});
await client.connect();
const dbs = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1");
console.log(dbs.rows.map((r) => r.datname));
await client.end();
