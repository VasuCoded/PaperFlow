/**
 * Turning institute_members rows into the caller's own memberships.
 *
 * RLS on institute_members lets a member read their FELLOW members (the
 * members page needs it), so "select from institute_members" as a teacher
 * returns everyone in the institute — including its admin. The session must
 * therefore ask for, and keep, only the caller's own rows. Before this, a
 * teacher's session took the first row it saw and could come out as
 * institute_admin (found on dev, 21 Sep 2026).
 */
export type Role = "owner" | "institute_admin" | "teacher" | "student";

export interface Membership {
  instituteId: string;
  instituteName: string;
  instituteSlug: string;
  role: Role;
  kind: "platform" | "institute";
}

export interface MembershipRow {
  user_id: string;
  institute_id: string;
  role: string;
  institutes: { id: string; name: string; slug: string; kind: string; status: string } | null;
}

export function ownMemberships(rows: readonly MembershipRow[], userId: string): Membership[] {
  return rows
    .filter((r) => r.user_id === userId)
    .filter((r) => r.institutes !== null && r.institutes.status === "active")
    .map((r): Membership => ({
      instituteId: r.institute_id,
      instituteName: r.institutes!.name,
      instituteSlug: r.institutes!.slug,
      role: r.role as Role,
      kind: r.institutes!.kind === "platform" ? "platform" : "institute",
    }))
    // platform membership last so a tenant is the natural default
    .sort((a, b) => (a.kind === "platform" ? 1 : 0) - (b.kind === "platform" ? 1 : 0));
}
