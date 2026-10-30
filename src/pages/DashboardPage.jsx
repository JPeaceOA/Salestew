import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer,
  Plus,
  Download,
  Trash2,
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Check,
  X,
  ArrowUpDown,
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import useToast from '../store/useToast';
import { useModal } from '../components/Modal';
import { formatMoney, formatNum, toNaira, currencySymbol } from '../lib/format';
import { csvStringify, csvDownload } from '../lib/csv';
import { computeGoalProgress } from '../store/useAlerts';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const CAT_COLORS = {
  Electronics: '#52796f', Apparel: '#8b5a2b', Food: '#4e9463',
  Home: '#5c7f6e', Sports: '#8a7a5a', General: '#68816c',
};
const CATEGORIES = ['Electronics', 'Apparel', 'Food', 'Home', 'Sports', 'General'];
const STATUSES = ['Active', 'Pending', 'Discontinued'];
const PRESET_LABELS = { month: 'This Month', quarter: 'This Quarter', year: 'This Year', all: 'All Time', custom: 'Custom Range' };

export default function DashboardPage() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const { entries, inventory, goals, addEntry, deleteEntry, setEntries, addGoal, deleteGoal,
          filterByPeriod: filterPeriod, recordActivity } = useDb();
  const { currency, nairaPerUSD } = useSettings();
  const addToast = useToast((s) => s.addToast);
  const { open: openModal } = useModal();

  const fmt = useCallback((n) => formatMoney(n, currency, nairaPerUSD), [currency, nairaPerUSD]);

  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState(-1);
  const [filterCat, setFilterCat] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => { document.title = 'Overview — SaleStew'; }, []);

  if (!session) { navigate('/login'); return null; }

  const today = new Date().toISOString().slice(0, 10);

  function getFiltered() {
    return (filterPeriod || filterByPeriodLocal)(entries, period, customFrom, customTo) || [];
  }

  function filterByPeriodLocal(arr, p, from, to) {
    const now = new Date();
    return (arr || []).filter((e) => {
      const dStr = e.date || e.createdAt;
      if (!dStr) return true;
      const d = new Date(dStr);
      if (p === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (p === 'quarter') return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear();
      if (p === 'year') return d.getFullYear() === now.getFullYear();
      if (p === 'custom' && from && to) return dStr >= from && dStr <= to;
      return true;
    });
  }

  const filtered = getFiltered();

  const visible = filtered
    .filter((e) => {
      const pName = (e.productName || e.product || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();
      const q = (searchQ || '').toLowerCase();
      if (filterCat !== 'all' && e.category !== filterCat) return false;
      if (q && !pName.includes(q) && !cat.includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const getVal = (x, col) => {
        if (col === 'product') return x.productName || x.product || '';
        if (col === 'units') return Number(x.qty ?? x.units) || 0;
        if (col === 'revenue') return Number(x.revenue) || 0;
        if (col === 'margin') return x.revenue > 0 ? Math.round(((x.profit ?? 0) / x.revenue) * 100) : (x.margin ?? 0);
        if (col === 'date') return x.date || x.createdAt || '';
        return x[col] || '';
      };
      const av = getVal(a, sortCol);
      const bv = getVal(b, sortCol);
      return typeof av === 'string' ? sortDir * av.localeCompare(bv) : sortDir * (av - bv);
    });

  const totalRev = filtered.reduce((s, e) => s + (Number(e.revenue) || 0), 0);
  const totalUnits = filtered.reduce((s, e) => s + (Number(e.qty ?? e.units) || 0), 0);
  const aov = totalUnits ? totalRev / totalUnits : 0;
  const prods = new Set(filtered.map((e) => e.productName || e.product || 'Unknown')).size;

  // Chart data
  const byDate = {};
  filtered.forEach((e) => {
    const dStr = e.date || e.createdAt || '';
    const k = dStr.slice(0, 7) || '2026-10';
    byDate[k] = (byDate[k] || 0) + (Number(e.revenue) || 0);
  });
  const dKeys = Object.keys(byDate).sort();

  const byCat = {};
  filtered.forEach((e) => {
    const k = e.category || 'General';
    byCat[k] = (byCat[k] || 0) + (Number(e.revenue) || 0);
  });
  const catKeys = Object.keys(byCat);

  const byDU = {};
  filtered.forEach((e) => {
    const dStr = e.date || e.createdAt || '';
    const k = dStr.slice(0, 7) || '2026-10';
    byDU[k] = (byDU[k] || 0) + (Number(e.qty ?? e.units) || 0);
  });
  const tKeys = Object.keys(byDU).sort();

  const chartAxisStyle = {
    ticks: { color: '#445842', font: { family: 'DM Mono', size: 10 } },
    grid: { color: 'rgba(26,42,26,0.4)' },
  };

  // Leaderboard
  const byP = {};
  filtered.forEach((e) => {
    const pName = e.productName || e.product || 'Unknown';
    if (!byP[pName]) byP[pName] = { rev: 0, cat: e.category || 'General' };
    byP[pName].rev += Number(e.revenue) || 0;
  });
  const leaderboard = Object.entries(byP).sort((a, b) => b[1].rev - a[1].rev).slice(0, 7);
  const maxRev = leaderboard[0]?.[1]?.rev || 1;

  function handleSort(col) {
    setSortDir(sortCol === col ? sortDir * -1 : 1);
    setSortCol(col);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openAddSaleModal() {
    const inv = inventory;
    let product = '', category = '', units = '', revenue = '', margin = '', status = 'Active', date = today;
    const content = (
      <AddSaleForm
        inventory={inv}
        currency={currency}
        nairaPerUSD={nairaPerUSD}
        onChange={(f, v) => {
          if (f === 'product') product = v;
          if (f === 'category') category = v;
          if (f === 'units') units = v;
          if (f === 'revenue') revenue = v;
          if (f === 'margin') margin = v;
          if (f === 'status') status = v;
          if (f === 'date') date = v;
        }}
      />
    );
    openModal({
      title: 'Record Sale',
      content,
      saveLabel: 'Save Sale',
      onSave: async () => {
        // Read values from DOM since we're using uncontrolled-ish approach
        const pEl = document.getElementById('ms-product');
        const cEl = document.getElementById('ms-category');
        const uEl = document.getElementById('ms-units');
        const rEl = document.getElementById('ms-revenue');
        const mEl = document.getElementById('ms-margin');
        const sEl = document.getElementById('ms-status');
        const dEl = document.getElementById('ms-date');
        if (!pEl || !dEl) return;
        const pv = pEl.value, dv = dEl.value;
        const uv = parseInt(uEl.value) || 0;
        const rv = toNaira(rEl.value, currency, nairaPerUSD);
        const mv = parseFloat(mEl.value) || 0;
        const sv = sEl.value;
        const cv = cEl.value || 'General';
        if (!pv || !dv || uv < 1) throw new Error('Fill in all required fields.');
        addEntry({
          date: dv,
          productName: pv,
          product: pv,
          category: cv,
          qty: uv,
          units: uv,
          revenue: rv,
          profit: Math.round(rv * (mv / 100)),
          margin: mv,
          status: sv,
          trend: Math.floor(Math.random() * 30) - 10,
          supplierId: null,
        });
        // Deduct from inventory
        const iIdx = useDb.getState().inventory.findIndex(i => (i.name || i.product) === pv);
        if (iIdx > -1) {
          const inv2 = [...useDb.getState().inventory];
          inv2[iIdx] = { ...inv2[iIdx], stock: Math.max(0, inv2[iIdx].stock - uv) };
          useDb.getState().setInventory(inv2);
        }
        recordActivity('sale_add', `${pv} — ${fmt(rv)}`, session.username, 'dashboard');
        addToast({ msg: 'Sale recorded.', type: 'success' });
      },
    });
  }

  function openAddGoalModal() {
    openModal({
      title: 'Add Goal',
      size: 'sm',
      content: <AddGoalForm />,
      saveLabel: 'Add Goal',
      onSave: async () => {
        const label = document.getElementById('g-label')?.value.trim();
        const metric = document.getElementById('g-metric')?.value;
        const per = document.getElementById('g-period')?.value;
        const cat = document.getElementById('g-cat')?.value;
        const target = parseFloat(document.getElementById('g-target')?.value);
        if (!label || !(target > 0)) throw new Error('Label and target > 0 required.');
        addGoal({ label, metric, period: per, category: cat, target, createdAt: Date.now() });
        recordActivity('goal_add', label, session.username, 'dashboard');
        addToast({ msg: 'Goal added!', type: 'success' });
      },
    });
  }

  function handleDeleteEntry(id) {
    const snap = [...entries];
    const deleted = snap.find(e => e.id === id);
    setEntries(snap.filter(e => e.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    recordActivity('sale_delete', deleted?.product || `id:${id}`, session.username, 'dashboard');
    addToast({
      msg: 'Entry removed.',
      type: 'warn',
      actions: [{ label: 'Undo', onClick: () => { setEntries(snap); } }],
    });
  }

  function handleBulkDelete() {
    if (!selected.size) return;
    const snap = [...entries];
    setEntries(snap.filter(e => !selected.has(e.id)));
    const n = selected.size;
    setSelected(new Set());
    recordActivity('sale_delete', `${n} entries (bulk)`, session.username, 'dashboard');
    addToast({
      msg: `${n} entries deleted.`,
      type: 'warn',
      actions: [{ label: 'Undo', onClick: () => setEntries(snap) }],
    });
  }

  function handleBulkExport() {
    const rows = entries.filter(e => selected.has(e.id));
    if (!rows.length) return;
    const headers = ['Date', 'Product', 'Category', 'Units', 'Revenue (NGN)', 'Margin%', 'Status', 'Trend%'];
    csvDownload('salestew_export.csv', csvStringify([headers, ...rows.map(e => [e.date, e.product, e.category, e.units, e.revenue, e.margin, e.status, e.trend])]));
    addToast({ msg: `${rows.length} rows exported.`, type: 'success' });
  }

  return (
    <main className="page">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Sales Overview</h1>
          <p className="page-header__sub">// product performance dashboard</p>
        </div>
        <div className="page-header__controls">
          {/* Date presets */}
          <div className="date-picker-wrap">
            <div className="date-picker-presets">
              {Object.entries(PRESET_LABELS).map(([p, lbl]) => (
                <button key={p} className={`date-preset${period === p ? ' is-active' : ''}`}
                  onClick={() => { setPeriod(p); }}>
                  {lbl}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input className="form-input" type="date" style={{ width: 'auto' }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                <span style={{ color: 'var(--text-3)' }}>→</span>
                <input className="form-input" type="date" style={{ width: 'auto' }} value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm flex items-center gap-1.5" onClick={() => window.print()}>
            <Printer size={13} />
            <span>Print</span>
          </button>
          <button className="btn btn-primary flex items-center gap-1.5" onClick={openAddSaleModal}>
            <Plus size={14} />
            <span>Add Sale</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="stats-strip">
        {[
          ['Total Revenue', fmt(totalRev), 'var(--green)'],
          ['Units Sold', formatNum(totalUnits), 'var(--orange)'],
          ['Avg Order Value', fmt(aov), 'var(--purple)'],
          ['Products', prods, 'var(--green)'],
        ].map(([label, value, color]) => (
          <div key={label} className="stat-card">
            <div className="stat-card__accent" style={{ background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
            <p className="stat-card__label">{label}</p>
            <p className="stat-card__value" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Goals panel */}
      {(goals.length > 0 || session.role === 'admin') && (
        <section className="panel" style={{ marginBottom: '1.75rem' }}>
          <div className="panel__header">
            <span className="panel__title">Goals &amp; Targets</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="panel__action" style={{ color: 'var(--text-3)' }}>
                {goals.filter(g => {
                  const { pct } = computeGoalProgress(g, entries);
                  return pct >= 100;
                }).length}/{goals.length} achieved
              </span>
              {session.role === 'admin' && (
                <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={openAddGoalModal}>
                  <Plus size={12} />
                  <span>Add Goal</span>
                </button>
              )}
            </div>
          </div>
          {goals.length === 0 ? (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', padding: '0.5rem 0' }}>
              No goals yet. Click "Add Goal" to set your first target.
            </div>
          ) : (
            <div className="goals-grid">
              {goals.map(g => {
                const { actual, pct, formattedActual, formattedTarget } = computeGoalProgress(g, entries, currency, nairaPerUSD);
                const displayPct = Math.min(100, pct);
                const barColor = displayPct >= 100 ? 'var(--green)' : displayPct >= 60 ? 'var(--orange)' : 'var(--down)';
                const IconComponent = displayPct >= 100 ? Trophy : displayPct >= 60 ? TrendingUp : Target;
                return (
                  <div key={g.id} className={`goal-card${displayPct >= 100 ? ' goal-card--done' : ''}`}>
                    <div className="goal-card__top">
                      <span className="goal-card__icon">
                        <IconComponent size={18} style={{ color: barColor }} />
                      </span>
                      <div className="goal-card__info">
                        <div className="goal-card__label">{g.label}</div>
                        <div className="goal-card__meta">{g.category === 'all' ? 'All categories' : g.category} · {PRESET_LABELS[g.period] || g.period}</div>
                      </div>
                      {session.role === 'admin' && (
                        <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={() => {
                          const snap = [...goals];
                          deleteGoal(g.id);
                          recordActivity('goal_delete', g.label, session.username, 'dashboard');
                          addToast({ msg: 'Goal removed.', type: 'warn', actions: [{ label: 'Undo', onClick: () => useDb.getState().setGoals(snap) }] });
                        }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <div className="goal-card__values">
                      <span className="goal-card__actual" style={{ color: barColor }}>{formattedActual}</span>
                      <span className="goal-card__target">/ {formattedTarget}</span>
                      <span className="goal-card__pct flex items-center gap-0.5" style={{ color: barColor, marginLeft: 'auto' }}>
                        {pct >= 100 && <Check size={11} />}
                        <span>{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="progress" style={{ height: 6, marginTop: '0.4rem' }}>
                      <div className="progress__fill" style={{ width: `${displayPct}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Charts row 1 */}
      <div className="main-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Revenue by Period</span>
            <span className="panel__action" style={{ color: 'var(--green)' }}>{fmt(totalRev)}</span>
          </div>
          <div style={{ height: 200 }}>
            {dKeys.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.75rem' }}>No sales data</div>
            ) : (
              <Bar
                data={{
                  labels: dKeys.map(k => { const parts = (k || '').split('-'); const y = +parts[0] || 2026; const m = +parts[1] || 1; return new Date(y, m - 1).toLocaleString('en-NG', { month: 'short', year: '2-digit' }); }),
                  datasets: [{ label: 'Revenue', data: dKeys.map(k => (byDate[k] || 0) / 1000), backgroundColor: 'rgba(78,148,99,0.65)', borderColor: '#4e9463', borderWidth: 1, borderRadius: 2 }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw * 1000) } } },
                  scales: { x: chartAxisStyle, y: { ...chartAxisStyle, ticks: { ...chartAxisStyle.ticks, callback: v => currencySymbol(currency) + (v >= 1000 ? (v / 1000).toFixed(0) + 'M' : v + 'K') } } },
                }}
              />
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Top Products</span>
            <span className="panel__action" style={{ color: 'var(--text-3)' }}>by revenue</span>
          </div>
          {leaderboard.length === 0 ? (
            <div className="empty-state"><div className="empty-state__icon flex justify-center"><BarChart3 size={32} className="opacity-50" /></div><div className="empty-state__text">No data for this period.</div></div>
          ) : (
            leaderboard.map(([name, { rev, cat }], i) => {
              const color = CAT_COLORS[cat] || '#748e70';
              const w = Math.round(rev / maxRev * 100);
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(26,42,26,0.5)' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.65rem', color: i === 0 ? 'var(--green)' : 'var(--text-3)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span className="cat-dot" style={{ background: color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>{cat}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--green)' }}>{fmt(rev)}</div>
                    <div style={{ width: 60, height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
                      <div style={{ height: '100%', width: `${w}%`, background: 'var(--green-dk)' }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="main-grid main-grid--3-1" style={{ marginBottom: '1.75rem' }}>
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Monthly Trend</span>
            <span className="panel__action" style={{ color: 'var(--text-3)' }}>units sold</span>
          </div>
          <div style={{ height: 220 }}>
            {tKeys.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.75rem' }}>No trend data</div>
            ) : (
              <Line
                data={{
                  labels: tKeys.map(k => { const parts = (k || '').split('-'); const y = +parts[0] || 2026; const m = +parts[1] || 1; return new Date(y, m - 1).toLocaleString('en-NG', { month: 'short', year: '2-digit' }); }),
                  datasets: [{ label: 'Units', data: tKeys.map(k => byDU[k] || 0), borderColor: '#5c7f6e', backgroundColor: 'rgba(92,127,110,0.12)', pointBackgroundColor: '#5c7f6e', fill: true, tension: 0.4, pointRadius: 4 }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: chartAxisStyle, y: chartAxisStyle } }}
              />
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel__header"><span className="panel__title">Sales by Category</span></div>
          <div style={{ height: 220 }}>
            {catKeys.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.75rem' }}>No category data</div>
            ) : (
              <Doughnut
                data={{
                  labels: catKeys,
                  datasets: [{ data: catKeys.map(k => byCat[k] || 0), backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#748e70'), borderColor: 'var(--bg)', borderWidth: 3 }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#748e70', font: { family: 'DM Mono', size: 10 }, padding: 12 } }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)}` } } } }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <section className="panel" style={{ marginBottom: '1.75rem' }}>
        <div className="table-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="panel__title">Recent Sales</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>{visible.length} records</span>
            {session.role === 'admin' && <span style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>· double-click cell to edit</span>}
          </div>
          <div className="table-controls__right">
            <input className="search-input" type="text" placeholder="Search…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            <div className="filter-tabs">
              {['all', ...CATEGORIES.slice(0, 5)].map(cat => (
                <button key={cat} className={`filter-tab${filterCat === cat ? ' is-active' : ''}`}
                  onClick={() => setFilterCat(cat)}>{cat === 'all' ? 'All' : cat}</button>
              ))}
            </div>
            {session.role === 'admin' && selected.size > 0 && (
              <div className="bulk-bar">
                <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{selected.size} selected</span>
                <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={handleBulkExport}>
                  <Download size={12} />
                  <span>Export</span>
                </button>
                <button className="btn btn-danger flex items-center gap-1" onClick={handleBulkDelete}>
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {session.role === 'admin' && (
                  <th style={{ width: 32 }}>
                    <input type="checkbox" style={{ accentColor: 'var(--green)' }}
                      checked={visible.length > 0 && visible.every(e => selected.has(e.id))}
                      onChange={e => {
                        if (e.target.checked) setSelected(new Set(visible.map(x => x.id)));
                        else setSelected(new Set());
                      }} />
                  </th>
                )}
                {[['date', 'Date'], ['product', 'Product'], ['category', 'Category'], ['units', 'Units'], ['revenue', 'Revenue'], ['margin', 'Margin'], [null, 'Status'], ['trend', 'Trend']].map(([col, lbl]) => (
                  <th key={lbl} className={col && sortCol === col ? 'sorted' : ''} onClick={() => col && handleSort(col)}>
                    {lbl}{col ? ' ↕' : ''}
                  </th>
                ))}
                {session.role === 'admin' && <th />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={session.role === 'admin' ? 11 : 9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>No records match your filter.</td></tr>
              ) : visible.map(e => {
                const color = CAT_COLORS[e.category] || '#748e70';
                const bc = { Active: 'green', Pending: 'orange', Discontinued: 'red' }[e.status] || 'info';
                const tc = e.trend >= 0 ? 'var(--up)' : 'var(--down)';
                return (
                  <tr key={e.id} style={selected.has(e.id) ? { background: 'rgba(78,148,99,0.06)' } : {}}>
                    {session.role === 'admin' && (
                      <td><input type="checkbox" style={{ accentColor: 'var(--green)' }} checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                    )}
                    <EditableCell entry={e} field="date" isAdmin={session.role === 'admin'} fmt={fmt} currency={currency} nairaPerUSD={nairaPerUSD} />
                    <td style={{ fontWeight: 500 }}>{e.productName || e.product || 'Item'}</td>
                    <td><span className="cat-dot" style={{ background: color }} />{e.category || 'General'}</td>
                    <EditableCell entry={e} field="units" isAdmin={session.role === 'admin'} fmt={fmt} currency={currency} nairaPerUSD={nairaPerUSD} />
                    <EditableCell entry={e} field="revenue" isAdmin={session.role === 'admin'} fmt={fmt} currency={currency} nairaPerUSD={nairaPerUSD} />
                    <EditableCell entry={e} field="margin" isAdmin={session.role === 'admin'} fmt={fmt} currency={currency} nairaPerUSD={nairaPerUSD} />
                    <EditableCell entry={e} field="status" isAdmin={session.role === 'admin'} fmt={fmt} currency={currency} nairaPerUSD={nairaPerUSD} />
                    <EditableCell entry={e} field="trend" isAdmin={session.role === 'admin'} fmt={fmt} currency={currency} nairaPerUSD={nairaPerUSD} />
                    {session.role === 'admin' && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger p-1"
                          onClick={() => handleDeleteEntry(e.id)}
                          aria-label="Delete entry"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

// ── Inline editable cell ─────────────────────────────────
function EditableCell({ entry, field, isAdmin, fmt, currency, nairaPerUSD }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const updateEntry = useDb((s) => s.updateEntry);
  const addToast = useToast((s) => s.addToast);
  const inputRef = useRef();

  const SPEC = {
    date:    { type: 'date',   label: 'Date' },
    units:   { type: 'number', label: 'Units', min: 1 },
    revenue: { type: 'number', label: 'Revenue', min: 0 },
    margin:  { type: 'number', label: 'Margin %', min: 0, max: 100 },
    status:  { type: 'select', label: 'Status', options: STATUSES },
    trend:   { type: 'number', label: 'Trend %', min: -100, max: 100 },
  };

  const spec = SPEC[field];

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) inputRef.current.select();
    }
  }, [editing]);

  if (!spec) return <td>{renderValue(entry, field, fmt, currency, nairaPerUSD)}</td>;

  function startEdit() {
    if (!isAdmin) return;
    let initVal = entry[field];
    if (field === 'revenue' && currency === 'USD') initVal = (entry.revenue / nairaPerUSD).toFixed(2);
    setVal(String(initVal));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    let newVal = val;
    if (spec.type === 'number') {
      newVal = parseFloat(val);
      if (isNaN(newVal)) return;
      if (spec.min != null) newVal = Math.max(spec.min, newVal);
      if (spec.max != null) newVal = Math.min(spec.max, newVal);
      newVal = Math.round(newVal * 100) / 100;
    }
    if (field === 'revenue' && currency === 'USD') newVal = Math.round(parseFloat(val) * nairaPerUSD);
    if (String(newVal) === String(entry[field])) return;
    const snap = { ...entry };
    updateEntry(entry.id, { [field]: newVal });
    addToast({
      msg: `${spec.label} updated.`, type: 'success',
      actions: [{ label: 'Undo', onClick: () => updateEntry(entry.id, { [field]: snap[field] }) }],
    });
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.removeEventListener('blur', commit); commit(); }
    if (e.key === 'Escape') { setEditing(false); }
  }

  if (editing) {
    return (
      <td className="is-editing">
        {spec.type === 'select' ? (
          <select ref={inputRef} className="inline-edit__input" value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={onKey}>
            {spec.options.map(o => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <input ref={inputRef} type={spec.type} className="inline-edit__input" value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={onKey} min={spec.min} max={spec.max} />
        )}
      </td>
    );
  }

  return (
    <td className={isAdmin ? 'editable-cell' : ''} onDoubleClick={startEdit}>
      {renderValue(entry, field, fmt, currency, nairaPerUSD)}
    </td>
  );
}

function renderValue(entry, field, fmt, currency, nairaPerUSD) {
  if (field === 'date') return <span style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{entry.date || entry.createdAt?.slice(0, 10)}</span>;
  if (field === 'units') return formatNum(entry.qty ?? entry.units ?? 0);
  if (field === 'revenue') return <span style={{ color: 'var(--green)' }}>{fmt(Number(entry.revenue) || 0)}</span>;
  if (field === 'margin') {
    const margin = entry.revenue > 0 ? Math.round(((Number(entry.profit) || 0) / entry.revenue) * 100) : (entry.margin ?? 0);
    return `${margin}%`;
  }
  if (field === 'status') {
    const st = entry.status || 'Active';
    const bc = { Active: 'green', Pending: 'orange', Discontinued: 'red' }[st] || 'info';
    return <span className={`badge badge-${bc}`}>{st}</span>;
  }
  if (field === 'trend') {
    const tr = entry.trend ?? 5;
    const tc = tr >= 0 ? 'var(--up)' : 'var(--down)';
    return (
      <span className="inline-flex items-center gap-1" style={{ color: tc }}>
        {tr >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{Math.abs(tr)}%</span>
      </span>
    );
  }
  return entry[field];
}

// ── Add Sale Form ─────────────────────────────────────────
function AddSaleForm({ inventory, currency, nairaPerUSD }) {
  const [selProd, setSelProd] = useState('');
  const [cat, setCat] = useState('');

  function handleProductChange(e) {
    const opt = e.target.selectedOptions[0];
    setSelProd(e.target.value);
    setCat(opt?.dataset.cat || '');
    const price = Number(opt?.dataset.price) || 0;
    const revEl = document.getElementById('ms-revenue');
    if (revEl) revEl.value = currency === 'USD' ? (price / nairaPerUSD).toFixed(2) : price;
  }

  return (
    <div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Product</label>
          <select className="form-input" id="ms-product" value={selProd} onChange={handleProductChange}>
            <option value="">— select —</option>
            {inventory.map(i => (
              <option key={i.id} value={i.name || i.product} data-cat={i.category} data-price={i.sellingPrice || i.selling}>
                {i.name || i.product}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <input className="form-input" id="ms-category" type="text" readOnly placeholder="auto-filled" value={cat} onChange={() => {}} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Units Sold</label>
          <input className="form-input" id="ms-units" type="number" placeholder="0" min="1" />
        </div>
        <div className="form-group">
          <label className="form-label">Revenue ({currency === 'USD' ? '$' : '₦'})</label>
          <input className="form-input" id="ms-revenue" type="number" placeholder="0.00" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Margin (%)</label>
          <input className="form-input" id="ms-margin" type="number" placeholder="0" min="0" max="100" />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" id="ms-status">
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Date</label>
        <input className="form-input" id="ms-date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
    </div>
  );
}

// ── Add Goal Form ─────────────────────────────────────────
function AddGoalForm() {
  return (
    <div>
      <div className="form-group">
        <label className="form-label">Goal Label *</label>
        <input className="form-input" id="g-label" placeholder="e.g. Hit ₦10M revenue this month" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Metric</label>
          <select className="form-input" id="g-metric">
            <option value="revenue">Revenue</option>
            <option value="units">Units Sold</option>
            <option value="margin">Avg Margin (%)</option>
            <option value="products">Products Tracked</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Period</label>
          <select className="form-input" id="g-period">
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-input" id="g-cat">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Target Value *</label>
          <input className="form-input" id="g-target" type="number" min="0" placeholder="0" />
        </div>
      </div>
    </div>
  );
}

