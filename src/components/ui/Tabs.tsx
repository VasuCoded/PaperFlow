"use client";

import { Children, useEffect, useState, type ReactNode } from "react";

/**
 * Tabs over panels the server has already rendered: switching is instant and
 * asks the server for nothing. The open tab follows the address's #hash, so a
 * link can open a page on a given tab and the back button works.
 */
export function Tabs({ tabs, children }: { tabs: { id: string; label: string; count?: number }[]; children: ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const panels = Children.toArray(children);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  return (
    <div className="tabs">
      <div className="tabbarx" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tabbtn${active === t.id ? " on" : ""}`}
            onClick={() => {
              setActive(t.id);
              history.replaceState(null, "", `#${t.id}`);
            }}
          >
            {t.label}
            {t.count !== undefined && <span className="tabcount">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="tabpanel">
          {panels[i]}
        </div>
      ))}
    </div>
  );
}
