import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4180 quoting, and a leading apostrophe against spreadsheet formula injection. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  // 404, not 403: the route should not confirm it exists to anyone else.
  if (!session?.isPlatformOwner) return new NextResponse("Not found", { status: 404 });

  const institute = request.nextUrl.searchParams.get("institute");
  const kind = request.nextUrl.searchParams.get("kind");
  const instituteId = institute && UUID.test(institute) ? institute : undefined;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("platform_audit", { p_institute_id: instituteId, p_limit: 1000 });
  if (error) return new NextResponse(error.message, { status: 500 });

  const rows = (data ?? []).filter((r) => !kind || r.kind === kind);
  const lines = [
    ["at", "trail", "actor_email", "institute_id", "institute_name", "action", "detail"].join(","),
    ...rows.map((r) => [r.at, r.kind, r.actor_email, r.institute_id, r.institute_name, r.action, r.target].map(cell).join(",")),
  ];
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paperflow-audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
