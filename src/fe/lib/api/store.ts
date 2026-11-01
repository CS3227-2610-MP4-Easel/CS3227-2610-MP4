'use client';
import { useSyncExternalStore } from 'react';
import { initialDb } from './fixtures';
import type { Db } from './types';

// The one in-memory database behind the data layer. It survives a reload through
// sessionStorage so a click-through keeps its changes; resetPrototypeData() clears it.
const KEY = 'easel-fe-db-v2';
let db: Db | null = null;
const subs = new Set<() => void>();

function load(): Db {
  if (db) return db;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(KEY) : null;
    if (raw) return (db = JSON.parse(raw) as Db);
  } catch {}
  return (db = initialDb());
}

export function read(): Db {
  return load();
}

export function write(mutate: (d: Db) => void): void {
  const next = structuredClone(load());
  mutate(next);
  db = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  subs.forEach((f) => f());
}

export function reset(): void {
  db = initialDb();
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
  subs.forEach((f) => f());
}

const serverSnapshot = initialDb();

export function useDb(): Db {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => load(),
    () => serverSnapshot,
  );
}
