import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getSession } from "@/server/session";
import { renderRich } from "@/lib/print/math";
import { FigureControls } from "./FigureControls";

export const metadata: Metadata = { title: "Questions · PaperFlow" };

const PAGE = 40;

type Row = {
  id: string;
  body: string;
  question_type: string;
  marks: number;
  difficulty: string;
  source: string | null;
  status: string;
  note: string | null;
  chapters: { name: string } | null;
  topics: { name: string } | null;
  question_assets: { id: string }[];
};

/**
 * The whole question bank for the platform owner: find any question by subject,
 * chapter, source or words in it, see it as it prints, and attach figures
 * (graphs, diagrams) that then appear on screen and on the printed paper.
 */
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ cs?: string; ch?: string; q?: string; src?: string; fig?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const supabase = await createServerSupabaseClient();

  const { data: coverage } = session?.isPlatformOwner ? await supabase.rpc("platform_bank_coverage") : { data: [] };
  const subjects = [...(coverage ?? [])]
    .filter((c) => c.approved + c.staging > 0)
    .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  const cs = subjects.find((s) => s.class_subject_id === sp.cs)?.class_subject_id ?? subjects[0]?.class_subject_id ?? null;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);

  const { data: chapters } = cs
    ? await supabase.from("chapters").select("id, name").eq("class_subject_id", cs).order("sort_order")
    : { data: [] as { id: string; name: string }[] };

  let rows: Row[] = [];
  let total = 0;
  let failed: string | null = null;
  let answers = new Map<string, string | null>();
  if (cs && session?.isPlatformOwner) {
    let query = supabase
      .from("questions")
      .select(
        "id, body, question_type, marks, difficulty, source, status, note, chapters ( name ), topics ( name ), question_assets ( id )",
        { count: "exact" },
      )
      .eq("class_subject_id", cs)
      .neq("status", "retired");
    if (sp.ch) query = query.eq("chapter_id", sp.ch);
    if (sp.src) query = query.eq("source", sp.src);
    if (sp.q?.trim()) query = query.ilike("body", `%${sp.q.trim().replace(/[%_]/g, "")}%`);
    if (sp.fig === "1") query = query.like("body", "%[[fig:%");
    const { data, count, error } = await query
      .order("chapter_id")
      .order("created_at")
      .range(page * PAGE, page * PAGE + PAGE - 1)
      .returns<Row[]>();
    rows = data ?? [];
    total = count ?? 0;
    failed = error?.message ?? null;
    // Answers are column-revoked from signed-in clients (migration 0018), so they
    // come from the service role, pinned to exactly the questions RLS just
    // showed this platform owner.
    if (rows.length) {
      const { data: ans } = await createAdminClient()
        .from("questions")
        .select("id, answer")
        .in("id", rows.map((r) => r.id));
      answers = new Map((ans ?? []).map((a) => [a.id, a.answer]));
    }
  }

  const qs = (over: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { cs: cs ?? undefined, ch: sp.ch, q: sp.q, src: sp.src, fig: sp.fig, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/platform/questions?${next.toString()}`;
  };

  return (
    <AppShell area="platform">
      <form className="toolbar qfilters" action="/platform/questions" method="get">
        <select name="cs" className="sel" defaultValue={cs ?? ""} aria-label="Subject">
          {subjects.map((s) => (
            <option key={s.class_subject_id} value={s.class_subject_id}>{s.label}</option>
          ))}
        </select>
        <select name="ch" className="sel" defaultValue={sp.ch ?? ""} aria-label="Chapter">
          <option value="">All chapters</option>
          {(chapters ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="src" className="sel" defaultValue={sp.src ?? ""} aria-label="Source">
          <option value="">Any source</option>
          <option value="NCERT">NCERT</option>
        </select>
        <input name="q" className="inp" defaultValue={sp.q ?? ""} placeholder="Words in the question" />
        <label className="check" style={{ whiteSpace: "nowrap" }}>
          <input type="checkbox" name="fig" value="1" defaultChecked={sp.fig === "1"} /> With figures
        </label>
        <button type="submit" className="btn solid">Show</button>
      </form>

      <p className="lede">
        {total} question{total === 1 ? "" : "s"}
        {total > PAGE ? ` · showing ${page * PAGE + 1}–${Math.min(total, page * PAGE + PAGE)}` : ""}. Figures appear wherever
        the question does: the paper builder, the printed paper and the student app.
      </p>

      {failed && <div className="notice warn">Could not load questions: {failed}</div>}

      {rows.length === 0 ? (
        <div className="empty panel"><p>No question matches.</p></div>
      ) : (
        <div className="qbank">
          {rows.map((r) => (
            <article key={r.id} className="qcard">
              <div className="qcardmeta">
                <span className={`tag ${r.difficulty[0]}`}>{r.difficulty}</span>
                <span className="tag">{r.question_type.toUpperCase()} · {r.marks} mark{r.marks === 1 ? "" : "s"}</span>
                {r.chapters && <span className="tag">{r.chapters.name}</span>}
                {r.topics && <span className="tag">{r.topics.name}</span>}
                {r.source && <span className="tag src">{r.source}</span>}
                {r.status !== "approved" && <span className="tag h">{r.status}</span>}
              </div>
              <div className="qcardbody" dangerouslySetInnerHTML={{ __html: renderRich(r.body) }} />
              {answers.get(r.id) && (
                <div className="qcardans">
                  <b>Answer:</b> <span dangerouslySetInnerHTML={{ __html: renderRich(answers.get(r.id)!) }} />
                </div>
              )}
              <div className="qcardfoot">
                <span className="muted">{r.note ?? ""}</span>
                <FigureControls questionId={r.id} assetIds={r.question_assets.map((a) => a.id)} />
              </div>
            </article>
          ))}
        </div>
      )}

      {total > PAGE && (
        <div className="btnrow" style={{ marginTop: 16 }}>
          {page > 0 && <Link className="btn" href={qs({ page: String(page - 1) })}>← Previous</Link>}
          {(page + 1) * PAGE < total && <Link className="btn" href={qs({ page: String(page + 1) })}>Next →</Link>}
        </div>
      )}
    </AppShell>
  );
}
