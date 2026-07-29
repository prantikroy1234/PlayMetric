// Shared self-contained SVG charts (used by the Financials overview and the
// Dashboard). No chart library — inline SVG only, so nothing new touches the
// strict CSP. Theme colours that come from CSS variables are applied via CSS
// classes (presentation attributes can't read var()); the categorical palette
// below is literal hex.

export const PALETTE = [
  '#3b82f6', '#5ce1ff', '#7c6cff', '#22c55e',
  '#f59e0b', '#ef4444', '#14b8a6', '#f472b6',
];

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/* ---------------------------- Vertical bars ---------------------------- */
// data: [{ label, value, highlight? }]
export function BarChart({ data: bars }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="barchart">
      {bars.map((b) => (
        <div className="barchart__col" key={b.label} title={`${b.label}: ${b.value}`}>
          <span className="barchart__val">{b.value || ''}</span>
          <div className="barchart__track">
            <div
              className={`barchart__bar${b.highlight ? ' is-today' : ''}`}
              style={{ height: `${(b.value / max) * 100}%` }}
            />
          </div>
          <span className="barchart__label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Horizontal bars --------------------------- */
// data: [{ label, value }]
export function HBars({ data: bars, format = (v) => v, empty, variant }) {
  if (bars.length === 0) return <p className="dash-empty">{empty}</p>;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="hbars">
      {bars.map((b) => (
        <div className="hbar" key={b.label}>
          <span className="hbar__label" title={b.label}>{b.label}</span>
          <div className="hbar__track">
            <div className={`hbar__fill${variant ? ` is-${variant}` : ''}`} style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="hbar__val">{format(b.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Donut -------------------------------- */
// data: [{ label, value, color }]
export function Donut({ data, size = 190, thickness = 26, centerValue, centerLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  // GROW is how much a hovered segment thickens; reserve that much headroom on
  // the radius (plus a 2px cushion) so the pop never clips the viewBox edge.
  const GROW = 6;
  const r = (size - thickness) / 2 - GROW - 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2;
  let acc = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="donut__svg" role="img">
      <g transform={`rotate(-90 ${cx} ${cx})`}>
        <circle className="donut__track" cx={cx} cy={cx} r={r} fill="none" strokeWidth={thickness} />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * C;
            const seg = (
              <circle
                key={d.label}
                className="donut__seg"
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
                // Base + hovered stroke widths, read by the CSS :hover rule.
                style={{ '--sw': `${thickness}px`, '--swh': `${thickness + GROW * 2}px` }}
              >
                <title>{d.label}</title>
              </circle>
            );
            acc += len;
            return seg;
          })}
      </g>
      <text x={cx} y={cx - 4} textAnchor="middle" className="donut__center">{centerValue}</text>
      <text x={cx} y={cx + 16} textAnchor="middle" className="donut__centersub">{centerLabel}</text>
    </svg>
  );
}

export function DonutLegend({ data, total, format = money }) {
  return (
    <ul className="donut-legend">
      {data.map((d) => (
        <li className="donut-legend__item" key={d.label}>
          <span className="donut-legend__dot" style={{ background: d.color }} />
          <span className="donut-legend__label">{d.label}</span>
          <span className="donut-legend__pct">
            {total ? Math.round((d.value / total) * 100) : 0}%
          </span>
          <span className="donut-legend__val">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- Trend line ------------------------------ */
// Catmull-Rom → cubic bezier for a smooth curve through the points.
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// points: [{ label, value }] — plotted left→right. A dashed zero baseline
// marks break-even (handy for a running balance that can dip negative).
export function TrendLine({ points, height = 210, formatY }) {
  const w = 640;
  const h = height;
  const pad = { t: 18, r: 18, b: 26, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const x = (i) => pad.l + (points.length <= 1 ? 0.5 : i / (points.length - 1)) * iw;
  const y = (v) => pad.t + (1 - (v - min) / range) * ih;

  const coords = points.map((p, i) => [x(i), y(p.value)]);
  const line = smoothPath(coords);
  const zeroY = y(0);
  const area =
    coords.length > 0
      ? `${line} L${x(points.length - 1).toFixed(1)},${(pad.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(pad.t + ih).toFixed(1)} Z`
      : '';

  // A few y gridlines: max, 0, min.
  const yTicks = [max, 0, min].filter((v, i, a) => a.indexOf(v) === i);
  const fmtK =
    formatY ||
    ((v) => (Math.abs(v) >= 1000 ? `${v < 0 ? '−' : ''}₹${Math.round(Math.abs(v) / 1000)}k` : `₹${v}`));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend__svg" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5ce1ff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#5ce1ff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((v) => (
        <g key={v}>
          <line className="trend__grid" x1={pad.l} y1={y(v)} x2={w - pad.r} y2={y(v)} />
          <text className="trend__ylabel" x={pad.l - 8} y={y(v) + 3} textAnchor="end">{fmtK(v)}</text>
        </g>
      ))}

      {/* break-even baseline */}
      <line className="trend__zero" x1={pad.l} y1={zeroY} x2={w - pad.r} y2={zeroY} />

      {area && <path d={area} fill="url(#trendfill)" />}
      {line && <path d={line} className="trend__line" fill="none" />}

      {coords.map((c, i) => (
        <circle key={i} cx={c[0]} cy={c[1]} r="3.2" className="trend__dot" />
      ))}

      {points.map((p, i) =>
        // Label every other point when crowded, always the ends.
        points.length > 8 && i % 2 === 1 && i !== points.length - 1 ? null : (
          <text key={i} className="trend__xlabel" x={x(i)} y={h - 8} textAnchor="middle">{p.label}</text>
        )
      )}
    </svg>
  );
}
