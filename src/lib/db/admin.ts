import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client. Server-only.
 *
 * WARNING: the service role key bypasses RLS *and* tenancy. Every query made
 * through this client MUST filter by institute_id explicitly. A service-role
 * query with no institute_id predicate on a tenant-scoped table is a bug,
 * every time (see CLAUDE.md > Tenancy).
 *
 * The `server-only` import above throws at build time if this module is ever
 * pulled into a client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
