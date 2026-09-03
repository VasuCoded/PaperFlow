import type { MappingSheetModel } from "@/lib/print/model";

/**
 * One master mapping sheet: canonical question number, its position in each set,
 * the answer and the marks (§C7 item 3). This is what keeps hand-checking cheap
 * across sets. Header carries the distribution instruction.
 */
export function MappingSheet({ model }: { model: MappingSheetModel }) {
  return (
    <div className="pf-paper">
      <header className="pf-paper-header">
        <div>
          <div className="pf-institute">{model.instituteName}</div>
          <div className="pf-meta">Master mapping sheet · {model.title}</div>
          <div className="pf-meta">Hand out in a repeating cycle {model.setLabels.join(", ")} along each row.</div>
        </div>
        <div className="pf-meta">
          {model.setLabels.map((l) => (
            <div key={l}>
              Set {l}: {model.copies[l] ?? 0} copies
            </div>
          ))}
        </div>
      </header>
      <table className="pf-map-table">
        <thead>
          <tr>
            <th>Canonical #</th>
            {model.setLabels.map((l) => (
              <th key={l}>Set {l} pos</th>
            ))}
            <th>Answer</th>
            <th>Marks</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((r) => (
            <tr key={r.canonicalNumber}>
              <td>{r.canonicalNumber}</td>
              {model.setLabels.map((l) => (
                <td key={l}>{r.positionInSet[l] ?? "—"}</td>
              ))}
              <td>{r.answer}</td>
              <td>{r.marks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
