// Route smoke test: every screen listed on /screens answers 200 and renders for its role.
const base = process.env.BASE || 'http://localhost:3100';
let failed = 0;
for (const role of ['pm', 'lead', 'dev']) {
  const cookie = `role=${role}`;
  const index = await (await fetch(`${base}/screens`, { headers: { cookie } })).text();
  const urls = [...new Set([...index.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))].filter((u) => !u.startsWith('/api') && !u.startsWith('/_next'));
  let ok = 0;
  for (const u of urls) {
    const res = await fetch(base + u, { headers: { cookie }, redirect: 'manual' });
    const body = await res.text();
    const bad = res.status !== 200 || /Application error|Internal Server Error/.test(body) || !/class="app|class="sign|<main/.test(body);
    if (bad) { failed++; console.log(`[${role}] FAIL ${u} -> ${res.status}`); } else ok++;
  }
  console.log(`[${role}] ${ok}/${urls.length} routes ok`);
}
process.exit(failed ? 1 : 0);
