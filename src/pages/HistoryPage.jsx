import { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, RotateCcw, Eye } from 'lucide-react';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import useToast from '../store/useToast';
import { useModal } from '../components/Modal';
import { formatMoney, formatDate, formatNum } from '../lib/format';
import { csvStringify, csvDownload } from '../lib/csv';

export default function HistoryPage() {
  const session = useAuth((s) => s.session);
  const { entries, deleteEntry, setEntries, recordActivity } = useDb();
  const { currency, nairaPerUSD } = useSettings();
  const addToast = useToast((s) => s.addToast);
  const { open: openModal } = useModal();

  useEffect(() => {
    document.title = 'History — SaleStew';
  }, []);

  const fmt = useCallback(
    (n) => formatMoney(n, currency, nairaPerUSD),
    [currency, nairaPerUSD]
  );

  // Default date range: 6 months ago to today
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [searchQ, setSearchQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState(-1);

  // Quick preset handlers
  const applyPreset = (months) => {
    if (months === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    setDateFrom(d.toISOString().slice(0, 10));
    setDateTo(today);
  };

  const resetFilters = () => {
    setDateFrom(defaultFrom);
    setDateTo(today);
    setSearchQ('');
    setCategoryFilter('all');
  };

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const entryDate = (e.date || e.createdAt || '').slice(0, 10);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;

      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const pName = (e.productName || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        const cust = (e.customer || '').toLowerCase();
        const pm = (e.paymentMethod || '').toLowerCase();
        const notes = (e.notes || '').toLowerCase();
        if (!pName.includes(q) && !cat.includes(q) && !cust.includes(q) && !pm.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [entries, dateFrom, dateTo, categoryFilter, searchQ]);

  // Sorted entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];

      if (sortCol === 'date') {
        va = a.date || a.createdAt || '';
        vb = b.date || b.createdAt || '';
      } else if (sortCol === 'margin') {
        const revA = Number(a.revenue) || 0;
        const profA = Number(a.profit) || 0;
        const revB = Number(b.revenue) || 0;
        const profB = Number(b.profit) || 0;
        va = revA > 0 ? profA / revA : 0;
        vb = revB > 0 ? profB / revB : 0;
      }

      if (typeof va === 'string') {
        return sortDir * va.localeCompare(vb || '');
      }
      return sortDir * ((Number(va) || 0) - (Number(vb) || 0));
    });
  }, [filteredEntries, sortCol, sortDir]);

  // Metrics summary
  const summary = useMemo(() => {
    let totalRev = 0;
    let totalProf = 0;
    let totalUnits = 0;
    filteredEntries.forEach((e) => {
      totalRev += Number(e.revenue) || 0;
      totalProf += Number(e.profit) || 0;
      totalUnits += Number(e.qty) || 0;
    });
    const avgMargin = totalRev > 0 ? Math.round((totalProf / totalRev) * 100) : 0;
    return {
      count: filteredEntries.length,
      totalRev,
      totalProf,
      totalUnits,
      avgMargin,
    };
  }, [filteredEntries]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => -d);
    else {
      setSortCol(col);
      setSortDir(col === 'date' ? -1 : 1);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (sortedEntries.length === 0) {
      addToast({ msg: 'No transactions to export', type: 'error' });
      return;
    }
    const rows = sortedEntries.map((e) => ({
      ID: e.id,
      Date: e.date || e.createdAt?.slice(0, 10),
      Product: e.productName,
      Category: e.category || 'General',
      Quantity: e.qty,
      'Unit Price': e.unitPrice,
      'Cost Price': e.cost,
      Revenue: e.revenue,
      Profit: e.profit,
      MarginPct: e.revenue > 0 ? Math.round(((e.profit || 0) / e.revenue) * 100) : 0,
      Customer: e.customer || '',
      'Payment Method': e.paymentMethod || '',
      Notes: e.notes || '',
    }));
    const csv = csvStringify(rows);
    csvDownload(csv, `sales_history_${dateFrom || 'all'}_to_${dateTo || 'now'}.csv`);
    addToast({ msg: 'Sales history exported', type: 'success' });
    recordActivity?.('history_export', `Exported ${rows.length} history records`, session?.username, 'History');
  };

  // View sale details
  const viewDetail = (e) => {
    const margin = e.revenue > 0 ? Math.round(((e.profit || 0) / e.revenue) * 100) : 0;
    openModal({
      title: `Sale Details: ${e.productName}`,
      size: '',
      content: (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Transaction ID</span>
            <span className="text-[var(--text)] font-bold">#{e.id}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Date</span>
            <span className="text-[var(--text)]">{formatDate(e.date || e.createdAt)}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Category</span>
            <span className="text-[var(--text)]">{e.category || 'General'}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Units Sold</span>
            <span className="text-[var(--text)] font-bold">{formatNum(e.qty)}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Unit Price</span>
            <span className="text-[var(--text)]">{fmt(e.unitPrice)}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Total Revenue</span>
            <span className="text-[var(--green)] font-bold">{fmt(e.revenue)}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Gross Profit</span>
            <span className="text-[var(--green-lt)] font-bold">{fmt(e.profit)} ({margin}%)</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Customer</span>
            <span className="text-[var(--text)]">{e.customer || 'Walk-in'}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-3)]">Payment Method</span>
            <span className="text-[var(--text)]">{e.paymentMethod || 'Cash'}</span>
          </div>
          {e.notes && (
            <div className="pt-1">
              <span className="text-[var(--text-3)] block mb-1">Notes</span>
              <p className="p-2 bg-[var(--bg2)] rounded text-[var(--text-2)]">{e.notes}</p>
            </div>
          )}
        </div>
      ),
    });
  };

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Sales History</h1>
          <p className="page-sub text-xs text-[var(--text-2)]">// comprehensive ledger of past transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="panel space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-3)] font-mono">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input text-xs py-1 px-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-3)] font-mono">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input text-xs py-1 px-2"
            />
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => applyPreset(1)} className="btn btn-secondary btn-sm text-[11px] py-1 px-2">1M</button>
            <button onClick={() => applyPreset(3)} className="btn btn-secondary btn-sm text-[11px] py-1 px-2">3M</button>
            <button onClick={() => applyPreset(6)} className="btn btn-secondary btn-sm text-[11px] py-1 px-2">6M</button>
            <button onClick={() => applyPreset(12)} className="btn btn-secondary btn-sm text-[11px] py-1 px-2">1Y</button>
            <button onClick={() => applyPreset('all')} className="btn btn-secondary btn-sm text-[11px] py-1 px-2">All</button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select text-xs py-1 px-2"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search product, customer, payment..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="form-input text-xs py-1 px-3 w-48 sm:w-60"
            />

            <button onClick={resetFilters} className="btn btn-secondary btn-sm p-1.5" title="Reset Filters" aria-label="Reset Filters">
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards for Filtered Range */}
      <div className="stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-card__lbl">Transactions</div>
          <div className="stat-card__val font-mono">{formatNum(summary.count)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">{formatNum(summary.totalUnits)} units sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Gross Revenue</div>
          <div className="stat-card__val font-mono">{fmt(summary.totalRev)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">in selected range</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Net Profit</div>
          <div className="stat-card__val font-mono text-[var(--green)]">{fmt(summary.totalProf)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">gross revenue minus cost</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Avg Margin</div>
          <div className="stat-card__val font-mono">{summary.avgMargin}%</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">profit / revenue</div>
        </div>
      </div>

      {/* History Ledger Table */}
      <div className="panel space-y-4">
        <div className="table-wrap overflow-x-auto">
          <table className="data-table w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-3)] font-mono">
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('date')}>
                  Date {sortCol === 'date' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('productName')}>
                  Product {sortCol === 'productName' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('category')}>
                  Category {sortCol === 'category' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('qty')}>
                  Qty {sortCol === 'qty' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('unitPrice')}>
                  Price {sortCol === 'unitPrice' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('revenue')}>
                  Revenue {sortCol === 'revenue' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('profit')}>
                  Profit {sortCol === 'profit' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('margin')}>
                  Margin {sortCol === 'margin' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('customer')}>
                  Customer {sortCol === 'customer' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('paymentMethod')}>
                  Payment {sortCol === 'paymentMethod' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-8 text-center text-[var(--text-3)] font-sans">
                    No transactions recorded for the selected period.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((e) => {
                  const rev = Number(e.revenue) || 0;
                  const prof = Number(e.profit) || 0;
                  const marginPct = rev > 0 ? Math.round((prof / rev) * 100) : 0;
                  return (
                    <tr key={e.id} className="hover:bg-[var(--card-h)] transition-colors">
                      <td className="py-2.5 px-3 text-[var(--text-2)] whitespace-nowrap">
                        {formatDate(e.date || e.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-[var(--text)]">
                        {e.productName}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-2)]">{e.category || 'General'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--text)]">
                        {formatNum(e.qty)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--text-2)]">{fmt(e.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">{fmt(rev)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-[var(--green)]">{fmt(prof)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          marginPct >= 30 ? 'bg-[rgba(78,148,99,0.15)] text-[var(--green)]' :
                          marginPct >= 15 ? 'bg-[rgba(184,98,42,0.15)] text-[var(--orange)]' :
                          'bg-[rgba(160,72,72,0.15)] text-[var(--down)]'
                        }`}>
                          {marginPct}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-2)]">{e.customer || 'Walk-in'}</td>
                      <td className="py-2.5 px-3 text-[var(--text-3)]">{e.paymentMethod || 'Cash'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => viewDetail(e)}
                          className="p-1 rounded-md bg-[var(--bg2)] hover:bg-[var(--bg3)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors inline-flex items-center justify-center"
                          title="View sale details"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--text-3)] font-mono">
          <span>{sortedEntries.length} records in view</span>
          <span>Ledger up to date</span>
        </div>
      </div>
    </main>
  );
}

