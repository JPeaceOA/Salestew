/**
 * useToast.js — Lightweight Zustand store for transient toast notifications.
 *
 * Each toast auto-removes itself after 2800ms.
 * Toasts can have optional action buttons.
 *
 * Usage:
 *   const { addToast } = useToast();
 *   addToast({ msg: 'Saved!', type: 'success' });
 */
import { create } from 'zustand';

let _nextId = 1;

const useToast = create((set) => ({
  toasts: [],

  /**
   * Add a toast notification.
   * @param {{ msg: string, type?: 'success'|'error'|'warn'|'info', actions?: Array<{label:string,onClick:()=>void}> }} opts
   * @returns {number} The toast id
   */
  addToast: ({ msg, type = 'info', actions = [] }) => {
    const id = _nextId++;
    set((s) => ({
      toasts: [...s.toasts, { id, msg, type, actions }],
    }));

    // Auto-remove after 2800ms
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2800);

    return id;
  },

  /**
   * Manually remove a toast by id.
   * @param {number} id
   */
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export default useToast;
