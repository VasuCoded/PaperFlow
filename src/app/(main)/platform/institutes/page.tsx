import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { ActionButton } from "../../_components/ActionButton";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { setInstituteStatusAction } from "@/server/actions/platform";
import { CreateInstituteForm } from "./CreateInstituteForm";
import { Icon } from "@/components/ui/Icon";
import { TableSearch } from "@/components/ui/TableSearch";
import { ago } from "@/components/ui/Stat";
import { createAdminClient } from "@/lib/db/admin";
import { effectiveModules, MODULE_PRESETS, MODULES } from "@/lib/modules";

export const metadata: Metadata = { title: "Institutes · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const SORTS = { activity: "Recently active", name: "Name", students: "Most students" } as const;
type Sort = keyof typeof SORTS;

export default async function InstitutesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status === "active" || sp.status === "suspended" ? sp.status : null;
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "activity";

  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  const { data } = session?.isPlatformOwner ? await supabase.rpc("platform_list_institutes") : { data: [] };
  const institutes = data ?? [];
  // each institute's setup (modules); the owner is not a member, so read them pinned to these ids
  const { data: modRows } = institutes.length
    ? await createAdminClient().from("institutes").select("id, modules").in("id", institutes.map((i) => i.id))
    : { data: [] as { id: string; modules: unknown }[] };
  const setupOf = new Map(
    (modRows ?? []).map((r) => {
      const m = effectiveModules(r.modules);
      const preset = MODULE_PRESETS.find((p) => MODULES.every((x) => p.modules[x.key] === m[x.key]));
      return [r.id, preset ? preset.name : "Custom"];
    }),
  );

  const shown = institutes
    .filter((i) => !status || i.status === status)
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "students"
          ? b.students - a.students
          : (b.last_activity ?? b.created_at).localeCompare(a.last_activity ?? a.created_at),
    );
  const href = (next: { status?: string | null; sort?: string }) => {
    const q = new URLSearchParams();
    const st = next.status === undefined ? status : next.status;
    const so = next.sort ?? sort;
    if (st) q.set("status", st);
    if (so !== "activity") q.set("sort", so);
    const s = q.toString();
    return `/platform/institutes${s ? `?${s}` : ""}`;
  };
  const suspendedCount = institutes.filter((i) => i.status !== "active").length;
  const openNew = sp.new === "1" || institutes.length === 0;

  return (
    <AppShell area="platform">
      <details className="drawer" id="new" open={openNew}>
        <summary className="btn solid">
          <Icon name="building" size={15} /> New institute
        </summary>
        <div className="drawerbody">
          <div className="cards c2">
            <div>
              <h3 className="drawertitle">Create an institute</h3>
              <p className="lede">
                Creates the institute and invites its first admin, in one step. The admin then invites their own
                teachers and students.
              </p>
              <CreateInstituteForm />
            </div>
            <div className="card tinted">
              <h4>After you create it</h4>
              <p>
                Switch on its subjects from the institute&rsquo;s page (Subjects tab), so its teachers can set papers.
                The admin sees the invitation the next time they sign in.
              </p>
            </div>
          </div>
        </div>
      </details>

      <div className="toolbar">
        <TableSearch target="institutes" placeholder="Search institutes" />
        <nav className="seg" aria-label="Filter by status">
          <Link className={!status ? "on" : ""} href={href({ status: null })}>All · {institutes.length}</Link>
          <Link className={status === "active" ? "on" : ""} href={href({ status: "active" })}>Active · {institutes.length - suspendedCount}</Link>
          <Link className={status === "suspended" ? "on" : ""} href={href({ status: "suspended" })}>Suspended · {suspendedCount}</Link>
        </nav>
        <nav className="seg" aria-label="Sort">
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <Link key={s} className={sort === s ? "on" : ""} href={href({ sort: s })}>{SORTS[s]}</Link>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <div className="empty panel">
          <p>{institutes.length === 0 ? "No institutes yet." : "No institute matches this filter."}</p>
        </div>
      ) : (
        <div className="tablewrap">
          <table className="lt stack" id="institutes">
            <thead>
              <tr>
                <th>Institute</th>
                <th className="num">Students</th>
                <th className="num">Staff</th>
                <th className="num">Subjects</th>
                <th className="num">Papers</th>
                <th>Setup</th>
                <th>Last active</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id} data-search={`${i.name} ${i.slug} ${i.contact_email ?? ""}`}>
                  <td>
                    <Link href={`/platform/institutes/${i.id}`} className="rowtitle">{i.name}</Link>
                    <span className="sub">{i.slug} · since {dateFmt.format(new Date(i.created_at))}</span>
                  </td>
                  <td className="num" data-label="Students:">{i.students}</td>
                  <td className="num" data-label="Staff:" title={`${i.admins} admin(s), ${i.teachers} teacher(s)`}>{i.admins + i.teachers}</td>
                  <td className="num" data-label="Subjects:">{i.active_subjects}</td>
                  <td className="num" data-label="Papers:">{i.papers}</td>
                  <td data-label="Setup:"><Link className="rowtitle" style={{ fontWeight: 500 }} href={`/platform/institutes/${i.id}#modules`}>{setupOf.get(i.id) ?? "Full institute"}</Link></td>
                  <td style={{ whiteSpace: "nowrap" }} data-label="Last active:">{ago(i.last_activity ?? null)}</td>
                  <td>
                    <span className={`pill ${i.status === "active" ? "active" : "suspended"}`}>{i.status}</span>
                  </td>
                  <td>
                    <div className="btnrow" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <Link className="btn sm" href={`/platform/institutes/${i.id}`}>Manage</Link>
                      {i.status === "active" ? (
                        <ActionButton
                          action={setInstituteStatusAction.bind(null, i.id, "suspended")}
                          label="Suspend"
                          confirm={`Suspend ${i.name}? Its people lose access until you reactivate. Nothing is deleted.`}
                          confirmLabel="Suspend"
                        />
                      ) : (
                        <ActionButton action={setInstituteStatusAction.bind(null, i.id, "active")} label="Reactivate" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="footnote-plain">
        Suspending keeps every row; its members simply stop resolving as members until you reactivate. There is no
        &ldquo;log in as&rdquo;: Manage reads an institute through an audited function, and the visit is logged.
      </p>
    </AppShell>
  );
}
