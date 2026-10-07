import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { getSession } from "@/server/session";
import { getTeachingSubjects } from "@/server/data/teacher";
import { getActiveSubjects } from "@/server/data/institute";
import { createServerSupabaseClient } from "@/lib/db/server";
import { displayIdentity } from "@/lib/identity";
import { Icon } from "@/components/ui/Icon";
import { CopyButton } from "@/components/ui/CopyButton";
import { TableSearch } from "@/components/ui/TableSearch";
import {
  ActiveToggle,
  AddStudents,
  CreateBatchForm,
  EditBatch,
  RemoveStudentButton,
  RotateCodeButton,
  SubjectTeacherSelect,
} from "./BatchControls";

export const metadata: Metadata = { title: "Batches · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

type BatchRow = {
  id: string;
  name: string;
  note: string | null;
  teacher_id: string | null;
  join_code: string;
  active: boolean;
  created_at: string;
  batch_subjects: { class_subject_id: string; teacher_id: string | null }[];
  enrolments: { student_id: string; joined_at: string }[];
  papers: { count: number }[];
};

/**
 * Batches: a batch is a group of students with any number of subjects, as a
 * coaching batch really is. Students join with the code, or are added here.
 * A teacher sees the batches they run or teach a subject in; an admin sees all.
 */
export default async function BatchesPage() {
  const session = await getSession();
  const inst = session?.instituteId ?? null;
  const admin = session?.role === "institute_admin";
  const supabase = await createServerSupabaseClient();

  const [teaching, active, batchesRes, membersRes] = session && inst
    ? await Promise.all([
        getTeachingSubjects(session),
        getActiveSubjects(session),
        supabase
          .from("batches")
          .select("id, name, note, teacher_id, join_code, active, created_at, batch_subjects ( class_subject_id, teacher_id ), enrolments ( student_id, joined_at ), papers ( count )")
          .eq("institute_id", inst)
          .order("active", { ascending: false })
          .order("created_at", { ascending: false })
          .returns<BatchRow[]>(),
        supabase.from("institute_members").select("user_id, role").eq("institute_id", inst),
      ])
    : [[], [], { data: [] as BatchRow[] }, { data: [] as { user_id: string; role: string }[] }];

  const taught = new Set(teaching.map((t) => t.classSubjectId));
  const labelOf = new Map(active.map((s) => [s.classSubjectId, s.label]));
  const batches = (batchesRes.data ?? []).filter(
    (b) => admin || b.teacher_id === session?.userId || b.batch_subjects.some((x) => taught.has(x.class_subject_id)),
  );

  const members = membersRes.data ?? [];
  const ids = [...new Set(members.map((m) => m.user_id))];
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids.slice(i, i + 100));
    for (const p of data ?? []) names.set(p.id, p.full_name ?? displayIdentity(p.email));
  }
  const studentIds = members.filter((m) => m.role === "student").map((m) => m.user_id);
  const teachers = members
    .filter((m) => m.role === "teacher" || m.role === "institute_admin")
    .map((m) => ({ id: m.user_id, label: names.get(m.user_id) ?? "Teacher" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const subjectOptions = active.map((s) => ({ id: s.classSubjectId, label: s.label }));
  const createOptions = teaching.map((t) => ({ id: t.classSubjectId, label: `Class ${t.className} · ${t.subjectName}` }));
  const editable = admin ? subjectOptions.map((s) => s.id) : [...taught];
  const studentApp = session?.modules.student_app !== false;

  return (
    <AppShell area="teacher">
      <div className="toolbar">
        <TableSearch target="batchlist" placeholder="Search batches or students" />
        <details className="drawer inline" id="new" open={batches.length === 0}>
          <summary className="btn solid"><Icon name="layers" size={15} /> New batch</summary>
          <div className="drawerbody wide">
            <CreateBatchForm subjects={createOptions} />
          </div>
        </details>
      </div>

      <p className="lede">
        {studentApp
          ? "A batch is a group of students with as many subjects as they study together. Students join with the batch code, or you add them below. Papers you set for a batch reach its students once you mark them as conducted."
          : "A batch is a class you teach, with as many subjects as it studies. Set papers for it to keep each class's papers together."}
      </p>

      {batches.length === 0 ? (
        <div className="empty panel"><p>No batches yet. Create the first one with <b>New batch</b>.</p></div>
      ) : (
        <div className="batchlist" id="batchlist">
          {batches.map((b) => {
            const enrolled = [...b.enrolments].sort((x, y) => (names.get(x.student_id) ?? "").localeCompare(names.get(y.student_id) ?? ""));
            const inBatch = new Set(b.enrolments.map((e) => e.student_id));
            const candidates = studentIds.filter((id) => !inBatch.has(id)).map((id) => ({ id, label: names.get(id) ?? "Student" })).sort((x, y) => x.label.localeCompare(y.label));
            const paperCount = b.papers[0]?.count ?? 0;
            const search = [b.name, b.note ?? "", ...b.batch_subjects.map((x) => labelOf.get(x.class_subject_id) ?? ""), ...enrolled.map((e) => names.get(e.student_id) ?? "")].join(" ");
            return (
              <article key={b.id} className={`batchcard${b.active ? "" : " closed"}`} data-search={search}>
                <header className="batchhead">
                  <div className="batchtitle">
                    <h3>
                      {b.name} {!b.active && <span className="pill planned">closed</span>}
                    </h3>
                    {b.note && <p>{b.note}</p>}
                  </div>
                  {studentApp && <div className="batchcode">
                    <span className="joincode" style={{ opacity: b.active ? 1 : 0.45 }}>{b.join_code}</span>
                    <CopyButton text={b.join_code} />
                  </div>}
                </header>

                <div className="batchsubjects">
                  {b.batch_subjects.length === 0 ? (
                    <span className="muted">No subjects yet — add some under Edit.</span>
                  ) : (
                    b.batch_subjects.map((x) => (
                      <span key={x.class_subject_id} className="subjtag">
                        <b>{labelOf.get(x.class_subject_id) ?? "Subject no longer active"}</b>
                        {admin ? (
                          <SubjectTeacherSelect batchId={b.id} classSubjectId={x.class_subject_id} current={x.teacher_id} teachers={teachers} />
                        ) : (
                          x.teacher_id && <span className="muted"> · {names.get(x.teacher_id) ?? "Teacher"}</span>
                        )}
                      </span>
                    ))
                  )}
                </div>

                <div className="batchstats">
                  {studentApp && <span><b>{b.enrolments.length}</b> student{b.enrolments.length === 1 ? "" : "s"}</span>}
                  <Link href={`/teacher/papers?batch=${b.id}`}><b>{paperCount}</b> paper{paperCount === 1 ? "" : "s"} →</Link>
                  {session?.modules.student_app && <Link href={`/teacher/results?batch=${b.id}`}>Results →</Link>}
                  <span className="batchactions">
                    {studentApp && <RotateCodeButton batchId={b.id} disabled={!b.active} />}
                    <ActiveToggle batchId={b.id} active={b.active} />
                  </span>
                </div>

                {studentApp && <details className="batchmore">
                  <summary>Students ({b.enrolments.length})</summary>
                  <div className="batchmorebody">
                    {enrolled.length === 0 ? (
                      <p className="hint">Nobody yet. Share the code <b className="mono">{b.join_code}</b>, or add students below.</p>
                    ) : (
                      <ul className="studentlist">
                        {enrolled.map((e) => (
                          <li key={e.student_id}>
                            <span>
                              {names.get(e.student_id) ?? "Student"} <span className="muted">· joined {dateFmt.format(new Date(e.joined_at))}</span>
                            </span>
                            <RemoveStudentButton batchId={b.id} studentId={e.student_id} name={names.get(e.student_id) ?? "this student"} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <h4 className="blk" style={{ marginTop: 14 }}>Add students</h4>
                    <AddStudents batchId={b.id} candidates={candidates} />
                  </div>
                </details>}

                <details className="batchmore">
                  <summary>Edit batch</summary>
                  <div className="batchmorebody">
                    <EditBatch
                      batchId={b.id}
                      name={b.name}
                      note={b.note}
                      subjects={subjectOptions}
                      selected={b.batch_subjects.map((x) => x.class_subject_id)}
                      editable={editable}
                      students={b.enrolments.length}
                      papers={paperCount}
                    />
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
