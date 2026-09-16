"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { useDemoSession } from "@/demo/session";
import { ACTIVE_CLASS_SUBJECTS, MEMBERS } from "@/demo/activity";
import { csLabel } from "@/demo/bank";

export default function TeacherSubjectsPage() {
  const { instituteId } = useDemoSession();
  const inst = instituteId ?? "";
  const teachers = (MEMBERS[inst] ?? []).filter((m) => m.role === "teacher");
  const active = ACTIVE_CLASS_SUBJECTS[inst] ?? [];

  const [grid, setGrid] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      teachers.map((t) => [
        t.accountId,
        active.filter((cs) => t.subjects.includes(csLabel(cs))),
      ]),
    ),
  );

  function toggle(teacherId: string, cs: string) {
    setGrid((g) => {
      const cur = g[teacherId] ?? [];
      return { ...g, [teacherId]: cur.includes(cs) ? cur.filter((x) => x !== cs) : [...cur, cs] };
    });
  }

  return (
    <Shell
      area="institute"
      eyebrow="Institute · teacher subjects"
      title={<>Who teaches <em>what</em></>}
      intro="A teacher can only generate papers for the class-subjects assigned here. Anything not ticked is invisible to them — the app returns nothing rather than an empty dropdown."
    >
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Teacher</th>
              {active.map((cs) => (
                <th key={cs} className="num">{csLabel(cs)}</th>
              ))}
              <th className="num">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.accountId}>
                <td>
                  <b>{t.name}</b>
                  <span className="sub">{t.email}</span>
                </td>
                {active.map((cs) => {
                  const on = (grid[t.accountId] ?? []).includes(cs);
                  return (
                    <td key={cs} className="num" style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(t.accountId, cs)}
                        aria-label={`${t.name} teaches ${csLabel(cs)}`}
                        style={{ accentColor: "var(--pen)", width: 16, height: 16 }}
                      />
                    </td>
                  );
                })}
                <td className="num">{(grid[t.accountId] ?? []).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        Only class-subjects <b>active for this institute</b> can be assigned. If a subject you want
        is missing, it has not been activated for you yet — request it from the Subjects screen.
      </div>
    </Shell>
  );
}
