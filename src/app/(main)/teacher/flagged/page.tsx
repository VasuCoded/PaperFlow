import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { getSession } from "@/server/session";
import { createServerSupabaseClient } from "@/lib/db/server";
import { renderRich } from "@/lib/print/math";
import { WithdrawFlagButton } from "./WithdrawFlagButton";

export const metadata: Metadata = { title: "Flagged questions · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

type FlagRow = {
  id: string;
  reason: string | null;
  status: string;
  created_at: string;
  raised_by: string | null;
  questions: { body: string; class_subjects: { classes: { name: string } | null; subjects: { name: string } | null } | null } | null;
};

const STATUS: Record<string, { pill: string; label: string }> = {
  open: { pill: "staging", label: "Pulled for us · awaiting review" },
  resolved: { pill: "active", label: "Resolved by the platform" },
  dismissed: { pill: "planned", label: "Withdrawn" },
};

export default async function FlaggedPage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();

  const { data } = session?.instituteId
    ? await supabase
        .from("question_flags")
        .select("id, reason, status, created_at, raised_by, questions ( body, class_subjects ( classes ( name ), subjects ( name ) ) )")
        .eq("institute_id", session.instituteId)
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<FlagRow[]>()
    : { data: [] as FlagRow[] };
  const flags = data ?? [];

  return (
    <AppShell area="teacher" pathname="/teacher/flagged">
      <div className="notice warn">
        <b>What a flag does, exactly.</b> The question stops appearing in your institute&rsquo;s papers straight
        away. It stays in the shared bank for other institutes until the platform reviews it — one institute
        cannot pull a question out of everyone else&rsquo;s papers. So you may still see it in the bank; that is
        deliberate, not a bug.
      </div>

      {flags.length === 0 ? (
        <p className="lede">Nothing flagged. Use the flag button beside any question in the paper preview.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Question</th>
                <th className="num">Flagged</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const s = STATUS[f.status] ?? { pill: "planned", label: f.status };
                const cs = f.questions?.class_subjects;
                return (
                  <tr key={f.id}>
                    <td>
                      {f.questions?.body ? (
                        <b dangerouslySetInnerHTML={{ __html: renderRich(f.questions.body) }} />
                      ) : (
                        <b>Question no longer available</b>
                      )}
                      <span className="sub">
                        {cs ? `Class ${cs.classes?.name ?? "?"} · ${cs.subjects?.name ?? "?"} — ` : ""}
                        {f.reason}
                      </span>
                    </td>
                    <td className="num">{dateFmt.format(new Date(f.created_at))}</td>
                    <td><span className={`pill ${s.pill}`}>{s.label}</span></td>
                    <td>{f.status === "open" && <WithdrawFlagButton flagId={f.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
