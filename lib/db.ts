import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __automatorPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not set");
  }
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

// Reuse the pool across hot reloads in dev.
export const pool: Pool = global.__automatorPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  global.__automatorPool = pool;
}

export async function query<T = unknown>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
