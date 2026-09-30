"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/**
 * A search box that narrows the rows of a table already on the page, as you
 * type, without asking the server. Rows opt in with data-search="text to
 * match"; the table is the element with id `target`.
 */
export function TableSearch({ target, placeholder = "Search…" }: { target: string; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);

  function apply(value: string) {
    setQ(value);
    const needle = value.trim().toLowerCase();
    const rows = document.querySelectorAll<HTMLElement>(`#${target} [data-search]`);
    let n = 0;
    rows.forEach((row) => {
      const hit = !needle || (row.dataset.search ?? "").toLowerCase().includes(needle);
      row.hidden = !hit;
      if (hit) n++;
    });
    setShown(needle ? n : null);
  }

  return (
    <div className="searchbox">
      <Icon name="search" size={16} />
      <input
        type="search"
        className="inp"
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => apply(e.target.value)}
      />
      {shown !== null && <span className="searchcount">{shown} found</span>}
    </div>
  );
}
