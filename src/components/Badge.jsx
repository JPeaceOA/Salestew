/**
 * Badge.jsx — Small uppercase badge with border.
 * Props: variant ('green'|'orange'|'purple'|'red'|'warn'|'info'), children
 */

const VARIANT_CLASSES = {
  green:
    'bg-green-bg text-green border border-green/30 dark:bg-green-bg dark:text-green dark:border-green/30 bg-[rgba(78,148,99,0.1)] text-[#2d6b40] border-[rgba(78,148,99,0.35)]',
  orange:
    'bg-orange-bg text-orange border border-orange/30 dark:bg-orange-bg dark:text-orange dark:border-orange/30 bg-[rgba(184,98,42,0.1)] text-[#8a4a1e] border-[rgba(184,98,42,0.35)]',
  purple:
    'bg-purple-bg text-purple border border-purple/30 dark:bg-purple-bg dark:text-purple dark:border-purple/30 bg-[rgba(114,82,160,0.1)] text-[#4e3272] border-[rgba(114,82,160,0.35)]',
  red:
    'bg-[rgba(160,72,72,0.1)] text-[#a04848] border border-[rgba(160,72,72,0.35)] dark:bg-[rgba(160,72,72,0.12)] dark:text-[#c46060] dark:border-[rgba(160,72,72,0.4)]',
  warn:
    'bg-orange-bg text-orange border border-orange/30 dark:bg-orange-bg dark:text-orange dark:border-orange/30 bg-[rgba(184,98,42,0.1)] text-[#8a4a1e] border-[rgba(184,98,42,0.35)]',
  info:
    'bg-purple-bg text-purple border border-purple/30 dark:bg-purple-bg dark:text-purple dark:border-purple/30 bg-[rgba(114,82,160,0.1)] text-[#4e3272] border-[rgba(114,82,160,0.35)]',
};

export function Badge({ variant = 'green', children }) {
  const cls = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.green;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}
