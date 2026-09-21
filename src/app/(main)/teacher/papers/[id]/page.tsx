import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../_components/AppShell";
import { getSession } from "@/server/session";
import { loadPaper } from "@/server/data/papers";
import { createServerSupabaseClient } from "@/lib/db/server";
import { blockMarks } from "@/lib/print/compose";
import { CorrectSetControl } from "./CorrectSetControl";

export const metadata: Metadata = { title: "Paper · PaperFlow" };

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function PaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const paper = session ? await loadPaper(session, id, { withAnswers: false }) : null;
  if (!paper) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, student_id, paper_set_id, logged_at, attempt_items ( is_correct )")
    .eq("paper_id", paper.id)
    .eq("institute_id", paper.instituteId)
    .order("logged_at", { ascending: false })
    .returns<{ id: string; student_id: string; paper_set_id: string | null; logged_at: string; attempt_items: { is_correct: boolean }[] }[]>();

  const studentIds = [...new Set((attempts ?? []).map((a) => a.student_id))];
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", studentIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const labelBySetId = new Map(Object.entries(paper.setIds).map(([label, setId]) => [setId, label]));

  const positions = paper.canon.sections.reduce((n, s) => n + s.blocks.length, 0);
  const questionCount = paper.canon.sections.reduce(
    (n, s) => n + s.blocks.reduce((m, b) => m + b.questions.filter((q) => !q.isChoiceAlternative).length, 0),
    0,
  );
  const placedMarks = paper.canon.sections.reduce((n, s) => n + s.blocks.reduce((m, b) => m + blockMarks(b), 0), 0);

  return (
    <AppShell area="teacher" pathname="/teacher/papers">
      <div className="pagehead">
        <h1>{paper.title}</h1>
        <span>
          {paper.classSubjectLabel} · {paper.batchName ?? "No batch"} · saved {when.format(new Date(paper.createdAt))}
        </span>
      </div>
      <div className="cards c4" style={{ marginBottom: 20 }}>
        <div className="card"><span className="big">{placedMarks}</span><span className="cap">Marks</span></div>
        <div className="card"><span className="big">{positions}</span><span className="cap">Numbered questions</span></div>
        <div className="card"><span className="big">{paper.sets.length}</span><span className="cap">Printed sets</span></div>
        <div className="card"><span className="big">{(attempts ?? []).length}</span><span className="cap">Students logged</span></div>
      </div>

      <h2 className="sect">Print</h2>
      <div className="tablewrap" style={{ marginBottom: 8 }}>
        <table className="lt">
          <thead>
            <tr><th>Set</th><th className="num">Copies</th><th /></tr>
          </thead>
          <tbody>
            {paper.sets.map((s) => (
              <tr key={s.setLabel}>
                <td><b>Set {s.setLabel}</b></td>
                <td className="num">{s.copiesToPrint}</td>
                <td>
                  <div className="btnrow">
                    <Link className="btn sm ghost" target="_blank" href={`/print/paper/${paper.id}?set=${s.setLabel}&only=papers`}>Question paper</Link>
                    <Link className="btn sm ghost" target="_blank" href={`/print/paper/${paper.id}?set=${s.setLabel}&only=keys`}>Answer key</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="btnrow" style={{ marginBottom: 6 }}>
        <Link className="btn solid" target="_blank" href={`/print/paper/${paper.id}`}>Print everything</Link>
      </div>
      <p style={{ fontSize: 12, color: "var(--graphite)" }}>
        {questionCount} questions across {paper.sets.length} set{paper.sets.length === 1 ? "" : "s"}.
        &ldquo;Print everything&rdquo; gives every set&rsquo;s paper, then every key, then one mapping sheet
        {paper.sets.length > 1 ? " — hand out in a repeating cycle along each row" : ""}.
      </p>

      <h2 className="sect">Who logged, and which set they wrote</h2>
      {paper.sets.length > 1 && (
        <div className="notice warn">
          <b>Check the set column.</b> A student who logged against the wrong set has every tap mapped to
          the wrong question, so their weak spots are quietly wrong. Correcting it remaps their attempt
          and rebuilds their practice set in one step.
        </div>
      )}

      {(attempts ?? []).length === 0 ? (
        <p className="lede">No one has logged this paper yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Student</th>
                <th>Set</th>
                <th className="num">Wrong</th>
                <th className="num">Logged</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(attempts ?? []).map((a) => (
                <tr key={a.id}>
                  <td><b>{nameById.get(a.student_id) ?? "Student"}</b></td>
                  <td>
                    {a.paper_set_id ? <span className="pill active">Set {labelBySetId.get(a.paper_set_id) ?? "?"}</span> : "—"}
                  </td>
                  <td className="num">{a.attempt_items.filter((i) => !i.is_correct).length}</td>
                  <td className="num">{when.format(new Date(a.logged_at))}</td>
                  <td>
                    {paper.sets.length > 1 && a.paper_set_id && (
                      <CorrectSetControl
                        attemptId={a.id}
                        currentSetId={a.paper_set_id}
                        sets={Object.entries(paper.setIds).map(([label, setId]) => ({ label, setId }))}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
