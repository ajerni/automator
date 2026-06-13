import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listWorkflows } from "@/lib/workflows";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workflows = await listWorkflows(user.id);

  return <Dashboard user={user} initialWorkflows={workflows} />;
}
