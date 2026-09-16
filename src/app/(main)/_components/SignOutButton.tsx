"use client";

import { useTransition } from "react";
import { signOutAction } from "@/server/actions/membership";

export function SignOutButton({ className = "btn sm ghost" }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => start(async () => { await signOutAction(); })}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
