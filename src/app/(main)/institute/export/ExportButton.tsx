"use client";

import { useState } from "react";

export function ExportButton() {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function run() {
    setState("working");
    setError(null);
    try {
      const res = await fetch("/institute/export/download", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Export failed (${res.status}).`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "paperflow-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setFilename(name);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
      setState("idle");
    }
  }

  return (
    <>
      <button type="button" className="gen" style={{ marginTop: 14 }} disabled={state === "working"} onClick={run}>
        {state === "working" ? "Preparing…" : state === "done" ? "Export again" : "Export everything as JSON"}
      </button>
      {state === "done" && filename && (
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          <b>{filename}</b> downloaded. This export was recorded in the audit log; another can be made in ten minutes.
        </div>
      )}
      {error && (
        <div className="notice warn" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}
    </>
  );
}
