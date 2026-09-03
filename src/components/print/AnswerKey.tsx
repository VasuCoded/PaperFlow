import type { AnswerKeyModel } from "@/lib/print/model";

/**
 * One answer key per set, numbered in that set's display order. Where option
 * order was shuffled, the answer letter shown must be the shuffled letter
 * (§C7 item 2) — the DB layer resolves that before building this model.
 */
export function AnswerKey({ model }: { model: AnswerKeyModel }) {
  return (
    <div className="pf-paper">
      <header className="pf-paper-header">
        <div>
          <div className="pf-institute">{model.instituteName}</div>
          <div className="pf-meta">Answer key · {model.title}</div>
        </div>
        <div className="pf-set-badge">SET {model.setLabel}</div>
      </header>
      <table className="pf-key-table">
        <thead>
          <tr>
            <th style={{ width: "12%" }}>Q</th>
            <th>Answer</th>
            <th style={{ width: "12%" }}>Marks</th>
          </tr>
        </thead>
        <tbody>
          {model.entries.map((e, i) => (
            <tr key={i}>
              <td>
                {e.displayNumber}
                {e.partLabel ?? ""}
              </td>
              <td className={e.script === "devanagari" ? "pf-deva" : ""}>{e.answer}</td>
              <td>{e.marks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
