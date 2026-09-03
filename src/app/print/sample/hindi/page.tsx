import "katex/dist/katex.min.css";
import { QuestionPaper } from "@/components/print/QuestionPaper";
import { buildHindiSampleModel } from "@/lib/print/model";

/**
 * Hindi as its own SUBJECT paper — not a translation of another subject's
 * questions. This is the page to print when checking Devanagari matra
 * positioning on a real printer (§2.2), which only paper reveals.
 */
export default function HindiPrintSamplePage() {
  return (
    <main>
      <div className="pf-no-print" style={{ padding: 16, fontFamily: "system-ui" }}>
        <strong>Print preview — Class 10 Hindi (sample data).</strong> Single set. Print
        this to check Devanagari matra positioning and passage layout.
      </div>
      <QuestionPaper model={buildHindiSampleModel("A")} />
    </main>
  );
}
