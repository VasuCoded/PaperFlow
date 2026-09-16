import { redirect } from "next/navigation";
import { getSession, homePath } from "@/server/session";

// Reads the session cookie on every request; never prerender a redirect.
export const dynamic = "force-dynamic";

/**
 * There is no marketing page: PaperFlow is reached by invitation or batch
 * code. The root sends each person to their own area, and everyone else to
 * sign in.
 */
export default async function Home() {
  const session = await getSession();
  redirect(session ? homePath(session) : "/login");
}
