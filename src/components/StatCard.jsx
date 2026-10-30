/**
 * StatCard.jsx — Metric card with hover effect and bottom accent bar.
 * Props: label (string), value (string|number), color (CSS color), delta (optional string)
 */

export function StatCard({ label, value, color, delta }) {
  const isPositive = delta && (delta.startsWith('+') || (!delta.startsWith('-') && parseFloat(delta) > 0));
  const isNegative = delta && delta.startsWith('-');

  return (
    <div className="relative group rounded-lg overflow-hidden border border-[#1a2a1a] dark:border-[#1a2a1a] border-[#e2d8cc] bg-[#111710] dark:bg-[#111710] bg-[#f9f1e6] p-4 transition-all duration-200 hover:bg-[#151d14] dark:hover:bg-[#151d14] hover:bg-[#f2e8d8] hover:border-[#243524] dark:hover:border-[#243524] hover:border-[#cfc3b0] cursor-default">
      {/* Label */}
      <p className="text-[11px] font-mono uppercase tracking-widest text-[#748e70] dark:text-[#748e70] text-[#7a6050] mb-1 truncate">
        {label}
      </p>

      {/* Value */}
      <p className="text-2xl font-serif font-semibold text-[#c4d4c0] dark:text-[#c4d4c0] text-[#2a1a08] leading-tight truncate">
        {value}
      </p>

      {/* Delta */}
      {delta && (
        <p
          className={`mt-1 text-[11px] font-mono ${
            isPositive
              ? 'text-[#4e9463]'
              : isNegative
              ? 'text-[#a04848]'
              : 'text-[#748e70] dark:text-[#748e70] text-[#7a6050]'
          }`}
        >
          {delta}
        </p>
      )}

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] opacity-70 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: color || '#4e9463' }}
      />
    </div>
  );
}
