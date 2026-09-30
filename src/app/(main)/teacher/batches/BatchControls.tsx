"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addStudentsToBatch,
  createBatch,
  deleteBatch,
  removeStudentFromBatch,
  rotateJoinCode,
  setBatchActive,
  setBatchSubject,
  setBatchSubjectTeacher,
  updateBatch,
} from "@/server/actions/teacher";

type Opt = { id: string; label: string };

export function RotateCodeButton({ batchId, disabled }: { batchId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "var(--pen)" }}>Old code stops working.</span>
        <button
          type="button"
          className="btn sm solid"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await rotateJoinCode(batchId);
              if (!res.ok) setError(res.message ?? "Could not change it.");
              setConfirming(false);
            })
          }
        >
          {pending ? "Changing…" : "New code"}
        </button>
        <button type="button" className="btn sm ghost" onClick={() => setConfirming(false)}>Cancel</button>
        {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
      </span>
    );
  }
  return (
    <button type="button" className="btn sm ghost" disabled={disabled} onClick={() => setConfirming(true)}>
      New code
    </button>
  );
}

export function ActiveToggle({ batchId, active }: { batchId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn sm ghost" disabled={pending} onClick={() => start(async () => { await setBatchActive(batchId, !active); })}>
      {active ? "Close batch" : "Reopen"}
    </button>
  );
}

/** Subject chips to tick; used when creating a batch and when editing one. */
function SubjectChips({ options, selected, onToggle, disabled }: { options: Opt[]; selected: string[]; onToggle: (id: string) => void; disabled?: (id: string) => boolean }) {
  return (
    <div className="chipset">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button key={o.id} type="button" className={`chapchip${on ? " on" : ""}`} aria-pressed={on} disabled={disabled?.(o.id)} onClick={() => onToggle(o.id)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function CreateBatchForm({ subjects }: { subjects: Opt[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (subjects.length === 0) {
    return <p className="hint">You need a subject assigned to you before you can create a batch.</p>;
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createBatch({ name, note, subjectIds: picked });
          if (res.ok) {
            setName("");
            setNote("");
            setPicked([]);
            router.refresh();
          } else setError(res.message ?? "Could not create the batch.");
        });
      }}
    >
      <div className="formrow">
        <div className="field">
          <label htmlFor="bn">Batch name</label>
          <input className="inp" id="bn" placeholder="e.g. Class 10 Morning" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bnote">Note <span className="muted">(optional)</span></label>
          <input className="inp" id="bnote" placeholder="e.g. Mon–Sat, 7–9 am, Room 2" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Subjects taught in this batch <span className="muted">· pick as many as you like</span></label>
        <SubjectChips options={subjects} selected={picked} onToggle={(id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} />
      </div>
      <button className="btn solid" type="submit" disabled={pending || name.trim().length < 2 || picked.length === 0}>
        {pending ? "Creating…" : "Create batch and get its code"}
      </button>
      {error && <div className="notice warn" style={{ marginTop: 10, marginBottom: 0 }}>{error}</div>}
    </form>
  );
}

/** Rename, change the note, and add or remove subjects. */
export function EditBatch({
  batchId,
  name,
  note,
  subjects,
  selected,
  editable,
  students,
  papers,
}: {
  batchId: string;
  name: string;
  note: string | null;
  subjects: Opt[];
  selected: string[];
  /** subjects this person may add or remove */
  editable: string[];
  students: number;
  papers: number;
}) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [nt, setNt] = useState(note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="batchedit">
      <div className="formrow">
        <div className="field">
          <label htmlFor={`n-${batchId}`}>Name</label>
          <input id={`n-${batchId}`} className="inp" value={n} maxLength={60} onChange={(e) => setN(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`t-${batchId}`}>Note</label>
          <input id={`t-${batchId}`} className="inp" value={nt} maxLength={120} placeholder="Timing, room…" onChange={(e) => setNt(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="btn sm"
        disabled={pending || (n === name && nt === (note ?? ""))}
        onClick={() =>
          start(async () => {
            const res = await updateBatch(batchId, n, nt);
            setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.message ?? "Could not save." });
            if (res.ok) router.refresh();
          })
        }
      >
        Save name and note
      </button>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Subjects <span className="muted">· tap to add or remove</span></label>
        <SubjectChips
          options={subjects}
          selected={selected}
          disabled={(id) => pending || !editable.includes(id)}
          onToggle={(id) =>
            start(async () => {
              setMsg(null);
              const res = await setBatchSubject(batchId, id, !selected.includes(id));
              if (res.ok) router.refresh();
              else setMsg({ ok: false, text: res.message ?? "Could not change it." });
            })
          }
        />
        <p className="hint">Papers already set for a subject you remove stay, and students keep what they logged.</p>
      </div>
      {msg && <p className="hint" style={{ color: msg.ok ? "var(--ledger)" : "var(--pen)" }}>{msg.text}</p>}
      <DeleteBatch batchId={batchId} name={name} students={students} papers={papers} />
    </div>
  );
}

function DeleteBatch({ batchId, name, students, papers }: { batchId: string; name: string; students: number; papers: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="danger compact">
      <div>
        <h3>Delete this batch</h3>
        <p>
          {students} student{students === 1 ? "" : "s"} leave the batch (their accounts stay).
          {papers > 0 ? ` Its ${papers} paper${papers === 1 ? " is" : "s are"} kept under Papers but hidden from students; anyone who already logged one keeps it.` : ""}
        </p>
      </div>
      {!asking ? (
        <button type="button" className="btn danger-btn" onClick={() => setAsking(true)}>Delete batch</button>
      ) : (
        <span className="btnrow">
          <button
            type="button"
            className="btn solid"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await deleteBatch(batchId);
                if (res.ok) router.refresh();
                else setError(res.message ?? "Could not delete it.");
              })
            }
          >
            {pending ? "Deleting…" : `Delete ${name}`}
          </button>
          <button type="button" className="btn ghost" disabled={pending} onClick={() => setAsking(false)}>Cancel</button>
          {error && <span className="hint" style={{ margin: 0, color: "var(--pen)" }}>{error}</span>}
        </span>
      )}
    </section>
  );
}

/** Admin: who teaches each subject of the batch. */
export function SubjectTeacherSelect({ batchId, classSubjectId, current, teachers }: { batchId: string; classSubjectId: string; current: string | null; teachers: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      className="sel tiny"
      value={current ?? ""}
      disabled={pending}
      aria-label="Teacher for this subject"
      onChange={(e) =>
        start(async () => {
          await setBatchSubjectTeacher(batchId, classSubjectId, e.target.value || null);
          router.refresh();
        })
      }
    >
      <option value="">No teacher set</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  );
}

/** Pick students of the institute to put straight into this batch. */
export function AddStudents({ batchId, candidates }: { batchId: string; candidates: Opt[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates.filter((c) => !needle || c.label.toLowerCase().includes(needle)).slice(0, 60);
  }, [candidates, q]);

  if (candidates.length === 0) {
    return <p className="hint">Every student of the institute is already in this batch. New students can join with the code.</p>;
  }
  return (
    <div className="addstudents">
      <input className="inp" placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
      <div className="pickgrid">
        {shown.map((c) => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))} />
            {c.label}
          </label>
        ))}
      </div>
      <div className="btnrow" style={{ alignItems: "center" }}>
        <button
          type="button"
          className="btn sm solid"
          disabled={pending || picked.length === 0}
          onClick={() =>
            start(async () => {
              const res = await addStudentsToBatch(batchId, picked);
              if (res.ok) {
                setMsg({ ok: true, text: `Added ${res.added ?? 0}.` });
                setPicked([]);
                router.refresh();
              } else setMsg({ ok: false, text: res.message ?? "Could not add them." });
            })
          }
        >
          {pending ? "Adding…" : `Add ${picked.length || ""} to batch`}
        </button>
        {msg && <span className="hint" style={{ margin: 0, color: msg.ok ? "var(--ledger)" : "var(--pen)" }}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function RemoveStudentButton({ batchId, studentId, name }: { batchId: string; studentId: string; name: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button type="button" className="btn sm ghost" onClick={() => setAsking(true)} aria-label={`Remove ${name} from this batch`}>
        Remove
      </button>
    );
  }
  return (
    <span className="btnrow" style={{ alignItems: "center" }}>
      <span className="hint" style={{ margin: 0, color: "var(--pen)" }}>Remove from this batch?</span>
      <button
        type="button"
        className="btn sm solid"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await removeStudentFromBatch(batchId, studentId);
            setAsking(false);
            router.refresh();
          })
        }
      >
        Remove
      </button>
      <button type="button" className="btn sm ghost" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}
