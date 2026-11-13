'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SelectOption } from './select';

// Searchable multi-select in the same pill style as Select. Options with an empty search show in
// the given order, so a caller can pin an entry (e.g. "Unassigned") at the top.
export default function MultiSelect({ values, onChange, options, label, placeholder, noun, compact = false, bar = false }: {
  /** Render as an always-visible search bar with the selection as chips (for long option names). */
  bar?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  label: string;
  placeholder: string;
  noun: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (open) root.current?.querySelector('.ss-opt.hi')?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  const byValue = new Map(options.map((o) => [o.value, o.label]));
  const summary = values.length === 0 ? placeholder
    : values.length === 1 ? (byValue.get(values[0]) ?? placeholder)
    : `${values.length} ${noun}`;

  const close = () => { setOpen(false); setQuery(''); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = shown[active]; if (o) toggle(o.value); }
    else if (e.key === 'Tab') close();
  };

  if (bar) {
    const onBarKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !query && values.length) onChange(values.slice(0, -1));
      else if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); }
    };
    return <div className={`ss ms ss-bar-wrap${open ? ' open' : ''}`} ref={root} onKeyDown={onKeyDown}>
      <div className={`ss-bar${values.length ? ' has' : ''}`} onClick={() => { setOpen(true); search.current?.focus(); }}>
        <svg className="ic" aria-hidden="true"><use href="#i-search" /></svg>
        {values.map((v) => <span key={v} className="ss-chip" title={byValue.get(v)}>
          <span>{byValue.get(v) ?? v}</span>
          <button type="button" aria-label={`Remove ${byValue.get(v) ?? v}`} onClick={(e) => { e.stopPropagation(); toggle(v); }}>×</button>
        </span>)}
        <input ref={search} className="ss-bar-input" role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          placeholder={values.length ? '' : placeholder} value={query}
          onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onBarKey} />
      </div>
      {open && <div className="ss-menu" role="presentation">
        <div className="ss-list" id={listId} role="listbox" aria-multiselectable="true" aria-label={label}>
          {shown.map((o, i) => {
            const on = values.includes(o.value);
            return <div key={o.value} role="option" aria-selected={on}
              className={`ss-opt${on ? ' on' : ''}${i === active ? ' hi' : ''}`}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(o.value)}>
              <span>{o.label}</span>
              <svg className="ic" aria-hidden="true" style={{ visibility: on ? 'visible' : 'hidden' }}><use href="#i-check" /></svg>
            </div>;
          })}
          {shown.length === 0 && <div className="ss-none">No matches</div>}
        </div>
        {values.length > 0 && <button type="button" className="ss-clear" onClick={() => onChange([])}>Clear selection</button>}
      </div>}
    </div>;
  }

  return <div className={`ss ms${compact ? ' compact' : ''}${open ? ' open' : ''}`} ref={root} onKeyDown={onKeyDown}>
    <button type="button" className={`ss-btn${values.length ? ' has' : ''}`} role="combobox" aria-label={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => (open ? close() : setOpen(true))}>
      <span className={`ss-val${values.length === 0 ? ' ph' : ''}`}>{summary}</span>
      {values.length > 1 && <span className="ss-count">{values.length}</span>}
      <svg className="ic ss-caret" aria-hidden="true"><use href="#i-down" /></svg>
    </button>
    {open && <div className="ss-menu" role="presentation">
      <input ref={search} className="ss-search" aria-label={`Search ${noun}`} placeholder={`Search ${noun}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="ss-list" id={listId} role="listbox" aria-multiselectable="true" aria-label={label}>
        {shown.map((o, i) => {
          const on = values.includes(o.value);
          return <div key={o.value} role="option" aria-selected={on}
            className={`ss-opt${on ? ' on' : ''}${i === active ? ' hi' : ''}`}
            onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(o.value)}>
            <span>{o.label}</span>
            <svg className="ic" aria-hidden="true" style={{ visibility: on ? 'visible' : 'hidden' }}><use href="#i-check" /></svg>
          </div>;
        })}
        {shown.length === 0 && <div className="ss-none">No matches</div>}
      </div>
      {values.length > 0 && <button type="button" className="ss-clear" onClick={() => onChange([])}>Clear selection</button>}
    </div>}
  </div>;
}
