"use client";

import { useEffect } from "react";

/**
 * Opens the <details> with this id when the address says #id, so a link like
 * "/institute/members#invite" lands with the invite form already open.
 */
export function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    const open = () => {
      if (window.location.hash !== `#${id}`) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.querySelector<HTMLInputElement>("input, select")?.focus();
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [id]);
  return null;
}
