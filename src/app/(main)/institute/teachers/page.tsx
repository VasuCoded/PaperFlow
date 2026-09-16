import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { getActiveSubjects, getMembers } from "@/server/data/institute";
import { AssignToggle } from "./AssignToggle";

export const metadata: Metadata = { title: "Teacher subjects · PaperFlow" };

export default async function TeacherSubjectsPage() {
  const session = await getSession();
  const admin = session?.role === "institute_admin" ? session : null;

  const [members, subjects, assignedRes] = admin
    ? await Promise.all([
        getMembers(admin),
        getActiveSubjects(admin),
        (await createServerSupabaseClient())
          .from("teacher_subjects")
          .select("teacher_id, class_subject_id")
          .eq("institute_id", admin.instituteId!),
      ])
    : [[], [], { data: [] }];

  // Admins can generate papers too, so they appear in the grid below teachers.
  const desk = members.filter((m) => m.role === "teacher" || m.role === "institute_admin");
  const assigned = new Set((assignedRes.data ?? []).map((a) => `${a.teacher_id}:${a.class_subject_id}`));

  return (
    <AppShell
      area="institute"
      pathname="/institute/teachers"
      eyebrow="Institute · teacher subjects"
      title={
        <>
          Who teaches <em>what</em>
        </>
      }
      intro="A teacher can only generate papers and create batches for the class-subjects ticked here. Changes save as you tick."
    >
      {subjects.length === 0 ? (
        <div className="notice warn">
          <b>No subjects are active for your institute yet,</b> so there is nothing to assign.{" "}
          <Link href="/institute/subjects">Request a subject →</Link>
        </div>
      ) : desk.length === 0 ? (
        <p className="lede">
          No teachers yet. <Link href="/institute/members">Invite one →</Link>
        </p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Teacher</th>
                {subjects.map((s) => (
                  <th key={s.classSubjectId} style={{ textAlign: "center" }}>{s.label}</th>
                ))}
                <th className="num">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {desk.map((t) => (
                <tr key={t.userId}>
                  <td>
                    <b>{t.fullName ?? t.email}</b>
                    <span className="sub">
                      {t.fullName ? t.email : ""}
                      {t.role === "institute_admin" ? `${t.fullName ? " · " : ""}admin` : ""}
                    </span>
                  </td>
                  {subjects.map((s) => (
                    <td key={s.classSubjectId} style={{ textAlign: "center" }}>
                      <AssignToggle
                        teacherId={t.userId}
                        teacherName={t.fullName ?? t.email}
                        classSubjectId={s.classSubjectId}
                        label={s.label}
                        assigned={assigned.has(`${t.userId}:${s.classSubjectId}`)}
                      />
                    </td>
                  ))}
                  <td className="num">{subjects.filter((s) => assigned.has(`${t.userId}:${s.classSubjectId}`)).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="notice" style={{ marginTop: 16 }}>
        Only class-subjects <b>active for this institute</b> can be assigned. If a subject you want is missing, it has
        not been activated for you yet — request it from the Subjects screen. Removing an assignment does not delete
        papers the teacher already made.
      </div>
    </AppShell>
  );
}
