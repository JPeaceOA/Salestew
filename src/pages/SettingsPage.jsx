import { useState, useEffect, useMemo, useCallback } from 'react';
import { Moon, Sun, RefreshCw, Key } from 'lucide-react';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import useToast from '../store/useToast';
import { useModal } from '../components/Modal';
import { fetchUSDToNGN } from '../lib/exchange';
import { formatDuration, formatNum } from '../lib/format';
import { passwordStrength } from '../lib/crypto';

export default function SettingsPage() {
  const session = useAuth((s) => s.session);
  const users = useAuth((s) => s.users);
  const changePassword = useAuth((s) => s.changePassword);

  const { entries, inventory, suppliers, actLog, clearActivityLog, recordActivity } = useDb();
  const {
    theme,
    setTheme,
    currency,
    setCurrency,
    nairaPerUSD,
    setRate,
    globalLowStockThreshold,
    setThreshold,
  } = useSettings();

  const addToast = useToast((s) => s.addToast);
  const { open: openModal } = useModal();

  // Exchange rate states
  const [liveRate, setLiveRate] = useState(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(nairaPerUSD));
  const [lastFetched, setLastFetched] = useState(null);

  // Threshold state
  const [thresholdInput, setThresholdInput] = useState(String(globalLowStockThreshold));

  useEffect(() => {
    document.title = 'Settings — SaleStew';
  }, []);

  // Sync inputs with settings
  useEffect(() => {
    setRateInput(String(nairaPerUSD));
  }, [nairaPerUSD]);

  useEffect(() => {
    setThresholdInput(String(globalLowStockThreshold));
  }, [globalLowStockThreshold]);

  // Fetch live exchange rate on mount
  const loadLiveRate = useCallback(async () => {
    setFetchingRate(true);
    try {
      const rate = await fetchUSDToNGN();
      setLiveRate(Math.round(rate));
      setLastFetched(new Date().toLocaleTimeString());
    } catch {
      // fallback handled inside fetchUSDToNGN
    } finally {
      setFetchingRate(false);
    }
  }, []);

  useEffect(() => {
    loadLiveRate();
  }, [loadLiveRate]);

  // Save manual exchange rate
  const handleSaveRate = () => {
    const val = parseFloat(rateInput);
    if (!val || val <= 0) {
      addToast({ msg: 'Please enter a valid positive exchange rate', type: 'error' });
      return;
    }
    setRate(val);
    recordActivity?.('settings_rate', `Updated exchange rate to ₦${val}/$1`, session?.username, 'Settings');
    addToast({ msg: `Exchange rate updated to ₦${val}/$1`, type: 'success' });
  };

  const handleApplyLiveRate = () => {
    if (!liveRate) return;
    setRate(liveRate);
    setRateInput(String(liveRate));
    recordActivity?.('settings_rate', `Applied live exchange rate ₦${liveRate}/$1`, session?.username, 'Settings');
    addToast({ msg: `Live rate applied: ₦${liveRate}/$1`, type: 'success' });
  };

  // Save threshold
  const handleSaveThreshold = () => {
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val < 1) {
      addToast({ msg: 'Threshold must be at least 1', type: 'error' });
      return;
    }
    setThreshold(val);
    recordActivity?.('settings_threshold', `Updated low stock threshold to ${val}`, session?.username, 'Settings');
    addToast({ msg: `Global threshold updated to ${val} units`, type: 'success' });
  };

  // User details
  const currentUser = useMemo(() => {
    return users.find((u) => u.id === session?.userId) || session;
  }, [users, session]);

  // LocalStorage calculation
  const storageMetrics = useMemo(() => {
    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ss_')) {
        const val = localStorage.getItem(key) || '';
        totalChars += key.length + val.length;
      }
    }
    // UTF-16 characters use 2 bytes each
    const bytesUsed = totalChars * 2;
    const kbUsed = (bytesUsed / 1024).toFixed(1);
    const quotaKB = 5120; // 5 MB typical quota
    const pct = Math.min(100, Math.round((bytesUsed / (quotaKB * 1024)) * 100));

    return { kbUsed, pct };
  }, [entries, inventory, suppliers, actLog]);

  // Change Password Modal
  const openPasswordModal = () => {
    let currentPw = '';
    let newPw = '';
    let confirmPw = '';

    openModal({
      title: 'Change Password',
      saveLabel: 'Update Password',
      size: 'sm',
      content: (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              onChange={(e) => { currentPw = e.target.value; }}
              autoComplete="current-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password (min 8 chars)</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              onChange={(e) => { newPw = e.target.value; }}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              onChange={(e) => { confirmPw = e.target.value; }}
              autoComplete="new-password"
            />
          </div>
        </form>
      ),
      onSave: async () => {
        if (!currentPw) throw new Error('Current password is required.');
        if (!newPw || newPw.length < 8) throw new Error('New password must be at least 8 characters.');
        if (newPw !== confirmPw) throw new Error('New passwords do not match.');

        const res = await changePassword({
          userId: session.userId,
          currentPassword: currentPw,
          newPassword: newPw,
        });

        if (!res.ok) throw new Error(res.error || 'Failed to update password.');
        recordActivity?.('auth_password', 'Changed password', session?.username, 'Settings');
        addToast({ msg: 'Password updated successfully!', type: 'success' });
      },
    });
  };

  return (
    <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Settings</h1>
        <p className="page-sub text-xs text-[var(--text-2)]">// preferences, currency rates &amp; profile management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appearance & Display */}
        <div className="panel space-y-4">
          <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
            // APPEARANCE &amp; PREFERENCES
          </h2>

          <div className="space-y-4">
            <div>
              <label className="form-label text-xs block mb-2">Theme Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`btn flex-1 btn-sm flex items-center justify-center gap-1.5 ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <Moon size={13} />
                  <span>Dark (Default)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`btn flex-1 btn-sm flex items-center justify-center gap-1.5 ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <Sun size={13} />
                  <span>Light</span>
                </button>
              </div>
            </div>

            <div>
              <label className="form-label text-xs block mb-2">Display Currency</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrency('NGN')}
                  className={`btn flex-1 btn-sm ${currency === 'NGN' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  ₦ Naira (NGN)
                </button>
                <button
                  onClick={() => setCurrency('USD')}
                  className={`btn flex-1 btn-sm ${currency === 'USD' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  $ US Dollar (USD)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Currency Exchange Rate */}
        <div className="panel space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
              // LIVE CURRENCY EXCHANGE API
            </h2>
            <button
              onClick={loadLiveRate}
              disabled={fetchingRate}
              className="text-xs text-[var(--green)] hover:underline flex items-center gap-1.5 font-mono"
            >
              <RefreshCw size={12} className={fetchingRate ? 'animate-spin' : ''} />
              <span>{fetchingRate ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>

          <div className="p-3 bg-[var(--bg2)] rounded border border-[var(--border)] space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-3)] font-mono">Live Rate Source:</span>
              <span className="text-[var(--text)] font-mono">open.er-api.com</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-3)] font-mono">Current Live Quote:</span>
              <span className="text-[var(--green)] font-bold font-mono">
                {liveRate ? `₦${formatNum(liveRate)} / $1 USD` : 'Checking...'}
              </span>
            </div>
            {lastFetched && (
              <div className="text-[10px] text-[var(--text-3)] text-right">
                Last checked: {lastFetched}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="form-label text-xs">Active Exchange Rate (₦ / $1)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="form-input text-xs py-1.5 px-3 flex-1 font-mono"
              />
              <button onClick={handleSaveRate} className="btn btn-secondary btn-sm">
                Save
              </button>
              {liveRate && (
                <button onClick={handleApplyLiveRate} className="btn btn-primary btn-sm">
                  Apply Live (₦{liveRate})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Defaults */}
        <div className="panel space-y-4">
          <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
            // INVENTORY THRESHOLDS
          </h2>

          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label text-xs">Global Low Stock Alert Level</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="form-input text-xs py-1.5 px-3 flex-1 font-mono"
                />
                <button onClick={handleSaveThreshold} className="btn btn-secondary btn-sm">
                  Save Threshold
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-3)] mt-1.5">
                Items without a custom reorder level trigger low stock warnings when falling below this amount.
              </p>
            </div>
          </div>
        </div>

        {/* User Account Profile */}
        <div className="panel space-y-4">
          <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
            // ACCOUNT PROFILE &amp; SECURITY
          </h2>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <span className="text-[var(--text-3)]">Signed In As:</span>
              <span className="text-[var(--text)] font-bold">@{currentUser?.username}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <span className="text-[var(--text-3)]">Role Permission:</span>
              <span className="badge badge-success uppercase">{currentUser?.role || 'user'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <span className="text-[var(--text-3)]">Time in App:</span>
              <span className="text-[var(--text-2)]">{formatDuration(currentUser?.totalTime || 0)}</span>
            </div>
          </div>

          <button onClick={openPasswordModal} className="btn btn-secondary btn-sm w-full flex items-center justify-center gap-1.5">
            <Key size={13} />
            <span>Change Password</span>
          </button>
        </div>
      </div>

      {/* Storage & Diagnostic Info */}
      <div className="panel space-y-4">
        <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
          // SYSTEM STORAGE &amp; DATABASE DIAGNOSTICS
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 bg-[var(--bg2)] rounded border border-[var(--border)]">
            <div className="text-[var(--text-3)]">Sales Entries</div>
            <div className="text-base font-bold text-[var(--text)] mt-1">{entries.length}</div>
          </div>
          <div className="p-3 bg-[var(--bg2)] rounded border border-[var(--border)]">
            <div className="text-[var(--text-3)]">Inventory Items</div>
            <div className="text-base font-bold text-[var(--text)] mt-1">{inventory.length}</div>
          </div>
          <div className="p-3 bg-[var(--bg2)] rounded border border-[var(--border)]">
            <div className="text-[var(--text-3)]">Suppliers</div>
            <div className="text-base font-bold text-[var(--text)] mt-1">{suppliers.length}</div>
          </div>
          <div className="p-3 bg-[var(--bg2)] rounded border border-[var(--border)]">
            <div className="text-[var(--text-3)]">Audit Log Events</div>
            <div className="text-base font-bold text-[var(--text)] mt-1">{actLog.length}</div>
          </div>
        </div>

        {/* LocalStorage meter */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[var(--text-3)]">Browser LocalStorage Utilization:</span>
            <span className="text-[var(--text-2)]">{storageMetrics.kbUsed} KB ({storageMetrics.pct}% of ~5MB)</span>
          </div>
          <div className="w-full bg-[var(--bg3)] h-2 rounded overflow-hidden">
            <div
              className="bg-[var(--green)] h-full transition-all duration-300"
              style={{ width: `${Math.max(2, storageMetrics.pct)}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-[11px] text-[var(--text-3)] pt-2 border-t border-[var(--border)] font-mono">
          <span>SaleStew React // v3.0 (OWASP-Hardened Client Storage)</span>
          <span>Engine: WebCrypto PBKDF2-SHA256</span>
        </div>
      </div>
    </main>
  );
}

