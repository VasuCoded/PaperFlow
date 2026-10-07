/**
 * The app's line icons, drawn inline (no icon font, no requests). Each entry is
 * a list of shapes: a path's "d", or "c cx cy r" for a circle, or
 * "r x y w h rx" for a rectangle. 24px grid, 1.8px stroke, currentColor.
 */
const ICONS = {
  home: ["M3 11l9-7 9 7", "M5.5 9.5V20h13V9.5", "M10 20v-5h4v5"],
  grid: ["r 3 3 8 8 2", "r 13 3 8 5 2", "r 13 11 8 10 2", "r 3 14 8 7 2"],
  building: ["r 4 3 16 18 2", "M8.5 7.5h2M13.5 7.5h2M8.5 11.5h2M13.5 11.5h2M8.5 15.5h2M13.5 15.5h2"],
  users: ["c 9 8 3.2", "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6", "M16 5a3.2 3.2 0 010 6.2", "M18 14.4c1.8.8 3 2.6 3 4.6"],
  user: ["c 12 8 4", "M4.5 21c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5"],
  userPlus: ["c 9.5 8 3.8", "M2.5 21c0-3.9 3.1-7 7-7 1.6 0 3 .5 4.2 1.3", "M18.5 13.5v7M15 17h7"],
  search: ["c 11 11 7", "M20.5 20.5l-4.6-4.6"],
  toggle: ["r 2 7 20 10 5", "c 16 12 2.6"],
  check: ["r 3 3 18 18 4", "M8 12.2l2.8 2.8L16.5 9"],
  tick: ["M5 12.5l4.5 4.5L19 7.5"],
  inbox: ["M3 13.5h5l1.6 3h4.8l1.6-3h5", "M5.3 5h13.4L21 13.5V19H3v-5.5z"],
  activity: ["M3 12h4l3-8 4 16 3-8h4"],
  list: ["M9 6h11M9 12h11M9 18h11", "M4.5 6h.01M4.5 12h.01M4.5 18h.01"],
  file: ["M6 3h8.5L19 7.5V21H6z", "M14 3v5h5", "M9 13h7M9 17h5"],
  filePlus: ["M6 3h8.5L19 7.5V21H6z", "M14 3v5h5", "M12.5 11v7M9 14.5h7"],
  layers: ["M12 3l9 5-9 5-9-5z", "M3 12.5l9 5 9-5", "M3 17l9 5 9-5"],
  chart: ["M4 20V11M10 20V5M16 20v-7M21 20H3"],
  flag: ["M5 21V4", "M5 4h12l-2.5 4.5L17 13H5"],
  book: ["M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z", "M4 20.5A2.5 2.5 0 006.5 23H20", "M8.5 8h7"],
  idcard: ["r 3 5 18 14 2", "c 8.5 11 2", "M5.5 16.5c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2", "M14.5 10h4M14.5 13.5h3"],
  download: ["M12 3v12", "M7 10.5l5 5 5-5", "M4 20.5h16"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  x: ["M6 6l12 12M18 6L6 18"],
  logout: ["M15 4h4v16h-4", "M10 8l-4 4 4 4", "M6 12h11"],
  arrowRight: ["M5 12h14", "M13 6l6 6-6 6"],
  chevronRight: ["M9.5 6l6 6-6 6"],
  printer: ["M7 8V3h10v5", "r 3 8 18 9 2", "M7 14h10v7H7z"],
  target: ["c 12 12 9", "c 12 12 5", "c 12 12 1"],
  pencil: ["M4 20l4.2-1L19 8.2 15.8 5 5 15.8z", "M13.8 7l3.2 3.2"],
  clipboard: ["r 5 4 14 17 2", "M9 4V2.8h6V4", "M9 11h6M9 15h4"],
  shield: ["M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"],
  lock: ["r 5 11 14 10 2", "M8 11V7.5a4 4 0 018 0V11"],
  mail: ["r 3 5 18 14 2", "M3.5 7l8.5 6 8.5-6"],
  copy: ["r 8 8 13 13 2", "M16 8V5.5A2.5 2.5 0 0013.5 3h-8A2.5 2.5 0 003 5.5v8A2.5 2.5 0 005.5 16H8"],
  spark: ["M12 3v4M12 17v4M3 12h4M17 12h4", "M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"],
  clock: ["c 12 12 9", "M12 7v5l3 2"],
  swap: ["M4 8h14", "M14.5 4.5L18 8l-3.5 3.5", "M20 16H6", "M9.5 12.5L6 16l3.5 3.5"],
  phone: ["r 6.5 2.5 11 19 2.5", "M10.5 18.5h3"],
  key: ["c 8 15 4", "M11 12l9-9", "M16.5 6.5l2.5 2.5"],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ? `icon ${className}` : "icon"}
    >
      {(ICONS[name] as readonly string[]).map((s, i) => {
        if (s.startsWith("c ")) {
          const [cx, cy, r] = s.slice(2).split(" ").map(Number);
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        if (s.startsWith("r ")) {
          const [x, y, w, h, rx] = s.slice(2).split(" ").map(Number);
          return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />;
        }
        return <path key={i} d={s} />;
      })}
    </svg>
  );
}
