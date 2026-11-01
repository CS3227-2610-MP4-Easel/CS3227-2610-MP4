'use client';
import Link from 'next/link';
import { useRole } from '../lib/nav';
import { SCREENS, urlOf } from '../lib/screens';
import Top from './canvas/Top';

const OPEN = new Set(['ScreenIndex']);
const words = (f: string) => f.replace(/([a-z])([A-Z0-9])/g, '$1 $2');

// Prototype only: lists every drawn screen and state so states with no natural trigger
// (empty lists, errors, narrow layout, degraded standup) can be opened.
export default function ScreenIndex() {
  const role = useRole();
  const mine = SCREENS.filter((s) => !OPEN.has(s.file) && (!s.roles || s.roles.includes(role)));
  return (
    <div className="app">
      <Top role={role} />
      <main className="main">
        <h1>All screens and states</h1>
        <p className="muted">Prototype index for the current role. Use the buttons at the bottom right to switch role.</p>
        <section className="card stack8">
          {mine.map((s) => (
            <Link key={s.file} href={urlOf(s)} className="row between">
              <span className="b">{words(s.file)}</span>
              <span className="small muted">{urlOf(s)}</span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
