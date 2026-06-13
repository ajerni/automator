import { query } from "./db";
import type { Workflow, WorkflowStep, WorkflowVariable } from "./types";

interface Row {
  id: string;
  user_id: string;
  name: string;
  description: string;
  start_url: string;
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
  created_at: string;
  updated_at: string;
}

function toWorkflow(r: Row): Workflow {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    startUrl: r.start_url,
    steps: r.steps ?? [],
    variables: r.variables ?? [],
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listWorkflows(userId: string): Promise<Workflow[]> {
  const rows = await query<Row>(
    `SELECT * FROM automator_workflows WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(toWorkflow);
}

export async function getWorkflow(
  userId: string,
  id: string
): Promise<Workflow | null> {
  const rows = await query<Row>(
    `SELECT * FROM automator_workflows WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] ? toWorkflow(rows[0]) : null;
}

export async function createWorkflow(
  userId: string,
  data: {
    name: string;
    description?: string;
    startUrl: string;
    steps: WorkflowStep[];
    variables: WorkflowVariable[];
  }
): Promise<Workflow> {
  const rows = await query<Row>(
    `INSERT INTO automator_workflows (user_id, name, description, start_url, steps, variables)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     RETURNING *`,
    [
      userId,
      data.name,
      data.description ?? "",
      data.startUrl,
      JSON.stringify(data.steps),
      JSON.stringify(data.variables),
    ]
  );
  return toWorkflow(rows[0]);
}

export async function updateWorkflow(
  userId: string,
  id: string,
  data: Partial<{
    name: string;
    description: string;
    startUrl: string;
    steps: WorkflowStep[];
    variables: WorkflowVariable[];
  }>
): Promise<Workflow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const push = (col: string, val: unknown, cast = "") => {
    sets.push(`${col} = $${i}${cast}`);
    params.push(val);
    i++;
  };
  if (data.name !== undefined) push("name", data.name);
  if (data.description !== undefined) push("description", data.description);
  if (data.startUrl !== undefined) push("start_url", data.startUrl);
  if (data.steps !== undefined) push("steps", JSON.stringify(data.steps), "::jsonb");
  if (data.variables !== undefined)
    push("variables", JSON.stringify(data.variables), "::jsonb");
  if (sets.length === 0) return getWorkflow(userId, id);
  sets.push(`updated_at = now()`);
  params.push(id, userId);
  const rows = await query<Row>(
    `UPDATE automator_workflows SET ${sets.join(", ")}
     WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    params
  );
  return rows[0] ? toWorkflow(rows[0]) : null;
}

export async function deleteWorkflow(
  userId: string,
  id: string
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM automator_workflows WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}
