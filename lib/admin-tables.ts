import { query } from "./db";
import { hashPassword } from "./auth";

export const ADMIN_TABLES = [
  "automator_users",
  "automator_workflows",
  "automator_runs",
] as const;

export type AdminTable = (typeof ADMIN_TABLES)[number];

export interface ColumnMeta {
  name: string;
  type: "text" | "uuid" | "timestamptz" | "json" | "password";
  editable: boolean;
  required?: boolean;
}

export const TABLE_META: Record<AdminTable, { label: string; columns: ColumnMeta[] }> = {
  automator_users: {
    label: "Users",
    columns: [
      { name: "id", type: "uuid", editable: false },
      { name: "email", type: "text", editable: true, required: true },
      { name: "name", type: "text", editable: true },
      { name: "password", type: "password", editable: true },
      { name: "password_hash", type: "text", editable: false },
      { name: "created_at", type: "timestamptz", editable: false },
    ],
  },
  automator_workflows: {
    label: "Workflows",
    columns: [
      { name: "id", type: "uuid", editable: false },
      { name: "user_id", type: "uuid", editable: true, required: true },
      { name: "name", type: "text", editable: true, required: true },
      { name: "description", type: "text", editable: true },
      { name: "start_url", type: "text", editable: true },
      { name: "steps", type: "json", editable: true },
      { name: "variables", type: "json", editable: true },
      { name: "created_at", type: "timestamptz", editable: false },
      { name: "updated_at", type: "timestamptz", editable: false },
    ],
  },
  automator_runs: {
    label: "Runs",
    columns: [
      { name: "id", type: "uuid", editable: false },
      { name: "workflow_id", type: "uuid", editable: true, required: true },
      { name: "user_id", type: "uuid", editable: true, required: true },
      { name: "status", type: "text", editable: true, required: true },
      { name: "variable_values", type: "json", editable: true },
      { name: "log", type: "text", editable: true },
      { name: "started_at", type: "timestamptz", editable: false },
      { name: "finished_at", type: "timestamptz", editable: true },
    ],
  },
};

export function assertAdminTable(table: string): AdminTable {
  if (!ADMIN_TABLES.includes(table as AdminTable)) {
    throw new Error("Invalid table");
  }
  return table as AdminTable;
}

const DB_COLUMNS: Record<AdminTable, string[]> = {
  automator_users: ["id", "email", "name", "password_hash", "created_at"],
  automator_workflows: [
    "id",
    "user_id",
    "name",
    "description",
    "start_url",
    "steps",
    "variables",
    "created_at",
    "updated_at",
  ],
  automator_runs: [
    "id",
    "workflow_id",
    "user_id",
    "status",
    "variable_values",
    "log",
    "started_at",
    "finished_at",
  ],
};

async function prepareUserPayload(
  data: Record<string, unknown>,
  forUpdate: boolean
): Promise<Record<string, unknown>> {
  const out = { ...data };
  delete out.password;
  delete out.password_hash;

  if (typeof data.password === "string" && data.password.length > 0) {
    out.password_hash = await hashPassword(data.password);
  } else if (!forUpdate) {
    throw new Error("password is required for new users");
  }

  if (typeof out.email === "string") {
    out.email = out.email.toLowerCase();
  }
  return out;
}

function preparePayload(
  table: AdminTable,
  data: Record<string, unknown>,
  forUpdate: boolean
): Record<string, unknown> {
  const allowed = new Set(
    TABLE_META[table].columns
      .filter((c) => c.editable && c.name !== "password")
      .map((c) => c.name)
  );

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (!allowed.has(key)) continue;
    const col = TABLE_META[table].columns.find((c) => c.name === key);
    if (col?.type === "json") {
      out[key] =
        typeof val === "string" ? val : JSON.stringify(val ?? (col.name.includes("steps") || col.name.includes("variables") ? [] : {}));
    } else {
      out[key] = val;
    }
  }

  if (!forUpdate) {
    for (const col of TABLE_META[table].columns) {
      if (col.required && col.editable && col.name !== "password" && out[col.name] === undefined) {
        throw new Error(`${col.name} is required`);
      }
    }
  }

  return out;
}

export async function listRows(table: AdminTable) {
  const cols = DB_COLUMNS[table].join(", ");
  const order =
    table === "automator_runs" ? "started_at DESC" : "created_at DESC";
  return query(`SELECT ${cols} FROM ${table} ORDER BY ${order}`);
}

export async function getRow(table: AdminTable, id: string) {
  const cols = DB_COLUMNS[table].join(", ");
  const rows = await query(
    `SELECT ${cols} FROM ${table} WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createRow(table: AdminTable, data: Record<string, unknown>) {
  let payload = preparePayload(table, data, false);
  if (table === "automator_users") {
    payload = await prepareUserPayload(data, false);
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) throw new Error("No fields to insert");

  const placeholders = keys
    .map((k, i) => {
      const col = TABLE_META[table].columns.find((c) => c.name === k);
      return col?.type === "json" ? `$${i + 1}::jsonb` : `$${i + 1}`;
    })
    .join(", ");
  const values = keys.map((k) => {
    const col = TABLE_META[table].columns.find((c) => c.name === k);
    if (col?.type === "json") {
      return typeof payload[k] === "string"
        ? payload[k]
        : JSON.stringify(payload[k]);
    }
    return payload[k];
  });

  const rows = await query(
    `INSERT INTO ${table} (${keys.join(", ")})
     VALUES (${placeholders})
     RETURNING ${DB_COLUMNS[table].join(", ")}`,
    values
  );
  return rows[0];
}

export async function updateRow(
  table: AdminTable,
  id: string,
  data: Record<string, unknown>
) {
  let payload = preparePayload(table, data, true);
  if (table === "automator_users") {
    const userPayload = await prepareUserPayload(data, true);
    payload = { ...payload, ...userPayload };
  }

  if (table === "automator_workflows") {
    payload.updated_at = new Date().toISOString();
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) throw new Error("No fields to update");

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const key of keys) {
    const col = TABLE_META[table].columns.find((c) => c.name === key);
    sets.push(`${key} = $${i}${col?.type === "json" ? "::jsonb" : ""}`);
    values.push(
      col?.type === "json"
        ? typeof payload[key] === "string"
          ? payload[key]
          : JSON.stringify(payload[key])
        : payload[key]
    );
    i++;
  }
  values.push(id);

  const rows = await query(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE id = $${i}
     RETURNING ${DB_COLUMNS[table].join(", ")}`,
    values
  );
  return rows[0] ?? null;
}

export async function deleteRow(table: AdminTable, id: string) {
  const rows = await query(
    `DELETE FROM ${table} WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows.length > 0;
}

export async function getStats() {
  const stats: Record<string, number> = {};
  for (const table of ADMIN_TABLES) {
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`
    );
    stats[table] = Number(rows[0]?.count ?? 0);
  }
  return stats;
}
