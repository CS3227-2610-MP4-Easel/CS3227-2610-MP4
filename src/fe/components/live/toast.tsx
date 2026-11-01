'use client';
import { useEffect, useState } from 'react';

type T = { id: number; text: string; kind: 'ok' | 'bad' | 'info' };
const EVENT = 'easel-toast';

export function toast(text: string, kind: T['kind'] = 'ok') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

export function ToastHost() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { text: string; kind: T['kind'] };
      const id = ++n;
      setItems((xs) => [...xs, { id, ...d }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 72, zIndex: 80, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      {items.map((t) => (
        <div key={t.id} className={`banner ${t.kind === 'bad' ? 'b-bad' : t.kind === 'info' ? 'b-info' : 'b-ok'}`} style={{ boxShadow: 'var(--sh)', minWidth: 260 }}>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
