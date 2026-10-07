"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

export interface DropdownOption {
  value: string;
  label: string;
  /** a second, quieter line: marks, counts */
  hint?: string;
  /** options with the same group are listed under that heading */
  group?: string;
}

/**
 * A select that can show more than one line per option, and opens with the
 * app's motion. Keyboard: arrows move, Enter or Space chooses, Escape closes,
 * typing a letter jumps to the next option starting with it.
 */
export function Dropdown({
  id,
  value,
  options,
  onChange,
  label,
}: {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** for screen readers, when there is no visible <label htmlFor> */
  label?: string;
}) {
  const auto = useId();
  const btnId = id ?? `dd-${auto}`;
  const listId = `${btnId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // keep the highlighted option in view
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function choose(i: number) {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
    document.getElementById(btnId)?.focus();
  }
  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const n = options.length;
      for (let step = 1; step <= n; step++) {
        const i = (active + step) % n;
        if (options[i]!.label.toLowerCase().startsWith(k)) {
          setActive(i);
          break;
        }
      }
    }
  }

  let lastGroup: string | undefined;
  return (
    <div className={`dd${open ? " open" : ""}`} ref={root}>
      <button
        type="button"
        id={btnId}
        className="dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={label ? `${label}: ${current?.label ?? ""}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span className="dd-val">
          <span className="dd-label">{current?.label ?? "Choose…"}</span>
          {current?.hint && <span className="dd-hint">{current.hint}</span>}
        </span>
        <Icon name="chevronRight" size={16} className="dd-chev" />
      </button>
      {open && (
        <ul className="dd-pop" role="listbox" id={listId} ref={list} aria-labelledby={btnId} tabIndex={-1}>
          {options.map((o, i) => {
            const heading = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <li key={o.value} role="presentation">
                {heading && <div className="dd-group">{heading}</div>}
                <div
                  role="option"
                  id={`${listId}-${i}`}
                  data-i={i}
                  aria-selected={o.value === value}
                  className={`dd-opt${i === active ? " active" : ""}${o.value === value ? " sel" : ""}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span className="dd-val">
                    <span className="dd-label">{o.label}</span>
                    {o.hint && <span className="dd-hint">{o.hint}</span>}
                  </span>
                  {o.value === value && <Icon name="tick" size={15} className="dd-tick" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
