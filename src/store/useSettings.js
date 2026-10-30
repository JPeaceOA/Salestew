/**
 * useSettings.js — Zustand store for global app settings (theme, currency, rate, threshold).
 * Persisted to localStorage key 'ss_settings_react'.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'ss_settings_react';

export const useSettings = create(
  persist(
    (set) => ({
      theme: 'dark',
      currency: 'NGN',
      nairaPerUSD: 1610,
      globalLowStockThreshold: 20,

      /**
       * Set the UI theme and apply/remove the 'light' class on <html>.
       * @param {'dark'|'light'} mode
       */
      setTheme: (mode) => {
        set({ theme: mode });
        if (typeof document !== 'undefined') {
          try {
            if (mode === 'light') {
              document.documentElement.classList.add('light');
              document.documentElement.classList.remove('dark');
            } else {
              document.documentElement.classList.remove('light');
              document.documentElement.classList.add('dark');
            }
          } catch {
            // Safe fallback
          }
        }
      },

      /**
       * Set the display currency and notify the rest of the app via a custom event.
       * @param {'NGN'|'USD'} code
       */
      setCurrency: (code) => {
        set({ currency: code });
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(
              new CustomEvent('currency-changed', { detail: { currency: code } })
            );
          } catch {
            // Safe fallback
          }
        }
      },

      /**
       * Update the NGN/USD exchange rate.
       * @param {number} n
       */
      setRate: (n) => {
        const rate = Number(n);
        if (!Number.isFinite(rate) || rate <= 0) return;
        set({ nairaPerUSD: rate });
      },

      /**
       * Update the global low-stock threshold.
       * @param {number} n
       */
      setThreshold: (n) => {
        const t = parseInt(n, 10);
        if (!Number.isFinite(t) || t < 0) return;
        set({ globalLowStockThreshold: t });
      },

      /**
       * Apply the persisted theme on app startup.
       */
      initTheme: () => {
        if (typeof document === 'undefined') return;
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
          if (!raw) {
            document.documentElement.classList.remove('light');
            return;
          }
          const parsed = JSON.parse(raw);
          const theme = parsed?.state?.theme ?? 'dark';
          if (theme === 'light') {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
          } else {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
          }
        } catch {
          document.documentElement.classList.remove('light');
          document.documentElement.classList.add('dark');
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        theme: state.theme,
        currency: state.currency,
        nairaPerUSD: state.nairaPerUSD,
        globalLowStockThreshold: state.globalLowStockThreshold,
      }),
    }
  )
);

export default useSettings;
