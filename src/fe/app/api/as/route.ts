import { NextRequest, NextResponse } from 'next/server';
import { authMode } from '../../../lib/auth/mode';

const ROLES = ['pm', 'lead', 'dev'];

// Prototype only: stands in for sign-in by remembering the chosen role in a cookie.
export function GET(req: NextRequest) {
  if (authMode(process.env) !== 'prototype') return new Response(null, { status: 404 });
  const role = req.nextUrl.searchParams.get('role') ?? '';
  const to = req.nextUrl.searchParams.get('to') || '/projects';
  const u = new URL(to, req.url);
  const sameSite =
    to.startsWith('/') &&
    !to.includes('\\') &&
    !/%5c/i.test(to) &&
    u.origin === new URL(req.url).origin &&
    !u.pathname.startsWith('//');
  // Redirect to the checked URL itself: re-parsing a normalised '//host' path would go off-site.
  const res = NextResponse.redirect(sameSite ? u : new URL('/projects', req.url));
  const cookie = { path: '/', sameSite: 'lax', httpOnly: true, secure: req.nextUrl.protocol === 'https:' } as const;
  if (ROLES.includes(role)) res.cookies.set('role', role, cookie);
  else if (role === 'out') res.cookies.delete('role');
  return res;
}
