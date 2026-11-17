import { useMemo, useState } from "react";
import type { Day } from "./api";
import { formatDate, formatDecimal } from "./format";

const W = 960;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 32, left: 56 };

/**
 * Accumulated return of the quota since the first day. Numbers are converted
 * to floats only to place pixels; every label and tooltip shows the API's
 * exact decimal strings.
 */
export function QuotaChart({ days, selected, onSelect }: { days: Day[]; selected?: string; onSelect: (d: string) => void }) {
  const [hover, setHover] = useState<number>();
  const geo = useMemo(() => {
    const ys = days.map((d) => Number(d.return_pct));
    const lo = Math.min(0, ...ys);
    const hi = Math.max(0, ...ys);
    const span = hi - lo || 1;
    const step = niceStep(span / 4);
    const yMin = Math.floor(lo / step) * step;
    const yMax = Math.ceil(hi / step) * step;
    const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, days.length - 1);
    const y = (v: number) => PAD.top + ((yMax - v) * (H - PAD.top - PAD.bottom)) / (yMax - yMin || 1);
    const ticks: number[] = [];
    for (let t = yMin; t <= yMax + step / 2; t += step) ticks.push(Number(t.toFixed(6)));
    const path = ys.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return { ys, x, y, ticks, path };
  }, [days]);

  if (days.length === 0) return null;
  const h = hover === undefined ? undefined : days[hover];
  const sel = days.findIndex((d) => d.date === selected);

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Rentabilidade acumulada da cota por dia"
        onMouseLeave={() => setHover(undefined)}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} className={t === 0 ? "axis-zero" : "grid"} />
            <text x={PAD.left - 8} y={geo.y(t) + 4} className="tick" textAnchor="end">
              {formatDecimal(t.toFixed(2), 2)}%
            </text>
          </g>
        ))}
        {days.map((d, i) => (
          <text key={d.date} x={geo.x(i)} y={H - 10} className="tick" textAnchor="middle">
            {formatDate(d.date).slice(0, 5)}
          </text>
        ))}
        <path d={geo.path} className="series" />
        {sel >= 0 && <circle cx={geo.x(sel)} cy={geo.y(geo.ys[sel])} r={5} className="marker selected" />}
        {hover !== undefined && (
          <>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
            <circle cx={geo.x(hover)} cy={geo.y(geo.ys[hover])} r={5} className="marker" />
          </>
        )}
        {days.map((d, i) => {
          const half = (W - PAD.left - PAD.right) / Math.max(1, days.length - 1) / 2;
          return (
            <rect
              key={d.date}
              x={geo.x(i) - half}
              y={PAD.top}
              width={half * 2}
              height={H - PAD.top - PAD.bottom}
              className="hit"
              onMouseEnter={() => setHover(i)}
              onClick={() => onSelect(d.date)}
            />
          );
        })}
      </svg>
      {h && hover !== undefined && (
        <div className="tooltip" style={{ left: `${(geo.x(hover) / W) * 100}%` }}>
          <strong>{formatDate(h.date)}</strong>
          <span>Cota {formatDecimal(h.quota)}</span>
          <span>Acumulado {formatDecimal(h.return_pct, 2)}%</span>
          <span>No dia {h.change_pct === null ? "—" : `${formatDecimal(h.change_pct, 2)}%`}</span>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p;
  return 10 * p;
}
