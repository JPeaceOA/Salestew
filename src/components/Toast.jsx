/**
 * Toast.jsx — Toast notification host.
 * Reads from useToast store. Bottom-right fixed, stacked, animated slide-in.
 * Types: success (green), warn (orange), error (red), info (purple)
 */
import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import useToast from '../store/useToast';

const TYPE_CONFIG = {
  success: {
    borderColor: 'var(--green)',
    Icon: CheckCircle2,
    iconColor: 'var(--green)',
  },
  warn: {
    borderColor: 'var(--warn)',
    Icon: AlertTriangle,
    iconColor: 'var(--warn)',
  },
  error: {
    borderColor: 'var(--down)',
    Icon: AlertCircle,
    iconColor: 'var(--down)',
  },
  info: {
    borderColor: 'var(--purple)',
    Icon: Info,
    iconColor: 'var(--purple)',
  },
};

function ToastItem({ toast, onDismiss }) {
  const cfg = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.info;
  const IconComp = cfg.Icon;
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 2800);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onDismiss]);

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      className="animate-[toastIn_0.25s_ease] flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] pl-3 pr-3 py-3 rounded-xl border border-l-4 shadow-xl cursor-pointer hover:brightness-105 transition-all"
      style={{
        background: 'var(--bg2)',
        borderColor: 'var(--border-2)',
        borderLeftColor: cfg.borderColor,
        color: 'var(--text)',
      }}
      role="alert"
      aria-live="polite"
    >
      <IconComp size={16} style={{ color: cfg.iconColor }} className="shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-xs font-semibold leading-snug mb-0.5">
            {toast.title}
          </p>
        )}
        {toast.message && (
          <p className="text-xs opacity-75 leading-snug">
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.action.onClick?.();
              onDismiss(toast.id);
            }}
            className="mt-1.5 text-xs underline underline-offset-2 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--green)' }}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss X */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
        className="opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastHost() {
  const { toasts, dismiss } = useToast();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}

export default ToastHost;
