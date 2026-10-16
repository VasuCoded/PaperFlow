import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { AccessRequestList } from "../../_components/AccessRequestList";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Access requests · PaperFlow" };

export default async function AccountsPage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  // Shows people's names and which institutes they asked for, so the read is
  // logged (platform_access_requests_pending writes platform_access_log).
  const { data } = session?.isPlatformOwner ? await supabase.rpc("platform_access_requests_pending", { p_limit: 200 }) : { data: [] };
  const requests = data ?? [];

  return (
    <AppShell area="platform">
      <div className="notice warn">
        <b>Check who it is before approving.</b> The name on a request is whatever the person typed.
      </div>

      <AccessRequestList mode="platform" requests={requests} />

      <div className="notice plain" style={{ marginTop: 16 }}>
        New institute? Create it under <b>Institutes</b> with its first admin&rsquo;s username.
      </div>
    </AppShell>
  );
}
