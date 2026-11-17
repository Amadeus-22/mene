/**
 * Mene mark: tally marks being counted, with the lamp beside the wall where
 * MENE was written (Daniel 5:5, 5:25-26: "God has numbered your kingdom").
 * Flat geometry with one shaded facet and one accent circle. Original
 * artwork; the wordmark is plain text so it follows the theme.
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
        <linearGradient id="mene-shade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8fd3c6" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <clipPath id="mene-tile">
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <g clipPath="url(#mene-tile)">
        <rect width="64" height="64" fill="#0f5c8c" />
        <circle cx="49" cy="16" r="9" fill="#ffc94a" />
        <rect x="11" y="26" width="7" height="30" rx="2" fill="#ffffff" />
        <rect x="23" y="26" width="7" height="30" rx="2" fill="#ffffff" />
        <rect x="35" y="26" width="7" height="30" rx="2" fill="#ffffff" />
        <path d="M2 54 L52 28 L56 35 L6 61 Z" fill="url(#mene-shade)" />
      </g>
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
        <span className="logo-word">MENE</span>
        {tagline && <span className="logo-tag">back office de fundos</span>}
      </span>
    </span>
  );
}
