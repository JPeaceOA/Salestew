import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  UserPlus,
  RotateCcw,
  Trash2,
  HardDriveDownload,
  Upload,
  AlertOctagon,
} from 'lucide-react';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import useToast from '../store/useToast';
import { useModal } from '../components/Modal';
import { formatMoney, formatNum, formatDate, formatDuration } from '../lib/format';
import { exportBackup, importBackup } from '../lib/backup';
import { csvStringify, csvDownload } from '../lib/csv';

export default function AdminPage() {
  const session = useAuth((s) => s.session);
  const users = useAuth((s) => s.users);
  const register = useAuth((s) => s.register);
  const promoteUser = useAuth((s) => s.promoteUser);
  const demoteUser = useAuth((s) => s.demoteUser);
  const deleteUser = useAuth((s) => s.deleteUser);
  const resetUserTime = useAuth((s) => s.resetUserTime);
  const unlockUser = useAuth((s) => s.unlockUser);

  const {
    entries,
    inventory,
    suppliers,
    goals,
    actLog,
    seedData,
    setEntries,
    setInventory,
    clearActivityLog,
    recordActivity,
  } = useDb();

  const { currency, nairaPerUSD } = useSettings();
  const addToast = useToast((s) => s.addToast);
  const { open: openModal } = useModal();

  useEffect(() => {
    document.title = 'Admin Console — SaleStew';
  }, []);

  const fmt = useCallback(
    (n) => formatMoney(n, currency, nairaPerUSD),
    [currency, nairaPerUSD]
  );

  // Security guard
  if (!session || session.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Summary Metrics
  const totalRevenue = useMemo(() => {
    return entries.reduce((sum, e) => sum + (Number(e.revenue) || 0), 0);
  }, [entries]);

  // Create User Modal
  const openCreateUserModal = () => {
    let formState = {
      username: '',
      password: '',
      role: 'user',
    };

    openModal({
      title: 'Create New Account',
      saveLabel: 'Create Account',
      size: 'sm',
      content: (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label className="form-label">Username (min 3 chars)</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. accountant_jane"
              onChange={(e) => { formState.username = e.target.value; }}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password (min 8 chars)</label>
            <input
              className="form-input"
              type="password"
              placeholder="min 8 chars"
              onChange={(e) => { formState.password = e.target.value; }}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-select"
              defaultValue="user"
              onChange={(e) => { formState.role = e.target.value; }}
            >
              <option value="user">User (Staff / Cashier)</option>
              <option value="admin">Administrator (Full Access)</option>
            </select>
          </div>
        </form>
      ),
      onSave: async () => {
        if (!formState.username.trim() || formState.username.trim().length < 3) {
          throw new Error('Username must be at least 3 characters.');
        }
        if (!formState.password || formState.password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }

        const res = await register({
          username: formState.username.trim(),
          password: formState.password,
          role: formState.role,
        });

        if (!res.ok) throw new Error(res.error || 'Failed to create user account.');
        recordActivity?.('auth_create_user', `Created user @${formState.username.trim()} (${formState.role})`, session?.username, 'Admin');
        addToast({ msg: `Account @${formState.username.trim()} created!`, type: 'success' });
      },
    });
  };

  // Re-seed demo data
  const handleReseed = () => {
    openModal({
      title: 'Re-seed Demo Data',
      saveLabel: 'Confirm Re-seed',
      danger: true,
      size: 'sm',
      content: (
        <p className="text-xs text-[var(--text-2)]">
          This will reset the sales ledger and catalog to the standard initial 16 demo transactions and 16 product lines.
        </p>
      ),
      onSave: async () => {
        localStorage.removeItem('ss_entries');
        localStorage.removeItem('ss_inventory');
        localStorage.removeItem('ss_suppliers');
        setEntries([]);
        setInventory([]);
        setTimeout(() => {
          seedData();
          window.location.reload();
        }, 150);
      },
    });
  };

  // Export full system backup JSON
  const handleExportBackup = () => {
    try {
      exportBackup();
      recordActivity?.('backup_export', 'Exported JSON database backup', session?.username, 'Admin');
      addToast({ msg: 'Full database backup downloaded (.json)', type: 'success' });
    } catch (err) {
      addToast({ msg: 'Backup export failed: ' + err.message, type: 'error' });
    }
  };

  // Import backup JSON
  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await importBackup(file);
      addToast({ msg: `Restored ${res.restored} data collections! Reloading...`, type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err) {
      addToast({ msg: 'Restore failed: ' + err.message, type: 'error' });
    } finally {
      e.target.value = '';
    }
  };

  // Full reset all business data
  const handleResetAllData = () => {
    openModal({
      title: 'Danger: Factory Reset Business Data',
      saveLabel: 'Permanently Erase All Data',
      danger: true,
      size: 'sm',
      content: (
        <p className="text-xs text-[var(--down)] font-bold">
          WARNING: This will permanently delete all sales entries, inventory products, suppliers, goals, and activity logs. Your user accounts will be kept.
        </p>
      ),
      onSave: async () => {
        setEntries([]);
        setInventory([]);
        clearActivityLog();
        localStorage.removeItem('ss_entries');
        localStorage.removeItem('ss_inventory');
        localStorage.removeItem('ss_suppliers');
        localStorage.removeItem('ss_goals');
        localStorage.removeItem('ss_actlog');
        addToast({ msg: 'All business data has been reset.', type: 'warning' });
        setTimeout(() => window.location.reload(), 400);
      },
    });
  };

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Admin Console</h1>
          <p className="page-sub text-xs text-[var(--text-2)]">// system governance, user permissions &amp; data lifecycle</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreateUserModal} className="btn btn-primary btn-sm flex items-center gap-1.5">
            <UserPlus size={14} />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* High-Level Metric Cards */}
      <div className="stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-card__lbl">Gross System Revenue</div>
          <div className="stat-card__val font-mono">{fmt(totalRevenue)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">{entries.length} historical sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Catalog Products</div>
          <div className="stat-card__val font-mono">{formatNum(inventory.length)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">active inventory SKUs</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Suppliers / Vendors</div>
          <div className="stat-card__val font-mono">{formatNum(suppliers.length)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">registered supply partners</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">User Accounts</div>
          <div className="stat-card__val font-mono text-[var(--green)]">{formatNum(users.length)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">authenticated identities</div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="panel space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
            // USER ACCOUNTS &amp; ACCESS CONTROL ({users.length} users)
          </h2>
        </div>

        <div className="table-wrap overflow-x-auto">
          <table className="data-table w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-3)]">
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Logins</th>
                <th className="py-2.5 px-3 text-right">App Time</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map((u) => {
                const isSelf = u.id === session.userId;
                const isLocked = u.lockedUntil && Date.now() < u.lockedUntil;

                return (
                  <tr key={u.id} className="hover:bg-[var(--card-h)]">
                    <td className="py-2.5 px-3 font-semibold text-[var(--text)]">
                      @{u.username} {isSelf && <span className="text-[var(--green)] text-[10px]">(you)</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-info'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-2)]">{formatDate(u.createdAt)}</td>
                    <td className="py-2.5 px-3">
                      {isLocked ? (
                        <span className="badge badge-error">Locked</span>
                      ) : (
                        <span className="text-[var(--text-3)]">Active</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-2)]">{u.loginCount || 1}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-2)]">
                      <div className="flex items-center justify-end gap-1">
                        <span>{formatDuration(u.totalTime || 0)}</span>
                        <button
                          onClick={() => {
                            resetUserTime(u.id);
                            addToast({ msg: `Reset time for @${u.username}`, type: 'success' });
                          }}
                          className="hover:text-[var(--text)] text-[var(--text-3)] p-0.5"
                          title="Reset time"
                          aria-label="Reset time"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isLocked && (
                          <button
                            onClick={() => {
                              unlockUser?.(u.id);
                              addToast({ msg: `Unlocked @${u.username}`, type: 'success' });
                            }}
                            className="btn btn-secondary btn-sm text-[10px] py-0.5 px-1.5"
                          >
                            Unlock
                          </button>
                        )}

                        {!isSelf && (
                          <>
                            {u.role === 'user' ? (
                              <button
                                onClick={() => {
                                  promoteUser(u.id);
                                  addToast({ msg: `Promoted @${u.username} to Admin`, type: 'success' });
                                }}
                                className="btn btn-secondary btn-sm text-[10px] py-0.5 px-1.5"
                              >
                                Make Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  demoteUser(u.id);
                                  addToast({ msg: `Demoted @${u.username} to User`, type: 'warning' });
                                }}
                                className="btn btn-secondary btn-sm text-[10px] py-0.5 px-1.5"
                              >
                                Demote
                              </button>
                            )}

                            <button
                              onClick={() => {
                                deleteUser(u.id);
                                addToast({ msg: `Deleted user @${u.username}`, type: 'warning' });
                              }}
                              className="p-1 hover:text-[var(--down)] text-[var(--text-3)] text-xs opacity-70 hover:opacity-100"
                              title="Delete user"
                              aria-label="Delete user"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Management Operations */}
      <div className="panel space-y-4">
        <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text-2)]">
          // BACKUP, RESTORE &amp; DATA OPERATIONS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: JSON Backup */}
          <div className="p-4 bg-[var(--bg2)] rounded border border-[var(--border)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-serif font-bold text-sm text-[var(--text)]">Database Backup</div>
              <p className="text-xs text-[var(--text-2)] mt-1">
                Save an encrypted JSON archive containing all collections, users, and audit records.
              </p>
            </div>
            <button onClick={handleExportBackup} className="btn btn-secondary btn-sm mt-3 w-full flex items-center justify-center gap-1.5">
              <HardDriveDownload size={13} />
              <span>Download Backup (.json)</span>
            </button>
          </div>

          {/* Card 2: JSON Restore */}
          <div className="p-4 bg-[var(--bg2)] rounded border border-[var(--border)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-serif font-bold text-sm text-[var(--text)]">Restore Database</div>
              <p className="text-xs text-[var(--text-2)] mt-1">
                Restore collections from a previously exported SaleStew backup JSON archive.
              </p>
            </div>
            <label className="btn btn-secondary btn-sm mt-3 w-full text-center cursor-pointer flex items-center justify-center gap-1.5">
              <Upload size={13} />
              <span>Choose File to Restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>

          {/* Card 3: Re-seed Demo */}
          <div className="p-4 bg-[var(--bg2)] rounded border border-[var(--border)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-serif font-bold text-sm text-[var(--text)]">Re-seed Catalog</div>
              <p className="text-xs text-[var(--text-2)] mt-1">
                Replace existing products and sales with standard demo entries (16 items, 1 supplier).
              </p>
            </div>
            <button onClick={handleReseed} className="btn btn-secondary btn-sm mt-3 w-full flex items-center justify-center gap-1.5">
              <RotateCcw size={13} />
              <span>Load Standard Demo</span>
            </button>
          </div>

          {/* Card 4: Factory Reset */}
          <div className="p-4 bg-[var(--bg2)] rounded border border-[var(--border)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-serif font-bold text-sm text-[var(--down)]">Factory Reset</div>
              <p className="text-xs text-[var(--text-2)] mt-1">
                Purge all sales, inventory, and supplier records while keeping admin accounts.
              </p>
            </div>
            <button
              onClick={handleResetAllData}
              className="btn btn-secondary btn-sm mt-3 w-full text-[var(--down)] border-[var(--down)]/30 hover:bg-[var(--down)]/10 flex items-center justify-center gap-1.5"
            >
              <AlertOctagon size={13} />
              <span>Reset Business Data</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

