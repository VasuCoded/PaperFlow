"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useDemoSession } from "@/demo/session";
import { instituteName } from "@/demo/institutes";
import { classSubject } from "@/demo/bank";
import { STUDENT_SUBJECTS } from "@/demo/activity";

const SUBJECT_KEY = "pf_demo_subject";

export function useDemoSubject(): [string, (id: string) => void] {
  const [id, setId] = useState<string>(STUDENT_SUBJECTS[0]!);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SUBJECT_KEY);
      if (v && STUDENT_SUBJECTS.includes(v)) setId(v);
    } catch {
      /* blocked storage */
    }
  }, []);
  const set = (next: string) => {
    setId(next);
    try {
      window.localStorage.setItem(SUBJECT_KEY, next);
    } catch {
      /* blocked storage */
    }
  };
  return [id, set];
}

const TABS = [
  { href: "/demo/app", label: "Tests", ic: "▤" },
  { href: "/demo/app/practice", label: "Practice", ic: "▢" },
  { href: "/demo/app/weak", label: "Weak spots", ic: "▲" },
  { href: "/demo/app/me", label: "Me", ic: "●" },
];

export function Phone({
  children,
  eyebrow,
  title,
  intro,
  aside,
  showChrome = true,
}: {
  children: ReactNode;
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  aside?: ReactNode;
  showChrome?: boolean;
}) {
  const { ready, account, instituteId } = useDemoSession();
  const router = useRouter();
  const pathname = usePathname();
  const [subject, setSubject] = useDemoSubject();

  useEffect(() => {
    if (ready && !account) router.replace("/demo/login");
  }, [ready, account, router]);

  if (!ready || !account) {
    return (
      <div className="wrap">
        <p className="eyebrow">Loading</p>
      </div>
    );
  }

  const cs = classSubject(subject);

  return (
    <div className="wrap narrow">
      <header className="masthead">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </header>

      <div className="phonestage">
        <div className="phone-col">
          <div className="phone">
            <div className="statusbar">
              <span>9:41</span>
              <span>●●● &nbsp; 4G &nbsp; 82%</span>
            </div>
            {showChrome && (
              <div className="appbar">
                <div className="who">
                  {account.name}
                  <span>
                    {instituteId ? instituteName(instituteId).toUpperCase() : ""}
                    {cs ? ` · CLASS ${cs.className}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {STUDENT_SUBJECTS.length > 1 && (
                    <select
                      className="subjswitch"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      aria-label="Switch subject"
                    >
                      {STUDENT_SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {classSubject(s)?.short}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="avatar">{account.initials}</div>
                </div>
              </div>
            )}
            <div className="screen">{children}</div>
            {showChrome && (
              <nav className="tabbar">
                {TABS.map((t) => (
                  <Link key={t.href} href={t.href} className={`tab${pathname === t.href ? " on" : ""}`}>
                    <span className="ic">{t.ic}</span>
                    {t.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <p className="caption">Installs from the browser. No app store.</p>
        </div>

        {aside && <aside className="noterail">{aside}</aside>}
      </div>

      <p className="footnote">
        Clickable prototype. The practice matcher behind these screens is the real engine running on
        mock data; only the database is simulated.
      </p>
    </div>
  );
}
