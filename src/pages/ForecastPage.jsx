import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  AlertTriangle,
  Minus,
  Info,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import { formatMoney, formatNum } from '../lib/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

/**
 * Perform least-squares linear regression on an array of { x, y } points.
 * x: 0, 1, 2, ...
 * y: metric value
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points[0]?.y || 0, r2: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, r2: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Compute R-squared (coefficient of determination)
  const yMean = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = slope * points[i].x + intercept;
    ssTot += Math.pow(points[i].y - yMean, 2);
    ssRes += Math.pow(points[i].y - yPred, 2);
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

export default function ForecastPage() {
  const session = useAuth((s) => s.session);
  const { entries, inventory } = useDb();
  const { currency, nairaPerUSD } = useSettings();

  useEffect(() => {
    document.title = 'Forecast — SaleStew';
  }, []);

  const fmt = useCallback(
    (n) => formatMoney(n, currency, nairaPerUSD),
    [currency, nairaPerUSD]
  );

  const [horizon, setHorizon] = useState(6); // 3, 6, 12 months
  const [selectedCat, setSelectedCat] = useState('All');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return ['All', ...Array.from(set)];
  }, [entries]);

  // Aggregate historical monthly sales: returns map of "YYYY-MM" -> revenue
  const monthlyData = useMemo(() => {
    const map = {};
    const filteredEntries = entries.filter((e) => {
      if (selectedCat !== 'All' && e.category !== selectedCat) return false;
      return true;
    });

    // Populate past 6 months at minimum
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = 0;
    }

    filteredEntries.forEach((e) => {
      const dStr = e.date || e.createdAt;
      if (!dStr) return;
      const key = dStr.slice(0, 7);
      if (map[key] !== undefined) {
        map[key] += Number(e.revenue) || 0;
      } else {
        map[key] = Number(e.revenue) || 0;
      }
    });

    // Sort chronologically
    const sortedKeys = Object.keys(map).sort();
    return sortedKeys.map((key, idx) => ({
      monthKey: key,
      x: idx,
      revenue: map[key],
    }));
  }, [entries, selectedCat]);

  // Regression on monthlyData
  const model = useMemo(() => {
    const points = monthlyData.map((d, i) => ({ x: i, y: d.revenue }));
    const reg = linearRegression(points);

    const n = points.length;
    const avgMonthly = points.reduce((acc, p) => acc + p.y, 0) / (n || 1);
    const growthRate = avgMonthly > 0 ? (reg.slope / avgMonthly) * 100 : 0;
    const nextMonthVal = Math.max(0, reg.slope * n + reg.intercept);

    return {
      ...reg,
      avgMonthly,
      growthRate,
      nextMonthVal,
    };
  }, [monthlyData]);

  // Build projected points
  const projection = useMemo(() => {
    const pastCount = monthlyData.length;
    const futureMonths = [];
    const lastMonthStr = monthlyData[pastCount - 1]?.monthKey || '2026-10';
    const [y, m] = lastMonthStr.split('-').map(Number);

    for (let step = 1; step <= horizon; step++) {
      const targetDate = new Date(y, m - 1 + step, 1);
      const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      const x = pastCount - 1 + step;
      const projectedRevenue = Math.max(0, model.slope * x + model.intercept);
      futureMonths.push({
        monthKey: key,
        x,
        revenue: projectedRevenue,
      });
    }

    return futureMonths;
  }, [monthlyData, horizon, model]);

  // Chart dataset with historical (solid) and projection (dashed)
  const chartConfig = useMemo(() => {
    const allLabels = [
      ...monthlyData.map((d) => d.monthKey),
      ...projection.map((d) => `${d.monthKey} (proj)`),
    ];

    const historicalValues = monthlyData.map((d) =>
      currency === 'USD' ? d.revenue / nairaPerUSD : d.revenue
    );
    // Pad historical line with nulls for future
    const historicalSeries = [
      ...historicalValues,
      ...Array(projection.length).fill(null),
    ];

    // Projection series connects to the last historical point
    const lastHist = historicalValues[historicalValues.length - 1] ?? 0;
    const futureValues = projection.map((d) =>
      currency === 'USD' ? d.revenue / nairaPerUSD : d.revenue
    );
    const projectionSeries = [
      ...Array(historicalValues.length - 1).fill(null),
      lastHist,
      ...futureValues,
    ];

    return {
      labels: allLabels,
      datasets: [
        {
          label: `Historical Revenue (${currency})`,
          data: historicalSeries,
          borderColor: '#4e9463',
          backgroundColor: 'rgba(78,148,99,0.1)',
          fill: true,
          tension: 0.2,
          pointRadius: 4,
          pointBackgroundColor: '#4e9463',
        },
        {
          label: `Projected Trend (${currency})`,
          data: projectionSeries,
          borderColor: '#8b5a2b',
          backgroundColor: 'rgba(139,90,43,0.08)',
          borderDash: [6, 4],
          fill: true,
          tension: 0.1,
          pointRadius: 4,
          pointBackgroundColor: '#8b5a2b',
        },
      ],
    };
  }, [monthlyData, projection, currency, nairaPerUSD]);

  // Product level forecast breakdown
  const productForecasts = useMemo(() => {
    const prodMap = {};
    entries.forEach((e) => {
      const p = e.productName || 'Unknown';
      if (!prodMap[p]) {
        prodMap[p] = { name: p, category: e.category, revs: [], total: 0 };
      }
      prodMap[p].revs.push(Number(e.revenue) || 0);
      prodMap[p].total += Number(e.revenue) || 0;
    });

    return Object.values(prodMap).map((item) => {
      const avg = item.total / Math.max(item.revs.length, 1);
      const points = item.revs.map((y, i) => ({ x: i, y }));
      const reg = linearRegression(points);
      const trendPct = avg > 0 ? Math.round((reg.slope / avg) * 100) : 0;
      const projNext = Math.max(0, avg + reg.slope);

      let confidence = 'Low';
      if (item.revs.length >= 4 && reg.r2 > 0.4) confidence = 'High';
      else if (item.revs.length >= 2) confidence = 'Medium';

      let signalType = 'up';
      if (trendPct > 15) signalType = 'fire';
      else if (trendPct < -10) signalType = 'down';
      else if (trendPct <= 0) signalType = 'warn';

      return {
        name: item.name,
        category: item.category || 'General',
        avgMonthly: avg,
        trendPct,
        projNext,
        confidence,
        signalType,
      };
    });
  }, [entries]);

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Sales Forecast</h1>
          <p className="page-sub text-xs text-[var(--text-2)]">// linear regression projections &amp; momentum signals</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-3)] font-mono">Horizon:</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="form-select text-xs py-1 px-3"
            >
              <option value={3}>3 Months Ahead</option>
              <option value={6}>6 Months Ahead</option>
              <option value={12}>12 Months Ahead</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-3)] font-mono">Category:</label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="form-select text-xs py-1 px-3"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Model Alert Banner */}
      <div className="p-3 bg-[rgba(114,82,160,0.12)] border border-[rgba(114,82,160,0.3)] rounded-xl text-xs text-[var(--text)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-[var(--purple)] shrink-0" />
          <span>
            Model fit coefficient (R²): <strong>{(model.r2 * 100).toFixed(1)}%</strong>.
            {model.r2 > 0.5 ? ' High correlation indicates a dependable trendline.' : ' Moderate correlation; adjust for seasonal shifts.'}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-card__lbl">Trend Direction</div>
          <div className={`stat-card__val font-mono flex items-center gap-1.5 ${model.slope >= 0 ? 'text-[var(--green)]' : 'text-[var(--down)]'}`}>
            {model.slope >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>{model.slope >= 0 ? 'Upward' : 'Downward'}</span>
          </div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">
            {model.slope >= 0 ? '+' : ''}{model.growthRate.toFixed(1)}% per month
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Avg Monthly Run Rate</div>
          <div className="stat-card__val font-mono">{fmt(model.avgMonthly)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">baseline revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Projected Next Month</div>
          <div className="stat-card__val font-mono text-[var(--orange)]">{fmt(model.nextMonthVal)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">predicted trajectory</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Forecast Confidence</div>
          <div className="stat-card__val font-mono">
            {model.r2 > 0.6 ? 'High' : model.r2 > 0.3 ? 'Medium' : 'Observational'}
          </div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">based on R² variance</div>
        </div>
      </div>

      {/* Line Chart Panel */}
      <div className="panel space-y-4">
        <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
          // REVENUE TRAJECTORY ({horizon} MONTHS PROJECTION)
        </h2>
        <div className="h-72 w-full">
          <Line
            data={chartConfig}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  labels: { color: '#c4d4c0', font: { family: 'DM Mono', size: 11 } },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${fmt(ctx.parsed.y * (currency === 'USD' ? nairaPerUSD : 1))}`,
                  },
                },
              },
              scales: {
                x: {
                  grid: { color: 'rgba(255,255,255,0.05)' },
                  ticks: { color: '#748e70', font: { family: 'DM Mono', size: 10 } },
                },
                y: {
                  grid: { color: 'rgba(255,255,255,0.05)' },
                  ticks: { color: '#748e70', font: { family: 'DM Mono', size: 10 } },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Product-Level Forecasts Table */}
      <div className="panel space-y-4">
        <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
          // INDIVIDUAL PRODUCT DEMAND SIGNALS
        </h2>
        <div className="table-wrap overflow-x-auto">
          <table className="data-table w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-3)] font-mono">
                <th className="py-2.5 px-3">Signal</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Avg Monthly</th>
                <th className="py-2.5 px-3 text-right">Trend Momentum</th>
                <th className="py-2.5 px-3 text-right">Projected Next Month</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {productForecasts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-[var(--text-3)]">
                    No product history available.
                  </td>
                </tr>
              ) : (
                productForecasts.map((p, idx) => (
                  <tr key={idx} className="hover:bg-[var(--card-h)]">
                    <td className="py-2.5 px-3">
                      {p.signalType === 'fire' ? (
                        <Flame size={15} className="text-amber-500" />
                      ) : p.signalType === 'up' ? (
                        <TrendingUp size={15} className="text-[var(--green)]" />
                      ) : p.signalType === 'down' ? (
                        <TrendingDown size={15} className="text-[var(--down)]" />
                      ) : (
                        <AlertTriangle size={15} className="text-amber-500" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-medium text-[var(--text)]">{p.name}</td>
                    <td className="py-2.5 px-3 text-[var(--text-2)]">{p.category}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-2)]">{fmt(p.avgMonthly)}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      p.trendPct > 0 ? 'text-[var(--green)]' : p.trendPct < 0 ? 'text-[var(--down)]' : 'text-[var(--text-3)]'
                    }`}>
                      {p.trendPct > 0 ? '+' : ''}{p.trendPct}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[var(--orange)]">{fmt(p.projNext)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        p.confidence === 'High' ? 'bg-[rgba(78,148,99,0.15)] text-[var(--green)]' :
                        p.confidence === 'Medium' ? 'bg-[rgba(184,98,42,0.15)] text-[var(--orange)]' :
                        'bg-[rgba(114,82,160,0.15)] text-[var(--purple)]'
                      }`}>
                        {p.confidence}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology Section */}
      <div className="panel p-4 bg-[var(--bg2)] rounded border border-[var(--border)] text-xs text-[var(--text-2)] space-y-2">
        <h3 className="font-semibold text-[var(--text)] font-mono">// HOW THIS WORKS</h3>
        <p>
          SaleStew computes ordinary least-squares (OLS) linear regression y = mx + c across all historical sales records, normalized by month.
          Momentum indicators categorize products accelerating in demand versus declining lines to guide purchase orders and stock replenishment.
        </p>
      </div>
    </main>
  );
}

