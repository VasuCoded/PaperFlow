import "server-only";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { Session } from "@/server/session";

export interface MemberRow {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  joinedAt: string;
  subjects: string[];
}

export interface InviteRow {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface ActiveSubject {
  classSubjectId: string;
  label: string;
}

/** Active class-subjects of the session's institute, labelled. */
export async function getActiveSubjects(session: Session): Promise<ActiveSubject[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("my_active_class_subjects")
    .select("class_subject_id, class_name, subject_name")
    .eq("institute_id", session.instituteId);
  return (data ?? [])
    .filter((r) => r.class_subject_id)
    .map((r) => ({ classSubjectId: r.class_subject_id!, label: `Class ${r.class_name} · ${r.subject_name}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
}

/**
 * Members of the session's institute with names and assigned subjects.
 * Every query carries the institute id explicitly, on top of RLS.
 */
export async function getMembers(session: Session): Promise<MemberRow[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();
  const inst = session.instituteId;

  const [{ data: members }, { data: assigned }, subjects] = await Promise.all([
    supabase.from("institute_members").select("user_id, role, created_at").eq("institute_id", inst),
    supabase.from("teacher_subjects").select("teacher_id, class_subject_id").eq("institute_id", inst),
    getActiveSubjects(session),
  ]);

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const labelById = new Map(subjects.map((s) => [s.classSubjectId, s.label]));
  const subjectsByTeacher = new Map<string, string[]>();
  for (const a of assigned ?? []) {
    const label = labelById.get(a.class_subject_id);
    if (!label) continue;
    subjectsByTeacher.set(a.teacher_id, [...(subjectsByTeacher.get(a.teacher_id) ?? []), label]);
  }

  const order: Record<string, number> = { institute_admin: 0, teacher: 1, student: 2 };
  return (members ?? [])
    .map((m) => {
      const p = profileById.get(m.user_id);
      return {
        userId: m.user_id,
        email: p?.email ?? "",
        fullName: p?.full_name ?? null,
        role: m.role,
        joinedAt: m.created_at,
        subjects: subjectsByTeacher.get(m.user_id) ?? [],
      };
    })
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
}

export async function getPendingInvites(session: Session): Promise<InviteRow[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("institute_invites")
    .select("id, email, role, created_at")
    .eq("institute_id", session.instituteId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at }));
}
