import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { getSession } from "@/server/session";
import { getTeachingSubjects } from "@/server/data/teacher";
import { createServerSupabaseClient } from "@/lib/db/server";
import { ActiveToggle, CreateBatchForm, RotateCodeButton } from "./BatchControls";

export const metadata: Metadata = { title: "Batches · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

type BatchRow = {
  id: string;
  name: string;
  class_subject_id: string;
  join_code: string;
  active: boolean;
  created_at: string;
  enrolments: { student_id: string; joined_at: string }[];
  papers: { count: number }[];
};

export default async function BatchesPage() {
  const session = await getSession();
  const subjects = session ? await getTeachingSubjects(session) : [];
  const labelById = new Map(subjects.map((s) => [s.classSubjectId, `Class ${s.className} · ${s.subjectName}`]));

  const supabase = await createServerSupabaseClient();
  const { data } = session?.instituteId && subjects.length > 0
    ? await supabase
        .from("batches")
        .select("id, name, class_subject_id, join_code, active, created_at, enrolments ( student_id, joined_at ), papers ( count )")
        .eq("institute_id", session.instituteId)
        .in("class_subject_id", subjects.map((s) => s.classSubjectId))
        .order("active", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<BatchRow[]>()
    : { data: [] as BatchRow[] };
  const batches = data ?? [];

  const studentIds = [...new Set(batches.flatMap((b) => b.enrolments.map((e) => e.student_id)))];
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", studentIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  return (
    <AppShell area="teacher" pathname="/teacher/batches">
      {batches.length === 0 ? (
        <p className="lede">No batches yet. Create one below and hand its code to your students.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Batch</th>
                <th className="num">Students</th>
                <th className="num">Papers</th>
                <th>Join code</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b>{b.name}</b>
                    <span className="sub">{labelById.get(b.class_subject_id) ?? ""}</span>
                    {b.enrolments.length > 0 && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ fontSize: 11.5, color: "var(--graphite)", cursor: "pointer" }}>
                          {b.enrolments.length} enrolled
                        </summary>
                        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12 }}>
                          {[...b.enrolments]
                            .sort((x, y) => x.joined_at.localeCompare(y.joined_at))
                            .map((e) => (
                              <li key={e.student_id}>
                                {nameById.get(e.student_id) ?? "Student"}{" "}
                                <span style={{ color: "var(--graphite)" }}>· joined {dateFmt.format(new Date(e.joined_at))}</span>
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="num">{b.enrolments.length}</td>
                  <td className="num">
                    {(b.papers[0]?.count ?? 0) > 0 ? (
                      <Link href={`/teacher/papers?batch=${b.id}`} title="This batch's paper history">{b.papers[0]!.count} →</Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 14, letterSpacing: "0.18em", fontWeight: 500, opacity: b.active ? 1 : 0.45 }}>
                      {b.join_code}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${b.active ? "active" : "planned"}`}>{b.active ? "Open" : "Closed"}</span>
                  </td>
                  <td>
                    <div className="btnrow">
                      <RotateCodeButton batchId={b.id} disabled={!b.active} />
                      <ActiveToggle batchId={b.id} active={b.active} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cards c2" style={{ marginTop: 20 }}>
        <div className="card">
          <h4>Create a batch</h4>
          <p style={{ marginBottom: 12 }}>One batch per class and subject. You can only choose subjects you are assigned.</p>
          <CreateBatchForm subjects={subjects.map((s) => ({ id: s.classSubjectId, label: `Class ${s.className} · ${s.subjectName}` }))} />
        </div>
        <div className="card tinted">
          <h4>One batch per subject, per student</h4>
          <p>
            A student holds at most one batch per class and subject in an institute. If they enter a second
            code for a subject they already have, the app tells them which batch they are in instead of
            enrolling them twice — and the database enforces that, not just this screen. A closed batch&rsquo;s
            code stops working.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
