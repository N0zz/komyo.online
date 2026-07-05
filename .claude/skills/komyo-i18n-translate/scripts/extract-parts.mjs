#!/usr/bin/env node
// Splits the site's i18n key surface into translation-sized chunks + a changelog
// chunk, writing one <name>.keys.txt file per part to an output directory.
// See ../SKILL.md for the full workflow this feeds into.
//
// Usage: node extract-parts.mjs <outDir> [--missing <locale>]
//   --missing <locale>: incremental mode — emit only the keys present in pl but
//   absent in that locale ("add the new keys to an already-complete locale");
//   parts with nothing missing are skipped.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const USAGE = 'usage: node extract-parts.mjs <outDir> [--missing <locale>]';
const args = process.argv.slice(2);
let missingLang = null;
const mi = args.indexOf('--missing');
if (mi >= 0) {
  missingLang = args[mi + 1];
  if (!missingLang) { console.error(USAGE); process.exit(1); }
  args.splice(mi, 2);
}
const outDir = args[0];
if (!outDir) { console.error(USAGE); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

function load(file) {
  const code = fs.readFileSync(path.join(DIR, file), 'utf8');
  const sb = { window: {} }; sb.globalThis = sb;
  vm.runInNewContext(code, sb, { filename: file });
  return sb.window;
}

// The catalogue is split per language: i18n.js is the loader + the en (def-source) dict; every
// other locale lives in its own root-level i18n.<code>.js. Eval them all into ONE sandbox
// (same as test-harness.mjs's I18N list) to reconstruct the full KOMYO_I18N map.
function loadI18N() {
  const files = ['i18n.js']
    .concat(fs.readdirSync(DIR).filter(f => /^i18n\.[a-z]{2}\.js$/.test(f)).sort());
  const sb = { window: {} }; sb.globalThis = sb;
  for (const f of files) vm.runInNewContext(fs.readFileSync(path.join(DIR, f), 'utf8'), sb, { filename: f });
  return sb.window.KOMYO_I18N;
}

const I18N = loadI18N();
const CH = load('changelog.js').CHANGELOG;
const pl = I18N.pl; // pl is the reference locale (i18n.pl.js) — every key the site uses lives here.

// Incremental mode: emit only what the target locale is missing vs pl.
let target = null;
if (missingLang) {
  target = I18N[missingLang];
  if (!target) {
    console.error(`unknown locale "${missingLang}" — locales found (i18n.js + i18n.<code>.js): ${Object.keys(I18N).join(' ')}`);
    process.exit(1);
  }
}
const wanted = k => !target || !(k in target);

const KIT_NS = ['nav', 'confirm', 'pause', 'sound', 'kit', 'update', 'controls', 'embed', 'menu',
  'share', 'card', 'shop', 'grb', 'challenges', 'challenge', 'title', 'titles', 'lang', 'crt',
  'badge', 'tag', 'chal'];
const CAT_NS = ['cat', 'profile', 'drawer', 'fb', 'nl', 'cl', 'name', 'about', 'settings', 'faq',
  'legal', 'data', 'cookie', 'form', 'meta'];
// The heaviest per-game registries (upgrade/map/tower prose) — keep them alone in one
// part so no single translator part is wildly bigger than the others.
const HEAVY_GAMES = ['tower-defense', 'asteroids-plus', 'asteroids', 'bubbles'];

const keys = Object.keys(pl).filter(k => !k.startsWith('changelog.') && wanted(k));
const out = { part1_kit: [], part2_catalogue: [], part3_games_heavy: [], part4_games_rest: [], part5_cosmetics: [] };
for (const k of keys) {
  const ns = k.split('.')[0];
  if (ns === 'game') {
    const slug = k.split('.')[1];
    (HEAVY_GAMES.includes(slug) ? out.part3_games_heavy : out.part4_games_rest).push(k);
  } else if (ns === 'cos') out.part5_cosmetics.push(k);
  else if (KIT_NS.includes(ns)) out.part1_kit.push(k);
  else out.part2_catalogue.push(k); // CAT_NS + anything unclassified falls here
}
for (const [name, list] of Object.entries(out)) {
  if (missingLang && !list.length) { console.log(name, 0, '(skipped — nothing missing)'); continue; }
  fs.writeFileSync(path.join(outDir, name + '.keys.txt'), list.join('\n') + '\n');
  console.log(name, list.length);
}

// changelog is keyed by a REVERSE index (distance from CHANGELOG's end) — stable across
// prepends, since new entries are only ever added at the top. See index.html's changelog
// renderer and test.mjs's testI18nCoverage for the matching computation.
const chLines = [];
CH.forEach((r, i) => {
  const ei = CH.length - 1 - i;
  const push = (key, txt) => { if (wanted(key)) chLines.push(`${key}\t${txt}`); };
  push(`changelog.e${ei}.title`, r.title);
  r.items.forEach((it, j) => push(`changelog.e${ei}.b${j}`, it));
});
if (missingLang && !chLines.length) {
  console.log('part6_changelog', 0, '(skipped — nothing missing)');
} else {
  fs.writeFileSync(path.join(outDir, 'part6_changelog.keys.txt'), chLines.join('\n') + '\n');
  console.log('part6_changelog', chLines.length);
}
