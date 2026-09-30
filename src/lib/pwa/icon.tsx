/**
 * The app icon: the same drawing as the logo mark (src/components/brand/Logo.tsx),
 * a printed sheet on the ink tile with the red pen tick. next/og renders the
 * SVG to PNG at any size without a font.
 *
 * `maskable` keeps the sheet inside the central safe zone (80%), since Android
 * crops maskable icons to a circle or squircle, and draws the tile full-bleed.
 */
export function AppIcon({ px, maskable = false }: { px: number; maskable?: boolean }) {
  const scale = maskable ? 0.72 : 1;
  const off = (32 - 32 * scale) / 2;
  return (
    <div style={{ width: px, height: px, display: "flex", background: maskable ? "#15181b" : "transparent" }}>
      <svg width={px} height={px} viewBox="0 0 32 32">
        {!maskable && <rect width="32" height="32" rx="7" fill="#15181b" />}
        <g transform={`translate(${off} ${off}) scale(${scale})`}>
          <path d="M8.5 9.5h9l4.5 4.5v12.5h-13.5z" fill="#5a6169" transform="translate(-1.6 1.6)" />
          <path d="M9.5 6.5h9.2l5.3 5.3v14.7h-14.5z" fill="#f7f6f4" />
          <path d="M18.7 6.5v5.3h5.3z" fill="#d6d1c8" />
          <path d="M12.3 13.2h6.4M12.3 16.6h8.6" stroke="#a39e96" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M12.4 21.1l2.5 2.4 5.6-6" stroke="#b3141c" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}
