import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createWorkflow, listWorkflows } from "@/lib/workflows";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workflows = await listWorkflows(user.id);
  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.name || !body.startUrl) {
      return NextResponse.json(
        { error: "name and startUrl are required" },
        { status: 400 }
      );
    }
    const workflow = await createWorkflow(user.id, {
      name: body.name,
      description: body.description ?? "",
      startUrl: body.startUrl,
      steps: body.steps ?? [],
      variables: body.variables ?? [],
    });
    return NextResponse.json({ workflow });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 500 }
    );
  }
}
