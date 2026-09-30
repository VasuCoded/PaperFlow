/**
 * PaperFlow's mark: a printed sheet on the ink tile, with the red pen tick
 * that marks it. Plain SVG, no fonts or requests, so it costs nothing to show
 * anywhere (and the same drawing makes the app icon, src/lib/pwa/icon.tsx).
 */
export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="logomark"
    >
      <rect width="32" height="32" rx="8" fill="#15181b" />
      {/* the second set, peeking out behind the first */}
      <path d="M8.5 9.5h9l4.5 4.5v12.5h-13.5z" fill="#5a6169" transform="translate(-1.6 1.6)" />
      <path d="M9.5 6.5h9.2l5.3 5.3v14.7h-14.5z" fill="#f7f6f4" />
      <path d="M18.7 6.5v5.3h5.3z" fill="#d6d1c8" />
      <path d="M12.3 13.2h6.4M12.3 16.6h8.6" stroke="#a39e96" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.4 21.1l2.5 2.4 5.6-6" stroke="#b3141c" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Mark plus the word. `sub` is the small line under it (which console this is). */
export function Logo({ size = 28, sub }: { size?: number; sub?: string }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logotext">
        <span className="logoword">
          Paper<em>Flow</em>
        </span>
        {sub && <span className="logosub">{sub}</span>}
      </span>
    </span>
  );
}
