'use client';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { toast } from './toast';

// A button that runs one data-layer call, shows "busy" while it waits, and reports the result as a toast.
export function Act({ className, children, run, ok, busyText, title }: { className: string; children: ReactNode; run: () => Promise<any>; ok: (res: any) => string; busyText?: string; title?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      title={title}
      onClick={async () => {
        setBusy(true);
        try {
          toast(ok(await run()));
        } catch (e) {
          toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'bad');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && busyText ? busyText : children}
    </button>
  );
}
