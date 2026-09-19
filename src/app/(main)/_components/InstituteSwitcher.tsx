"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchInstitute } from "@/server/actions/membership";
import type { Membership } from "@/server/session";

/** Where a role lands in an institute (mirrors homePath in session.ts). */
function homeFor(role: Membership["role"]): string {
  if (role === "institute_admin") return "/institute";
  if (role === "teacher") return "/teacher/generate";
  return "/app";
}

/**
 * Shown to people who belong to more than one institute (coaching staff
 * moonlight). Switching sets a preference cookie; the server re-validates it
 * against real memberships on every request, so this control cannot widen
 * access to an institute the user does not belong to. It then goes to that
 * role's home — staying put would 404 when the role differs (an admin at one
 * institute, a teacher at the next).
 */
export function InstituteSwitcher({
  memberships,
  current,
}: {
  memberships: Membership[];
  current: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const tenants = memberships.filter((m) => m.kind === "institute");

  return (
    <select
      className="sel"
      style={{ marginTop: 8, fontSize: 11, padding: "5px 6px" }}
      value={current}
      disabled={pending}
      aria-label="Switch institute"
      onChange={(e) => {
        const next = tenants.find((m) => m.instituteId === e.target.value);
        if (!next) return;
        start(async () => {
          const res = await switchInstitute(next.instituteId);
          if (res.ok) router.push(homeFor(next.role));
        });
      }}
    >
      {tenants.map((m) => (
        <option key={m.instituteId} value={m.instituteId}>
          {m.instituteName}
        </option>
      ))}
    </select>
  );
}

/** For the platform console: open one of your own institutes' consoles. */
export function InstituteLinks({ memberships }: { memberships: Membership[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const tenants = memberships.filter((m) => m.kind === "institute");
  if (tenants.length === 0) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5 }}>Your institutes</span>
      {tenants.map((m) => (
        <button
          key={m.instituteId}
          type="button"
          className="btn sm ghost"
          disabled={pending}
          style={{ justifyContent: "flex-start", textAlign: "left" }}
          onClick={() =>
            start(async () => {
              const res = await switchInstitute(m.instituteId);
              if (res.ok) router.push(homeFor(m.role));
            })
          }
        >
          {m.instituteName} →
        </button>
      ))}
    </div>
  );
}
