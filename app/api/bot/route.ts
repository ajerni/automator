import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listWorkflows } from "@/lib/workflows";
import { chatJSON } from "@/lib/openrouter";

interface BotResult {
  workflowId: string | null;
  reasoning: string;
  variables: Record<string, string>;
  missing: string[];
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const workflows = await listWorkflows(user.id);
  if (workflows.length === 0) {
    return NextResponse.json({
      result: {
        workflowId: null,
        reasoning: "You have no recorded workflows yet. Record one first.",
        variables: {},
        missing: [],
      } satisfies BotResult,
      workflows: [],
    });
  }

  const registry = workflows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    variables: w.variables.map((v) => ({
      key: v.key,
      name: v.name,
      description: v.description,
      kind: v.kind,
      example: v.sampleValue,
    })),
  }));

  const system = `You are the routing brain of a browser-automation app named Automator.
You are given a registry of the user's recorded workflows (each with an id, name, description and the variables it needs) and a user request.
Your job:
1. Pick the single best matching workflow id, or null if nothing matches.
2. Extract values for that workflow's variables from the user's request, keyed by the variable "key".
3. List the keys of any required variables you could not extract in "missing".
Respond ONLY with strict JSON of shape:
{"workflowId": string|null, "reasoning": string, "variables": {<key>: <value>}, "missing": [<key>]}`;

  const userMsg = `Workflow registry:\n${JSON.stringify(
    registry,
    null,
    2
  )}\n\nUser request:\n"""${message}"""`;

  try {
    const result = await chatJSON<BotResult>([
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ]);
    return NextResponse.json({ result, workflows: registry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bot failed" },
      { status: 500 }
    );
  }
}
