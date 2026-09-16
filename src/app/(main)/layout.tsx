import "@/styles/paperflow.css";
import { uiFontClass } from "@/lib/fonts";

/**
 * Shell for the real application. Route groups do not affect URLs, so pages in
 * here live at /login, /welcome, /platform, /institute, /teacher and /app.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pf-ui ${uiFontClass}`}>{children}</div>;
}
