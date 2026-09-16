"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createInstituteAction } from "@/server/actions/platform";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function CreateInstituteForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contact, setContact] = useState("");
  const [admin, setAdmin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; admin: string } | null>(null);
  const [pending, start] = useTransition();

  if (created) {
    return (
      <div>
        <p style={{ fontSize: 13, marginBottom: 10 }}>
          <b>{created.name}</b> exists. An institute-admin invite is waiting for <b>{created.admin}</b> — it is
          accepted when they sign in with Google using that address. Nothing is activated yet.
        </p>
        <div className="btnrow">
          <Link className="btn sm solid" href={`/platform/activation`}>Activate a subject</Link>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setCreated(null);
              setName("");
              setSlug("");
              setSlugTouched(false);
              setContact("");
              setAdmin("");
            }}
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createInstituteAction({ name, slug, contactEmail: contact, firstAdminEmail: admin });
          if (res.ok && res.instituteId) setCreated({ id: res.instituteId, name: name.trim(), admin: admin.trim().toLowerCase() });
          else setError(res.message ?? "Could not create the institute.");
        });
      }}
    >
      <div className="field">
        <label htmlFor="inst-name">Institute name</label>
        <input
          id="inst-name"
          className="inp"
          value={name}
          required
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="Sunrise Tuition Centre"
        />
      </div>
      <div className="field">
        <label htmlFor="inst-slug">Slug</label>
        <input
          id="inst-slug"
          className="inp"
          value={slug}
          required
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="sunrise"
          style={{ fontFamily: "var(--mono)" }}
        />
      </div>
      <div className="field">
        <label htmlFor="inst-admin">First institute admin (Google account email)</label>
        <input id="inst-admin" className="inp" type="email" value={admin} required onChange={(e) => setAdmin(e.target.value)} placeholder="owner@sunrise.in" />
      </div>
      <div className="field">
        <label htmlFor="inst-contact">Contact email (optional — defaults to the admin)</label>
        <input id="inst-contact" className="inp" type="email" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      {error && <p style={{ color: "var(--pen)", fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>}
      <button type="submit" className="btn solid" disabled={pending}>
        {pending ? "Creating…" : "Create institute"}
      </button>
    </form>
  );
}
