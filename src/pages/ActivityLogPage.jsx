import { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Trash2,
  PlusCircle,
  Edit,
  User,
  Settings,
  Calendar,
  Activity,
  FileText,
} from 'lucide-react';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useToast from '../store/useToast';
import { useModal } from '../components/Modal';
import { formatDate } from '../lib/format';
import { csvStringify, csvDownload } from '../lib/csv';

const LOG_TYPES = [
  'All',
  'Sales',
  'Inventory',
  'Suppliers',
  'Reports',
  'Auth',
  'Settings',
  'Backups',
];

export default function ActivityLogPage() {
  const session = useAuth((s) => s.session);
  const isAdmin = session?.role === 'admin';

  const { actLog, clearActivityLog } = useDb();
  const addToast = useToast((s) => s.addToast);
  const { open: openModal } = useModal();

  const [activeType, setActiveType] = useState('All');
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    document.title = 'Activity Log — SaleStew';
  }, []);

  // Filtered log entries
  const filteredLog = useMemo(() => {
    return actLog.filter((item) => {
      // Type match
      if (activeType !== 'All') {
        const t = (item.type || '').toLowerCase();
        const target = activeType.toLowerCase();
        if (!t.includes(target) && !(target === 'sales' && t.includes('entry'))) {
          return false;
        }
      }

      // Search match
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const d = (item.detail || '').toLowerCase();
        const u = (item.username || '').toLowerCase();
        const p = (item.page || '').toLowerCase();
        const t = (item.type || '').toLowerCase();
        if (!d.includes(q) && !u.includes(q) && !p.includes(q) && !t.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [actLog, activeType, searchQ]);

  // Group log by day (YYYY-MM-DD)
  const groupedLog = useMemo(() => {
    const groups = {};
    filteredLog.forEach((item) => {
      const day = (item.time || item.createdAt || new Date().toISOString()).slice(0, 10);
      if (!groups[day]) groups[day] = [];
      groups[day].push(item);
    });

    // Sort days descending
    const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedDays.map((day) => ({
      day,
      items: groups[day].sort(
        (a, b) => new Date(b.time || 0) - new Date(a.time || 0)
      ),
    }));
  }, [filteredLog]);

  // CSV Export
  const handleExportCSV = () => {
    if (actLog.length === 0) {
      addToast({ msg: 'No log entries to export', type: 'error' });
      return;
    }
    const rows = actLog.map((l) => ({
      ID: l.id,
      Timestamp: l.time,
      Type: l.type,
      Detail: l.detail,
      User: l.username,
      Page: l.page || '',
    }));
    const csv = csvStringify(rows);
    csvDownload(csv, `activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
    addToast({ msg: 'Activity log exported as CSV', type: 'success' });
  };

  // Clear Log Confirmation
  const handleClearLog = () => {
    if (!isAdmin) {
      addToast({ msg: 'Admin authorization required to clear audit log', type: 'error' });
      return;
    }

    openModal({
      title: 'Clear Activity Audit Log',
      saveLabel: 'Clear All Log Entries',
      danger: true,
      size: 'sm',
      content: (
        <p className="text-xs text-[var(--text-2)]">
          Are you sure you want to permanently clear the activity log? This action cannot be reversed.
        </p>
      ),
      onSave: async () => {
        clearActivityLog();
        addToast({ msg: 'Activity log cleared.', type: 'warning' });
      },
    });
  };

  const getLogIcon = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('delete')) return <Trash2 size={15} className="text-[var(--down)] shrink-0" />;
    if (t.includes('add') || t.includes('create')) return <PlusCircle size={15} className="text-[var(--green)] shrink-0" />;
    if (t.includes('edit') || t.includes('update')) return <Edit size={15} className="text-[var(--orange)] shrink-0" />;
    if (t.includes('export') || t.includes('csv') || t.includes('pdf')) return <Download size={15} className="text-[var(--purple)] shrink-0" />;
    if (t.includes('auth') || t.includes('login') || t.includes('user')) return <User size={15} className="text-[var(--green-lt)] shrink-0" />;
    if (t.includes('settings')) return <Settings size={15} className="text-[var(--text-2)] shrink-0" />;
    return <FileText size={15} className="text-[var(--text-3)] shrink-0" />;
  };

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Activity Log</h1>
          <p className="page-sub text-xs text-[var(--text-2)]">// immutable audit trail of system events &amp; data modifications</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          {isAdmin && (
            <button onClick={handleClearLog} className="btn btn-secondary btn-sm text-[var(--down)] border-[var(--down)]/30">
              Clear Log
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="panel space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {LOG_TYPES.map((t) => {
              const active = activeType === t;
              return (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[var(--green)] text-white font-semibold'
                      : 'bg-[var(--bg2)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg3)]'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search user, action, detail..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="form-input text-xs py-1.5 px-3 w-full sm:w-60"
            />
          </div>
        </div>
      </div>

      {/* Grouped Activity Stream */}
      <div className="panel space-y-6">
        {groupedLog.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-3)] text-xs">
            No events recorded yet in the audit log.
          </div>
        ) : (
          groupedLog.map(({ day, items }) => (
            <div key={day} className="space-y-3">
              <div className="text-xs font-mono font-semibold text-[var(--text-3)] border-b border-[var(--border)] pb-1 flex items-center gap-2">
                <Calendar size={13} className="text-[var(--text-3)]" />
                <span>{formatDate(day)}</span>
                <span className="text-[10px] text-[var(--text-3)]">({items.length} events)</span>
              </div>

              <div className="space-y-2">
                {items.map((log) => {
                  const icon = getLogIcon(log.type);
                  const timeStr = log.time
                    ? new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '';

                  return (
                    <div
                      key={log.id}
                      className="p-3 bg-[var(--bg2)] hover:bg-[var(--card-h)] rounded-xl border border-[var(--border)] flex items-start justify-between gap-4 transition-colors text-xs font-mono"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 select-none">{icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="badge badge-info text-[10px] uppercase tracking-wider">
                              {log.type}
                            </span>
                            {log.page && (
                              <span className="text-[var(--text-3)] text-[10px]">
                                on [{log.page}]
                              </span>
                            )}
                          </div>
                          <p className="text-[var(--text)] font-sans mt-1">
                            {log.detail}
                          </p>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap text-[var(--text-3)] text-[11px]">
                        <div className="text-[var(--text-2)] font-semibold">@{log.username}</div>
                        <div>{timeStr}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div className="text-right text-xs text-[var(--text-3)] font-mono border-t border-[var(--border)] pt-3">
          Audit stream holds up to 200 events • Total logged: {actLog.length}
        </div>
      </div>
    </main>
  );
}

