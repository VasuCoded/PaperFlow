"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { isActive, type NavGroup } from "@/lib/nav";

/**
 * The console menu. It lives in the area's layout, so it stays on screen while
 * a click loads the next page. The highlight moves the moment an item is
 * clicked (the address bar only changes once the page arrives), and follows the
 * address bar otherwise, including the browser's back and forward buttons.
 */
export function RailNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  // the page arrived (or the user went elsewhere): the address bar is the truth again
  useEffect(() => setPending(null), [pathname]);

  const current = pending ?? pathname;
  return (
    <>
      {groups.map((group, gi) => (
        <Fragment key={group.title ?? gi}>
          {group.title && <div className="navgroup">{group.title}</div>}
          {group.items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`navitem${isActive(current, n) ? " on" : ""}`}
              onClick={(e) => {
                // a new tab or window leaves this page where it is
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                if (n.href !== pathname) setPending(n.href);
              }}
            >
              <span>{n.label}</span>
            </Link>
          ))}
        </Fragment>
      ))}
    </>
  );
}
