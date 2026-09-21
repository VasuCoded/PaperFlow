import { describe, expect, it } from "vitest";
import { ownMemberships, type MembershipRow } from "@/lib/memberships";

const sunrise = { id: "inst-sunrise", name: "Sunrise", slug: "staging-sunrise", kind: "institute", status: "active" };
const platform = { id: "plat", name: "Platform", slug: "platform", kind: "platform", status: "active" };

describe("ownMemberships", () => {
  // What RLS returns to a teacher who selects from institute_members with no
  // filter: every member of their institute, the admin first.
  const visibleToTeacher: MembershipRow[] = [
    { user_id: "admin", institute_id: sunrise.id, role: "institute_admin", institutes: sunrise },
    { user_id: "teacher", institute_id: sunrise.id, role: "teacher", institutes: sunrise },
    { user_id: "student", institute_id: sunrise.id, role: "student", institutes: sunrise },
  ];

  it("keeps only the caller's own rows, so a teacher never resolves as the admin", () => {
    const mine = ownMemberships(visibleToTeacher, "teacher");
    expect(mine).toHaveLength(1);
    expect(mine[0]!.role).toBe("teacher");
  });

  it("returns nothing for someone who is not in any of the rows", () => {
    expect(ownMemberships(visibleToTeacher, "stranger")).toEqual([]);
  });

  it("drops inactive institutes and puts the platform last", () => {
    const rows: MembershipRow[] = [
      { user_id: "u", institute_id: platform.id, role: "owner", institutes: platform },
      { user_id: "u", institute_id: sunrise.id, role: "teacher", institutes: sunrise },
      { user_id: "u", institute_id: "gone", role: "teacher", institutes: { ...sunrise, id: "gone", status: "suspended" } },
    ];
    expect(ownMemberships(rows, "u").map((m) => m.kind)).toEqual(["institute", "platform"]);
  });
});
