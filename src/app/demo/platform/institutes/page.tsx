"use client";

import Link from "next/link";
import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { INSTITUTES } from "@/demo/institutes";
import { ACTIVE_CLASS_SUBJECTS, batchesFor, MEMBERS, papersFor } from "@/demo/activity";
import { csLabel } from "@/demo/bank";

export default function InstitutesPage() {
  const [list, setList] = useState(INSTITUTES.filter((i) => i.kind === "institute"));
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", contact: "", admin: "" });

  const valid = form.name.trim() && form.slug.trim() && form.admin.includes("@");

  return (
    <Shell
      area="platform"
      eyebrow="Platform · institutes"
      title={<>Tenants, <em>and how one is created</em></>}
      intro="Creating an institute is the only path that inserts a tenant, and it is callable by the platform owner alone. There is no public signup form, and there never will be."
    >
      <div className="instbar">
        <div className="instname">
          {list.length} institutes
          <span>Platform-owned infrastructure · tenant data owned by each institute</span>
        </div>
        <button className="btn solid" onClick={() => setCreating((c) => !c)}>
          {creating ? "Cancel" : "Create institute"}
        </button>
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h4>New institute</h4>
          <p style={{ marginBottom: 14 }}>
            This calls <span style={{ fontFamily: "var(--mono)" }}>create_institute()</span>, which
            creates the tenant and its first admin invitation in one transaction.
          </p>
          <div className="cards c2">
            <div>
              <div className="field">
                <label htmlFor="n">Institute name</label>
                <input className="inp" id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} placeholder="Nalanda Tutorials" />
              </div>
              <div className="field">
                <label htmlFor="s">Slug</label>
                <input className="inp" id="s" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="nalanda-tutorials" style={{ fontFamily: "var(--mono)" }} />
              </div>
            </div>
            <div>
              <div className="field">
                <label htmlFor="c">Contact email</label>
                <input className="inp" id="c" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="office@nalanda.test" />
              </div>
              <div className="field">
                <label htmlFor="a">First institute admin (invited by email)</label>
                <input className="inp" id="a" value={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.value })} placeholder="principal@nalanda.test" />
              </div>
            </div>
          </div>
          <button
            className="gen"
            disabled={!valid}
            onClick={() => {
              setList((l) => [
                ...l,
                {
                  id: `inst-${form.slug}`,
                  name: form.name,
                  slug: form.slug,
                  kind: "institute",
                  status: "active",
                  contactEmail: form.contact || null,
                  createdAt: "today",
                },
              ]);
              setForm({ name: "", slug: "", contact: "", admin: "" });
              setCreating(false);
            }}
          >
            Create institute and invite first admin
          </button>
        </div>
      )}

      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Institute</th>
              <th>Members</th>
              <th>Active subjects</th>
              <th className="num">Batches</th>
              <th className="num">Papers</th>
              <th className="num">Created</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((i) => {
              const members = MEMBERS[i.id] ?? [];
              const byRole = {
                admin: members.filter((m) => m.role === "institute_admin").length,
                teacher: members.filter((m) => m.role === "teacher").length,
                student: members.filter((m) => m.role === "student").length,
              };
              const active = ACTIVE_CLASS_SUBJECTS[i.id] ?? [];
              return (
                <tr key={i.id}>
                  <td>
                    <b>{i.name}</b>
                    <span className="sub" style={{ fontFamily: "var(--mono)" }}>{i.slug}</span>
                  </td>
                  <td className="num">
                    {byRole.admin}a · {byRole.teacher}t · {byRole.student}s
                  </td>
                  <td>
                    {active.length === 0 ? (
                      <span style={{ color: "var(--graphite)" }}>none yet</span>
                    ) : (
                      active.map((cs) => (
                        <div key={cs} style={{ fontSize: 12 }}>{csLabel(cs)}</div>
                      ))
                    )}
                  </td>
                  <td className="num">{batchesFor(i.id).length}</td>
                  <td className="num">{papersFor(i.id).length}</td>
                  <td className="num">{i.createdAt}</td>
                  <td>
                    <span className={`pill ${i.status === "active" ? "active" : "suspended"}`}>
                      {i.status}
                    </span>
                  </td>
                  <td>
                    <div className="btnrow">
                      <Link className="btn sm ghost" href={`/demo/platform/institutes/${i.id}`}>
                        Inspect
                      </Link>
                      <button
                        className="btn sm ghost"
                        onClick={() =>
                          setList((l) =>
                            l.map((x) =>
                              x.id === i.id
                                ? { ...x, status: x.status === "active" ? "suspended" : "active" }
                                : x,
                            ),
                          )
                        }
                      >
                        {i.status === "active" ? "Suspend" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
