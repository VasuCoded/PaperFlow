import type { MetadataRoute } from "next";

/**
 * Web app manifest (BUILD-PLAN C9 item 8). Installing opens the student app;
 * teachers and admins use PaperFlow in a desktop browser.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "PaperFlow",
    short_name: "PaperFlow",
    description: "Log your tests and practise exactly what you got wrong.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6f4",
    theme_color: "#15181b",
    icons: [
      { src: "/pwa/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
