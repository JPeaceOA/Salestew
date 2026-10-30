/**
 * exchange.js — Fetch a live USD → NGN exchange rate.
 * Falls back to a hard-coded rate if the network request fails.
 */

const FALLBACK_RATE = 1610; // NGN per USD

/**
 * Fetch the current USD to NGN exchange rate from open.er-api.com.
 * Returns the fallback rate (1610) if the request fails for any reason.
 * @returns {Promise<number>} NGN per USD
 */
export async function fetchUSDToNGN() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) return FALLBACK_RATE;
    const json = await res.json();
    const rate = json?.rates?.NGN;
    return typeof rate === 'number' && rate > 0 ? rate : FALLBACK_RATE;
  } catch {
    return FALLBACK_RATE;
  }
}
