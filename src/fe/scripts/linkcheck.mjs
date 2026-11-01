// Crawls the running prototype (npm run start) for each role, following every internal link.
// Fails on a dead link ("#", missing screen, or a screen the role cannot open) and lists
// screens the crawl never reached and controls that look like buttons but go nowhere.
const BASE = process.env.BASE || 'http://localhost:3100';
const HOMES = { pm: '/projects', lead: '/lead/overview', dev: '/my-work' };
import fs from 'node:fs';
let failed = 0;

// every screen the registry draws, so a screen no control reaches is reported
const reg = fs.readFileSync(new URL('../lib/screens.ts', import.meta.url), 'utf8');
const screens = [...reg.matchAll(/\{ file: '(\w+)', path: (P \+ )?'([^']*)'(?:, view: '([\w-]+)')?(?:, roles: \[([^\]]*)\])?/g)].map((m) => ({
  file: m[1],
  url: ((m[2] ? '/projects/p1' : '') + m[3]).replace(':id', 'p1') + (m[4] ? '?view=' + m[4] : ''),
  roles: m[5] ? m[5].split(',').map((x) => x.trim().replace(/'/g, '')) : null,
}));
const OPEN = new Set(['Styleguide', 'States', 'Register', 'RegisterAccount', 'RegisterFinish', 'Main', 'SignInError']);

for (const role of Object.keys(HOMES)) {
  const headers = { cookie: `role=${role}` };
  const seen = new Map();
  const queue = [HOMES[role]];
  const dead = [];
  const inert = new Map();
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    const res = await fetch(BASE + url, { headers, redirect: 'manual' });
    const html = await res.text();
    seen.set(url, res.status);
    if (res.status >= 300 || /Page not found|You cannot open this page/.test(html)) {
      dead.push(`${url} -> ${res.status} ${/Page not found/.test(html) ? 'not found' : /cannot open/.test(html) ? 'forbidden' : ''}`);
      continue;
    }
    for (const m of html.matchAll(/<a [^>]*href="([^"]*)"/g)) {
      const href = m[1].replace(/&amp;/g, '&');
      if (href === '#' || href === '') { dead.push(`${url} has a dead link`); continue; }
      if (href.startsWith('/api/') || href.startsWith('http')) continue;
      if (!seen.has(href)) queue.push(href);
    }
    for (const m of html.matchAll(/<(?:span|div)[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>(.*?)<\/(?:span|div)>/g)) {
      if (/aria-haspopup/.test(m[0]) || /type="submit"/.test(m[0])) continue;
      const label = m[1].replace(/<[^>]+>/g, '').trim() || '(icon)';
      if (url.includes('view=epics')) continue; // plan epic controls are handled in components/live/plan-actions.tsx
      inert.set(`${url} :: ${label}`, true);
    }
  }
  console.log(`[${role}] reached ${seen.size} URLs, ${dead.length} dead, ${inert.size} controls without a target`);
  for (const d of new Set(dead)) console.log('  DEAD', d);
  if (process.env.SHOW_INERT) for (const k of inert.keys()) console.log('  INERT', k);
  const unreached = screens.filter((x) => (!x.roles || x.roles.includes(role)) && !OPEN.has(x.file) && !seen.has(x.url)).map((x) => x.file);
  if (unreached.length) console.log('  UNREACHED', unreached.join(' '));
  failed += dead.length + unreached.length;
}
process.exit(failed ? 1 : 0);
