"use client";

import { useParams } from "next/navigation";
import { Shell } from "../../../_components/Shell";
import { INSTITUTES, ROLE_LABEL } from "@/demo/institutes";
import { ACTIVE_CLASS_SUBJECTS, batchesFor, MEMBERS, papersFor } from "@/demo/activity";
import { csLabel } from "@/demo/bank";

export default function InspectInstitutePage() {
  const params = useParams<{ id: string }>();
  const inst = INSTITUTES.find((i) => i.id === params.id);

  if (!inst) {
    return (
      <Shell area="platform" eyebrow="Platform · inspect" title="Institute not found">
        <p className="lede">No institute with that id.</p>
      </Shell>
    );
  }

  const members = MEMBERS[inst.id] ?? [];
  const batches = batchesFor(inst.id);
  const papers = papersFor(inst.id);
  const active = ACTIVE_CLASS_SUBJECTS[inst.id] ?? [];

  return (
    <Shell
      area="platform"
      eyebrow="Platform · read-only inspector"
      title={<>{inst.name}</>}
      intro="Read-only. Everything on this screen came from an audited inspect function; there is no edit control here except suspension and role changes, which go through their own audited paths."
    >
      <div className="cards c4" style={{ marginBottom: 20 }}>
        <div className="card"><span className="big">{members.length}</span><span className="cap">Members</span></div>
        <div className="card"><span className="big">{batches.length}</span><span className="cap">Batches</span></div>
        <div className="card"><span className="big">{papers.length}</span><span className="cap">Papers</span></div>
        <div className="card"><span className="big">{active.length}</span><span className="cap">Active subjects</span></div>
      </div>

      <h2 className="sect">Members</h2>
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th className="num">Joined</th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.accountId}>
                <td><b>{m.name}</b></td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>{m.email}</td>
                <td>{ROLE_LABEL[m.role]}</td>
                <td className="num">{m.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sect">Recent papers</h2>
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr><th>Paper</th><th>Subject</th><th className="num">Date</th><th className="num">Sets</th><th className="num">Logged</th></tr>
          </thead>
          <tbody>
            {papers.map((p) => (
              <tr key={p.id}>
                <td><b>{p.title}</b></td>
                <td>{csLabel(p.classSubjectId)}</td>
                <td className="num">{p.date}</td>
                <td className="num">{p.setCount}</td>
                <td className="num">{p.loggedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sect">Batches</h2>
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr><th>Batch</th><th>Subject</th><th className="num">Students</th><th>Status</th></tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td><b>{b.name}</b></td>
                <td>{csLabel(b.classSubjectId)}</td>
                <td className="num">{b.students}</td>
                <td><span className={`pill ${b.active ? "active" : "planned"}`}>{b.active ? "active" : "closed"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notice plain" style={{ marginTop: 20 }}>
        This view was recorded in the access log: <b>inspect_institute</b> · {inst.name} · just now.
        Every read of a tenant&rsquo;s data is logged, which is what makes it defensible when a
        customer asks who has looked at their students.
      </div>
    </Shell>
  );
}
