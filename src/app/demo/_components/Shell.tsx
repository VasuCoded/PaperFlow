"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AREA_ROLES, useDemoSession } from "@/demo/session";
import { instituteName, ROLE_LABEL } from "@/demo/institutes";
import { ACTIVATION_REQUESTS, batchesFor, papersFor, STAGING_QUEUE } from "@/demo/activity";
import { INSTITUTES } from "@/demo/institutes";

export type Area = "platform" | "institute" | "teacher";

interface NavItem {
  href: string;
  label: string;
  count?: number | string;
}

function navFor(area: Area, instituteId: string | null): NavItem[] {
  if (area === "platform") {
    return [
      { href: "/demo/platform", label: "Overview" },
      { href: "/demo/platform/institutes", label: "Institutes", count: INSTITUTES.filter((i) => i.kind === "institute").length },
      { href: "/demo/platform/bank", label: "Review queue", count: STAGING_QUEUE.length },
      { href: "/demo/platform/activation", label: "Activation" },
      { href: "/demo/platform/requests", label: "Requests", count: ACTIVATION_REQUESTS.filter((r) => r.status === "pending").length },
      { href: "/demo/platform/health", label: "Health" },
      { href: "/demo/platform/audit", label: "Audit log" },
    ];
  }
  if (area === "institute") {
    return [
      { href: "/demo/institute", label: "Overview" },
      { href: "/demo/institute/members", label: "Members", count: 7 },
      { href: "/demo/institute/teachers", label: "Teacher subjects" },
      { href: "/demo/institute/subjects", label: "Subjects" },
      { href: "/demo/institute/export", label: "Export data" },
    ];
  }
  const inst = instituteId ?? "";
  return [
    { href: "/demo/teacher/generate", label: "Set a paper" },
    { href: "/demo/teacher/papers", label: "My papers", count: papersFor(inst).length },
    { href: "/demo/teacher/batches", label: "Batches", count: batchesFor(inst).length },
    { href: "/demo/teacher/flagged", label: "Flagged questions", count: 2 },
  ];
}

const AREA_BRAND: Record<Area, { brand: string; cap: string }> = {
  platform: { brand: "PaperFlow", cap: "Platform console" },
  institute: { brand: "PaperFlow", cap: "Institute console" },
  teacher: { brand: "PaperFlow", cap: "Teacher console" },
};

export function Shell({
  area,
  eyebrow,
  title,
  intro,
  children,
  split = false,
}: {
  area: Area;
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  children: ReactNode;
  split?: boolean;
}) {
  const { ready, account, instituteId, role, setInstitute } = useDemoSession();
  const router = useRouter();
  const pathname = usePathname();

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

  const allowed = AREA_ROLES[area] ?? [];
  if (!role || !allowed.includes(role)) {
    return (
      <div className="wrap narrow">
        <header className="masthead">
          <div>
            <p className="eyebrow">404</p>
            <h1>Not found</h1>
            <p>
              This account has no access to this area, so the app returns a 404 rather than a 403 —
              an unauthorised user should not be able to map the routes that exist.
            </p>
          </div>
          <Link className="btn" href="/demo/login">
            Switch account
          </Link>
        </header>
        <div className="notice plain">
          Signed in as <b>{account.name}</b> ({ROLE_LABEL[role ?? "none"]}). Area{" "}
          <span className="mono">/{area}</span> requires{" "}
          <span className="mono">{allowed.join(" or ")}</span>.
        </div>
      </div>
    );
  }

  const nav = navFor(area, instituteId);
  const brand = AREA_BRAND[area];
  const multi = account.memberships.length > 1;

  return (
    <div className="wrap">
      <header className="masthead">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </header>

      <div className="appshell">
        <nav className="rail">
          <div className="brand">
            {brand.brand}
            <span>{brand.cap}</span>
          </div>
          {nav.map((n) => {
            const on = pathname === n.href || (n.href !== `/demo/${area}` && pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`navitem${on ? " on" : ""}`}>
                <span>{n.label}</span>
                {n.count !== undefined && <span className="n">{n.count}</span>}
              </Link>
            );
          })}
          <div className="railfoot">
            Signed in as
            <br />
            <b>{account.name}</b>
            <br />
            <span className="role">{(ROLE_LABEL[role] ?? role).toUpperCase()}</span>
            {instituteId && area !== "platform" && (
              <>
                <br />
                {multi ? (
                  <select
                    className="sel"
                    style={{ marginTop: 8, fontSize: 11, padding: "5px 6px" }}
                    value={instituteId}
                    onChange={(e) => setInstitute(e.target.value)}
                    aria-label="Switch institute"
                  >
                    {account.memberships.map((m) => (
                      <option key={m.instituteId} value={m.instituteId}>
                        {instituteName(m.instituteId)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 11 }}>{instituteName(instituteId)}</span>
                )}
              </>
            )}
          </div>
        </nav>

        <div className={split ? "content split" : "content"}>{children}</div>
      </div>

      <p className="footnote">
        Clickable prototype, not the finished product. The paper generator, the multi-set shuffle
        and the practice matcher on these screens are the real engines running on mock data; only
        the database is simulated.
      </p>
    </div>
  );
}
