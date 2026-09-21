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
    <AppShell
      area="platform"
      pathname="/platform/accounts"
      eyebrow="Platform · access requests"
      title={
        <>
          People asking <em>to be let in</em>
        </>
      }
      intro="Anyone can create an account; an account opens nothing. Here are the people asking an institute for access. You can approve anyone, including an institute's first admin; institute admins see and approve their own teachers and students too."
    >
      <div className="notice warn">
        <b>Check who it is before approving.</b> An account is just a username and a name the person typed.
        The role you choose is what they get: an institute admin can invite and approve people, change roles
        and export that institute&rsquo;s data.
      </div>

      <AccessRequestList mode="platform" requests={requests} />

      <div className="notice plain" style={{ marginTop: 16 }}>
        Setting up a new institute: create it under <b>Institutes</b> with its first admin&rsquo;s username, or
        have them sign up, ask for access to it here, and approve them as <b>Institute admin</b>. Opening this
        page was logged.
      </div>
    </AppShell>
  );
}
