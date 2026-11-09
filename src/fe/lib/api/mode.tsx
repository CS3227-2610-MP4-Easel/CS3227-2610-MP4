'use client';
import type { ReactNode } from 'react';

// LLM_MODE is the only switch (no new variable): `live` sends the plan flow (endpoints 34 to 41) to /api,
// anything else keeps the fixtures. The server layout reads it and hands it down; it is not NEXT_PUBLIC_.
let live = false;

export const isLive = () => live;

export function ModeProvider({ live: value, children }: { live: boolean; children: ReactNode }) {
  live = value;
  return <>{children}</>;
}
