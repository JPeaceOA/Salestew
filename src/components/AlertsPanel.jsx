/**
 * AlertsPanel.jsx — Dropdown panel showing alert notifications.
 * Reads computed alerts from store/useAlerts.js.
 */
import { useRef } from 'react';
import { X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useAlerts } from '../store/useAlerts';

export function AlertsPanel({ onNavigate, onDismissAll }) {
  const { alerts, dismiss, dismissAll } = useAlerts();
  const panelRef = useRef(null);

  const count = alerts.length;

  const handleDismissAll = () => {
    dismissAll?.();
    onDismissAll?.();
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div
        ref={panelRef}
        className="w-80 max-h-[70vh] rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg2)',
          borderColor: 'var(--border-2)',
          color: 'var(--text)',
        }}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm font-semibold">Alerts</span>
        </div>
        <div className="px-4 py-8 text-center text-xs opacity-60 flex flex-col items-center gap-2">
          <CheckCircle2 size={24} className="text-green-500 opacity-70" />
          <span>No active alerts</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="w-80 max-h-[70vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
      style={{
        background: 'var(--bg2)',
        borderColor: 'var(--border-2)',
        color: 'var(--text)',
      }}
      data-alert-count={count}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-sm font-semibold">
          Alerts
          <span className="ml-2 text-xs opacity-75">({count})</span>
        </span>
        <button
          type="button"
          onClick={handleDismissAll}
          className="text-xs uppercase tracking-wider opacity-60 hover:opacity-100 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Alerts list */}
      <ul className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
        {alerts.map((alert) => {
          const isError = alert.type === 'error';
          const isWarn = alert.type === 'warn';
          return (
            <li
              key={alert.id}
              className="flex items-start gap-3 px-4 py-3 border-l-4 hover:bg-[var(--bg3)] transition-colors"
              style={{
                borderLeftColor: isError ? 'var(--down)' : isWarn ? 'var(--warn)' : 'var(--purple)',
              }}
            >
              <span className="mt-0.5 shrink-0">
                {isError ? (
                  <AlertTriangle size={14} style={{ color: 'var(--down)' }} />
                ) : isWarn ? (
                  <AlertTriangle size={14} style={{ color: 'var(--warn)' }} />
                ) : (
                  <Info size={14} style={{ color: 'var(--purple)' }} />
                )}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug font-medium">
                  {alert.message}
                </p>
                {alert.action && (
                  <button
                    type="button"
                    onClick={() => {
                      dismiss?.(alert.id);
                      onNavigate?.(alert.action.page);
                    }}
                    className="mt-1 text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--green)' }}
                  >
                    {alert.action.label ?? 'View →'}
                  </button>
                )}
              </div>

              {/* Dismiss */}
              <button
                type="button"
                onClick={() => dismiss?.(alert.id)}
                className="opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                aria-label="Dismiss alert"
              >
                <X size={13} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AlertsPanel;
