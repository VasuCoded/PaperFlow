import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./demo.css";
import { DemoSessionProvider } from "@/demo/session";
import { DemoBar } from "./_components/DemoBar";

// Self-hosted at build time, matching the reference mockups' type pairing.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
      className={`demo-root ${newsreader.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <DemoSessionProvider>
        <DemoBar />
        {children}
      </DemoSessionProvider>
    </div>
  );
}
