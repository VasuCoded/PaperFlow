"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/client";
import { loginToEmail, passwordProblem, usernameProblem } from "@/lib/identity";
import { createAccount } from "@/server/actions/auth";

/** Only same-site paths, so ?next= cannot send someone elsewhere. */
function safeNext(next?: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Signs in from the browser (the person's own connection), so Supabase's
 * per-address sign-in limits apply per person rather than to our server.
 */
export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const { error: err } = await createClient().auth.signInWithPassword({
            email: loginToEmail(login),
            password,
          });
          if (err) {
            setError(/invalid/i.test(err.message) ? "Wrong username or password." : err.message);
            setBusy(false);
            return;
          }
          router.replace(safeNext(next));
          router.refresh();
        } catch {
          setError("Could not reach the server. Check your connection and try again.");
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="login">Username</label>
        <input
          id="login"
          className="inp"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          className="inp"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div className="notice warn" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button type="submit" className="gen" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="loginnote" style={{ marginTop: 12 }}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameHint = username ? usernameProblem(username) : null;
  const pwHint = password ? passwordProblem(password) : null;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (password !== confirm) {
          setError("The two passwords don't match.");
          return;
        }
        setBusy(true);
        try {
          const res = await createAccount({ fullName, username, password, website });
          if (!res.ok) {
            setError(res.message ?? "Could not create the account.");
            setBusy(false);
            return;
          }
          const { error: err } = await createClient().auth.signInWithPassword({ email: loginToEmail(username), password });
          if (err) {
            // The account exists; let them sign in by hand.
            router.replace("/login");
            return;
          }
          router.replace("/welcome");
          router.refresh();
        } catch {
          setError("Could not reach the server. Check your connection and try again.");
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="fullName">Full name</label>
        <input id="fullName" className="inp" autoComplete="name" required maxLength={80} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          className="inp"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={30}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <p style={{ fontSize: 11, margin: "6px 0 0", color: nameHint ? "var(--pen)" : "var(--graphite)" }}>
          {nameHint ?? "Letters, numbers, dots and underscores. This is what you sign in with."}
        </p>
      </div>
      <div className="field">
        <label htmlFor="newPassword">Password</label>
        <input id="newPassword" className="inp" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <p style={{ fontSize: 11, margin: "6px 0 0", color: pwHint ? "var(--pen)" : "var(--graphite)" }}>
          {pwHint ?? "At least 8 characters, with a letter and a number."}
        </p>
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Password again</label>
        <input id="confirmPassword" className="inp" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {/* Honeypot: hidden from people, filled in by form-spamming bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error && (
        <div className="notice warn" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button type="submit" className="gen" disabled={busy || !!nameHint || !!pwHint}>
        {busy ? "Creating your account…" : "Create account"}
      </button>
      <p className="loginnote" style={{ marginTop: 12 }}>
        Already have one? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
