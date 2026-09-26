import type { ReactNode } from 'react';

/** Splits "€184k" into the big number and the small suffix used on tiles. */
export function Money({ text }: { text: string }) {
  const m = text.match(/^(.*?)([kM])$/);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <small>{m[2]}</small>
    </>
  );
}

export function Ring({ share, children, size = 112 }: { share: number; children: ReactNode; size?: number }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, share)) * c;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 112 112" style={{ width: size, height: size }}>
        <circle cx="56" cy="56" r={r} stroke="#1b3150" strokeWidth="12" fill="none" />
        <circle
          cx="56"
          cy="56"
          r={r}
          stroke="#22d3ee"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${filled} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

const ICONS = {
  alert: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  chevronLeft: <polyline points="15 18 9 12 15 6" />,
  chevronRight: <polyline points="9 18 15 12 9 6" />,
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  euro: (
    <>
      <path d="M17 6.5A7 7 0 1 0 17 17.5" />
      <line x1="4" y1="10.5" x2="13" y2="10.5" />
      <line x1="4" y1="13.5" x2="13" y2="13.5" />
    </>
  ),
  doc: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 21V10h5a1 1 0 0 1 1 1v10" />
      <path d="M3 21h18M7.5 8h3M7.5 12h3M7.5 16h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" />
      <path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, style, width = 2 }: { name: IconName; style?: React.CSSProperties; width?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/**
 * Company mark drawn after the STAYPROPERTY renders. Replace with the official
 * logo file (public/logo.svg) when it is provided.
 */
export function Logo() {
  return (
    <div className="logo">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M7 24 L24 8 L41 24" stroke="#d7262f" strokeWidth="7" fill="none" />
        <path d="M7 24 L7 28 L24 28" stroke="#d7262f" strokeWidth="7" fill="none" />
        <path d="M24 28 L41 28 L41 40 L20 40" stroke="#1d3a78" strokeWidth="7" fill="none" />
      </svg>
      <div className="logo-text">
        <span className="s">STAY</span>
        <span className="p">PROPERTY</span>
      </div>
    </div>
  );
}
