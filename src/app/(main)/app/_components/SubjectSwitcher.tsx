"use client";

import { useTransition } from "react";
import { chooseSubject } from "@/server/actions/student";

export function SubjectSwitcher({ subjects, current }: { subjects: { id: string; short: string }[]; current: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="subjswitch"
      value={current}
      disabled={pending}
      aria-label="Switch subject"
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          await chooseSubject(next);
        });
      }}
    >
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.short}
        </option>
      ))}
    </select>
  );
}
