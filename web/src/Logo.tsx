/**
 * Emaús mark: a road rising to the sun (Luke 24:13-35), drawn as flat
 * geometry with one shaded facet and one accent circle. Original artwork;
 * the wordmark is plain text so it follows the theme.
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
        <linearGradient id="emaus-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8fd3c6" />
        </linearGradient>
        <clipPath id="emaus-tile">
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <g clipPath="url(#emaus-tile)">
        <rect width="64" height="64" fill="#0f5c8c" />
        <circle cx="43" cy="19" r="11" fill="#ffc94a" />
        <path d="M-6 64 L43 25 L22 64 Z" fill="#ffffff" />
        <path d="M22 64 L43 25 L70 64 Z" fill="url(#emaus-shade)" />
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
        <span className="logo-word">EMAÚS</span>
        {tagline && <span className="logo-tag">back office de fundos</span>}
      </span>
    </span>
  );
}
