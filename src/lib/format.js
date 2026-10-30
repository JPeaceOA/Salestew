/**
 * format.js — Currency, date, number, and duration formatters.
 * The app stores all monetary values in NGN (Nigerian Naira).
 * Pass `currency` and `rate` (nairaPerUSD) where applicable.
 */

/**
 * Format a naira amount, optionally converting to USD for display.
 * @param {number} n - Amount in NGN
 * @param {'NGN'|'USD'} currency
 * @param {number} rate - naira per USD
 * @returns {string}
 */
export function formatMoney(n, currency, rate) {
  if (currency === 'USD') {
    const usd = (n / (rate || 1610)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return '$' + usd;
  }
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

/**
 * Format a date value to a human-readable string.
 * @param {string|number|Date} d
 * @returns {string}
 */
export function formatDate(d) {
  return new Date(d).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a number with locale separators.
 * @param {number} n
 * @returns {string}
 */
export function formatNum(n) {
  return Number(n).toLocaleString('en-NG');
}

/**
 * Format a percentage with a leading + for positive values.
 * @param {number} n
 * @returns {string}
 */
export function formatPct(n) {
  return (n >= 0 ? '+' : '') + n + '%';
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * @param {number|null|undefined} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!ms) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Return the currency symbol for a given currency code.
 * @param {'NGN'|'USD'} currency
 * @returns {string}
 */
export function currencySymbol(currency) {
  return currency === 'USD' ? '$' : '₦';
}

/**
 * Convert a user-entered value (which may be in USD or NGN) to NGN.
 * @param {string|number} val
 * @param {'NGN'|'USD'} currency
 * @param {number} rate - naira per USD
 * @returns {number}
 */
export function toNaira(val, currency, rate) {
  const n = parseFloat(val) || 0;
  return currency === 'USD' ? n * (rate || 1610) : n;
}
