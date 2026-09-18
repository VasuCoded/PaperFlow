/**
 * The app icon, drawn with plain boxes so next/og can render it to PNG at any
 * size without a font: a sheet of paper on the ink ground, three ruled lines,
 * and the red pen mark that is PaperFlow's accent.
 *
 * `maskable` keeps everything inside the central safe zone (80%), since
 * Android crops maskable icons to a circle or squircle.
 */
export function AppIcon({ px, maskable = false }: { px: number; maskable?: boolean }) {
  const inset = maskable ? 0.2 : 0.14;
  const sheetW = px * (1 - inset * 2) * 0.72;
  const sheetH = px * (1 - inset * 2) * 0.9;
  const line = Math.max(2, Math.round(px * 0.028));
  return (
    <div
      style={{
        width: px,
        height: px,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#15181b",
        borderRadius: maskable ? 0 : px * 0.18,
      }}
    >
      <div
        style={{
          width: sheetW,
          height: sheetH,
          background: "#f7f6f4",
          borderRadius: px * 0.03,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: `0 ${sheetW * 0.16}px`,
          gap: sheetH * 0.1,
        }}
      >
        <div style={{ height: line, width: "100%", background: "#9a958e", borderRadius: line }} />
        <div style={{ height: line, width: "82%", background: "#9a958e", borderRadius: line }} />
        <div style={{ height: line, width: "92%", background: "#9a958e", borderRadius: line }} />
        <div style={{ height: line * 1.8, width: "46%", background: "#b3141c", borderRadius: line }} />
      </div>
    </div>
  );
}
