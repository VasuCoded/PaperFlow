import type { Metadata, Viewport } from "next";
import { rootFontClass } from "@/lib/fonts";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaperFlow",
  description: "Question bank and mistake-practice platform for classes 9-12.",
  applicationName: "PaperFlow",
  appleWebApp: { capable: true, title: "PaperFlow", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#15181b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme on <html> before
    // React hydrates, so the attribute legitimately differs from the server's.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint so a dark-mode user never sees a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${rootFontClass} font-sans antialiased`}>{children}</body>
    </html>
  );
}
