'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface SelectOption { value: string; label: string }

// Styled replacement for the native <select>: rounded trigger, a floating menu of pill options,
// brand accent on the chosen one. Keyboard: arrows/Home/End move, Enter/Space choose, Esc closes.
export default function Select({ value, onChange, options, id, label, compact = false, disabled = false, buttonRef }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.findIndex((o) => o.value === value);
  const current = options[selected];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  useEffect(() => {
    if (open) root.current?.querySelector('.ss-opt.hi')?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const show = () => { setActive(Math.max(selected, 0)); setOpen(true); };
  const pick = (i: number) => { const o = options[i]; if (o) onChange(o.value); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return <div className={`ss${compact ? ' compact' : ''}${open ? ' open' : ''}`} ref={root} onKeyDown={onKeyDown}>
    <button type="button" id={id} ref={buttonRef} className="ss-btn" disabled={disabled} role="combobox" aria-label={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
      onClick={() => (open ? setOpen(false) : show())}>
      <span className={`ss-val${current && current.value === '' ? ' ph' : ''}`}>{current?.label ?? ''}</span>
      <svg className="ic ss-caret" aria-hidden="true"><use href="#i-down" /></svg>
    </button>
    {open && <div className="ss-menu" id={listId} role="listbox" aria-label={label}>
      {options.map((o, i) => <div key={o.value} role="option" aria-selected={i === selected}
        className={`ss-opt${i === selected ? ' on' : ''}${i === active ? ' hi' : ''}`}
        onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
        <span>{o.label}</span>
        {i === selected && <svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>}
      </div>)}
    </div>}
  </div>;
}
