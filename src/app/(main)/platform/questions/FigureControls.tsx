"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attachFigureAction, removeFigureAction } from "@/server/actions/platform";
import { Icon } from "@/components/ui/Icon";

/** Attach a figure to a question (before or after its text), or remove one. */
export function FigureControls({ questionId, assetIds }: { questionId: string; assetIds: string[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="figctl">
      {assetIds.length > 0 && (
        <div className="figlist">
          {assetIds.map((id) => (
            <span key={id} className="figthumb">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by /asset after an access check */}
              <img src={`/asset/${id}`} alt="Figure" />
              <button
                type="button"
                className="btn sm ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const res = await removeFigureAction(id);
                    if (res.ok) router.refresh();
                    else setError(res.message ?? "Could not remove it.");
                  })
                }
              >
                Remove
              </button>
            </span>
          ))}
        </div>
      )}
      {!open ? (
        <button type="button" className="btn sm ghost" onClick={() => setOpen(true)}>
          <Icon name="filePlus" size={14} /> Add figure
        </button>
      ) : (
        <form
          ref={form}
          className="figform"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            data.set("questionId", questionId);
            start(async () => {
              setError(null);
              const res = await attachFigureAction(data);
              if (res.ok) {
                form.current?.reset();
                setOpen(false);
                router.refresh();
              } else setError(res.message ?? "Could not attach it.");
            });
          }}
        >
          <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="inp" />
          <select name="place" className="sel" defaultValue="after" aria-label="Where the figure goes">
            <option value="after">After the question text</option>
            <option value="before">Before the question text</option>
          </select>
          <span className="btnrow">
            <button type="submit" className="btn sm solid" disabled={pending}>
              {pending ? "Uploading…" : "Attach"}
            </button>
            <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </span>
        </form>
      )}
      {error && <p className="hint" style={{ color: "var(--pen)" }}>{error}</p>}
    </div>
  );
}
