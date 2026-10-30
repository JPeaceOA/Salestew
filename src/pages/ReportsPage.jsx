import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import useToast from '../store/useToast';
import { formatMoney, formatNum, formatDate } from '../lib/format';
import { csvStringify, csvDownload } from '../lib/csv';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ReportsPage() {
  const session = useAuth((s) => s.session);
  const { entries, recordActivity } = useDb();
  const { currency, nairaPerUSD } = useSettings();
  const addToast = useToast((s) => s.addToast);

  useEffect(() => {
    document.title = 'Reports — SaleStew';
  }, []);

  const fmt = useCallback(
    (n) => formatMoney(n, currency, nairaPerUSD),
    [currency, nairaPerUSD]
  );

  const [reportType, setReportType] = useState('monthly');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Custom date range inputs
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [customFrom, setCustomFrom] = useState(defaultFrom);
  const [customTo, setCustomTo] = useState(today);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return ['All', ...Array.from(set)];
  }, [entries]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    const now = new Date();

    return entries.filter((e) => {
      const entryDate = new Date(e.date || e.createdAt);

      if (selectedCategory !== 'All' && e.category !== selectedCategory) {
        return false;
      }

      if (reportType === 'daily') {
        const isToday =
          entryDate.getDate() === now.getDate() &&
          entryDate.getMonth() === now.getMonth() &&
          entryDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (reportType === 'monthly') {
        const isThisMonth =
          entryDate.getMonth() === now.getMonth() &&
          entryDate.getFullYear() === now.getFullYear();
        if (!isThisMonth) return false;
      } else if (reportType === 'quarterly') {
        const qNow = Math.floor(now.getMonth() / 3);
        const qEntry = Math.floor(entryDate.getMonth() / 3);
        const isThisQuarter =
          qNow === qEntry && entryDate.getFullYear() === now.getFullYear();
        if (!isThisQuarter) return false;
      } else if (reportType === 'custom') {
        const dStr = (e.date || e.createdAt || '').slice(0, 10);
        if (customFrom && dStr < customFrom) return false;
        if (customTo && dStr > customTo) return false;
      }

      return true;
    });
  }, [entries, reportType, selectedCategory, customFrom, customTo]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalUnits = 0;
    const productSalesMap = {};

    filteredData.forEach((e) => {
      const rev = Number(e.revenue) || 0;
      const prof = Number(e.profit) || 0;
      const units = Number(e.qty) || 0;

      totalRevenue += rev;
      totalProfit += prof;
      totalUnits += units;

      const pName = e.productName || 'Unknown';
      if (!productSalesMap[pName]) {
        productSalesMap[pName] = { revenue: 0, units: 0 };
      }
      productSalesMap[pName].revenue += rev;
      productSalesMap[pName].units += units;
    });

    const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    let topProduct = 'None';
    let maxRev = 0;
    Object.entries(productSalesMap).forEach(([name, data]) => {
      if (data.revenue > maxRev) {
        maxRev = data.revenue;
        topProduct = name;
      }
    });

    return {
      entriesCount: filteredData.length,
      totalRevenue,
      totalProfit,
      totalUnits,
      avgMargin,
      topProduct,
    };
  }, [filteredData]);

  // Chart data: Group by category or by date
  const chartData = useMemo(() => {
    const groupMap = {};
    filteredData.forEach((e) => {
      const key = e.category || 'General';
      groupMap[key] = (groupMap[key] || 0) + (Number(e.revenue) || 0);
    });

    const labels = Object.keys(groupMap);
    const values = Object.values(groupMap).map((v) =>
      currency === 'USD' ? v / nairaPerUSD : v
    );

    return {
      labels,
      datasets: [
        {
          label: `Revenue (${currency})`,
          data: values,
          backgroundColor: '#4e9463',
          borderColor: '#6db882',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [filteredData, currency, nairaPerUSD]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      addToast({ msg: 'No data to export for this report', type: 'error' });
      return;
    }
    const rows = filteredData.map((e) => ({
      ID: e.id,
      Date: e.date || e.createdAt?.slice(0, 10),
      Product: e.productName,
      Category: e.category || 'General',
      Units: e.qty,
      'Unit Price': e.unitPrice,
      Revenue: e.revenue,
      Profit: e.profit,
      Customer: e.customer || '',
      PaymentMethod: e.paymentMethod || '',
    }));
    const csv = csvStringify(rows);
    csvDownload(csv, `salestew_report_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`);
    addToast({ msg: 'Report exported as CSV', type: 'success' });
    recordActivity?.('report_csv', `Exported ${reportType} report CSV`, session?.username, 'Reports');
  };

  // PDF Print Export
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast({ msg: 'Popup blocked. Please allow popups to print.', type: 'error' });
      return;
    }

    const reportTitle = `${reportType.toUpperCase()} SALES REPORT`;
    const dateRangeLabel =
      reportType === 'custom'
        ? `${customFrom} to ${customTo}`
        : `${reportType} (${new Date().toLocaleDateString()})`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle} - SaleStew</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; color: #111; padding: 30px; font-size: 13px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 20px; font-weight: bold; margin: 0; }
          .meta { color: #555; font-size: 11px; }
          .metrics { display: flex; gap: 15px; margin-bottom: 24px; }
          .metric-card { flex: 1; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #fafafa; }
          .metric-lbl { font-size: 10px; color: #666; text-transform: uppercase; }
          .metric-val { font-size: 16px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
          th { background: #f0f0f0; }
          .text-right { text-align: right; }
          .footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; color: #777; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">SaleStew // ${reportTitle}</h1>
            <div class="meta">Category: ${selectedCategory} | Period: ${dateRangeLabel}</div>
          </div>
          <div class="meta text-right">
            Generated: ${new Date().toLocaleString()}<br/>
            User: ${session?.username || 'admin'}
          </div>
        </div>

        <div class="metrics">
          <div class="metric-card">
            <div class="metric-lbl">Total Revenue</div>
            <div class="metric-val">${fmt(stats.totalRevenue)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-lbl">Total Profit</div>
            <div class="metric-val">${fmt(stats.totalProfit)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-lbl">Units Sold</div>
            <div class="metric-val">${formatNum(stats.totalUnits)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-lbl">Avg Margin</div>
            <div class="metric-val">${stats.avgMargin}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-lbl">Top Product</div>
            <div class="metric-val" style="font-size: 13px;">${stats.topProduct}</div>
          </div>
        </div>

        <h3>Transaction Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Category</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Revenue</th>
              <th class="text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData
              .map(
                (e) => `
              <tr>
                <td>${formatDate(e.date || e.createdAt)}</td>
                <td>${e.productName}</td>
                <td>${e.category || 'General'}</td>
                <td class="text-right">${e.qty}</td>
                <td class="text-right">${fmt(e.unitPrice)}</td>
                <td class="text-right">${fmt(e.revenue)}</td>
                <td class="text-right">${fmt(e.profit)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          SaleStew Business Analytics &bull; Confidential
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    recordActivity?.('report_pdf', `Printed/Exported ${reportType} report PDF`, session?.username, 'Reports');
  };

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Reports</h1>
          <p className="page-sub text-xs text-[var(--text-2)]">// customized sales &amp; performance statements</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button onClick={handlePrintPDF} className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Printer size={13} />
            <span>Print / PDF Report</span>
          </button>
        </div>
      </div>

      {/* Report Builder Controls */}
      <div className="panel space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="form-group mb-0">
            <label className="form-label text-xs">Report Frequency</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="form-select text-xs py-1.5 px-3"
            >
              <option value="daily">Daily Report (Today)</option>
              <option value="monthly">Monthly Report (This Month)</option>
              <option value="quarterly">Quarterly Report (This Quarter)</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <div className="form-group mb-0">
            <label className="form-label text-xs">Category Filter</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="form-select text-xs py-1.5 px-3"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {reportType === 'custom' && (
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <div className="form-group mb-0">
                <label className="form-label text-xs">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="form-input text-xs py-1 px-2"
                />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="form-input text-xs py-1 px-2"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5 Metric Summary Cards */}
      <div className="stat-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="stat-card">
          <div className="stat-card__lbl">Total Revenue</div>
          <div className="stat-card__val font-mono">{fmt(stats.totalRevenue)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">for selected period</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Gross Profit</div>
          <div className="stat-card__val font-mono text-[var(--green)]">{fmt(stats.totalProfit)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">net earnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Units Sold</div>
          <div className="stat-card__val font-mono">{formatNum(stats.totalUnits)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">items moved</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Avg Margin</div>
          <div className="stat-card__val font-mono">{stats.avgMargin}%</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">profit ratio</div>
        </div>
        <div className="stat-card col-span-2 md:col-span-1">
          <div className="stat-card__lbl">Top Product</div>
          <div className="stat-card__val font-mono text-sm truncate" title={stats.topProduct}>
            {stats.topProduct}
          </div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">highest grossing</div>
        </div>
      </div>

      {/* Visual Chart Panel */}
      <div className="panel space-y-4">
        <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
          // REVENUE BREAKDOWN BY CATEGORY
        </h2>
        <div className="h-64 w-full">
          {chartData.labels.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--text-3)] text-xs">
              No data to chart for this period.
            </div>
          ) : (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
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
          )}
        </div>
      </div>

      {/* Detailed Ledger Preview Table */}
      <div className="panel space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
            // REPORT DATA TABLE ({filteredData.length} records)
          </h2>
        </div>
        <div className="table-wrap overflow-x-auto">
          <table className="data-table w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-3)] font-mono">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Product</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3 text-right">Qty</th>
                <th className="py-2 px-3 text-right">Unit Price</th>
                <th className="py-2 px-3 text-right">Revenue</th>
                <th className="py-2 px-3 text-right">Profit</th>
                <th className="py-2 px-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-[var(--text-3)]">
                    No transactions found for the chosen criteria.
                  </td>
                </tr>
              ) : (
                filteredData.map((e) => {
                  const rev = Number(e.revenue) || 0;
                  const prof = Number(e.profit) || 0;
                  const marginPct = rev > 0 ? Math.round((prof / rev) * 100) : 0;
                  return (
                    <tr key={e.id} className="hover:bg-[var(--card-h)]">
                      <td className="py-2 px-3 text-[var(--text-2)]">{formatDate(e.date || e.createdAt)}</td>
                      <td className="py-2 px-3 font-sans font-medium text-[var(--text)]">{e.productName}</td>
                      <td className="py-2 px-3 text-[var(--text-2)]">{e.category || 'General'}</td>
                      <td className="py-2 px-3 text-right font-bold text-[var(--text)]">{e.qty}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-2)]">{fmt(e.unitPrice)}</td>
                      <td className="py-2 px-3 text-right font-medium text-[var(--text)]">{fmt(rev)}</td>
                      <td className="py-2 px-3 text-right font-medium text-[var(--green)]">{fmt(prof)}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-3)]">{marginPct}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

