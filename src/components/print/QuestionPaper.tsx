import type { PaperPrintModel, PrintBlock } from "@/lib/print/model";

function Block({ block }: { block: PrintBlock }) {
  return (
    <div className="pf-block">
      {block.stimulus && (
        <div className={`pf-stimulus ${block.stimulus.script === "devanagari" ? "pf-deva" : ""}`}>
          {block.stimulus.body}
          {block.stimulus.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.stimulus.imageUrl} alt="" style={{ maxWidth: "100%", marginTop: 6 }} />
          )}
        </div>
      )}
      {block.questions.map((q, i) => (
        <div key={i} className={`pf-q ${q.script === "devanagari" ? "pf-deva" : ""}`}>
          <span className="pf-q-num">
            {i === 0 || q.displayNumber !== block.questions[i - 1]!.displayNumber ? q.displayNumber : ""}
            {q.partLabel ?? ""}
          </span>
          <span>
            {q.body}
            {q.options && (
              <span className="pf-options">
                {q.options.map((o) => (
                  <span key={o.letter}>
                    ({o.letter}) {o.text}
                  </span>
                ))}
              </span>
            )}
          </span>
          <span className="pf-q-marks">[{q.marks}]</span>
        </div>
      ))}
    </div>
  );
}

export function QuestionPaper({ model }: { model: PaperPrintModel }) {
  return (
    <div className="pf-paper">
      <header className="pf-paper-header">
        <div>
          <div className="pf-institute">{model.instituteName}</div>
          <div className="pf-meta">
            Class {model.className} · {model.subjectName} · {model.title}
          </div>
          <div className="pf-meta">
            Max Marks: {model.totalMarks}
            {model.durationMin ? ` · Time: ${model.durationMin} min` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {model.setCount > 1 && (
            <div className="pf-set-badge" aria-label={`Set ${model.setLabel}`}>
              SET {model.setLabel}
            </div>
          )}
          {model.instituteLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.instituteLogoUrl} alt="" className="pf-logo-slot" style={{ objectFit: "contain" }} />
          ) : (
            <div className="pf-logo-slot">logo</div>
          )}
        </div>
      </header>

      {model.sections.map((section) => (
        <section key={section.label} className="pf-section">
          <div className="pf-section-head">
            <span>Section {section.label}</span>
            {section.instructions && <span style={{ fontWeight: 400, fontSize: "9.5pt" }}>{section.instructions}</span>}
          </div>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}

      <footer className="pf-footer">
        <span>{model.setCount > 1 ? `Set ${model.setLabel}` : "Single set"}</span>
        <span>{model.instituteName}</span>
      </footer>
    </div>
  );
}
