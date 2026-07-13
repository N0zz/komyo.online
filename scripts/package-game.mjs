#!/usr/bin/env node
// package-game.mjs — build a SELF-CONTAINED portal zip (itch.io / Newgrounds) of one komyo game.
//
// Usage:   node scripts/package-game.mjs <slug>          e.g. node scripts/package-game.mjs asteroids-plus
// Output:  dist-portal/<slug>.zip  (index.html at the zip root — upload as-is to itch/Newgrounds)
//          dist-portal/<slug>/     (the staged, unzipped build, left around for inspection)
//
// What it does (ALL transforms happen in the staged COPY — repo files are never touched):
//   - copies games/<slug>/* (minus test.mjs) + every shared head file (SHARED_FILES below) +
//     every i18n.<code>.js locale listed in i18n.js's KOMYO_I18N_AVAILABLE into one flat folder;
//   - index.html: rewrites the atomic-head src/href from ../../X to ./X; points the nav
//     `home:` and any href="../../" at PORTAL_HOME (the komyo.online marketing backlink,
//     utm_source=portal&utm_medium=embed); rewrites sibling-game links (href="../<slug>/") to
//     absolute komyo.online URLs; neutralizes the `KIT.pwa('../../sw.js')` call (no service
//     worker on portals — sw.js is not bundled); injects a tiny snippet that opens all
//     komyo.online links in a new tab (portals run the game inside an iframe);
//   - game-kit.js: repoints its own lazy parent-path fetches ('../../qr.js',
//     '../../mascot-head.svg', '../../version.js', the '../../' home fallback) at the bundled
//     flat copies, so the kit is path-agnostic wherever the portal hosts the files;
//   - analytics.js ships AS-IS: it is consent-gated and the consent banner only exists on the
//     komyo.online catalogue, so on a portal it stays inert (no gtag load, no cookies).
//   Every transform asserts its expected match count — a refactor that breaks a pattern fails
//   the build loudly instead of shipping a broken zip.
//
// Adding a future game needs zero edits here: everything game-specific is derived from <slug>.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTAL_HOME = 'https://komyo.online?utm_source=portal&utm_medium=embed';
const GAME_URL = (slug) => `https://komyo.online/games/${slug}/?utm_source=portal&utm_medium=embed`;

// ---- data-driven transform config ----------------------------------------------------------
// shared head files (CLAUDE.md "Shared kit" order) + the kit's lazy-loaded assets
const SHARED_FILES = [
  'analytics.js', 'game-kit.css', 'version.js', 'game-kit.js',
  'challenges.js', 'cosmetics.js', 'games.js', 'i18n.js',
  'qr.js',              // lazy-loaded by the kit on score-card render
  'mascot-head.svg',    // drawn onto score/profile cards
];
// files in games/<slug>/ that are repo-only, never shipped
const GAME_SKIP = new Set(['test.mjs', 'CLAUDE.md', '.DS_Store']);

// index.html transforms: [description, regex, replacement, expected match count (n or [min,max])]
const HTML_TRANSFORMS = [
  ['head src/href ../../X -> ./X',
    /(src|href)="\.\.\/\.\.\/([\w.-]+)"/g, '$1="./$2"', [2, 99]],
  ['sibling game links -> absolute komyo.online',
    /href="\.\.\/([\w-]+)\/"/g, `href="https://komyo.online/games/$1/?utm_source=portal&utm_medium=embed"`, [0, 99]],
  ['bare href="../../" -> portal home backlink',
    /href="\.\.\/\.\.\/"/g, `href="${PORTAL_HOME}"`, [0, 99]],
  ['nav home: -> portal home backlink',
    /home:\s*(['"])\.\.\/(?:\.\.\/)?\1/g, `home: '${PORTAL_HOME}'`, 1],
  ['gamekit.pwa(../../sw.js) -> no-op',
    /[A-Za-z_$][\w$]*(?:\.[\w$]+)*\.pwa\(\s*(['"])\.\.\/\.\.\/sw\.js\1\s*\)/g,
    `void 0 /* portal build: no service worker */`, 1],
];

// game-kit.js (staged copy) transforms — literal strings, each must appear exactly once
const KIT_TRANSFORMS = [
  [`'../../qr.js'`, `'qr.js'`],
  [`'../../mascot-head.svg'`, `'mascot-head.svg'`],
  [`'../../version.js'`, `'version.js'`],
  [`opts.home || '../../'`, `opts.home || '${PORTAL_HOME}'`],
];

// injected before </body>: portals frame the game, so outbound komyo.online links open a new tab
const PORTAL_SNIPPET = `<script>(function(){try{document.querySelectorAll('a[href^="https://komyo.online"]').forEach(function(a){a.target='_blank';a.rel='noopener';});}catch(e){}})();</script>`;
// ---------------------------------------------------------------------------------------------

function die(msg) { console.error('package-game: ' + msg); process.exit(1); }

const slug = process.argv[2];
if (!slug || !/^[\w-]+$/.test(slug)) die('usage: node scripts/package-game.mjs <slug>');
const gameDir = path.join(ROOT, 'games', slug);
if (!fs.existsSync(path.join(gameDir, 'index.html'))) die(`no such game: games/${slug}/index.html`);

// locales stay in lockstep with the loader's list — parse it, never hardcode
const i18nSrc = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
const avail = i18nSrc.match(/KOMYO_I18N_AVAILABLE\s*=\s*\[([^\]]*)\]/);
if (!avail) die('could not find KOMYO_I18N_AVAILABLE in i18n.js');
const LOCALES = [...avail[1].matchAll(/['"]([\w-]+)['"]/g)].map((m) => m[1]);
if (!LOCALES.length) die('KOMYO_I18N_AVAILABLE parsed empty');

const stage = path.join(ROOT, 'dist-portal', slug);
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

// 1) the game's own files (flat, minus repo-only files)
for (const f of fs.readdirSync(gameDir)) {
  if (GAME_SKIP.has(f)) continue;
  fs.copyFileSync(path.join(gameDir, f), path.join(stage, f));
}

// 2) shared head files + all locale files, flat next to index.html
for (const f of [...SHARED_FILES, ...LOCALES.map((c) => `i18n.${c}.js`)]) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) die(`shared file missing: ${f}`);
  fs.copyFileSync(src, path.join(stage, f));
}

// 3) transform index.html (staged copy only)
function applyTransforms(file, transforms, isRegex) {
  let text = fs.readFileSync(file, 'utf8');
  for (const t of transforms) {
    if (isRegex) {
      const [desc, re, repl, expect] = t;
      const n = (text.match(re) || []).length;
      const [min, max] = Array.isArray(expect) ? expect : [expect, expect];
      if (n < min || n > max) die(`${path.basename(file)}: "${desc}" matched ${n}× (expected ${min}${max !== min ? '–' + max : ''})`);
      text = text.replace(re, repl);
    } else {
      const [find, repl] = t;
      const n = text.split(find).length - 1;
      if (n !== 1) die(`${path.basename(file)}: literal ${JSON.stringify(find)} found ${n}× (expected 1)`);
      text = text.replace(find, repl);
    }
  }
  fs.writeFileSync(file, text);
  return text;
}
let html = applyTransforms(path.join(stage, 'index.html'), HTML_TRANSFORMS, true);
const bodyEnd = html.lastIndexOf('</body>');
if (bodyEnd < 0) die('index.html: no </body>');
html = html.slice(0, bodyEnd) + PORTAL_SNIPPET + '\n' + html.slice(bodyEnd);
fs.writeFileSync(path.join(stage, 'index.html'), html);
if (html.includes('../')) die('index.html still contains a parent-path reference after transforms');

// 4) transform the staged game-kit.js
applyTransforms(path.join(stage, 'game-kit.js'), KIT_TRANSFORMS, false);

// 5) zip (index.html at zip root — what itch/Newgrounds expect)
const zipPath = path.join(ROOT, 'dist-portal', `${slug}.zip`);
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zipPath, '.', '-x', '.DS_Store'], { cwd: stage });
const kb = Math.round(fs.statSync(zipPath).size / 1024);
console.log(`packaged ${slug}: ${path.relative(ROOT, zipPath)} (${kb} KB, ${fs.readdirSync(stage).length} files; locales: en+${LOCALES.join(',')})`);
