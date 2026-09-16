"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/server/actions/membership";

export function AcceptInvite({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        className="btn solid sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await acceptInvite(inviteId);
            if (res.ok) router.push("/");
            else setError(res.message ?? "Could not accept the invitation.");
          })
        }
      >
        {pending ? "Accepting…" : "Accept"}
      </button>
      {error && (
        <div className="notice warn" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          {error}
        </div>
      )}
    </>
  );
}
