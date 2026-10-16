import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { uiFontClass } from "@/lib/fonts";
import "./demo.css";
import { DemoSessionProvider } from "@/demo/session";
import { DemoBar } from "./_components/DemoBar";

export const metadata: Metadata = {
  title: "PaperFlow — design demo",
  description: "Front-end design prototype. No database, no real accounts.",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  // The demo contains a persona picker, which is the shape of thing CLAUDE.md
  // forbids in the real app. It must never be reachable on a production
  // deployment unless someone opts in explicitly.
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_DEMO !== "1") {
    notFound();
  }

  return (
    <div
      className={`pf-ui ${uiFontClass}`}
    >
      <DemoSessionProvider>
        <DemoBar />
        {children}
      </DemoSessionProvider>
    </div>
  );
}
