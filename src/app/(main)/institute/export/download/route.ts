import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";

/**
 * Institute data export (BUILD-PLAN C12 item 8).
 *
 * 1. Authorise and record through the admin's own RLS-bound client:
 *    log_institute_export refuses non-admins, writes the audit row, and
 *    refuses a second export inside ten minutes.
 * 2. Only then assemble the rows with the service-role client. Several tables
 *    (practice sets, exposure) are readable under RLS by the student alone, and
 *    the answer columns of the institute's own private questions are revoked
 *    from every client role, so an RLS-bound export would be silently partial.
 *    EVERY query below is pinned to this institute's id — the session's,
 *    never a request parameter.
 *
 * The shared bank is not exported: it is licensed for use inside the platform.
 */

const TENANT_TABLES = [
  "institute_invites",
  "role_audit",
  "institute_class_subjects",
  "activation_requests",
  "teacher_subjects",
  "batches",
  "enrolments",
  "papers",
  "paper_sections",
  "paper_blocks",
  "paper_questions",
  "paper_sets",
  "paper_set_items",
  "paper_set_options",
  "attempts",
  "attempt_items",
  "practice_sets",
  "practice_set_items",
  "question_exposure",
  "coverage_gaps",
  "question_flags",
] as const;

const OWNED_TABLES = ["questions", "stimuli", "question_assets", "paper_patterns", "pattern_sections"] as const;

const PAGE = 1000;

type Admin = ReturnType<typeof createAdminClient>;

async function fetchAll(admin: Admin, table: string, column: "institute_id" | "owner_institute_id", inst: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    // Table names come from the constant lists above, never from the request.
    const { data, error } = await admin
      .from(table as "batches")
      .select("*")
      .eq(column as "institute_id", inst)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((r) => {
    // Generated columns that are noise outside the database.
    const { search_tsv: _tsv, body_normalised: _norm, ...rest } = r;
    void _tsv;
    void _norm;
    return rest;
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.instituteId || session.role !== "institute_admin") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // Route handlers do not get the Origin check server actions do.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ message: "Cross-site request refused." }, { status: 403 });
  }

  const inst = session.instituteId;
  const supabase = await createServerSupabaseClient();
  const { error: logError } = await supabase.rpc("log_institute_export", { p_institute_id: inst });
  if (logError) {
    const limited = /ten minutes/.test(logError.message);
    return NextResponse.json(
      { message: limited ? "An export was made in the last ten minutes. Try again shortly." : logError.message },
      { status: limited ? 429 : 403 },
    );
  }

  try {
    const admin = createAdminClient();
    const [{ data: institute }, { data: members }] = await Promise.all([
      admin.from("institutes").select("id, name, slug, status, contact_email, created_at").eq("id", inst).single(),
      admin.from("institute_members").select("user_id, role, created_at").eq("institute_id", inst),
    ]);
    const memberIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = memberIds.length
      ? await admin.from("profiles").select("id, email, full_name").in("id", memberIds)
      : { data: [] as { id: string; email: string; full_name: string | null }[] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const tables: Record<string, Record<string, unknown>[]> = {
      institute_members: (members ?? []).map((m) => ({
        ...m,
        email: profileById.get(m.user_id)?.email ?? null,
        full_name: profileById.get(m.user_id)?.full_name ?? null,
      })),
    };
    for (const t of TENANT_TABLES) tables[t] = await fetchAll(admin, t, "institute_id", inst);
    for (const t of OWNED_TABLES) tables[`private_${t}`] = await fetchAll(admin, t, "owner_institute_id", inst);

    const body = JSON.stringify(
      {
        format: "paperflow-institute-export",
        version: 1,
        exported_at: new Date().toISOString(),
        exported_by: session.email,
        institute,
        counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
        tables,
        not_included:
          "The shared question bank is licensed for use inside PaperFlow and is not part of an export. Papers reference shared questions by id; print PDFs from the Export page.",
      },
      null,
      2,
    );
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = (institute?.slug ?? "institute").replace(/[^a-z0-9-]/gi, "");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-paperflow-export-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "Export failed." }, { status: 500 });
  }
}
