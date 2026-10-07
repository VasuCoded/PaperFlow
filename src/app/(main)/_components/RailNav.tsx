"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense, use, useEffect, useState } from "react";
import * as m from "motion/react-m";
import { currentItem, isActive, type NavGroup } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";
import type { NavBadges } from "@/server/data/badges";

/** On phones the menu is a drawer over the page; these open and close it. */
function setNavOpen(open: boolean) {
  document.querySelector(".appshell")?.toggleAttribute("data-nav-open", open);
  document.body.style.overflow = open ? "hidden" : "";
}

/**
 * The console menu. It lives in the area's layout, so it stays on screen while
 * a click loads the next page. The highlight moves the moment an item is
 * clicked (the address bar only changes once the page arrives), and follows the
 * address bar otherwise, including the browser's back and forward buttons.
 *
 * The highlight is one element that slides to the chosen item. The list is its
 * layout root: the sidebar is pinned, so the page scrolling (or Next.js
 * scrolling to the top of the next page) must not count as the item moving.
 *
 * `badges` is a promise the server has not waited for: each count appears when
 * it arrives, and the menu itself never waits.
 */
export function RailNav({ groups, badges }: { groups: NavGroup[]; badges?: Promise<NavBadges> }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  // the page arrived (or the user went elsewhere): the address bar is the truth again
  useEffect(() => {
    setPending(null);
    setNavOpen(false);
  }, [pathname]);

  const current = pending ?? pathname;
  return (
    <m.div className="navlist" layoutRoot layoutScroll>
      {groups.map((group, gi) => (
        <Fragment key={group.title ?? gi}>
          {group.title && <div className="navgroup">{group.title}</div>}
          {group.items.map((n) => {
            const on = isActive(current, n);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`navitem${on ? " on" : ""}`}
                aria-current={on ? "page" : undefined}
                onClick={(e) => {
                  // a new tab or window leaves this page where it is
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  if (n.href !== pathname) setPending(n.href);
                  else setNavOpen(false);
                }}
              >
                {on && <m.span layoutId="navhl" className="navhl" aria-hidden="true" />}
                <Icon name={n.icon} />
                <span className="navlabel">{n.label}</span>
                {n.badge && badges && (
                  <Suspense fallback={null}>
                    <Badge badges={badges} k={n.badge} />
                  </Suspense>
                )}
              </Link>
            );
          })}
        </Fragment>
      ))}
    </m.div>
  );
}

function Badge({ badges, k }: { badges: Promise<NavBadges>; k: string }) {
  const n = use(badges)[k] ?? 0;
  if (n <= 0) return null;
  return (
    <span className="navbadge" aria-label={`${n} waiting`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** The phone-width top bar: the menu button and the logo. */
export function MobileBar({ children }: { children: React.ReactNode }) {
  return (
    <header className="mtopbar">
      <button type="button" className="mtopbtn" aria-label="Open menu" onClick={() => setNavOpen(true)}>
        <Icon name="menu" size={22} />
      </button>
      {children}
    </header>
  );
}

/**
 * The page's name above its content, from the menu item the address belongs
 * to (a paper's own page is under Papers).
 */
export function PageTitle({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const item = currentItem(groups, pathname);
  if (!item) return null;
  return (
    // keyed, so the title fades in with each page rather than swapping in place
    <div className="ctitle" key={item.href}>
      <Icon name={item.icon} size={20} />
      <h1>{item.label}</h1>
    </div>
  );
}

export function NavScrim() {
  return <button type="button" className="navscrim" aria-label="Close menu" tabIndex={-1} onClick={() => setNavOpen(false)} />;
}

export function NavClose() {
  return (
    <button type="button" className="navclose" aria-label="Close menu" onClick={() => setNavOpen(false)}>
      <Icon name="x" size={20} />
    </button>
  );
}
