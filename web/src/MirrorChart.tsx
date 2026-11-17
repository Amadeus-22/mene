import { useMemo, useState } from "react";
import type { MirrorDay } from "./api";
import { formatDate, formatDecimal } from "./format";

const W = 960;
const H = 300;
const PAD = { top: 16, right: 96, bottom: 32, left: 56 };

/** Official vs mirror quota, as accumulated return since the portfolio date. */
export function MirrorChart({ days }: { days: MirrorDay[] }) {
  const [hover, setHover] = useState<number>();
  const g = useMemo(() => {
    const a = days.map((d) => Number(d.official_return_pct));
    const b = days.map((d) => Number(d.our_return_pct));
    const lo = Math.min(0, ...a, ...b);
    const hi = Math.max(0, ...a, ...b);
    const step = nice((hi - lo || 1) / 4);
    const yMin = Math.floor(lo / step) * step;
    const yMax = Math.ceil(hi / step) * step;
    const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, days.length - 1);
    const y = (v: number) => PAD.top + ((yMax - v) * (H - PAD.top - PAD.bottom)) / (yMax - yMin || 1);
    const ticks: number[] = [];
    for (let t = yMin; t <= yMax + step / 2; t += step) ticks.push(Number(t.toFixed(6)));
    const path = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return { a, b, x, y, ticks, pa: path(a), pb: path(b) };
  }, [days]);
  if (days.length === 0) return null;
  const n = days.length - 1;
  const h = hover === undefined ? undefined : days[hover];
  const every = Math.ceil(days.length / 11);
  const half = (W - PAD.left - PAD.right) / Math.max(1, n) / 2;

  return (
    <div className="chart">
      <div className="legend">
        <span><i className="swatch s-official" /> Cota oficial (CVM)</span>
        <span><i className="swatch s-ours" /> Nossa cota espelho</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rentabilidade da cota oficial e da cota espelho" onMouseLeave={() => setHover(undefined)}>
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={g.y(t)} y2={g.y(t)} className={t === 0 ? "axis-zero" : "grid"} />
            <text x={PAD.left - 8} y={g.y(t) + 4} className="tick" textAnchor="end">
              {formatDecimal(t.toFixed(1), 1)}%
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          i % every === 0 || i === n ? (
            <text key={d.date} x={g.x(i)} y={H - 10} className="tick" textAnchor="middle">
              {formatDate(d.date).slice(0, 5)}
            </text>
          ) : null,
        )}
        <path d={g.pa} className="series s-official" />
        <path d={g.pb} className="series s-ours dashed" />
        <text x={g.x(n) + 8} y={g.y(g.a[n]) - 4} className="direct">oficial</text>
        <text x={g.x(n) + 8} y={g.y(g.b[n]) + 14} className="direct">espelho</text>
        {hover !== undefined && (
          <>
            <line x1={g.x(hover)} x2={g.x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
            <circle cx={g.x(hover)} cy={g.y(g.a[hover])} r={5} className="marker s-official" />
            <circle cx={g.x(hover)} cy={g.y(g.b[hover])} r={5} className="marker s-ours" />
          </>
        )}
        {days.map((d, i) => (
          <rect key={d.date} x={g.x(i) - half} y={PAD.top} width={half * 2} height={H - PAD.top - PAD.bottom} className="hit" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {h && hover !== undefined && (
        <div className="tooltip" style={{ left: `${(g.x(hover) / W) * 100}%` }}>
          <strong>{formatDate(h.date)}</strong>
          <span>Oficial {formatDecimal(h.official_quota, 6)}</span>
          <span>Espelho {formatDecimal(h.our_quota, 6)}</span>
          <span>Diferença {formatDecimal(h.gap_bps)} bps</span>
        </div>
      )}
    </div>
  );
}

function nice(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p;
  return 10 * p;
}
