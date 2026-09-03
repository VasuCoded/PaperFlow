import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Browser Supabase client. Uses the anon key and is subject to RLS and
 * tenancy in full. Safe to import into client components.
 *
 * The current institute is NEVER resolved here from client state — it is
 * resolved server-side on every request (see CLAUDE.md > Code).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
