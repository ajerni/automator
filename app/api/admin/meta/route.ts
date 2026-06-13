import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ADMIN_TABLES, TABLE_META, getStats } from "@/lib/admin-tables";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stats = await getStats();
  return NextResponse.json({
    tables: ADMIN_TABLES.map((t) => ({
      name: t,
      label: TABLE_META[t].label,
      columns: TABLE_META[t].columns,
      count: stats[t],
    })),
  });
}
