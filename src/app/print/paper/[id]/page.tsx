import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuestionPaper } from "@/components/print/QuestionPaper";
import { AnswerKey } from "@/components/print/AnswerKey";
import { MappingSheet } from "@/components/print/MappingSheet";
import { composeMapping, composeSetKey, composeSetPaper } from "@/lib/print/compose";
import { getSession } from "@/server/session";
import { loadPaper } from "@/server/data/papers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print · PaperFlow", robots: { index: false } };

/**
 * Print a saved paper exactly as stored: each set's question paper, then each
 * set's answer key, then one master mapping sheet — every artefact on its own
 * page (C7).
 *
 * Outside the (main) layout on purpose: print wants a plain white page, not the
 * app chrome. It is still authenticated, and still 404s rather than revealing
 * that a paper exists to someone who may not print it.
 */
export default async function PrintPaperPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ set?: string; only?: string }>;
}) {
  const { id } = await params;
  const { set, only } = await searchParams;

  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/print/paper/${id}`)}`);
  if (session.role !== "teacher" && session.role !== "institute_admin") notFound();

  const paper = await loadPaper(session, id, { withAnswers: true });
  if (!paper) notFound();

  if (paper.sets.length === 0) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <p>This paper has no printed sets stored, so there is nothing to print.</p>
        <Link href={`/teacher/papers/${paper.id}`}>Back to the paper</Link>
      </main>
    );
  }

  const chosen = set ? paper.sets.filter((s) => s.setLabel === set) : paper.sets;
  const show = (part: "papers" | "keys" | "mapping") => !only || only === part;
  const setCount = paper.sets.length;

  return (
    <main>
      <div className="pf-no-print" style={{ padding: "14px 16px", fontFamily: "system-ui", fontSize: 14, lineHeight: 1.6, borderBottom: "1px solid #ddd" }}>
        <strong>{paper.title}</strong> · {paper.classSubjectLabel} · {setCount} set{setCount === 1 ? "" : "s"}.
        Each document below starts on its own page. Use your browser&apos;s Print (Ctrl+P), A4, margins
        &ldquo;Default&rdquo;, headers and footers off.
        <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/print/paper/${paper.id}`}>Everything</Link>
          <Link href={`/print/paper/${paper.id}?only=papers`}>Question papers only</Link>
          <Link href={`/print/paper/${paper.id}?only=keys`}>Answer keys only</Link>
          {setCount > 1 && <Link href={`/print/paper/${paper.id}?only=mapping`}>Mapping sheet only</Link>}
          {paper.sets.map((s) => (
            <Link key={s.setLabel} href={`/print/paper/${paper.id}?set=${s.setLabel}`}>
              Set {s.setLabel} ({s.copiesToPrint} copies)
            </Link>
          ))}
          <Link href={`/teacher/papers/${paper.id}`}>← Back</Link>
        </div>
      </div>

      {show("papers") && chosen.map((s) => (
        <QuestionPaper key={`p-${s.setLabel}`} model={composeSetPaper(paper.canon, s, setCount)} />
      ))}
      {show("keys") && chosen.map((s) => (
        <AnswerKey key={`k-${s.setLabel}`} model={composeSetKey(paper.canon, s)} />
      ))}
      {show("mapping") && setCount > 1 && !set && <MappingSheet model={composeMapping(paper.canon, paper.sets)} />}
    </main>
  );
}
