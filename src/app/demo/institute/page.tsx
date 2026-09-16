"use client";

import Link from "next/link";
import { Shell } from "../_components/Shell";
import { useDemoSession } from "@/demo/session";
import { instituteName } from "@/demo/institutes";
import { ACTIVE_CLASS_SUBJECTS, batchesFor, MEMBERS, papersFor, PENDING_INVITES } from "@/demo/activity";
import { csLabel } from "@/demo/bank";

export default function InstituteOverview() {
  const { instituteId } = useDemoSession();
  const inst = instituteId ?? "";
  const members = MEMBERS[inst] ?? [];
  const batches = batchesFor(inst);
  const papers = papersFor(inst);
  const active = ACTIVE_CLASS_SUBJECTS[inst] ?? [];
  const invites = PENDING_INVITES[inst] ?? [];

  const teachers = members.filter((m) => m.role === "teacher").length;
  const students = members.filter((m) => m.role === "student").length;
  const logged = papers.reduce((n, p) => n + p.loggedCount, 0);

  return (
    <Shell
      area="institute"
      eyebrow="Institute console"
      title={<>{instituteName(inst)}</>}
      intro="Your members, your batches, your papers and your data. You cannot write to the question bank — that gate is what stands between a wrong answer key and a parent."
    >
      <div className="cards c4">
        <div className="card"><span className="big">{teachers}</span><span className="cap">Teachers</span></div>
        <div className="card"><span className="big">{students}</span><span className="cap">Students</span></div>
        <div className="card"><span className="big">{batches.filter((b) => b.active).length}</span><span className="cap">Active batches</span></div>
        <div className="card"><span className="big">{papers.length}</span><span className="cap">Papers set</span></div>
      </div>

      <h2 className="sect">Active subjects</h2>
      <div className="cards c3">
        {active.map((cs) => (
          <div className="card" key={cs}>
            <h4>
              {csLabel(cs)} <span className="pill active">Active</span>
            </h4>
            <p>{batches.filter((b) => b.classSubjectId === cs).length} batch(es) running.</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--graphite)", marginTop: 10 }}>
        Subjects appear for your teachers only once the platform activates them for you.{" "}
        <Link href="/demo/institute/subjects" style={{ color: "var(--pen)" }}>
          Request another subject →
        </Link>
      </p>

      <h2 className="sect">Needs your attention</h2>
      <div className="cards c2">
        <div className="card">
          <h4>Pending invitations</h4>
          {invites.length === 0 ? (
            <p>None outstanding.</p>
          ) : (
            <div style={{ marginTop: 8 }}>
              {invites.map((i) => (
                <div key={i.email} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--hair)" }}>
                  <span>{i.email}</span>
                  <span className="cap">{i.role.toUpperCase()} · SENT {i.sent}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h4>Mistake logging</h4>
          <p>
            <b>{logged}</b> attempts logged across {papers.length} papers. The loop is only worth
            anything if students log within a couple of days of getting the paper back.
          </p>
        </div>
      </div>
    </Shell>
  );
}
