import { NextRequest, NextResponse } from 'next/server';

const ROLES = ['pm', 'lead', 'dev'];

// Prototype only: stands in for sign-in by remembering the chosen role in a cookie.
export function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role') ?? '';
  const to = req.nextUrl.searchParams.get('to') || '/projects';
  const target = to.startsWith('/') && !to.startsWith('//') ? to : '/projects';
  const res = NextResponse.redirect(new URL(target, req.url));
  if (ROLES.includes(role)) res.cookies.set('role', role, { path: '/' });
  else if (role === 'out') res.cookies.delete('role');
  return res;
}
