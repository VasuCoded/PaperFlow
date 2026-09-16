"use client";

import Link from "next/link";
import { useDemoSession } from "@/demo/session";
import { instituteName, ROLE_LABEL } from "@/demo/institutes";

export function DemoBar() {
  const { account, instituteId, role, signOut, ready } = useDemoSession();

  return (
    <div className="demobar">
      <span>
        <b>Demo</b> · design prototype · no database, no real accounts
      </span>
      <span className="who">
        {ready && account ? (
          <>
            {account.name} · {ROLE_LABEL[role ?? "none"]}
            {instituteId ? ` · ${instituteName(instituteId)}` : ""}
            {" · "}
            <button
              type="button"
              onClick={signOut}
              style={{
                background: "none",
                border: 0,
                color: "inherit",
                font: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Switch account
            </button>
          </>
        ) : (
          <Link href="/demo/login">Sign in</Link>
        )}
      </span>
    </div>
  );
}
