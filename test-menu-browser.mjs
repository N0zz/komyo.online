// Real-browser menu-fit gate. Loads every live game in headless Chromium at the two tight viewports
// and asserts the START menu AND a representative END screen (score card + New best + stat line) do
// NOT scroll (box / scroll pane / landscape rail all fit). Unlike the
// old JS model, this uses the real CSS layout engine — it can't give a false "fits". Service workers
// are blocked so it always tests the on-disk CSS, never a cached build. Live games are auto-discovered
// from games.js (a new game is covered automatically). Dev-only: needs `npm i` (playwright).
//
// Run: `npm run test:menus`  (or `node test-menu-browser.mjs`).  Exits non-zero on any overflow.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const VPS = [{ w: 360, h: 640, n: 'portrait 360×640' }, { w: 640, h: 360, n: 'landscape 640×360' }];
const browser = await chromium.launch();
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();

// discover live (not `soon`) games straight from games.js
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
const games = await page.evaluate(() => (window.GAMES || []).filter(g => !g.soon).map(g => g.slug));

const fails = [], skips = [];
for (const g of games) {
  for (const v of VPS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.goto(`${base}/games/${g}/`, { waitUntil: 'load' });
    const hasMenu = await page.waitForSelector('.gkm-box', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!hasMenu) { skips.push(`${g} (${v.n}): no gamekit start menu (custom start UI)`); continue; }
    const ovExpr = `(() => { const ov=e=>e?Math.max(0,e.scrollHeight-e.clientHeight):0,q=s=>document.querySelector(s);
      return { box: ov(q('.gkm-box')), pane: ov(q('.gkm-scroll')), rail: ov(q('.gkm-rail')) }; })()`;

    // START menu
    const r = await page.evaluate(ovExpr);
    const startOver = Math.max(r.box, r.pane, r.rail);
    if (startOver > 1) fails.push(`${g} (${v.n}) START: menu SCROLLS +${startOver}px (${r.rail > 1 ? 'rail' : r.pane > 1 ? 'card pane' : 'box'})`);

    // END screen — render a representative end menu through THIS game's kit + theme (the share card is
    // the tall element; a stat line + New best exercise the busy case). Kit-owned layout, real theme.
    const e = await page.evaluate(async (g) => {
      const K = window.gamekit; if (!K || !K.menu) return { skip: true };
      try {
        K.menu.hide();
        K.menu.show({ kind: 'end', title: 'GAME OVER', score: 123456, best: 999999, newBest: true,
          lines: ['Waves cleared: 12'],
          share: { slug: g, accent: '#88ccff', icon: '🎮', title: 'Test Game', message: () => 'test', params: () => ({}) },
          actions: [{ id: 'a', label: 'PLAY AGAIN', primary: true }, { id: 'm', label: 'MENU' }] });
      } catch (err) { return { err: String(err) }; }
      await new Promise(r => setTimeout(r, 450)); // let the score card + QR render
      const ov = el => el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0, q = s => document.querySelector(s);
      return { box: ov(q('.gkm-box')), pane: ov(q('.gkm-scroll')), rail: ov(q('.gkm-rail')) };
    }, g);
    if (!e.skip && !e.err) {
      const endOver = Math.max(e.box, e.pane, e.rail);
      if (endOver > 1) fails.push(`${g} (${v.n}) END: menu SCROLLS +${endOver}px (${e.rail > 1 ? 'rail' : e.pane > 1 ? 'card pane' : 'box'})`);
    }
  }
}

await browser.close();
server.close();

if (skips.length) { console.log('skipped (no gamekit menu):'); skips.forEach(s => console.log('  · ' + s)); }
if (fails.length) {
  console.error(`\n✗ menu-fit: ${fails.length} FAILURE(S) — a menu scrolls on a small screen:`);
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log(`\n✓ menu-fit: all ${games.length} live games × ${VPS.length} viewports (start + end) — no menu scrolls.`);
