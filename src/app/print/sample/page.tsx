import "katex/dist/katex.min.css";
import { QuestionPaper } from "@/components/print/QuestionPaper";
import { AnswerKey } from "@/components/print/AnswerKey";
import { MappingSheet } from "@/components/print/MappingSheet";
import {
  buildSampleModel,
  buildSampleKey,
  buildSampleMapping,
} from "@/lib/print/model";

/**
 * C7 print preview with sample data — Class 10 Science, English, with real
 * notation (KaTeX server-rendered, mhchem for chemistry).
 *
 * "Print everything" = every set's paper, then every key, then the mapping
 * sheet, as ONE document in which each artefact starts on its own page.
 * In the real app this is /teacher/papers/[id]/print with data from the DB.
 */
export default function PrintSamplePage() {
  const setLabels = ["A", "B", "C"];

  return (
    <main>
      <div className="pf-no-print" style={{ padding: 16, fontFamily: "system-ui" }}>
        <strong>Print preview — Class 10 Science (sample data).</strong> Print to PDF to
        check A4 layout, that each set/key/mapping sheet lands on its own page, and that
        equations render. Hindi is a separate subject paper at{" "}
        <a href="/print/sample/hindi">/print/sample/hindi</a>.
      </div>

      {setLabels.map((l) => (
        <QuestionPaper key={`paper-${l}`} model={buildSampleModel(l)} />
      ))}
      {setLabels.map((l) => (
        <AnswerKey key={`key-${l}`} model={buildSampleKey(l)} />
      ))}
      <MappingSheet model={buildSampleMapping(setLabels)} />
    </main>
  );
}
