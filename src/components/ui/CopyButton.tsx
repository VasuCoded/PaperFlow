"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/** Copies a short text (a join code) and says so for a moment. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn sm ghost"
      aria-label={`${label} ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // clipboard blocked: the code is on screen to copy by hand
        }
      }}
    >
      <Icon name="copy" size={14} /> {done ? "Copied" : label}
    </button>
  );
}
