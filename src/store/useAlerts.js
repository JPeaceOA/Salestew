/**
 * useAlerts.js — Pure computed alert logic + useAlerts hook.
 */
import useDb from './useDb';
import useSettings from './useSettings';
import { formatMoney, formatNum } from '../lib/format';

// ---------- Goal Progress ----------

/**
 * Compute progress of a goal against sales entries.
 *
 * Goal shape expected:
 *   { id, metric: 'revenue'|'profit'|'units'|'orders', period: 'month'|'week'|'quarter'|'year',
 *     target: number, category?: string }
 *
 * @param {{ id: number, metric: string, period: string, target: number, category?: string }} goal
 * @param {Object[]} entries - All sales entries
 * @param {'NGN'|'USD'} [currency='NGN']
 * @param {number} [nairaPerUSD=1610]
 * @returns {{ actual: number, pct: number, formatted: string, formattedActual: string, formattedTarget: string }}
 */
export function computeGoalProgress(goal, entries, currency = 'NGN', nairaPerUSD = 1610) {
  if (!goal || !entries) {
    return { actual: 0, pct: 0, formatted: '0%', formattedActual: '0', formattedTarget: '0' };
  }

  const now = new Date();

  function periodStart(p) {
    const d = new Date(now);
    if (p === 'week') {
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
    } else if (p === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    } else if (p === 'quarter') {
      d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
      d.setHours(0, 0, 0, 0);
    } else if (p === 'year') {
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }

  const start = periodStart(goal.period || 'month');

  const filtered = entries.filter((e) => {
    const d = new Date(e.date || e.createdAt);
    if (d < start) return false;
    if (goal.category && goal.category !== 'All' && goal.category !== 'all' && e.category !== goal.category) return false;
    return true;
  });

  let actual = 0;
  const metric = goal.metric || 'revenue';

  if (metric === 'revenue') {
    actual = filtered.reduce((sum, e) => sum + (Number(e.revenue) || 0), 0);
  } else if (metric === 'profit') {
    actual = filtered.reduce((sum, e) => sum + (Number(e.profit) || 0), 0);
  } else if (metric === 'units') {
    actual = filtered.reduce((sum, e) => sum + (Number(e.qty ?? e.units) || 0), 0);
  } else if (metric === 'orders') {
    actual = filtered.length;
  }

  const target = Number(goal.target) || 1;
  const pct = Math.min(Math.round((actual / target) * 100), 999);
  const formatted = pct + '%';
  const isMoney = metric === 'revenue' || metric === 'profit';
  const formattedActual = isMoney ? formatMoney(actual, currency, nairaPerUSD) : formatNum(actual);
  const formattedTarget = isMoney ? formatMoney(target, currency, nairaPerUSD) : formatNum(target);

  return { actual, pct, formatted, formattedActual, formattedTarget };
}

// ---------- Alert IDs ----------

function outId(itemId) { return `out_${itemId}`; }
function lowId(itemId) { return `low_${itemId}`; }
function goalBehindId(goalId) { return `goal_behind_${goalId}`; }
function goalDoneId(goalId) { return `goal_done_${goalId}`; }
const NO_SALES_ID = 'no_sales_month';

// ---------- computeAlerts ----------

/**
 * Compute all active alerts for the app.
 *
 * @param {Object[]} inventory
 * @param {Object[]} entries
 * @param {Object[]} goals
 * @param {string[]} dismissed - array of dismissed alert IDs
 * @param {number} globalThreshold - global low-stock threshold
 * @returns {Array<{
 *   id: string,
 *   level: 'warn'|'error'|'info'|'success',
 *   icon: string,
 *   title: string,
 *   body: string,
 *   action?: { label: string, page: string }
 * }>}
 */
export function computeAlerts(inventory, entries, goals, dismissed, globalThreshold) {
  const alerts = [];
  const dis = new Set(Array.isArray(dismissed) ? dismissed : []);
  const threshold = Number(globalThreshold) || 20;

  // 1. Out of stock
  for (const item of (inventory || [])) {
    const stock = Number(item.stock) || 0;
    if (stock <= 0) {
      const id = outId(item.id);
      if (!dis.has(id)) {
        alerts.push({
          id,
          level: 'error',
          title: 'Out of Stock',
          body: `${item.name} has no stock remaining.`,
          action: { label: 'View Inventory', page: 'inventory' },
        });
      }
    }
  }

  // 2. Low stock (stock > 0 but <= threshold)
  for (const item of (inventory || [])) {
    const stock = Number(item.stock) || 0;
    const t =
      item.lowStockThreshold !== undefined && item.lowStockThreshold !== null
        ? Number(item.lowStockThreshold)
        : threshold;
    if (stock > 0 && stock <= t) {
      const id = lowId(item.id);
      if (!dis.has(id)) {
        alerts.push({
          id,
          level: 'warn',
          title: 'Low Stock',
          body: `${item.name} has only ${stock} unit${stock !== 1 ? 's' : ''} left (threshold: ${t}).`,
          action: { label: 'View Inventory', page: 'inventory' },
        });
      }
    }
  }

  // 3. Goals behind (<50% progress at >=50% through the period)
  // 4. Goals achieved (>=100%)
  for (const goal of (goals || [])) {
    const { pct } = computeGoalProgress(goal, entries);

    if (pct >= 100) {
      const id = goalDoneId(goal.id);
      if (!dis.has(id)) {
        alerts.push({
          id,
          level: 'success',
          title: 'Goal Achieved!',
          body: `"${goal.name || goal.metric}" goal reached ${pct}% — target met!`,
          action: { label: 'View Goals', page: 'goals' },
        });
      }
    } else {
      // Check if we're ≥50% through the period and <50% of target
      const now = new Date();
      const periodMs = getPeriodMs(goal.period || 'month');
      const startMs = getPeriodStart(goal.period || 'month').getTime();
      const elapsed = (now.getTime() - startMs) / periodMs;

      if (elapsed >= 0.5 && pct < 50) {
        const id = goalBehindId(goal.id);
        if (!dis.has(id)) {
          alerts.push({
            id,
            level: 'warn',
            title: 'Goal Behind Schedule',
            body: `"${goal.name || goal.metric}" is at ${pct}% — more than halfway through the period.`,
            action: { label: 'View Goals', page: 'goals' },
          });
        }
      }
    }
  }

  // 5. No sales this month
  const monthStart = getPeriodStart('month');
  const salesThisMonth = (entries || []).filter((e) => {
    return new Date(e.date || e.createdAt) >= monthStart;
  });
  if (salesThisMonth.length === 0 && !dis.has(NO_SALES_ID)) {
    alerts.push({
      id: NO_SALES_ID,
      level: 'info',
      title: 'No Sales This Month',
      body: 'No sales have been recorded for the current month yet.',
      action: { label: 'Add Sale', page: 'sales' },
    });
  }

  return alerts;
}

// ---------- Internal helpers ----------

function getPeriodStart(period) {
  const d = new Date();
  if (period === 'week') {
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  } else if (period === 'quarter') {
    d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
    d.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function getPeriodMs(period) {
  const day = 86_400_000;
  if (period === 'week') return 7 * day;
  if (period === 'month') return 30 * day;
  if (period === 'quarter') return 91 * day;
  if (period === 'year') return 365 * day;
  return 30 * day;
}

export function useAlerts() {
  const inventory = useDb((s) => s.inventory);
  const entries = useDb((s) => s.entries);
  const goals = useDb((s) => s.goals);
  const alertsDismissed = useDb((s) => s.alertsDismissed);
  const dismissAlert = useDb((s) => s.dismissAlert);
  const globalThreshold = useSettings((s) => s.globalLowStockThreshold);

  const alerts = computeAlerts(inventory, entries, goals, alertsDismissed, globalThreshold);

  return {
    alerts,
    dismiss: (id) => dismissAlert(id),
    dismissAll: () => {
      alerts.forEach((a) => dismissAlert(a.id));
    },
  };
}

export default useAlerts;
