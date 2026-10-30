import React from 'react';
import { AlertTriangle } from 'lucide-react';
import useDb from '../store/useDb';
import useSettings from '../store/useSettings';

export function LowStockBanner() {
  const inventory = useDb((s) => s.inventory ?? []);
  const threshold = useSettings((s) => s.globalLowStockThreshold ?? 20);

  const lowItems = inventory.filter((p) => {
    const itemThreshold = p.globalThreshold
      ? threshold
      : (p.lowStockThreshold ?? p.reorderPoint ?? threshold);
    return (Number(p.stock) || 0) <= Number(itemThreshold);
  });

  if (lowItems.length === 0) return null;

  const renderBadge = (p, prefix) => {
    const stock = Number(p.stock) || 0;
    const isOut = stock <= 0;
    return (
      <span key={`${prefix}-${p.id}`} className="inline-flex items-center gap-2 mr-10 text-xs font-medium tracking-wide">
        <AlertTriangle
          size={12}
          className={isOut ? 'text-red-500 flex-shrink-0 animate-pulse' : 'text-amber-500 flex-shrink-0'}
        />
        <span className="font-bold">{p.name}</span>
        <span className="opacity-90 font-normal">
          {isOut ? '— OUT OF STOCK' : `— ${stock} left (reorder ≤${p.lowStockThreshold ?? threshold})`}
        </span>
      </span>
    );
  };

  return (
    <div
      className="w-full overflow-hidden border-b py-2 select-none"
      style={{
        background: 'var(--orange-bg)',
        borderColor: 'var(--border-2)',
        color: 'var(--warn-text)',
      }}
      aria-label="Low stock alert"
    >
      <div className="flex whitespace-nowrap animate-[marquee_28s_linear_infinite]">
        <span className="inline-flex items-center px-4">
          {lowItems.map((p) => renderBadge(p, 'a'))}
        </span>
        <span className="inline-flex items-center px-4" aria-hidden="true">
          {lowItems.map((p) => renderBadge(p, 'b'))}
        </span>
      </div>
    </div>
  );
}

export default LowStockBanner;
