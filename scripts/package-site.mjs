#!/usr/bin/env node
// package-site.mjs — build the WHOLE-SITE offline bundle: komyo.zip.
//
// Usage:   node scripts/package-site.mjs
// Output:  komyo.zip           (unzip → open index.html; the arcade runs from file://, no internet)
//          dist-site/komyo/    (the staged, unzipped build, left around for inspection)
//
// This is the download behind Settings → "Play offline". No path rewriting is needed: the catalogue
// and the shared kit already suffix folder links with index.html under file:// at runtime
// (gamekit.localHref). So the bundle is just the live site minus dev-only files, plus a README.
//
// In CI (pages.yml) this runs AFTER version.js is stamped, so the bundle carries the live build stamp.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = path.join(ROOT, 'dist-site', 'komyo');
const ZIP = path.join(ROOT, 'komyo.zip');

// repo-relative paths / basenames that never belong in a play bundle (dev, build, docs, tests, VCS)
const SKIP_TOP = new Set(['.git', '.github', '.claude', 'node_modules', 'scripts', 'plans', 'dist-portal', 'dist-site', 'komyo.zip', '.gitignore', '.linters']);
const SKIP_BASE = new Set(['test.mjs', 'test-harness.mjs', '.DS_Store']);
const skip = (rel, base) => {
  const top = rel.split(path.sep)[0];
  if (SKIP_TOP.has(top) || SKIP_BASE.has(base)) return true;
  if (/\.md$/i.test(base)) return true;        // CLAUDE.md / ROADMAP / README / DESIGN — dev docs
  if (base === 'test.mjs') return true;
  return false;
};

fs.rmSync(STAGE, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(STAGE, { recursive: true });

// copy each top-level entry (copying ROOT itself into its own dist-site subdir is disallowed)
for (const entry of fs.readdirSync(ROOT)) {
  if (skip(entry, entry)) continue;
  fs.cpSync(path.join(ROOT, entry), path.join(STAGE, entry), {
    recursive: true,
    filter: (src) => !skip(path.relative(ROOT, src), path.basename(src)),
  });
}

// Strip the PWA manifest <link> from every bundled HTML: on file:// the browser can't fetch it
// (CORS blocks manifest requests from origin "null"), which logs a harmless-but-noisy console error.
// A downloaded copy has no service worker / install path anyway, so the manifest serves no purpose.
function stripManifest(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) stripManifest(p);
    else if (e.name.endsWith('.html')) {
      const t = fs.readFileSync(p, 'utf8');
      const out = t.replace(/[ \t]*<link[^>]*rel=["']manifest["'][^>]*>\s*\n?/gi, '');
      if (out !== t) fs.writeFileSync(p, out);
    }
  }
}
stripManifest(STAGE);

fs.writeFileSync(path.join(STAGE, 'README.txt'),
  'komyo — offline arcade\n' +
  '======================\n\n' +
  'A self-contained copy of https://komyo.online — play every game with no internet.\n\n' +
  'HOW TO PLAY\n' +
  '  1. Unzip this folder anywhere (a USB stick is fine).\n' +
  '  2. Open index.html in a web browser (double-click it).\n' +
  '  3. That is all — no install, no server, no account, no internet.\n\n' +
  'Scores and progress save in that browser, on that computer.\n' +
  'This copy does not update itself; grab a fresh one from komyo.online any time.\n');

execFileSync('zip', ['-q', '-r', '-X', ZIP, '.', '-x', '.DS_Store'], { cwd: STAGE });

const mb = (fs.statSync(ZIP).size / (1024 * 1024)).toFixed(1);
const count = execFileSync('unzip', ['-l', ZIP]).toString().trim().split('\n').pop();
console.log(`packaged site: ${path.relative(ROOT, ZIP)} (${mb} MB) — ${count.trim()}`);
