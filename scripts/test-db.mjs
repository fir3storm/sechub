import pg from "pg";

const urls = [
  "postgresql://aml_app:dev@localhost:5432/postgres",
  "postgresql://aml_app:dev@localhost:5432/aml",
  "postgresql://postgres:dev@localhost:5432/postgres",
];

for (const url of urls) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const r = await client.query("SELECT current_user, current_database()");
    console.log("OK:", url, "->", r.rows[0]);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log("FAIL:", url, "-", e.message);
    try { await client.end(); } catch {}
  }
}
process.exit(1);
