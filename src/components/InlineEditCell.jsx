/**
 * InlineEditCell.jsx — A <td> that shows a value and becomes an input on double-click.
 * Props:
 *   value         — current value
 *   field         — field name (for aria)
 *   type          — 'text' | 'number' | 'date' | 'select'
 *   options       — [{ value, label }] for select type
 *   min, max      — for number/date inputs
 *   onSave(v)     — called with new value on commit
 *   formatDisplay — optional fn(value) => string for display formatting
 *   className     — extra classes for <td>
 *   children      — optional override for display content
 */
import { useState, useRef, useEffect, useCallback } from 'react';

const INPUT_BASE =
  'w-full bg-[#090d0a] dark:bg-[#090d0a] bg-[#fdf6ee] text-[#c4d4c0] dark:text-[#c4d4c0] text-[#2a1a08] border border-[#4e9463]/50 rounded px-1.5 py-0.5 text-sm font-mono outline-none focus:ring-1 focus:ring-[#4e9463]/50';

export function InlineEditCell({
  value,
  field,
  type = 'text',
  options = [],
  min,
  max,
  onSave,
  formatDisplay,
  className = '',
  children,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  // Start editing
  const startEdit = useCallback(() => {
    setDraft(value ?? '');
    setEditing(true);
  }, [value]);

  // Commit the edit
  const commit = useCallback(() => {
    setEditing(false);
    const next = type === 'number' ? Number(draft) : draft;
    if (next !== value) {
      onSave?.(next);
    }
  }, [draft, onSave, type, value]);

  // Cancel the edit
  const cancel = useCallback(() => {
    setEditing(false);
    setDraft('');
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (typeof inputRef.current.select === 'function') {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  // Display string
  const display =
    children !== undefined
      ? children
      : formatDisplay
      ? formatDisplay(value)
      : (value ?? '—');

  return (
    <td
      onDoubleClick={editing ? undefined : startEdit}
      title={editing ? undefined : 'Double-click to edit'}
      className={`px-3 py-2 text-sm font-mono ${
        editing
          ? ''
          : 'cursor-pointer hover:bg-[#1a2a1a] dark:hover:bg-[#1a2a1a] hover:bg-[#ede3d5] transition-colors'
      } ${className}`}
    >
      {editing ? (
        type === 'select' ? (
          <select
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={INPUT_BASE}
            aria-label={field}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={draft}
            min={min}
            max={max}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={INPUT_BASE}
            aria-label={field}
          />
        )
      ) : (
        <span className="text-[#c4d4c0] dark:text-[#c4d4c0] text-[#2a1a08]">
          {display}
        </span>
      )}
    </td>
  );
}
