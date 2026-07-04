#!/usr/bin/env node
// scaffold.mjs — stamp a new komyo game folder from the skill's templates.
//
//   node scaffold.mjs <slug> "<title>" "<icon>" "<accent>" [themeKey]
//
// Writes games/<slug>/{index.html,test.mjs,sw.js,manifest.json} from ../assets/*.tmpl with
// {{SLUG}}/{{TITLE}}/{{ICON}}/{{ACCENT}}/{{THEME_KEY}} filled in. It NEVER edits the shared
// files (games.js, challenges.js, cosmetics.js, sitemap.xml, llms.txt, changelog.js) — only
// stamps the folder. It prints the remaining manual steps at the end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '..', 'assets');
// scripts/ lives at .claude/skills/komyo-new-game/scripts/ → repo root is 4 levels up.
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const [, , slug, title, icon, accent, themeKeyArg] = process.argv;

function die(msg) { console.error('error: ' + msg); process.exit(1); }

if (!slug || !title || !icon || !accent) {
  die('usage: node scaffold.mjs <slug> "<title>" "<icon>" "<accent>" [themeKey]');
}
if (!/^[a-z0-9_][a-z0-9_-]*$/.test(slug)) {
  die('slug must be lowercase letters/digits/hyphens (the slug is the ONE identity): got "' + slug + '"');
}
if (!/^#[0-9a-fA-F]{3,8}$/.test(accent)) {
  die('accent must be a hex color like "#8b5cf6": got "' + accent + '"');
}
const themeKey = themeKeyArg || 'neon';

const destDir = path.join(ROOT, 'games', slug);
if (fs.existsSync(destDir)) {
  die('games/' + slug + ' already exists — refusing to overwrite. Remove it first or pick another slug.');
}

const REPL = {
  '{{SLUG}}': slug,
  '{{TITLE}}': title,
  '{{ICON}}': icon,
  '{{ACCENT}}': accent,
  '{{THEME_KEY}}': themeKey,
};
function fill(s) {
  for (const [k, v] of Object.entries(REPL)) s = s.split(k).join(v);
  return s;
}

const FILES = [
  ['index.html.tmpl', 'index.html'],
  ['test.mjs.tmpl', 'test.mjs'],
  ['sw.js.tmpl', 'sw.js'],
  ['manifest.json.tmpl', 'manifest.json'],
  ['favicon.svg.tmpl', 'favicon.svg'],
];

fs.mkdirSync(destDir, { recursive: true });
for (const [tmpl, out] of FILES) {
  const src = path.join(ASSETS, tmpl);
  if (!fs.existsSync(src)) die('missing template: ' + src);
  fs.writeFileSync(path.join(destDir, out), fill(fs.readFileSync(src, 'utf8')));
  console.log('  wrote games/' + slug + '/' + out);
}

console.log('\nStamped games/' + slug + '/ (index.html, test.mjs, sw.js, manifest.json, favicon.svg).');
console.log('\nRemaining manual steps (this script does NOT touch shared files):');
console.log('\n  1. Icons (from repo root):');
console.log("       node scripts/gen-icon.mjs '" + icon + "' '" + accent + "' games/" + slug);
console.log('     (writes icon-192.png / icon-512.png; favicon.svg was already stamped).');
console.log('\n  2. challenges.js — add the CHALLENGES.goodRun bar for "' + slug + '"');
console.log('     (without it the game SILENTLY never earns good runs). Add two goal ids to');
console.log('     the daily/weekly pool when it goes live.');
console.log('\n  3. cosmetics.js — add a skin set (a free default at price 0) under "' + slug + '.<set>";');
console.log("     read it in render via KIT.cosmetics.selected('" + slug + ".<set>').");
console.log('\n  4. games.js — add the tile entry:');
console.log('       { slug: "' + slug + '", title: "' + title + '", icon: "' + icon + '", accent: "' + accent + '",');
console.log('         blurb: "…", tags: ["…"], added: "YYYY-MM-DD" }');
console.log('\n  5. On go-live (not soon:): add https://komyo.online/games/' + slug + '/ to sitemap.xml AND llms.txt.');
console.log('\n  6. changelog.js — prepend ONE player-facing entry for the release.');
console.log('\n  7. i18n — Polish is REQUIRED (node test.mjs enforces it). English works from the');
console.log('     KIT.t def: fallbacks, but add game.' + slug + '.* keys to the pl block in i18n.js');
console.log('     (reuse game.common.* for shared strings). The i18n-coverage test lists any missing.');
console.log('     es/pt/fr/it stay empty until a full translation pass (empty-or-complete is enforced).');
console.log('\n  8. Run the suites:  node test.mjs   &&   node games/' + slug + '/test.mjs');
