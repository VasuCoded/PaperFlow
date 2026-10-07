import "@/styles/paperflow.css";
import "@/styles/app.css";
import { uiFontClass } from "@/lib/fonts";
import { MotionProvider } from "@/components/motion/MotionProvider";

/**
 * Every screen in here depends on the signed-in session (resolved from cookies
 * server-side), so none of it can be prerendered at build time.
 */
export const dynamic = "force-dynamic";

/**
 * Shell for the real application. Route groups do not affect URLs, so pages in
 * here live at /login, /welcome, /platform, /institute, /teacher and /app.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pf-ui ${uiFontClass}`}>
      <MotionProvider>{children}</MotionProvider>
    </div>
  );
}
