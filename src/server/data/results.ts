import "server-only";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { Session } from "@/server/session";
import { getTeachingSubjects } from "./teacher";

/**
 * What a batch's students have logged: who logs, how many they got wrong, and
 * which topics the batch keeps getting wrong. Read under the caller's own RLS
 * (teachers and admins may read their institute's attempts), scoped to the
 * batches of subjects they teach (every batch, for an admin).
 *
 * Bounded: the batch's last PAPER_WINDOW papers, and only the wrong answers of
 * each attempt are fetched, embedded in the attempt rows (one request).
 */
export const PAPER_WINDOW = 10;

export interface ResultsBatch {
  id: string;
  name: string;
  label: string;
  joinCode: string;
  active: boolean;
  students: number;
  /** when its newest paper was set, or null */
  lastPaperAt: string | null;
}

export interface StudentResult {
  id: string;
  name: string;
  logged: number;
  wrong: number;
  lastLogged: string | null;
  weakest: string | null;
}

export interface TopicResult {
  topic: string;
  chapter: string;
  wrong: number;
  students: number;
}

export interface BatchResults {
  batch: ResultsBatch;
  papers: { id: string; title: string; createdAt: string; logged: number }[];
  students: StudentResult[];
  topics: TopicResult[];
}

type BatchRow = {
  id: string;
  name: string;
  class_subject_id: string;
  join_code: string;
  active: boolean;
  enrolments: { student_id: string }[];
  papers: { created_at: string }[];
};
type AttemptRow = {
  id: string;
  student_id: string;
  paper_id: string;
  logged_at: string;
  attempt_items: { questions: { topics: { name: string } | null; chapters: { name: string } | null } | null }[];
};

/** The batches this person can see results for, newest first (open ones first). */
export async function getResultBatches(session: Session): Promise<(ResultsBatch & { studentIds: string[] })[]> {
  if (!session.instituteId) return [];
  const subjects = await getTeachingSubjects(session);
  if (subjects.length === 0) return [];
  const label = new Map(subjects.map((s) => [s.classSubjectId, `Class ${s.className} · ${s.subjectName}`]));
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("batches")
    .select("id, name, class_subject_id, join_code, active, enrolments ( student_id ), papers ( created_at )")
    .eq("institute_id", session.instituteId)
    .in("class_subject_id", [...label.keys()])
    .order("active", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<BatchRow[]>();
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    label: label.get(b.class_subject_id) ?? "",
    joinCode: b.join_code,
    active: b.active,
    students: b.enrolments.length,
    lastPaperAt: b.papers.reduce<string | null>((m, p) => (!m || p.created_at > m ? p.created_at : m), null),
    studentIds: b.enrolments.map((e) => e.student_id),
  }));
}

export async function getBatchResults(
  session: Session,
  batch: ResultsBatch & { studentIds: string[] },
): Promise<BatchResults> {
  const supabase = await createServerSupabaseClient();
  const [{ data: paperRows }, { data: profiles }] = await Promise.all([
    supabase
      .from("papers")
      .select("id, title, created_at")
      .eq("institute_id", session.instituteId!)
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: false })
      .limit(PAPER_WINDOW),
    batch.studentIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", batch.studentIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
  ]);
  const papers = paperRows ?? [];

  const { data: attemptRows } = papers.length
    ? await supabase
        .from("attempts")
        .select("id, student_id, paper_id, logged_at, attempt_items ( questions ( topics ( name ), chapters ( name ) ) )")
        .eq("institute_id", session.instituteId!)
        .in("paper_id", papers.map((p) => p.id))
        .eq("attempt_items.is_correct", false)
        .returns<AttemptRow[]>()
    : { data: [] as AttemptRow[] };
  // only students still in the batch
  const inBatch = new Set(batch.studentIds);
  const attempts = (attemptRows ?? []).filter((a) => inBatch.has(a.student_id));

  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email.replace(/@users\.paperflow\.invalid$/, "")]));
  const perStudent = new Map<string, { logged: number; wrong: number; last: string | null; topics: Map<string, number> }>();
  for (const id of batch.studentIds) perStudent.set(id, { logged: 0, wrong: 0, last: null, topics: new Map() });
  const topicWrong = new Map<string, { chapter: string; wrong: number; students: Set<string> }>();

  for (const a of attempts) {
    const s = perStudent.get(a.student_id)!;
    s.logged++;
    if (!s.last || a.logged_at > s.last) s.last = a.logged_at;
    for (const item of a.attempt_items) {
      s.wrong++;
      const topic = item.questions?.topics?.name ?? item.questions?.chapters?.name ?? "Other";
      s.topics.set(topic, (s.topics.get(topic) ?? 0) + 1);
      const t = topicWrong.get(topic) ?? { chapter: item.questions?.chapters?.name ?? "", wrong: 0, students: new Set<string>() };
      t.wrong++;
      t.students.add(a.student_id);
      topicWrong.set(topic, t);
    }
  }

  const loggedPerPaper = new Map<string, number>();
  for (const a of attempts) loggedPerPaper.set(a.paper_id, (loggedPerPaper.get(a.paper_id) ?? 0) + 1);

  return {
    batch,
    papers: papers.map((p) => ({ id: p.id, title: p.title, createdAt: p.created_at, logged: loggedPerPaper.get(p.id) ?? 0 })),
    students: [...perStudent.entries()]
      .map(([id, s]) => ({
        id,
        name: nameOf.get(id) ?? "Student",
        logged: s.logged,
        wrong: s.wrong,
        lastLogged: s.last,
        weakest: [...s.topics.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
      }))
      .sort((x, y) => x.name.localeCompare(y.name)),
    topics: [...topicWrong.entries()]
      .map(([topic, t]) => ({ topic, chapter: t.chapter, wrong: t.wrong, students: t.students.size }))
      .sort((x, y) => y.students - x.students || y.wrong - x.wrong)
      .slice(0, 12),
  };
}
