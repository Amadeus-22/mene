/**
 * Mene mark: an M drawn as a rising price line over volume bars, on a vibrant
 * gradient tile. Mene is the word for "counted" in Daniel 5:25-26; the mark is
 * about counting the market. Original artwork; the wordmark is plain text so
 * it follows the theme.
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
        <linearGradient id="mene-bg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <clipPath id="mene-tile">
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <g clipPath="url(#mene-tile)">
        <rect width="64" height="64" fill="url(#mene-bg)" />
        <rect
          x="12"
          y="46"
          width="7"
          height="10"
          rx="1.5"
          fill="#ffffff"
          opacity="0.35"
        />
        <rect
          x="23"
          y="40"
          width="7"
          height="16"
          rx="1.5"
          fill="#ffffff"
          opacity="0.35"
        />
        <rect
          x="34"
          y="43"
          width="7"
          height="13"
          rx="1.5"
          fill="#ffffff"
          opacity="0.35"
        />
        <rect
          x="45"
          y="34"
          width="7"
          height="22"
          rx="1.5"
          fill="#ffffff"
          opacity="0.35"
        />
        <path
          d="M10 40 L22 15 L32 31 L43 13"
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M37 9 L53 6 L48 21 Z" fill="#ffffff" />
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
