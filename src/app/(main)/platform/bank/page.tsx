import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { renderRich } from "@/lib/print/math";
import { parseOptions } from "@/lib/options";
import { ReviewControls } from "./ReviewControls";

export const metadata: Metadata = { title: "Review queue · PaperFlow" };

const LIMIT = 50;

export default async function ReviewQueuePage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  // Reading the queue exposes institute-private questions and their answers,
  // so platform_review_queue logs one access row per call.
  const { data } = session?.isPlatformOwner
    ? await supabase.rpc("platform_review_queue", { p_limit: LIMIT })
    : { data: [] };
  const queue = (data ?? []).map((q) => ({
    ...q,
    bodyHtml: renderRich(q.body),
    answerHtml: q.answer ? renderRich(q.answer) : null,
    options: parseOptions(q.options).map((o) => ({ key: o.key, html: renderRich(o.text) })),
  }));

  const flagged = queue.filter((q) => q.note).length;
  const privateCount = queue.filter((q) => q.is_private).length;

  return (
    <AppShell area="platform" pathname="/platform/bank">
      <div className="cards c4" style={{ marginBottom: 20 }}>
        <div className="card"><span className="big">{queue.length}{queue.length === LIMIT ? "+" : ""}</span><span className="cap">Staged, by subject</span></div>
        <div className="card"><span className="big">{flagged}</span><span className="cap">Flagged uncertain</span></div>
        <div className="card"><span className="big">{privateCount}</span><span className="cap">Institute-private</span></div>
        <div className="card"><span className="big">{queue.length - privateCount}</span><span className="cap">For the shared bank</span></div>
      </div>

      <div className="notice warn">
        <b>What you are actually checking.</b> Does the answer match the question — that is the one that
        would embarrass you in front of somebody else&rsquo;s parent. Then: is the owner right, are diagrams
        present, are the marks sane. Check anything the session flagged as unsure and skim the rest lighter.
      </div>

      {queue.length === 0 && <p className="lede">The queue is empty. Nothing is waiting for review.</p>}

      {queue.map((q) => (
        <div
          className="card"
          key={q.id}
          style={{ marginBottom: 12, borderLeft: q.is_private ? "3px solid var(--ledger)" : undefined }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
                <span className="pill staging">staging</span>
                <span className={`tag ${q.difficulty?.[0] ?? ""}`}>{q.difficulty}</span>
                <span className="tag">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
                <span className="tag src">{q.class_subject_label}</span>
                {q.chapter_name && <span className="tag">{q.chapter_name}</span>}
                {q.source && <span className="tag">{q.source}</span>}
                {q.is_private ? <span className="tag priv">Private · {q.owner_name}</span> : <span className="tag">Shared bank</span>}
              </div>
              <div className="qtext" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 7 }} dangerouslySetInnerHTML={{ __html: q.bodyHtml }} />
              {q.options.length > 0 && (
                <ol style={{ margin: "0 0 8px", paddingLeft: 0, listStyle: "none", fontSize: 13 }}>
                  {q.options.map((o) => (
                    <li
                      key={o.key}
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: "2px 0",
                        fontWeight: o.key === q.correct_option ? 600 : 400,
                        color: o.key === q.correct_option ? "var(--ledger)" : undefined,
                      }}
                    >
                      <span style={{ fontFamily: "var(--mono)" }}>({o.key})</span>
                      <span dangerouslySetInnerHTML={{ __html: o.html }} />
                    </li>
                  ))}
                </ol>
              )}
              {q.answerHtml && (
                <div style={{ fontSize: 12.5, color: "var(--graphite)" }}>
                  <b style={{ color: "var(--ink)" }}>Answer:</b> <span dangerouslySetInnerHTML={{ __html: q.answerHtml }} />
                </div>
              )}
              {q.note && (
                <div className="notice warn" style={{ marginTop: 10, marginBottom: 0 }}>
                  <b>Session note:</b> {q.note}
                </div>
              )}
            </div>
            <ReviewControls questionId={q.id} isPrivate={q.is_private} ownerName={q.owner_name} />
          </div>
        </div>
      ))}

      <div className="notice plain">
        Approving an institute-private question into the shared bank is a separate, explicit action with a
        confirmation naming the owner — a private question sitting in the shared bank is both a licensing
        problem and a competitive one. Opening this page was logged, because it shows private questions.
      </div>
    </AppShell>
  );
}
