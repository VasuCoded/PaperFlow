import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** One number on a dashboard, with what it counts and (optionally) where to act on it. */
export function Stat({
  icon,
  value,
  label,
  hint,
  href,
  tone,
}: {
  icon: IconName;
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  href?: string;
  tone?: "warn" | "good";
}) {
  const body = (
    <>
      <span className={`staticon${tone ? ` ${tone}` : ""}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="statval">{value}</span>
      <span className="statlabel">{label}</span>
      {hint && <span className="stathint">{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="statx link">
      {body}
    </Link>
  ) : (
    <div className="statx">{body}</div>
  );
}

/** A row in a "needs you" list: icon, what, a count, and a link to deal with it. */
export function TodoRow({
  icon,
  title,
  text,
  count,
  href,
}: {
  icon: IconName;
  title: string;
  text: string;
  count: number;
  href: string;
}) {
  return (
    <Link href={href} className={`todorow${count > 0 ? " hot" : ""}`}>
      <span className="todoicon">
        <Icon name={icon} size={18} />
      </span>
      <span className="todotext">
        <b>{title}</b>
        <span>{text}</span>
      </span>
      <span className="todocount">{count}</span>
      <Icon name="chevronRight" size={16} className="todochev" />
    </Link>
  );
}

/** "3 days ago", for when something last happened. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : months < 12 ? `${months} months ago` : "over a year ago";
}
