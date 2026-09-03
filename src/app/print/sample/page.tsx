import "katex/dist/katex.min.css";
import { QuestionPaper } from "@/components/print/QuestionPaper";
import { AnswerKey } from "@/components/print/AnswerKey";
import { MappingSheet } from "@/components/print/MappingSheet";
import { SAMPLE_SCIENCE_PAPER } from "@/lib/print/sample-paper";
import {
  toShufflePaper,
  composeSetPaper,
  composeSetKey,
  composeMapping,
} from "@/lib/print/compose";
import { buildSets } from "@/server/sets";

/**
 * C7 print preview — Class 10 Science, three genuinely shuffled sets.
 *
 * The paper is authored once in canonical order; buildSets (C6) derives the
 * per-set orderings, and the compose layer renumbers each set and its key.
 * This is the same path the real /teacher/papers/[id]/print will take, with
 * the canonical paper coming from the DB instead of a constant.
 */
export default function PrintSamplePage() {
  const canon = SAMPLE_SCIENCE_PAPER;
  const SET_COUNT = 3;
  const BATCH_SIZE = 40;

  const { sets, warnings, pairwiseOverlap } = buildSets(
    toShufflePaper(canon),
    SET_COUNT,
    BATCH_SIZE,
    20260903, // persisted per paper in the real app, so reprints are identical
  );

  return (
    <main>
      <div className="pf-no-print" style={{ padding: 16, fontFamily: "system-ui", lineHeight: 1.5 }}>
        <strong>Print preview — Class 10 Science, {SET_COUNT} shuffled sets.</strong>
        <br />
        Question order genuinely differs per set (mean positional overlap{" "}
        {(pairwiseOverlap * 100).toFixed(0)}%). Each set&apos;s key is numbered in that
        set&apos;s order. Copies:{" "}
        {sets.map((s) => `${s.setLabel}=${s.copiesToPrint}`).join(", ")} for {BATCH_SIZE} students.
        {warnings.length > 0 && (
          <>
            <br />
            <em>
              Warnings:{" "}
              {warnings.map((w) => `Section ${w.section} (${w.blocks} blocks)`).join("; ")} — too
              short to give every set a distinct ordering.
            </em>
          </>
        )}
        <br />
        Hindi is a separate subject paper at <a href="/print/sample/hindi">/print/sample/hindi</a>.
      </div>

      {sets.map((s) => (
        <QuestionPaper key={`paper-${s.setLabel}`} model={composeSetPaper(canon, s, SET_COUNT)} />
      ))}
      {sets.map((s) => (
        <AnswerKey key={`key-${s.setLabel}`} model={composeSetKey(canon, s)} />
      ))}
      <MappingSheet model={composeMapping(canon, sets)} />
    </main>
  );
}
