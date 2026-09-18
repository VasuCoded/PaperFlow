import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudentContext, StudentShell } from "../../_components/StudentShell";
import { getPaperForLogging } from "@/server/data/student";
import { firstWordsTex, renderRich } from "@/lib/print/math";
import { LogFlow, type FlowSet } from "./LogFlow";

export const metadata: Metadata = { title: "Log a paper · PaperFlow" };

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getStudentContext(`/app/log/${id}`);
  const paper = await getPaperForLogging(ctx.session, id);
  if (!paper) notFound();

  const sets: FlowSet[] = paper.sets.map((s) => ({
    id: s.id,
    label: s.label,
    // The first twelve words, rendered: "is this question 1 on your sheet?" has
    // to look like the sheet, formulae included.
    firstQuestionHtml: s.positions[0]?.questions[0] ? renderRich(firstWordsTex(s.positions[0].questions[0].body)) : "",
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
