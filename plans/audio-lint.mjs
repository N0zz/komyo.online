#!/usr/bin/env node
// Detective linter for the Audio Lab. Each game's MODERN track is DATA (theme + palette overrides),
// so distinctness is a pure data-diff — no audio analysis. This version PARSES plans/audio-lab.html
// directly (GAMES + THEMES + PALETTES) so it can never drift out of sync. Run: node plans/audio-lint.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./audio-lab.html', import.meta.url), 'utf8');

// pull a `var NAME = {…}|[…]` literal out of the file and evaluate it.
// SAFETY: this is a dev-only linter that reads our OWN committed audio-lab.html (not user input,
// not network data); the extracted slices are pure config literals (numbers/strings/arrays/bools).
// eval is used deliberately to parse JS object-literal syntax (unquoted keys / single quotes) that
// JSON.parse can't handle. If audio-lab.html is ever fed untrusted content, swap for a real JS parser.
function grab(name) {
  const i = src.indexOf('var ' + name + ' =');
  if (i < 0) throw new Error('not found: ' + name);
  let j = src.indexOf('=', i) + 1; while (/\s/.test(src[j])) j++;
  const open = src[j], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, q = '';
  let k = j;
  for (; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (c === q && src[k - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) { k++; break; }
  }
  return eval('(' + src.slice(j, k) + ')');
}
const GAMES = grab('GAMES'), THEMES = grab('THEMES'), PALETTES = grab('PALETTES');

// effective MODERN track = theme merged with palette proposal overrides
const tracks = GAMES.map(g => {
  const T = THEMES[g.theme], P = PALETTES[g.key] || {};
  return {
    game: g.name,
    root: P.root ?? T.root, bpm: P.bpm ?? T.bpm, scale: P.scale || T.scale, prog: P.prog || T.prog,
    kit: P.kit || '?', style: P.groove || P.prod || '?',
    cur: { root: T.root, bpm: T.bpm, scale: (T.scale || []).join(','), prog: (T.prog || []).join(',') },
  };
});

const W = { prog: 0.26, style: 0.24, kit: 0.18, tempo: 0.12, scale: 0.10, root: 0.10 };
const SOFT = 0.55, HARD = 0.68;

const bandIdx = b => (b < 95 ? 0 : b < 116 ? 1 : 2);
const progSim = (a, b) => { const n = Math.min(a.length, b.length); let m = 0; for (let i = 0; i < n; i++) if (a[i] === b[i]) m++; return m / Math.max(a.length, b.length); };
const scaleSim = (a, b) => { const A = new Set(a), B = new Set(b); let x = 0; A.forEach(v => B.has(v) && x++); return x / (A.size + B.size - x); };
const tempoSim = (a, b) => { const d = Math.abs(bandIdx(a) - bandIdx(b)); return d === 0 ? 1 : d === 1 ? 0.5 : 0; };

function sim(a, b) {
  const parts = { prog: progSim(a.prog, b.prog), style: a.style === b.style ? 1 : 0, kit: a.kit === b.kit ? 1 : 0, tempo: tempoSim(a.bpm, b.bpm), scale: scaleSim(a.scale, b.scale), root: a.root === b.root ? 1 : 0 };
  let s = 0; for (const k in W) s += W[k] * parts[k];
  return { score: s, parts };
}
const label = { prog: 'progression', style: 'groove/style family', kit: 'drum kit', tempo: 'tempo band', scale: 'scale/mode', root: 'root/key' };
const shared = p => Object.keys(W).filter(k => p[k] >= 0.75);
const suggest = p => { const s = shared(p).sort((x, y) => W[y] - W[x]); return s.length ? 'change ' + label[s[0]] : '—'; };
const axStr = p => Object.keys(W).filter(k => p[k] >= 0.6).map(k => label[k] + (p[k] < 1 ? ` ${(p[k] * 100) | 0}%` : '')).join(', ') || '—';

const pairs = [];
for (let i = 0; i < tracks.length; i++) for (let j = i + 1; j < tracks.length; j++) pairs.push({ a: tracks[i], b: tracks[j], ...sim(tracks[i], tracks[j]) });
pairs.sort((x, y) => y.score - x.score);
const pct = x => (x * 100).toFixed(0).padStart(3) + '%';

console.log(`\n🎧  AUDIO LAB — DISTINCTNESS REPORT   (${tracks.length} tracks, ${pairs.length} pairs · parsed live from audio-lab.html)\n`);

const hard = pairs.filter(p => p.score >= HARD);
console.log(`── ❌ TOO SIMILAR — redesign (≥ ${HARD * 100 | 0}%) ` + '─'.repeat(30));
if (!hard.length) console.log('  ✅ none.');
for (const p of hard) console.log(`  ${pct(p.score)}  ${p.a.game} ✕ ${p.b.game}\n        shared: ${axStr(p.parts)}   → ${suggest(p.parts)}`);

const soft = pairs.filter(p => p.score >= SOFT && p.score < HARD);
console.log(`\n── ⚠️  GENRE SIBLINGS — review (${SOFT * 100 | 0}–${HARD * 100 | 0}%) ` + '─'.repeat(24));
if (!soft.length) console.log('  ✅ none.');
for (const p of soft) console.log(`  ${pct(p.score)}  ${p.a.game} ✕ ${p.b.game}   [${axStr(p.parts)}]`);

console.log('\n── MODERN PROGRESSIONS (must all be unique) ' + '─'.repeat(20));
const byProg = {};
for (const t of tracks) (byProg[t.prog.join(',')] ||= []).push(t.game);
let dup = 0;
for (const k in byProg) if (byProg[k].length > 1) { dup++; console.log(`  ⚠️  [${k}]  ${byProg[k].join(', ')}`); }
for (let i = 0; i < tracks.length; i++) for (let j = i + 1; j < tracks.length; j++) {
  const s = progSim(tracks[i].prog, tracks[j].prog);
  if (s >= 0.75 && tracks[i].prog.join() !== tracks[j].prog.join()) { dup++; console.log(`  ⚠️  ${(s * 100) | 0}% ${tracks[i].game} ≈ ${tracks[j].game}`); }
}
if (!dup) console.log('  ✅ all 11 progressions are distinct (<75% overlap).');

console.log('\n── ℹ️  IDENTICAL "CURRENT" TRACKS (in-game today) ' + '─'.repeat(16));
console.log('  (games sharing the same theme play identical music in the Current column — the Modern proposals fix this)');
const seen = {};
for (let n = 0; n < tracks.length; n++) { const c = tracks[n].cur; const key = [c.root, c.bpm, c.scale, c.prog].join('|'); (seen[key] ||= []).push(tracks[n].game); }
let cd = 0;
for (const k in seen) if (seen[k].length > 1) { cd++; console.log('  ⚠️  ' + seen[k].join('  =  ')); }
if (!cd) console.log('  ✅ none.');

const worst = pairs[0].score;
console.log(`\n  Summary: ${hard.length} to-redesign · ${soft.length} siblings · worst pair ${pct(worst)}\n`);
process.exit(hard.length ? 1 : 0);
