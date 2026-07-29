import { useMemo } from 'react';
import { IconCheckCircle, IconXCircle } from '../../components/Icons';
import { Donut, DonutLegend, TrendLine, PALETTE } from '../../components/charts';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const compact = (n) => {
  const v = Math.abs(n);
  if (v >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${Math.round(n / 1000)}k`;
  return `₹${n}`;
};

function byCategory(entries, direction) {
  const m = {};
  for (const e of entries) {
    if (e.direction !== direction) continue;
    m[e.category] = (m[e.category] || 0) + Number(e.amount || 0);
  }
  return m;
}
const sortedEntries = (m) =>
  Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
const topEntry = (m) => sortedEntries(m)[0];

function buildInsights({ inflow, outflow, net, inflowByCat, outflowByCat }) {
  const good = [];
  const bad = [];
  const topIn = topEntry(inflowByCat);
  const topOut = topEntry(outflowByCat);
  const inCats = Object.keys(inflowByCat).length;

  if (net >= 0) good.push(`Cash-flow positive — you kept ${money(net)} this period.`);
  if (topIn) good.push(`${topIn.label} is your strongest revenue stream at ${money(topIn.value)}.`);
  if (inCats >= 3) good.push(`Revenue is spread across ${inCats} streams, easing reliance on any one.`);

  if (net < 0) bad.push(`Spending outpaced income by ${money(Math.abs(net))} this period.`);
  if (topOut && outflow) {
    const share = Math.round((topOut.value / outflow) * 100);
    bad.push(
      share >= 33
        ? `${topOut.label} is ${share}% of all spending — a concentration risk.`
        : `${topOut.label} is your biggest cost at ${money(topOut.value)}.`
    );
  }
  if (outflow > inflow && inflow > 0)
    bad.push(`Costs are running at ${Math.round((outflow / inflow) * 100)}% of income.`);

  if (good.length === 0) good.push('Add a few entries to surface what’s going well.');
  if (bad.length === 0) bad.push('Nothing concerning — keep an eye on your largest costs.');
  return { good: good.slice(0, 3), bad: bad.slice(0, 3) };
}

// Running balance across dates: one point per date, cumulative net.
function runningBalance(entries) {
  const byDate = {};
  for (const e of entries) {
    const delta = (e.direction === 'inflow' ? 1 : -1) * Number(e.amount || 0);
    byDate[e.entry_date] = (byDate[e.entry_date] || 0) + delta;
  }
  const dates = Object.keys(byDate).sort();
  let run = 0;
  return dates.map((d) => {
    run += byDate[d];
    return { label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, value: run };
  });
}

function MiniBars({ data, total }) {
  if (data.length === 0) return <p className="fviz-empty">No revenue recorded yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d) => (
        <div className="hbar" key={d.label}>
          <span className="hbar__label" title={d.label}>{d.label}</span>
          <div className="hbar__track">
            <div className="hbar__fill is-in" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="hbar__val">{total ? Math.round((d.value / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview({ entries }) {
  const {
    inflow, outflow, net, donutData, inflowBars, insights, trend,
  } = useMemo(() => {
    const inflowByCat = byCategory(entries, 'inflow');
    const outflowByCat = byCategory(entries, 'outflow');
    const inflow = Object.values(inflowByCat).reduce((s, v) => s + v, 0);
    const outflow = Object.values(outflowByCat).reduce((s, v) => s + v, 0);
    const donutData = sortedEntries(outflowByCat).map((d, i) => ({
      ...d,
      color: PALETTE[i % PALETTE.length],
    }));
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      donutData,
      inflowBars: sortedEntries(inflowByCat),
      insights: buildInsights({ inflow, outflow, net: inflow - outflow, inflowByCat, outflowByCat }),
      trend: runningBalance(entries),
    };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="card">
        <div className="fviz-empty" style={{ padding: '3rem' }}>
          No finance entries yet — add one to see the overview come to life.
        </div>
      </div>
    );
  }

  return (
    <div className="fviz">
      <div className="fviz-row fviz-row--top">
        {/* Summary */}
        <div className="fviz-card">
          <h3 className="fviz-card__title">This period</h3>
          <ul className="finstats">
            <li className="finstat"><span className="finstat__dot is-in" />
              <div><div className="finstat__val fin-amt-in">{money(inflow)}</div><div className="finstat__label">Total inflow</div></div>
            </li>
            <li className="finstat"><span className="finstat__dot is-out" />
              <div><div className="finstat__val fin-amt-out">{money(outflow)}</div><div className="finstat__label">Total outflow</div></div>
            </li>
            <li className="finstat"><span className={`finstat__dot ${net >= 0 ? 'is-in' : 'is-out'}`} />
              <div>
                <div className={`finstat__val ${net >= 0 ? 'fin-amt-in' : 'fin-amt-out'}`}>
                  {net < 0 ? '−' : ''}{money(Math.abs(net))}
                </div>
                <div className="finstat__label">Net balance</div>
              </div>
            </li>
          </ul>
        </div>

        {/* Expense donut */}
        <div className="fviz-card">
          <h3 className="fviz-card__title">Where money goes</h3>
          <div className="donut-wrap">
            <Donut data={donutData} size={158} thickness={22} centerValue={compact(outflow)} centerLabel="spent" />
            <DonutLegend data={donutData} total={outflow} />
          </div>
        </div>

        {/* Insights */}
        <div className="fviz-card">
          <div className="insights">
            <div className="insights__col">
              <div className="insights__head is-good">
                <IconCheckCircle width={18} height={18} /> The good
              </div>
              <ul className="insight-list">
                {insights.good.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
            <div className="insights__col">
              <div className="insights__head is-bad">
                <IconXCircle width={18} height={18} /> Watch-outs
              </div>
              <ul className="insight-list">
                {insights.bad.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="fviz-row fviz-row--bottom">
        {/* Trend */}
        <div className="fviz-card fviz-card--wide">
          <h3 className="fviz-card__title">Running balance</h3>
          <TrendLine points={trend} />
        </div>

        {/* Revenue sources */}
        <div className="fviz-card">
          <h3 className="fviz-card__title">Where money comes from</h3>
          <MiniBars data={inflowBars} total={inflow} />
        </div>
      </div>
    </div>
  );
}
