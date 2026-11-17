/**
 * Emaús mark: the road to Emmaus converging on the horizon at sunrise
 * (Luke 24:13-35). Original artwork; the wordmark is plain text so it
 * follows the theme.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="logo-mark"
    >
      <defs>
        <linearGradient id="emaus-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fbfa8" />
          <stop offset="1" stopColor="#0f5c8c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#emaus-g)" />
      <circle cx="32" cy="22" r="6" fill="#ffd166" />
      <path
        d="M10 30h44"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".9"
      />
      <path d="M29 30 L14 56 H50 L35 30 Z" fill="#fff" />
      <path
        d="M32 34v4M32 42v5M32 51v4"
        stroke="#0f5c8c"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  size = 32,
  tagline = true,
}: {
  size?: number;
  tagline?: boolean;
}) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-word">EMAÚS</span>
        {tagline && <span className="logo-tag">back office de fundos</span>}
      </span>
    </span>
  );
}
