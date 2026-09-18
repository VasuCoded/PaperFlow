import "server-only";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { Session } from "@/server/session";
import type { Pattern, PatternSection } from "@/server/generator/types";

export interface TeachingSubject {
  classSubjectId: string;
  className: string;
  subjectName: string;
  shortName: string | null;
  script: string;
  bankStatus: string;
}

/**
 * What this person may generate for, in the institute the session is acting
 * within: their teacher_subjects, intersected with what the institute has
 * ACTIVE. Read from my_active_class_subjects — never by filtering status in
 * application code (CLAUDE.md > Scope).
 *
 * An institute_admin sees everything active at their institute; a teacher sees
 * only their assignments.
 */
export async function getTeachingSubjects(session: Session): Promise<TeachingSubject[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();

  const { data: active } = await supabase
    .from("my_active_class_subjects")
    .select("class_subject_id, class_name, subject_name, subject_short_name, script, bank_status")
    .eq("institute_id", session.instituteId);

  const rows = active ?? [];
  if (rows.length === 0) return [];

  let allowed = new Set(rows.map((r) => r.class_subject_id).filter((x): x is string => !!x));

  if (session.role === "teacher") {
    const { data: assigned } = await supabase
      .from("teacher_subjects")
      .select("class_subject_id")
      .eq("institute_id", session.instituteId)
      .eq("teacher_id", session.userId);
    const mine = new Set((assigned ?? []).map((a) => a.class_subject_id));
    allowed = new Set([...allowed].filter((id) => mine.has(id)));
  }

  return rows
    .filter((r) => r.class_subject_id && allowed.has(r.class_subject_id))
    .map((r) => ({
      classSubjectId: r.class_subject_id!,
      className: r.class_name ?? "",
      subjectName: r.subject_name ?? "",
      shortName: r.subject_short_name,
      script: r.script ?? "latin",
      bankStatus: r.bank_status ?? "planned",
    }));
}

export interface ChapterCount {
  chapterId: string;
  name: string;
  approved: number;
}

export interface StrandOption {
  id: string;
  name: string;
}

/**
 * Strands of a class-subject (Social Science: History, Geography, Political
 * Science, Economics). Global taxonomy, readable by everyone.
 */
export async function getStrands(classSubjectId: string): Promise<StrandOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("strands")
    .select("id, name, sort_order")
    .eq("class_subject_id", classSubjectId)
    .order("sort_order")
    .order("name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.name }));
}

/** One aggregate for the whole class-subject (C8 performance rule). */
export async function getChapterCounts(
  instituteId: string,
  classSubjectId: string,
): Promise<ChapterCount[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("chapter_pool_counts", {
    p_institute_id: instituteId,
    p_class_subject_id: classSubjectId,
  });
  return (data ?? []).map((r) => ({
    chapterId: r.chapter_id,
    name: r.chapter_name,
    approved: Number(r.approved),
  }));
}

export interface PatternWithSections extends Pattern {
  /** pattern_sections.id, parallel to sections — stored on paper_sections */
  sectionIds: string[];
  origin: string;
  durationMin: number | null;
  isDefault: boolean;
  ownerInstituteId: string;
}

/** Platform (board) patterns plus this institute's own, for one class-subject. */
export async function getPatterns(
  instituteId: string,
  classSubjectId: string,
): Promise<PatternWithSections[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_patterns")
    .select(
      `id, name, total_marks, duration_min, origin, is_default, owner_institute_id,
       pattern_sections (
         id, label, sort_order, instructions, question_count, marks_each,
         question_types, allow_choice, practice_eligible, requires_stimulus
       )`,
    )
    .eq("class_subject_id", classSubjectId)
    .order("is_default", { ascending: false })
    .order("total_marks", { ascending: true });

  return (data ?? []).map((p) => {
    const ordered = [...(p.pattern_sections ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const sections: PatternSection[] = ordered
      .map((s) => ({
        label: s.label,
        questionCount: s.question_count,
        marksEach: s.marks_each,
        questionTypes: s.question_types ?? [],
        allowChoice: s.allow_choice,
        practiceEligible: s.practice_eligible,
        requiresStimulus: s.requires_stimulus,
      }));
    return {
      id: p.id,
      name: p.name,
      totalMarks: p.total_marks,
      sections,
      sectionIds: ordered.map((s) => s.id),
      origin: p.origin,
      durationMin: p.duration_min,
      isDefault: p.is_default,
      ownerInstituteId: p.owner_institute_id,
    };
  });
}

export interface BatchOption {
  id: string;
  name: string;
  classSubjectId: string;
  students: number;
}

export async function getBatches(
  instituteId: string,
  classSubjectId?: string,
): Promise<BatchOption[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("batches")
    .select("id, name, class_subject_id, enrolments(count)")
    .eq("institute_id", instituteId)
    .eq("active", true);
  if (classSubjectId) q = q.eq("class_subject_id", classSubjectId);

  const { data } = await q;
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    classSubjectId: b.class_subject_id,
    students: Array.isArray(b.enrolments) ? (b.enrolments[0]?.count ?? 0) : 0,
  }));
}
