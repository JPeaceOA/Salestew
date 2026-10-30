/**
 * Modal.jsx — Full modal system with Context, Provider, useModal hook, and ModalHost.
 * Usage: wrap app with <ModalProvider>, call useModal().open({...}) anywhere.
 */
import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export const ModalContext = createContext(null);

/**
 * ModalProvider — wraps your app to provide modal functionality.
 */
export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const open = useCallback((opts) => {
    setModal({
      title: opts.title ?? '',
      content: opts.content ?? null,
      onSave: opts.onSave ?? null,
      saveLabel: opts.saveLabel ?? 'Save',
      size: opts.size ?? '',
      danger: opts.danger ?? false,
    });
  }, []);

  const close = useCallback(() => setModal(null), []);

  return (
    <ModalContext.Provider value={{ modal, open, close }}>
      {children}
    </ModalContext.Provider>
  );
}

/**
 * useModal — access open/close from anywhere inside ModalProvider.
 */
export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within a ModalProvider');
  return ctx;
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  '': 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * ModalHost — renders the active modal. Place once near the root inside ModalProvider.
 */
export function ModalHost() {
  const { modal, close } = useModal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const backdropRef = useRef(null);

  // Escape key to close
  useEffect(() => {
    if (!modal) return;
    const handle = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [modal, close]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = modal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  // Reset error when modal changes
  useEffect(() => { setError(''); setSaving(false); }, [modal]);

  if (!modal) return null;

  const sizeClass = SIZE_CLASSES[modal.size] ?? SIZE_CLASSES[''];

  const handleSave = async () => {
    if (!modal.onSave) return close();
    setSaving(true);
    setError('');
    try {
      await modal.onSave();
      close();
    } catch (err) {
      setError(err?.message ?? 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) close();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`animate-[modalIn_0.22s_ease] w-full ${sizeClass} rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]`}
        style={{
          background: 'var(--bg2)',
          borderColor: 'var(--border-2)',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            id="modal-title"
            className="text-base font-semibold"
            style={{ color: 'var(--text)' }}
          >
            {modal.title}
          </h2>
          <button
            type="button"
            onClick={close}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-[var(--bg3)] transition-colors"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {modal.content}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-[rgba(160,72,72,0.12)] border border-[rgba(160,72,72,0.3)] text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-xs tracking-wider uppercase border hover:bg-[var(--bg3)] transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
          >
            Cancel
          </button>
          {modal.onSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-1.5 rounded-lg text-xs tracking-wider uppercase font-semibold transition-all disabled:opacity-60 ${
                modal.danger
                  ? 'bg-red-700/80 text-white hover:bg-red-700'
                  : 'bg-[var(--green)] text-white hover:bg-[var(--green-lt)]'
              }`}
            >
              {saving ? 'Saving…' : (modal.saveLabel || 'Save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalHost;
