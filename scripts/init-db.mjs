import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("POSTGRES_URL is not set. Run with: npm run db:init");
  process.exit(1);
}

const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'automator_%'
     ORDER BY table_name`
  );
  console.log("Automator tables present:");
  for (const r of rows) console.log("  -", r.table_name);
  console.log("Database initialized successfully.");
} catch (err) {
  console.error("DB init failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
