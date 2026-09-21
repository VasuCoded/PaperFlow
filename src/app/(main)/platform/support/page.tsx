import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { renderRich } from "@/lib/print/math";
import { displayIdentity } from "@/lib/identity";
import { PersonLookup } from "./PersonLookup";
import { FlagActions, InstituteInvites, RetireById } from "./SupportControls";

export const metadata: Metadata = { title: "Support · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function SupportPage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  // platform_open_flags shows tenants' flags on (possibly private) questions,
  // so each load writes one access-log row.
  const [flagsRes, institutesRes] = session?.isPlatformOwner
    ? await Promise.all([supabase.rpc("platform_open_flags", { p_limit: 100 }), supabase.rpc("platform_list_institutes")])
    : [{ data: [] }, { data: [] }];

  const flags = (flagsRes.data ?? []).map((f) => ({ ...f, bodyHtml: renderRich(f.body) }));
  const institutes = (institutesRes.data ?? []).map((i) => ({ id: i.id, name: i.name }));

  return (
    <AppShell
      area="platform"
      pathname="/platform/support"
      eyebrow="Platform · support"
      title={
        <>
          The support queue, <em>without hand-written SQL</em>
        </>
      }
      intro="The fixes that used to be UPDATE statements against a live multi-tenant database. Each runs in one transaction, needs a reason, names the institute and the person before it runs, and is written to the audit log."
    >
      <h2 className="sect">Find a person</h2>
      <div className="card" style={{ marginBottom: 22 }}>
        <PersonLookup />
      </div>

      <h2 className="sect">Open flags — {flags.length}</h2>
      {flags.length === 0 ? (
        <p className="lede">No open flags. Teachers flag questions from their generator screen.</p>
      ) : (
        flags.map((f) => (
          <div className="card" key={f.id} style={{ marginBottom: 12, borderLeft: f.is_private ? "3px solid var(--ledger)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
                  <span className="pill suspended">flag</span>
                  <span className="tag src">{f.class_subject_label}</span>
                  {f.is_private ? <span className="tag priv">Private · {f.question_owner_name}</span> : <span className="tag">Shared bank</span>}
                  {f.open_on_question > 1 && <span className="tag h">{f.open_on_question} open flags on this question</span>}
                  {f.question_status !== "approved" && <span className="tag">{f.question_status}</span>}
                </div>
                <div className="qtext" style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: f.bodyHtml }} />
                <p style={{ margin: 0, fontSize: 12.5 }}>
                  <b>{f.institute_name}</b> · {f.raised_by_email ? displayIdentity(f.raised_by_email) : "a teacher"} · {dateFmt.format(new Date(f.created_at))}
                  {f.reason && <> — &ldquo;{f.reason}&rdquo;</>}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "var(--mono)", color: "var(--graphite)" }}>{f.question_id}</p>
              </div>
              <FlagActions
                flagId={f.id}
                questionId={f.question_id}
                ownerName={f.question_owner_name}
                flaggingInstitute={f.institute_name}
                isPrivate={f.is_private}
              />
            </div>
          </div>
        ))
      )}

      <div className="cards c2" style={{ marginTop: 20 }}>
        <div className="card">
          <h4>Invitations</h4>
          <p style={{ marginBottom: 12 }}>
            Replace an institute admin, fix a mistyped address, or revoke an invite that should not stand.
          </p>
          <InstituteInvites institutes={institutes} />
        </div>
        <div className="card">
          <h4>Retire a question by id</h4>
          <p style={{ marginBottom: 12 }}>
            For a bad question reported outside the flag flow. Retiring removes it from new papers and practice
            everywhere; papers already printed keep it.
          </p>
          <RetireById />
        </div>
      </div>
    </AppShell>
  );
}
