'use client';
import Link from 'next/link';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { routeOf, type Role } from './screens';

export const RoleCtx = createContext<Role>('pm');
export const useRole = () => useContext(RoleCtx);

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Canvas hole values give inline styles as a CSS string. */
export function css(str: string | undefined): CSSProperties {
  const o: Record<string, string> = {};
  for (const part of (str || '').split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    o[k.startsWith('--') ? k : camel(k)] = part.slice(i + 1).trim();
  }
  return o as CSSProperties;
}

export const r = routeOf;

export function A({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) {
  return <Link href={href} {...(rest as object)}>{children}</Link>;
}
