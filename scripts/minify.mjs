#!/usr/bin/env node
// Build a MINIFIED copy of the site into dist-min/ (gitignored).
//
// Why a copy and not in-place: the sources are the source of truth and the suites read them as
// text (they assert on selectors, script order, head contents). Minifying in place would make the
// repo unreadable AND break ~40 asserts. So this mirrors the site and swaps .js/.css for minified
// versions — the HTML is left alone, since its inline <script>/<style> blocks are what the tests
// grep and the win there is small next to game-kit.js/css.
//
//   node scripts/minify.mjs            build dist-min/
//   node scripts/minify.mjs --serve    build, then serve it on :8766 for Lighthouse
//
// esbuild is a DEV-ONLY dependency (same standing as playwright) — nothing shipped needs it.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-min');
// mirrors what the service worker actually ships; anything else is dev tooling
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'dist-min', 'dist-portal', 'dist-site',
  'dist-soundtrack', '.playwright-mcp', 'plans', 'scripts']);
const SKIP_FILES = new Set(['package.json', 'package-lock.json', 'test.mjs', 'test-harness.mjs',
  'test-menu-browser.mjs', 'komyo.zip']);

let esbuild;
try { esbuild = await import('esbuild'); } catch {
  console.error('esbuild is missing — install the dev dependency first:\n  npm i -D esbuild');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

rmSync(OUT, { recursive: true, force: true });
const files = walk(ROOT);
let rawTotal = 0, minTotal = 0;
const savings = [];

for (const src of files) {
  const rel = relative(ROOT, src);
  const dst = join(OUT, rel);
  mkdirSync(dirname(dst), { recursive: true });
  const ext = extname(src);
  if (ext !== '.js' && ext !== '.css' && ext !== '.mjs') { copyFileSync(src, dst); continue; }
  if (ext === '.mjs') { copyFileSync(src, dst); continue; }   // per-game test suites — not shipped
  const code = readFileSync(src, 'utf8');
  let out;
  try {
    out = (await esbuild.transform(code, {
      loader: ext === '.css' ? 'css' : 'js',
      minify: true,
      legalComments: 'none',
      // esnext = minify ONLY, never downlevel. These sources already run as-is in every browser we
      // support; asking for an old target makes esbuild try to transpile (and fail on destructuring).
      target: 'esnext',
      // without this, non-ASCII is escaped to \uXXXX — which made the 8 locale files BIGGER than
      // their sources and turned the whole build into a net loss
      charset: 'utf8',
    })).code;
  } catch (e) {
    console.error(`  ! ${rel}: ${e.message.split('\n')[0]} — copied unminified`);
    copyFileSync(src, dst); continue;
  }
  writeFileSync(dst, out);
  rawTotal += code.length; minTotal += out.length;
  if (code.length - out.length > 4096) savings.push([rel, code.length, out.length]);
}

const kb = n => (n / 1024).toFixed(0) + ' KB';
savings.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
console.log('minified into dist-min/\n');
for (const [rel, a, b] of savings.slice(0, 10)) {
  console.log(`  ${rel.padEnd(24)} ${kb(a).padStart(8)} -> ${kb(b).padStart(8)}   (-${Math.round((1 - b / a) * 100)}%)`);
}
console.log(`\n  TOTAL js+css           ${kb(rawTotal).padStart(8)} -> ${kb(minTotal).padStart(8)}   (-${Math.round((1 - minTotal / rawTotal) * 100)}%)`);

if (process.argv.includes('--serve')) {
  const { createServer } = await import('node:http');
  const PORT = 8766;
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.txt': 'text/plain', '.xml': 'application/xml' };
  createServer((req, res) => {
    const deny = () => { res.writeHead(404); res.end('not found'); };
    let p;
    // a malformed escape (%ZZ) throws — unguarded it kills the request mid-flight
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch { return deny(); }
    if (p.endsWith('/')) p += 'index.html';
    // Resolve, then prove the result is still inside dist-min. join() alone happily walks out:
    // GET /../../../../etc/hosts served /etc/hosts. Localhost-only dev tooling, but any browser
    // tab — or anything else on the machine — can reach it while it is running.
    const f = resolve(OUT, '.' + (p.startsWith('/') ? p : '/' + p));
    if (f !== OUT && !f.startsWith(OUT + sep)) return deny();
    try {
      const body = readFileSync(f);
      res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { deny(); }
  }).listen(PORT, '127.0.0.1', () => console.log(`\nserving dist-min/ on http://localhost:${PORT}/  (Ctrl-C to stop)`));
}
