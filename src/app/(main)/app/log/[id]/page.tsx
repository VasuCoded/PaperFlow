import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudentContext, StudentShell } from "../../_components/StudentShell";
import { getPaperForLogging } from "@/server/data/student";
import { renderRich } from "@/lib/print/math";
import { LogFlow, type FlowSet } from "./LogFlow";

export const metadata: Metadata = { title: "Log a paper · PaperFlow" };

/** First twelve words of plain text, with TeX delimiters removed. */
function firstWords(text: string, n = 12): string {
  const plain = text.replace(/\$\$?([^$]*)\$\$?/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
  const words = plain.split(/\s+/).filter(Boolean);
  const head = words.slice(0, n).join(" ");
  return words.length > n && !/[….]$/.test(head) ? `${head}…` : head;
}

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getStudentContext(`/app/log/${id}`);
  const paper = await getPaperForLogging(ctx.session, id);
  if (!paper) notFound();

  const sets: FlowSet[] = paper.sets.map((s) => ({
    id: s.id,
    label: s.label,
    firstQuestion: s.positions[0]?.questions[0] ? firstWords(s.positions[0].questions[0].body) : "",
    positions: s.positions.map((p) => ({
      position: p.position,
      number: p.number,
      marks: p.marks,
      practiceEligible: p.practiceEligible,
      sectionLabel: p.sectionLabel,
      stimulusHtml: p.stimulus ? renderRich(p.stimulus) : null,
      questions: p.questions.map((q) => ({
        html: renderRich(q.body),
        partLabel: q.partLabel,
        topic: q.topic,
        difficulty: q.difficulty,
      })),
    })),
  }));

  return (
    <StudentShell ctx={ctx} tab="tests">
      <p className="sec-label">
        <Link href="/app" style={{ color: "inherit" }}>← Tests</Link>
      </p>
      {sets.length === 0 ? (
        <div className="practice idle">
          <h4>This paper cannot be logged yet</h4>
          <p>No printed sets were stored for it. Tell your teacher.</p>
        </div>
      ) : (
        <LogFlow
          paperId={paper.id}
          title={paper.title}
          totalMarks={paper.totalMarks}
          sets={sets}
          existing={paper.existing}
        />
      )}
    </StudentShell>
  );
}
