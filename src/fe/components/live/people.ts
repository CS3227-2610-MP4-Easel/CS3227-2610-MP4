import type { Person } from '../../lib/api';

export const WHO: Record<Person, { av: string; ini: string; name: string }> = {
  pn: { av: 'a3', ini: 'PN', name: 'Priya N.' },
  ml: { av: 'a2', ini: 'ML', name: 'Marcus L.' },
  wo: { av: 'a4', ini: 'WO', name: 'Wei Ling O.' },
};

export const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtFull = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
