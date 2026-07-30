#!/usr/bin/env node
// Music distinctness linter.  Run: node scripts/audio-lint.mjs
//
// Each game's track is DATA (musical params + sound palette) in the TRACKS registry inside
// game-kit.js, so distinctness is a pure data-diff — no audio analysis needed.
//
// It reads the LIVE registry. The previous version parsed plans/audio-lab.html, a design mock that
// only ever held 11 of the tracks — which is how a shipped pair scoring 83% similar passed the lint
// clean. Anything that grades what ships has to read what ships.
import { readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const src = readFileSync(new URL('game-kit.js', ROOT), 'utf8');

// Pull `var NAME = {…}` out of the file and evaluate it.
// SAFETY: dev-only tool reading our OWN committed game-kit.js (not user input, not network data);
// the slice is a config literal
// (numbers/strings/arrays/bools). eval parses JS object-literal syntax (unquoted keys, single
// quotes) that JSON.parse cannot.
function grab(name) {
  const i = src.indexOf('var ' + name + ' =');
  if (i < 0) throw new Error('not found: ' + name);
  let j = src.indexOf('=', i) + 1; while (/\s/.test(src[j])) j++;
  const open = src[j], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, q = '', k = j;
  for (; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (c === q && src[k - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) { k++; break; }
  }
  return eval('(' + src.slice(j, k) + ')');
}

const TRACKS = grab('TRACKS');
const ALIAS = grab('ALIAS');

// which game plays which track (a track nobody plays is dead weight; a live game with no track
// falls back to a default and sounds like somebody else)
const gamesSrc = readFileSync(new URL('games.js', ROOT), 'utf8');
const win = {};
new Function('window', gamesSrc)(win);
const played = {};
for (const g of (win.GAMES || []).filter(x => !x.soon)) {
  let html = '';
  try { html = readFileSync(new URL('games/' + g.slug + '/index.html', ROOT), 'utf8'); } catch (e) { continue; }
  for (const call of html.matchAll(/music\.play\(([^;]{0,200}?)\)\s*;/g)) {
    for (const lit of call[1].matchAll(/['"]([\w-]+)['"]/g)) {
      const id = ALIAS[lit[1]] || lit[1];
      if (TRACKS[id] && !(played[id] || []).includes(g.title)) (played[id] = played[id] || []).push(g.title);
    }
  }
}

// ---- similarity model -------------------------------------------------------------------------
// Weighted so what an EAR notices most carries most: drum kit and arrangement dominate, then the
// chord progression and the hook, then mode/tempo/key. Two tracks sharing kit + arrangement
// template + groove start above 50% before a single note is compared — which is why choosing an
// UNUSED kit / template / groove combination is the strongest lever a new game has.
//
// v3 added two axes the old model couldn't see:
//   · `arr` — the arrangement TEMPLATE (dance / lush / epic / tactical / puzzle / retro). Two tracks
//     on the same template share their section shapes, so they build and drop at the same moments.
//   · `seed` — the motif seed. The hook is now a pure function of (seed, scale), so an identical
//     seed on an identical mode is literally the same tune.
const W = { kit: 0.20, arr: 0.18, groove: 0.16, prog: 0.16, scale: 0.12, bpm: 0.08, root: 0.04, seed: 0.06 };
const fam = t => t.groove || t.prod || '';
function similarity(a, b) {
  let s = 0;
  if ((a.kit || '') === (b.kit || '')) s += W.kit;
  if ((a.arr || '') === (b.arr || '')) s += W.arr;
  if (fam(a) === fam(b)) s += W.groove;
  const pa = a.prog || [], pb = b.prog || [];
  if (pa.length && pb.length) s += W.prog * (pa.filter((v, i) => pb[i] === v).length / Math.max(pa.length, pb.length));
  const sameMode = (a.scale || []).join() === (b.scale || []).join();
  if (sameMode) s += W.scale;
  if (Math.abs((a.bpm || 0) - (b.bpm || 0)) <= 6) s += W.bpm;
  if (Math.abs((a.root || 0) - (b.root || 0)) < 1) s += W.root;
  if (a.seed && a.seed === b.seed && sameMode) s += W.seed;   // same seed + same mode = same melody
  // a per-track high-intensity signature layer pulls them apart exactly where the engine converges
  if ((a.sig || '') && (a.sig || '') === (b.sig || '')) s += 0.05;
  else if ((a.sig || '') !== (b.sig || '')) s -= 0.05;
  return Math.max(0, s);
}
function why(a, b) {
  const out = [];
  if ((a.kit || '') === (b.kit || '')) out.push('drum kit ' + a.kit);
  if ((a.arr || '') === (b.arr || '')) out.push('template ' + (a.arr || 'default'));
  if (fam(a) === fam(b)) out.push('groove ' + (fam(a) || 'none'));
  const pa = a.prog || [], pb = b.prog || [];
  const ov = pa.length ? pa.filter((v, i) => pb[i] === v).length / pa.length : 0;
  if (ov >= 0.5) out.push('progression ' + Math.round(ov * 100) + '%');
  const sameMode = (a.scale || []).join() === (b.scale || []).join();
  if (sameMode) out.push('same mode');
  if (Math.abs((a.bpm || 0) - (b.bpm || 0)) <= 6) out.push('bpm ±6');
  if (Math.abs((a.root || 0) - (b.root || 0)) < 1) out.push('same key');
  if (a.seed && a.seed === b.seed && sameMode) out.push('SAME HOOK (seed ' + a.seed + ')');
  if (!a.sig && !b.sig) out.push('no high-intensity signature');
  return out.join(', ');
}

const REDESIGN = 0.68, SIBLING = 0.55;
const ids = Object.keys(TRACKS);
// One game's own variants are meant to resemble each other — Snake's two cosmetic tracks, Keep
// Defender's six biomes. The `game` field on a TRACK declares that family explicitly; the old
// prefix guess couldn't see that kd_ice and kd_dungeon belong to the same game, and flagged them.
const variantPair = (x, y) => {
  const a = TRACKS[x], b = TRACKS[y];
  if (a.game && b.game && a.game === b.game) return true;
  return x.startsWith(y) || y.startsWith(x);
};
const pairs = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    pairs.push({ a: ids[i], b: ids[j], v: similarity(TRACKS[ids[i]], TRACKS[ids[j]]), variant: variantPair(ids[i], ids[j]) });
  }
}
pairs.sort((x, y) => y.v - x.v);

const label = id => id + (played[id] ? ' (' + played[id].join(', ') + ')' : '');
console.log(`\n🎧  MUSIC DISTINCTNESS — ${ids.length} tracks, ${pairs.length} pairs · live TRACKS in game-kit.js\n`);

const bad = pairs.filter(p => p.v >= REDESIGN && !p.variant);
console.log('── ❌ TOO SIMILAR — redesign (≥ ' + REDESIGN * 100 + '%) ' + '─'.repeat(22));
if (!bad.length) console.log('  ✅ none.');
for (const p of bad) console.log(`  ${Math.round(p.v * 100)}%  ${label(p.a)} ✕ ${label(p.b)}   [${why(TRACKS[p.a], TRACKS[p.b])}]`);

const sib = pairs.filter(p => p.v >= SIBLING && p.v < REDESIGN && !p.variant);
console.log('\n── ⚠️  GENRE SIBLINGS — review (' + SIBLING * 100 + '–' + REDESIGN * 100 + '%) ' + '─'.repeat(18));
if (!sib.length) console.log('  ✅ none.');
for (const p of sib) console.log(`  ${Math.round(p.v * 100)}%  ${label(p.a)} ✕ ${label(p.b)}   [${why(TRACKS[p.a], TRACKS[p.b])}]`);

// a duplicated progression is the cheapest thing to fix and among the most audible
console.log('\n── PROGRESSIONS (unique per game) ' + '─'.repeat(28));
const byProg = {};
for (const id of ids) if (TRACKS[id].prog) (byProg[TRACKS[id].prog.join(',')] = byProg[TRACKS[id].prog.join(',')] || []).push(id);
const dup = Object.entries(byProg).filter(([, v]) => v.length > 1 && v.some(x => v.some(y => y !== x && !variantPair(x, y))));
if (!dup.length) console.log('  ✅ every game has its own chord progression.');
for (const [p, v] of dup) console.log(`  ⚠️  [${p}] shared by ${v.join(' + ')}`);

// the engine stacks every layer at high intensity, so tracks converge exactly when the action peaks
console.log('\n── HIGH-INTENSITY SIGNATURES ' + '─'.repeat(32));
const noSig = ids.filter(id => !TRACKS[id].sig);
console.log('  with a signature: ' + ids.filter(id => TRACKS[id].sig).map(id => id + ':' + TRACKS[id].sig).join(', ') || '  none');
if (noSig.length) console.log('  without one (converge when all layers are on): ' + noSig.join(', '));

console.log('\n── COVERAGE ' + '─'.repeat(48));
// a track is covered if a game plays it OR a sibling from the same game is played (biome/cosmetic
// variants are swapped in at runtime, so they never appear in a music.play() literal)
const orphan = ids.filter(id => !played[id] && !ids.some(o => o !== id && variantPair(id, o) && played[o]));
const heard = Object.values(played).flat();
const silent = (win.GAMES || []).filter(g => !g.soon).map(g => g.title).filter(t => !heard.includes(t));
console.log('  tracks with no game:', orphan.length ? orphan.join(', ') : 'none');
console.log('  live games with no track:', silent.length ? silent.join(', ') : 'none');

const worst = pairs.find(p => !p.variant);
console.log(`\n  Summary: ${bad.length} to-redesign · ${sib.length} siblings · worst pair ${Math.round(worst.v * 100)}% (${worst.a} ✕ ${worst.b})\n`);
process.exit(bad.length ? 1 : 0);
