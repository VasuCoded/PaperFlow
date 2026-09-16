"use client";

import { useTransition } from "react";
import { switchInstitute } from "@/server/actions/membership";
import type { Membership } from "@/server/session";

/**
 * Shown only to people who belong to more than one institute (coaching staff
 * moonlight). Switching sets a preference cookie; the server re-validates it
 * against real memberships on every request, so this control cannot widen
 * access to an institute the user does not belong to.
 */
export function InstituteSwitcher({
  memberships,
  current,
}: {
  memberships: Membership[];
  current: string;
}) {
  const [pending, start] = useTransition();

  return (
    <select
      className="sel"
      style={{ marginTop: 8, fontSize: 11, padding: "5px 6px" }}
      value={current}
      disabled={pending}
      aria-label="Switch institute"
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          await switchInstitute(next);
        });
      }}
    >
      {memberships.map((m) => (
        <option key={m.instituteId} value={m.instituteId}>
          {m.instituteName}
        </option>
      ))}
    </select>
  );
}
