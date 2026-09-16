import "server-only";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { Tables } from "@/lib/database.types";

/**
 * Server-side session resolution (CLAUDE.md > Code):
 *
 *   "The current institute is resolved server-side from the session on every
 *    request. Never from a URL parameter, a cookie, or client state. A route
 *    that takes institute_id from the client is a tenancy bug even if RLS
 *    would have caught it."
 *
 * The one cookie we do read is a *preference* among institutes the user is
 * already a member of, and it is validated against their memberships every
 * time. It can never widen access: an unrecognised value falls back to the
 * first real membership.
 */

export const PLATFORM_INSTITUTE_ID = "11111111-1111-1111-1111-111111111111";
const INSTITUTE_COOKIE = "pf_institute";

export type Role = "owner" | "institute_admin" | "teacher" | "student";

export interface Membership {
  instituteId: string;
  instituteName: string;
  instituteSlug: string;
  role: Role;
  kind: "platform" | "institute";
}

export interface Session {
  userId: string;
  email: string;
  fullName: string | null;
  memberships: Membership[];
  /** the institute this request acts within, or null when they belong to none */
  instituteId: string | null;
  role: Role | null;
  isPlatformOwner: boolean;
}

type MembershipRow = Pick<Tables<"institute_members">, "institute_id" | "role"> & {
  institutes: Pick<Tables<"institutes">, "id" | "name" | "slug" | "kind" | "status"> | null;
};

/**
 * Resolve the caller. Returns null when there is no authenticated user.
 * Never throws for an unauthenticated request — callers decide what to do.
 */
export async function getSession(): Promise<Session | null> {
  // Before Supabase is configured there is no one to be signed in as. Degrade
  // to "not signed in" rather than throwing, so /login can explain itself.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = await createServerSupabaseClient();

  // getUser() revalidates the JWT with the auth server; never trust a decoded
  // cookie for identity.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: rows } = await supabase
    .from("institute_members")
    .select("institute_id, role, institutes(id, name, slug, kind, status)")
    .returns<MembershipRow[]>();

  const memberships: Membership[] = (rows ?? [])
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

  const jar = await cookies();
  const preferred = jar.get(INSTITUTE_COOKIE)?.value;
  const chosen =
    memberships.find((m) => m.instituteId === preferred) ?? memberships[0] ?? null;

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? null,
    memberships,
    instituteId: chosen?.instituteId ?? null,
    role: chosen?.role ?? null,
    isPlatformOwner: memberships.some(
      (m) => m.instituteId === PLATFORM_INSTITUTE_ID && m.role === "owner",
    ),
  };
}

/** A session guaranteed to have an authenticated user, or null. */
export async function requireSession(): Promise<Session | null> {
  return getSession();
}

export const INSTITUTE_COOKIE_NAME = INSTITUTE_COOKIE;

/** Roles permitted in each area, mirroring middleware. */
export const AREA_ROLES: Record<string, Role[]> = {
  platform: ["owner"],
  institute: ["institute_admin"],
  teacher: ["teacher", "institute_admin"],
  app: ["student", "teacher", "institute_admin", "owner"],
};

export function canAccess(area: keyof typeof AREA_ROLES, session: Session | null): boolean {
  if (!session) return false;
  if (area === "platform") return session.isPlatformOwner;
  if (!session.role) return false;
  return (AREA_ROLES[area] ?? []).includes(session.role);
}
