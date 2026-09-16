"use client";

import { useState, useTransition } from "react";
import { setTeacherSubject } from "@/server/actions/institute";

export function AssignToggle({
  teacherId,
  teacherName,
  classSubjectId,
  label,
  assigned,
}: {
  teacherId: string;
  teacherName: string;
  classSubjectId: string;
  label: string;
  assigned: boolean;
}) {
  const [checked, setChecked] = useState(assigned);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        aria-label={`${teacherName} teaches ${label}`}
        style={{ accentColor: "var(--pen)", width: 16, height: 16, cursor: "pointer" }}
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          setError(null);
          start(async () => {
            const res = await setTeacherSubject(teacherId, classSubjectId, next);
            if (!res.ok) {
              setChecked(!next);
              setError(res.message ?? "Failed");
            }
          });
        }}
      />
      {error && <span style={{ fontSize: 10.5, color: "var(--pen)", maxWidth: 120 }}>{error}</span>}
    </span>
  );
}
