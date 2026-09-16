"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/client";

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

/**
 * The only way in. Google OAuth carries no role and no institute — that is
 * decided by an invite or a batch join code after sign-in (BUILD-PLAN 4.3).
 */
export function GoogleButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (err) throw err;
      // the browser is being redirected to Google; keep the button disabled
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error
          ? e.message
          : "Could not start sign-in. Check that Google is enabled in Supabase Auth.",
      );
    }
  }

  return (
    <>
      <button type="button" className="googlebtn" onClick={signIn} disabled={busy}>
        <GoogleMark /> {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && (
        <div className="notice warn" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}
    </>
  );
}
