"use client";

import { useState, useTransition } from "react";
import { withdrawFlag } from "@/server/actions/teacher";

export function WithdrawFlagButton({ flagId }: { flagId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn sm ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await withdrawFlag(flagId);
            if (!res.ok) setError(res.message ?? "Could not withdraw.");
          })
        }
      >
        {pending ? "Withdrawing…" : "Withdraw flag"}
      </button>
      {error && <span style={{ fontSize: 11.5, color: "var(--pen)", marginLeft: 6 }}>{error}</span>}
    </>
  );
}
