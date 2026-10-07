import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { getActiveSubjects, getPendingInvites } from "@/server/data/institute";
import { Icon } from "@/components/ui/Icon";
import { Stat, TodoRow } from "@/components/ui/Stat";

export const metadata: Metadata = { title: "Institute · PaperFlow" };

/**
 * An institute admin's front page. The everyday jobs are the big tiles at the
 * top; the numbers and anything that needs a decision come after.
 */
export default async function InstituteHome() {
  const session = await getSession();
  const inst = session?.role === "institute_admin" ? session.instituteId : null;
  const supabase = await createServerSupabaseClient();

  const [membersRes, assignedRes, batchesRes, papersRes, attemptsRes, subjects, invites, requestsRes, joinRes] = inst && session
    ? await Promise.all([
        supabase.from("institute_members").select("user_id, role").eq("institute_id", inst),
        supabase.from("teacher_subjects").select("teacher_id, class_subject_id").eq("institute_id", inst),
        supabase.from("batches").select("id, active, batch_subjects(class_subject_id), enrolments(count)").eq("institute_id", inst),
        supabase.from("papers").select("id", { count: "exact", head: true }).eq("institute_id", inst),
        supabase.from("attempts").select("id", { count: "exact", head: true }).eq("institute_id", inst),
        getActiveSubjects(session),
        getPendingInvites(session),
        supabase.from("activation_requests").select("id").eq("institute_id", inst).eq("status", "pending"),
        supabase.from("access_requests").select("id", { count: "exact", head: true }).eq("institute_id", inst).eq("status", "pending"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { count: 0 }, { count: 0 }, [], [], { data: [] }, { count: 0 }];

  const batches = (batchesRes.data ?? []) as { id: string; active: boolean; batch_subjects: { class_subject_id: string }[]; enrolments: { count: number }[] }[];
  const open = batches.filter((b) => b.active);
  const members = membersRes.data ?? [];
  const assigned = assignedRes.data ?? [];
  const teachers = members.filter((m) => m.role === "teacher");
  const teaching = new Set(assigned.map((a) => a.teacher_id));
  const idleTeachers = teachers.filter((t) => !teaching.has(t.user_id)).length;
  const emptyBatches = open.filter((b) => (b.enrolments[0]?.count ?? 0) === 0).length;
  const mods = session?.modules ?? { student_app: true, results: true, teachers: true, self_practice: false };
  const instituteName = session?.memberships.find((m) => m.instituteId === inst)?.instituteName ?? "your institute";

  return (
    <AppShell area="institute">
      <div className="phead">
        <p>Everything at {instituteName}, in one place.</p>
      </div>

      <div className="quick">
        <Link href="/institute/members#invite" className="quickcard primary">
          <Icon name="userPlus" size={26} />
          <b>{mods.teachers && mods.student_app ? "Invite a teacher or student" : mods.teachers ? "Invite a teacher" : "Invite a student"}</b>
          <span>By their PaperFlow username. They see it when they sign in.</span>
        </Link>
        <Link href="/teacher/generate" className="quickcard">
          <Icon name="filePlus" size={24} />
          <b>Set a paper</b>
          <span>A balanced test with its answer key, in a minute.</span>
        </Link>
        <Link href="/teacher/batches" className="quickcard">
          <Icon name="layers" size={24} />
          <b>{mods.student_app ? "Batches and join codes" : "Batches"}</b>
          <span>Group students by class and subject.</span>
        </Link>
        {mods.student_app && (
          <Link href="/teacher/results" className="quickcard">
            <Icon name="chart" size={24} />
            <b>Results</b>
            <span>Who is logging, and which topics need going over.</span>
          </Link>
        )}
      </div>

      <div className="stats">
        {mods.teachers && <Stat icon="idcard" value={teachers.length} label="Teachers" href="/institute/members?role=teacher" />}
        {mods.student_app && <Stat icon="users" value={members.filter((m) => m.role === "student").length} label="Students" href="/institute/members?role=student" />}
        <Stat icon="layers" value={open.length} label="Open batches" href="/teacher/batches" />
        <Stat icon="file" value={papersRes.count ?? 0} label="Papers set" href="/teacher/papers" />
        {mods.student_app && <Stat icon="pencil" value={attemptsRes.count ?? 0} label="Papers logged by students" />}
      </div>

      <div className="dash2">
        <section className="panel">
          <div className="panelhead">
            <h2>Needs your attention</h2>
          </div>
          <div className="todolist">
            <TodoRow icon="userPlus" title="Asking to join" text="People waiting for you to let them in" count={joinRes.count ?? 0} href="/institute/members#requests" />
            <TodoRow icon="mail" title="Invitations not yet accepted" text="They have not signed in since" count={invites.length} href="/institute/members#invites" />
            {mods.teachers && <TodoRow icon="idcard" title="Teachers without a subject" text="They cannot set papers until you assign one" count={idleTeachers} href="/institute/teachers" />}
            {mods.student_app && <TodoRow icon="layers" title="Batches with no students" text="Share the join code with the class" count={emptyBatches} href="/teacher/batches" />}
          </div>
        </section>

        <section className="panel">
          <div className="panelhead">
            <h2>Subjects</h2>
            <Link href="/institute/subjects" className="panellink">
              {(requestsRes.data ?? []).length > 0 ? `${(requestsRes.data ?? []).length} requested →` : "Request another →"}
            </Link>
          </div>
          {subjects.length === 0 ? (
            <div className="empty">
              <p>No subject is switched on yet. Your teachers cannot set papers until one is.</p>
              <Link className="btn sm solid" href="/institute/subjects">Request a subject</Link>
            </div>
          ) : (
            <div className="rowlist">
              {subjects.map((s) => {
                const n = open.filter((b) => b.batch_subjects.some((x) => x.class_subject_id === s.classSubjectId)).length;
                const who = new Set(assigned.filter((a) => a.class_subject_id === s.classSubjectId).map((a) => a.teacher_id)).size;
                return (
                  <div key={s.classSubjectId} className="rowlink static">
                    <span className="dot on" />
                    <span className="rowmain">
                      <b>{s.label}</b>
                      <span>
                        {n} open batch{n === 1 ? "" : "es"}
                        {who ? ` · ${who} teacher${who === 1 ? "" : "s"}` : ""}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="panelfoot">
            Who teaches what is set under <Link href="/institute/teachers">Teacher subjects</Link>. Your data can be
            downloaded any time from <Link href="/institute/export">Export data</Link>.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
