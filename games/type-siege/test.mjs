// games/type-siege/test.mjs — Type Siege suite (run: node games/type-siege/test.mjs)
// Everything boots through the shared headless harness; asserts here are game-specific.
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/type-siege/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 12345, ...(opts || {}) });
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');

const ATK_SLOP = 4;   // a couple of steps of slack around a strike landing

const pb = (store, mode) => {
  try { return ((JSON.parse(store['gamekit_pb'] || '{}')['type-siege'] || {})[mode] || {}); }
  catch (e) { return {}; }
};

// ---------------------------------------------------------------------------
section('Type Siege: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.win.gamekit.layout.archetypeName() === 'action', 'declares the action layout archetype');

section('Type Siege: initial state');
{
  const T = g.T;
  ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
  ok(T().score === 0, 'score starts at 0');
  ok(T().mode === 'stages', 'default mode is Stages');
  ok(T().wave === 1, 'starts on wave 1');
  ok(T().enemies.length === 0, 'no enemies on the menu screen');
  ok(T().menu() != null, 'the start menu is open at boot');
}

section('Type Siege: word banks');
{
  const T = g.T();
  const langs = T.langs();
  ok(langs.length === 8, 'ships 8 word languages (got ' + langs.length + ')');
  let allOk = true, counts = [];
  for (const l of langs) {
    const words = T.words(l);
    counts.push(l + ':' + words.length);
    if (words.length < 200) allOk = false;
    if (words.some(w => /\s/.test(w) || w.length < 2)) allOk = false;
  }
  ok(allOk, 'every locale has 200+ single-token words — ' + counts.join(' '));

  // --- English is the BIG bank: 1000+ words so a run stops feeling repetitive ---
  const en = T.words('en');
  ok(en.length >= 1000, 'the English bank carries 1000+ words (got ' + en.length + ')');
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const folded = new Set(en.map(fold));
  ok(folded.size === en.length, 'no duplicates after diacritic folding (' + folded.size + ' unique of ' + en.length + ')');
  ok(en.every(w => /^[a-z]{2,}$/.test(w)), 'every English word is a single lowercase token of 2+ letters');
  ok(!en.some(w => /^[A-Z]/.test(w)), 'no proper nouns (nothing capitalised)');

  // --- bands are rank THIRDS of each locale's own list, so bank SIZE never skews them ---
  const be = T.bandInfo('en'), bp = T.bandInfo('pl');
  for (const [name, b] of [['en', be], ['pl', bp]]) {
    const third = b.count / 3;
    const near = Object.values(b.sizes).every(n => Math.abs(n - third) <= 2);
    ok(near, name + ' (' + b.count + ' words) splits into equal thirds: ' +
      b.sizes.short + '/' + b.sizes.medium + '/' + b.sizes.long);
    ok(b.avg.short < b.avg.medium && b.avg.medium < b.avg.long,
      name + ' band means are ordered (' + b.avg.short.toFixed(2) + ' < ' + b.avg.medium.toFixed(2) + ' < ' + b.avg.long.toFixed(2) + ')');
  }
  // the bands must hold at ANY bank size, whichever locale happens to be bigger — that is the whole
  // reason they are rank thirds and not length thresholds
  ok(be.count >= 1400 && bp.count >= 1400, 'both banks are full size (en ' + be.count + ', pl ' + bp.count + ')');
  // THE SHARED BANK IS THE SOURCE: the game reads window.KOMYO_WORDS (words.js), it does not carry
  // its own copy — a second word game must never be able to drift from it.
  const shared = g.win.KOMYO_WORDS;
  ok(shared && shared.banks && shared.locales.length >= 8, 'words.js is loaded (' + (shared ? shared.locales.length : 0) + ' locales)');
  ok(en.length === new Set(shared.banks.en.map(w => w.toLowerCase())).size,
    'the English list IS the shared bank (' + en.length + ' vs ' + shared.banks.en.length + ')');
  ok(!/const WORDS = \{\s*$/m.test(SRC), 'no inline word literal left in the game');
  ok(bp.avg.long > be.avg.long,
    "pl's long band is genuinely longer than en's (" + bp.avg.long.toFixed(2) + ' > ' + be.avg.long.toFixed(2) + ') — bands self-calibrate per locale');
  ok(be.urgent >= 10 && bp.urgent >= 10, 'each locale has an urgent (very short) band for rocks');
}

section('Type Siege: no-repeat word supply');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'en');
  T().isolate(); T().clearField();
  const picks = T().pickWords(120, 'short');
  let clash = 0;
  for (let i = 0; i < picks.length; i++) {
    for (let j = Math.max(0, i - 40); j < i; j++) if (picks[i] === picks[j]) clash++;
  }
  ok(clash === 0, 'no word repeats inside the last 40 spawns (' + clash + ' clashes in 120 picks)');
  // and a word already on the page is never handed out twice
  T().clearField();
  for (let i = 0; i < 12; i++) T().spawn('grunt', T().pickWords(1, 'short')[0], { x: 400 + i * 10, lane: i % 3 });
  const live = T().enemies.map(e => e.word);
  ok(new Set(live).size === live.length, 'no two enemies on the field carry the same word');
  const next = T().pickWords(8, 'short');
  ok(!next.some(w => live.indexOf(w) >= 0), 'a fresh pick never duplicates a word already on screen');
  // a SMALL band (pl urgent ~20 words) must not starve under the 40-deep window
  const gp = runGame();
  gp.T().startMode('endless', 'normal', 'pl');
  gp.T().isolate(); gp.T().clearField();
  const urg = gp.T().pickWords(60, 'urgent');
  ok(urg.every(w => typeof w === 'string' && w.length > 1), 'a small band still always yields a word (no starvation)');
}

section('Type Siege: palette contrast (ink must never wash out on paper)');
{
  // WCAG relative luminance — the measurement, not an eyeball
  const lum = (hex) => {
    const n = parseInt(String(hex).slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const MIN_FG = 0.45;      // paper ↔ any foreground colour
  const MAX_FURN = 0.32;    // background furniture must hug the paper, never drift toward ink
  const pals = g.T().palettes();
  let worst = 9, worstName = '';
  for (const [name, p] of Object.entries(pals)) {
    const lp = lum(p.paper);
    for (const k of ['ink', 'ink2', 'hi', 'warn', 'good']) {
      const gap = Math.abs(lp - lum(p[k]));
      if (gap < worst) { worst = gap; worstName = name + '.' + k; }
      ok(gap >= MIN_FG, name + ': paper↔' + k + ' luminance gap ' + gap.toFixed(3) + ' >= ' + MIN_FG);
      // and nothing foreground may sit in the mid band relative to BOTH paper and ink
      ok(Math.abs(lum(p[k]) - lum(p.ink)) < 0.60, name + ': ' + k + ' stays on the ink side of the page');
    }
    // `scene` is the battlefield-scenery ink: visible against the paper, but still furniture —
    // it must never drift close enough to `ink` to be mistaken for an enemy or a word.
    ok(Math.abs(lp - lum(p.scene)) > Math.abs(lp - lum(p.rule)),
      name + ': scenery ink reads stronger than the ruled lines (' + Math.abs(lp - lum(p.scene)).toFixed(3) + ' > ' + Math.abs(lp - lum(p.rule)).toFixed(3) + ')');
    for (const k of ['rule', 'margin', 'scene']) {
      const near = Math.abs(lp - lum(p[k])), far = Math.abs(lum(p[k]) - lum(p.ink));
      ok(near <= MAX_FURN, name + ': ' + k + ' furniture hugs the paper (' + near.toFixed(3) + ' <= ' + MAX_FURN + ')');
      ok(far >= MIN_FG, name + ': ' + k + ' furniture can never be mistaken for ink (' + far.toFixed(3) + ')');
    }
  }
  console.log('  worst-case foreground contrast gap: ' + worst.toFixed(3) + ' (' + worstName + ')');

  // the menu art dresses itself from a REAL ink palette (a hand-mixed copy would drift on a retune),
  // and the title screen is always MARKER — never the player's selected skin
  const mi = g.T().menuInks();
  ok(mi.backdrop === 'type-siege.ink.marker', 'the menu backdrop paints in the marker palette (got ' + mi.backdrop + ')');
  ok(pals[mi.backdrop] != null && pals[mi.cards] != null, 'both menu palettes are real registered inks');

  const ls = g.T().labelStyle();
  ok(ls.plateAlpha === 1, 'the word-label plate is fully opaque (translucent plates grey the text out)');
  ok(Math.abs(lum(ls.plate) - lum(ls.text)) >= MIN_FG,
    'label plate ↔ label text gap ' + Math.abs(lum(ls.plate) - lum(ls.text)).toFixed(3) + ' >= ' + MIN_FG);
  ok(Math.abs(lum(ls.plate) - lum(ls.typed)) >= MIN_FG, 'label plate ↔ typed-prefix accent clears the gap too');
  ok(Math.abs(lum(ls.plate) - lum(ls.urgent)) >= MIN_FG, 'label plate ↔ urgent (rock) hue clears the gap too');
  ok(ls.typed !== ls.text, 'the typed prefix differs from the untyped text by HUE, not lightness alone');
  ok(ls.typedCues.indexOf('underline') >= 0 && ls.typedCues.indexOf('weight') >= 0,
    'the typed prefix also carries weight + underline cues');
  ok(ls.lockCues.indexOf('brackets') >= 0 && ls.lockCues.indexOf('caret') >= 0,
    'the locked target carries shape cues (brackets + caret), not just colour');
}

// ---------------------------------------------------------------------------
section('Type Siege: auto-lock picks the CLOSEST matching enemy');
{
  const gl = runGame();
  const T = gl.T;
  T().start();
  ok(T().state === 'playing', 'start() enters play');
  T().clearField();
  const far = T().spawn('grunt', 'apple', { x: 900, lane: 0 });
  const near = T().spawn('grunt', 'ant', { x: 300, lane: 1 });
  ok(T().enemies.length === 2, 'two enemies staged');
  T().type('a');
  ok(T().lockId === near, 'first keystroke locks the enemy closest to the wall (ant @300, not apple @900)');
  ok(T().lockedWord === 'ant', 'locked word is "ant" (got ' + T().lockedWord + ')');
  ok(far !== near, 'the far enemy is a distinct entity');

  // ties break toward the oldest
  T().esc(); T().clearField();
  const first = T().spawn('grunt', 'bell', { x: 500, lane: 0 });
  T().spawn('grunt', 'boat', { x: 500, lane: 1 });
  T().type('b');
  ok(T().lockId === first, 'an exact distance tie breaks toward the oldest enemy');
}

section('Type Siege: only the locked word accepts input');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().clearField();
  T().spawn('grunt', 'ant', { x: 300, lane: 0 });
  T().spawn('grunt', 'bell', { x: 200, lane: 1 });
  T().type('a');
  ok(T().lockedWord === 'ant', 'locked onto "ant"');
  const missBefore = T().misses;
  T().type('b');   // "b" starts the OTHER word — while locked it is just a miss
  ok(T().misses === missBefore + 1, 'a letter from another word counts as a miss while locked');
  ok(T().lockedWord === 'ant', 'the lock does not jump to another enemy');
  ok(T().enemies.length === 2, 'no enemy died from the stray letter');
}

section('Type Siege: a wrong letter COSTS — combo, points and a fumble lock');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  T().type('ant');
  ok(T().combo === 1, 'felling a word builds the combo (got ' + T().combo + ')');
  const hp0 = T().hp, sc0 = T().score;
  T().clearField();
  T().spawn('grunt', 'apple', { x: 400, lane: 0 });
  T().type('a');
  T().type('z');
  ok(T().combo === 0, 'a wrong letter breaks the combo');
  ok(T().score < sc0, 'a wrong letter costs points (' + T().score + ' < ' + sc0 + ')');
  ok(T().hp === hp0, 'a wrong letter costs no wall HP (that is the wall\'s job, ' + T().hp + ' === ' + hp0 + ')');
  ok(T().lockId !== 0, 'the lock survives a single miss');
  ok(T().accuracy < 100, 'accuracy tracks the miss (' + T().accuracy + '%)');
  ok(T().fumble > 0, 'the wrong key flashes the miss receipt (fumble ' + T().fumble + ' steps)');
  ok(T().fumble >= 12 && T().fumble <= 18, 'the receipt lasts ~0.2–0.3 s (' + (T().fumble / 60).toFixed(2) + ' s)');
  // THE CORRECTION LANDS IMMEDIATELY. The receipt is visual only — an input lock here dropped the
  // fix a fast typist types straight after the typo, turning one mistake into a cascade.
  const idx0 = T().enemies[0].idx;
  T().type('p');
  ok(T().enemies[0].idx > idx0, 'a correct key typed right after the miss still lands (idx ' + idx0 + ' → ' + T().enemies[0].idx + ')');
  ok(T().misses === 1, 'and it does not stack a second miss');
  T().step(T().fumble + 1);
  ok(T().fumble === 0, 'the receipt clears on its own');
  T().type('ple');
  ok(T().enemies.length === 0, 'the word finishes normally');
}

section('Type Siege: mashing is strictly worse than typing');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'en');
  T().isolate(); T().clearField();
  // give the masher a full field of real targets, then let them mash for a few seconds
  for (let i = 0; i < 3; i++) T().spawn('grunt', 'mountain', { x: 500 + i * 40, lane: i });
  const before = { score: T().score, enemies: T().enemies.length };
  const mash = 'qzxjvbnmqzxjvwkyqzxjvbnmqzxjvwky';
  for (let round = 0; round < 300; round++) { for (const ch of mash) T().type(ch); T().step(1); }
  ok(T().enemies.length === before.enemies, 'a long wrong sequence kills NOTHING (' + T().enemies.length + ' still standing)');
  ok(T().score === 0 && before.score === 0, 'and scores nothing');
  ok(T().combo === 0, 'the combo never leaves zero while mashing');
  ok(T().accuracy === 0, 'accuracy collapses to 0% (no keystroke ever landed)');
  ok(T().misses > 1, 'stray keys register as misses, never as free no-ops (' + T().misses + ' misses)');
  // Every mashed key now registers (no input lock) — and that is fine: each one breaks the combo and
  // takes points, so mashing is punished per keystroke instead of being throttled into harmlessness.
  ok(T().misses > 1000, 'every stray key is counted and charged for (' + T().misses + ' of ' + (300 * mash.length) + ')');
  const jammed = T().misses * T().missCost() / 300;
  ok(jammed > 0.85, 'the masher spent ' + Math.round(jammed * 100) + '% of the run jammed by their own fumbles');

  // …while a careful typist clears the same field in the same window
  const gc = runGame();
  gc.T().startMode('endless', 'normal', 'en');
  gc.T().isolate(); gc.T().clearField();
  for (let i = 0; i < 3; i++) gc.T().spawn('grunt', 'mountain', { x: 500 + i * 40, lane: i });
  for (let i = 0; i < 3; i++) { gc.T().type('mountain'); gc.T().step(4); }
  ok(gc.T().enemies.length === 0, 'a careful typist clears all three in a fraction of that time');
  ok(gc.T().score === 30 && gc.T().accuracy === 100, 'with 30 points and 100% accuracy — mashing is strictly worse');

  // and the same sequence AFTER earning points strips them
  const gp = runGame();
  gp.T().startMode('endless', 'normal', 'en');
  gp.T().isolate(); gp.T().clearField();
  gp.T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  gp.T().type('ant');
  const earned = gp.T().score;
  ok(earned === 10, 'earned 10 points cleanly');
  for (let round = 0; round < 12; round++) { for (const ch of 'qzxjv') gp.T().type(ch); gp.T().step(1); }
  ok(gp.T().score < earned, 'mashing after a clean kill gives points BACK (' + gp.T().score + ' < ' + earned + ')');

  // a key that matches nothing on an EMPTY field is a miss, not a silent no-op
  const ge = runGame();
  ge.T().start(); ge.T().isolate(); ge.T().clearField();
  ge.T().type('q');
  ok(ge.T().misses === 1, 'a key with nothing to match is a miss');
}

section('Type Siege: a soft keyboard double-firing one key is not punished');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  T().spawn('grunt', 'apple', { x: 400, lane: 0 });
  T().type('a');
  T().type('z'); T().type('z');       // the SAME wrong key twice inside the same step
  ok(T().misses === 1, 'the repeat of a wrong key within a couple of steps counts once (got ' + T().misses + ')');
  // a genuine double letter always goes through — it advances the word, so it is never swallowed
  const g2 = runGame();
  g2.T().start(); g2.T().isolate(); g2.T().clearField();
  g2.T().spawn('grunt', 'apple', { x: 400, lane: 0 });
  g2.T().type('apple');
  ok(g2.T().enemies.length === 0, 'the double "pp" in "apple" still fells it (no double-fire false positive)');
  ok(g2.T().misses === 0, 'and costs no miss');
}

section('Type Siege: the pause menu actually FREEZES the siege');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().clearField();
  T().spawn('grunt', 'ant', { x: T().layout.wallEdge + 3, lane: 0 });
  T().step(30);
  const hp0 = T().hp, n0 = T().enemies.length;
  gl.down('Escape');                       // no lock held → Escape opens the pause menu
  ok(T().state === 'paused', 'Escape with no lock pauses the run (state ' + T().state + ')');
  ok(T().menu() != null, 'the pause menu is showing');
  T().step(900);                           // a LOT of game time while "paused"
  ok(T().hp === hp0, 'the wall takes no damage while paused (' + T().hp + ' === ' + hp0 + ')');
  ok(T().enemies.length === n0, 'nothing new marched in while paused');
  T().type('ant');
  ok(T().enemies.length === n0, 'typing does nothing while paused');
  T().menu().activate('resume');
  ok(T().state === 'playing', 'RESUME returns to play');
  T().step(T().cadence('grunt') + ATK_SLOP);
  ok(T().hp < hp0, 'and the siege picks up where it left off');
  // and one pause UI only — never the kit's universal overlay on top of ours
  ok(gl.win.gamekit.isPaused() === false || T().menu() != null, 'no second pause overlay is stacked');
}

section('Type Siege: Escape and Backspace drop the lock');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().clearField();
  T().spawn('grunt', 'apple', { x: 400, lane: 0 });
  T().type('ap');
  ok(T().lockId !== 0, 'locked mid-word');
  gl.down('Escape');
  ok(T().lockId === 0, 'Escape drops the lock');
  ok(T().enemies[0].idx === 0, 'dropping the lock resets the word progress');
  T().type('a');
  ok(T().lockId !== 0, 'typing re-locks after Escape');
  gl.down('Backspace');
  gl.down('Backspace');
  ok(T().lockId === 0, 'Backspace on an empty buffer drops the lock');
}

section('Type Siege: completing a word kills the enemy and scores');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().clearField();
  T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  const s0 = T().score;
  T().type('ant');
  ok(T().enemies.length === 0, 'the enemy is felled by the finished word');
  ok(T().score === s0 + 10, 'a grunt is worth 10 (got ' + (T().score - s0) + ')');
  T().clearField();
  T().spawn('trebuchet', 'mountain', { x: 400, lane: 0 });
  const s1 = T().score;
  T().type('mountain');
  ok(T().score === s1 + 40, 'a trebuchet is worth 40 (got ' + (T().score - s1) + ')');
  T().clearField();
  T().spawn('boss', 'cat dog', { x: 400, lane: 0 });
  const s2 = T().score;
  T().type('cat dog');
  ok(T().score === s2 + 150, 'a boss phrase (spaces typed) is worth 150 (got ' + (T().score - s2) + ')');
  ok(T().lockId === 0, 'the lock clears when the word is finished');
}

// ---------------------------------------------------------------------------
// A WARLORD's target is an ordered SEQUENCE of separate words, not a phrase — and a typed space
// is never part of it (an invisible character must never cost anything).
section('Type Siege: a warlord is a SEQUENCE of words, word by word');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  const id = T().spawn('boss', 'cat dog fig', { x: 400, lane: 0 });
  const b = () => T().enemies.filter(e => e.id === id)[0];
  ok(JSON.stringify(b().seq) === '["cat","dog","fig"]', 'the warlord carries its words as an ordered sequence');
  ok(b().si === 0 && b().word === 'cat', 'word 1 is the live one at spawn');
  const s0 = T().score;
  T().type('cat');
  ok(b() != null, 'finishing word 1 does NOT kill the warlord');
  ok(b().si === 1 && b().word === 'dog', 'word 2 goes live once word 1 is done');
  ok(T().lockId === id, 'the lock stays on the warlord across the word boundary');
  ok(T().score === s0, 'no points are paid out mid-sequence (got +' + (T().score - s0) + ')');
  ok(b().idx === 0, 'the new live word starts from its first letter');
  T().type('dog');
  ok(b() != null && b().si === 2 && b().word === 'fig', 'word 3 goes live after word 2');
  T().type('fig');
  ok(T().enemies.length === 0, 'the LAST word of the sequence fells the warlord');
  ok(T().score === s0 + 150, 'the warlord still pays exactly 150 (got +' + (T().score - s0) + ')');
  ok(T().lockId === 0, 'the lock clears with the kill');
}

section('Type Siege: a typed space is a silent no-op');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  T().type('ant');                                    // a kill, so there is a chain to break
  const c0 = T().combo, m0 = T().misses, s0 = T().score;
  ok(c0 === 1, 'a chain is running (combo ' + c0 + ')');
  T().spawn('boss', 'cat dog', { x: 400, lane: 0 });
  T().type(' ');                                      // unlocked, boss live
  ok(T().combo === c0 && T().misses === m0 && T().fumble === 0 && T().score === s0,
    'a space with nothing locked costs nothing (combo ' + T().combo + ' misses ' + T().misses + ' fumble ' + T().fumble + ')');
  ok(T().lockId === 0, 'a space never locks a target');
  T().type('cat');
  T().type('   ');                                    // between the words of a sequence
  ok(T().combo === c0 && T().misses === m0 && T().fumble === 0,
    'spaces between the words of a sequence cost nothing');
  ok(T().enemies[0].si === 1 && T().enemies[0].idx === 0, 'and they leave the sequence exactly where it was');
  T().type('do');
  T().type(' ');                                      // mid-word, locked
  ok(T().misses === m0 && T().fumble === 0 && T().combo === c0, 'a space mid-word is not a miss either');
  ok(T().enemies[0].idx === 2, 'the half-typed word keeps its progress across a space');
  T().type('g');
  ok(T().enemies.length === 0 && T().score === s0 + 150, 'the sequence still completes normally');
  const gl2 = runGame();
  gl2.T().start(); gl2.T().isolate(); gl2.T().clearField();
  gl2.T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  gl2.down(' ');                                      // the REAL keydown path, no boss anywhere
  ok(gl2.T().misses === 0 && gl2.T().fumble === 0, 'a space through the keyboard handler is swallowed too');
  gl2.T().type('an');
  gl2.T().step(600);                                  // 10 s on the clock, so WPM is measurable
  const w0 = gl2.T().wpm;
  for (let i = 0; i < 20; i++) gl2.down(' ');
  ok(gl2.T().wpm === w0, 'a space is not even counted as a keystroke (WPM ' + gl2.T().wpm + ' vs ' + w0 + ')');
}

section('Type Siege: reading ahead in a sequence never jumps it (and never costs)');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  const id = T().spawn('boss', 'cat dog', { x: 400, lane: 0 });
  const b = () => T().enemies.filter(e => e.id === id)[0];
  const m0 = T().misses;
  T().type('d');                                      // word 2's first letter, word 1 still live
  ok(T().lockId === 0, 'a key that only matches a LATER word never auto-locks the warlord');
  ok(b().si === 0 && b().idx === 0, 'and it does not jump the sequence forward');
  ok(T().misses === m0 && T().fumble === 0, 'nor is it punished — the pending words are printed on the plate');
  T().type('ca');
  ok(T().lockId === id && b().idx === 2, 'word 1 still takes its own letters');
  T().type('d');                                      // reading ahead mid-word
  ok(b().si === 0 && b().idx === 2 && T().fumble === 0, 'reading ahead mid-word is a no-op, not a fumble');
  T().type('x');
  ok(T().misses === m0 + 1 && T().fumble > 0, 'a genuinely wrong letter still costs (misses ' + T().misses + ')');
}

section('Type Siege: abandoning a sequence costs at WORD level, not boss level');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  const id = T().spawn('boss', 'cat dog fig', { x: 400, lane: 0 });
  const b = () => T().enemies.filter(e => e.id === id)[0];
  T().type('cat');
  T().type('do');
  gl.down('Escape');
  ok(T().lockId === 0, 'Escape drops the lock mid-sequence');
  ok(b().si === 1, 'the words already struck off stay struck off');
  ok(b().idx === 0, 'only the half-typed word is reset');
  T().type('d');                                      // re-locks on the live word, not word 1
  ok(T().lockId === id && b().si === 1 && b().idx === 1, 'the auto-lock resumes on the LIVE word');
  gl.down('Backspace');
  ok(b().si === 1 && b().idx === 0, 'Backspace clears the live word only');
  // walking away to another target keeps the sequence's progress
  T().spawn('grunt', 'ant', { x: 500, lane: 1 });
  gl.down('Backspace');                               // buffer already empty → drops the lock
  T().type('ant');
  ok(T().enemies.filter(e => e.type === 'grunt').length === 0, 'the other target can be taken mid-sequence');
  ok(b().si === 1 && b().idx === 0, 'and the warlord still holds its completed words');
  T().type('dogfig');
  ok(T().enemies.length === 0, 'the rest of the sequence finishes it off');
}

section('Type Siege: warlord sequences are 2–3 words, never two on the same letter');
{
  const T = g.T;
  const seqs = T().bossSeqs(1500);
  ok(seqs.every(s => s.length >= 2 && s.length <= 3), 'every sequence is 2–3 words');
  ok(seqs.some(s => s.length === 3), 'three-word sequences do happen');
  ok(seqs.every(s => s.every(w => typeof w === 'string' && w.length > 1 && !/\s/.test(w))),
    'every entry is a single whitespace-free word');
  const clash = seqs.filter(s => new Set(s.map(w => w[0])).size !== s.length);
  ok(clash.length === 0, 'no sequence repeats an opening letter (' + clash.length + ' of ' + seqs.length +
    (clash.length ? ': ' + clash[0].join(' ') : '') + ')');
  const bands = T().bandInfo('en');
  const mean = seqs.reduce((n, s) => n + s.join('').length, 0) / seqs.length;
  // BUDGET: the old boss was a phrase (short + 1–2 medium words) whose SPACES were mandatory
  // keystrokes — 11.20 letters + 1.4 spaces ≈ 12.60 keys. Every key of the sequence is a letter
  // now, so mean letters must land near that number or time-to-kill moved.
  const old = (bands.avg.short + bands.avg.medium) + 0.4 * bands.avg.medium + 1.4;
  ok(Math.abs(mean - old) < 1.2, 'a sequence costs about what the old phrase did — ' + mean.toFixed(2) +
    ' keys vs ' + old.toFixed(2) + ' before');
  const longMax = Math.max.apply(null, seqs.map(s => Math.max.apply(null, s.map(w => w.length))));
  ok(mean > bands.avg.short * 2 && longMax > bands.medMax,
    'the words come from the medium/long bands (longest seen ' + longMax + ' letters, medium band caps at ' + bands.medMax + ')');
}

section('Type Siege: the sequence plate stays on the paper at every viewport');
{
  for (const v of [{ w: 360, h: 640 }, { w: 640, h: 360 }, { w: 1280, h: 800 }]) {
    const gl = runGame({ w: v.w, h: v.h });
    const T = gl.T;
    T().start(); T().isolate(); gl.resize(v.w, v.h);
    const L = T().layout;
    // the realistic worst case: one long-band word + two of the longest medium-band words
    for (const words of ['cat dog', 'wheelbarrow summer winter', 'gymnastics orchard blossom']) {
      T().clearField();
      const id = T().spawn('boss', words, { x: L.field.x + L.field.w * 0.5, lane: 0 });
      const q = T().seqPlate(id);
      ok(q != null && q.w <= L.field.w - 5, v.w + 'x' + v.h + ' "' + words + '": the plate fits the field (' +
        Math.round(q.w) + ' <= ' + Math.round(L.field.w - 5) + ')');
      ok(q.size >= 12, v.w + 'x' + v.h + ' "' + words + '": it never shrinks below 12px (got ' + q.size + ')');
      ok(q.lines.length <= 3 && q.h < L.field.h * 0.5, v.w + 'x' + v.h + ' "' + words + '": at most 3 lines, never half the field');
      const flat = q.lines.reduce((a, l) => a.concat(l), []);
      ok(flat.join(',') === flat.slice().sort((a, b) => a - b).join(','), v.w + 'x' + v.h + ': words stay in sequence order across lines');
      gl.step(3);
    }
    ok(gl.errors.length === 0, v.w + 'x' + v.h + ': the sequence plate renders without errors: ' + gl.errors[0]);
  }
}

section('Type Siege: enemies HOLD a line and work the wall (no kamikaze)');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  const L0 = T().layout;
  const id = T().spawn('grunt', 'ant', { x: L0.field.x + L0.field.w * 0.8, lane: 0 });
  const hp0 = T().hp;
  T().step(900);                                  // a full crossing time and then some
  const e = T().enemies.filter(x => x.id === id)[0];
  ok(e != null, 'the grunt is STILL on the field after walking the whole way in');
  ok(e.engaged === true, 'it stopped and engaged instead of vanishing into the wall');
  ok(Math.abs(e.x - e.range) < 1.5, 'it holds exactly at its engagement line (x ' + Math.round(e.x) + ' vs range ' + Math.round(e.range) + ')');
  ok(e.x > L0.wallEdge, 'it stands OUTSIDE the wall, not inside it');
  ok(T().hp < hp0, 'it has been chipping the wall while standing there');
  ok(T().hp > 0, 'a single melee attacker cannot fell the wall that fast');

  // repeating cadence, not a one-off collision
  const before = T().hp;
  T().step(T().cadence('grunt') + ATK_SLOP);
  const mid = T().hp;
  ok(mid === before - T().dmg('grunt'), 'exactly one more strike lands per cadence (' + before + '→' + mid + ')');
  T().step(T().cadence('grunt') + ATK_SLOP);
  ok(T().hp === mid - T().dmg('grunt'), 'and again on the next cadence — damage repeats forever');

  // killing the attacker stops the damage dead
  const hpK = T().hp;
  T().type('ant');
  ok(T().enemies.filter(x => x.id === id).length === 0, 'typing its word fells the holding attacker');
  T().step(600);
  ok(T().hp === hpK, 'a felled attacker deals no further damage (' + T().hp + ' === ' + hpK + ')');
}

section('Type Siege: pressure accumulates with the queue at the wall');
{
  const one = runGame();
  one.T().start(); one.T().isolate(); one.T().clearField();
  one.T().spawn('grunt', 'ant', { x: one.T().layout.wallEdge + 3, lane: 0 });
  one.T().step(4);
  const p1 = one.T().pressure();
  ok(p1 > 0, 'one engaged attacker registers pressure (' + p1.toFixed(3) + ' dmg/s)');

  const two = runGame();
  two.T().start(); two.T().isolate(); two.T().clearField();
  two.T().spawn('grunt', 'ant', { x: two.T().layout.wallEdge + 3, lane: 0 });
  two.T().spawn('grunt', 'bell', { x: two.T().layout.wallEdge + 3, lane: 1 });
  two.T().step(4);
  const p2 = two.T().pressure();
  ok(Math.abs(p2 - p1 * 2) < 0.02, 'two attackers apply ~double the DPS (' + p2.toFixed(3) + ' vs ' + p1.toFixed(3) + ')');

  // and that shows up as real damage over the same window
  const win = one.T().cadence('grunt') * 3 + 20;
  const h1 = one.T().hp; one.T().step(win); const d1 = h1 - one.T().hp;
  const h2 = two.T().hp; two.T().step(win); const d2 = h2 - two.T().hp;
  ok(d2 >= d1 * 1.8, 'the pair actually removes ~twice the HP over the same window (' + d2 + ' vs ' + d1 + ')');
}

section('Type Siege: ranks — melee at the wall, archers mid, engines at the back');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  T().spawn('grunt', 'ant', { lane: 0 });
  T().spawn('archer', 'pencil', { lane: 1 });
  T().spawn('trebuchet', 'mountain', { lane: 2 });
  T().step(2400);
  const es = T().enemies;
  const g1 = es.filter(e => e.type === 'grunt')[0];
  const a1 = es.filter(e => e.type === 'archer')[0];
  const t1 = es.filter(e => e.type === 'trebuchet')[0];
  ok(g1 && a1 && t1, 'all three ranks are still standing on the field');
  ok(g1.engaged && a1.engaged && t1.engaged, 'each one engaged at its own line');
  ok(g1.x < a1.x && a1.x < t1.x, 'formation reads front-to-back: melee ' + Math.round(g1.x) + ' < archer ' + Math.round(a1.x) + ' < engine ' + Math.round(t1.x));
  ok(a1.x - g1.x > 40, 'the archer rank stands clearly behind the melee rank');

  // the back ranks fight with projectiles rather than walking in
  ok(T().shots >= 2, 'the back ranks loosed projectiles instead of closing in (' + T().shots + ' fired)');
  const rocks = T().enemies.filter(e => e.type === 'rock');
  ok(rocks.every(r => r.word && r.word.length <= 5), 'rocks carry a very short urgent word');
  ok(T().enemies.filter(e => e.type === 'arrow').every(r => !r.word), 'arrows carry no word (the archer is the target)');
}

section('Type Siege: melee queue stacks outward from the wall');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().isolate(); T().clearField();
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(T().spawn('grunt', 'ant', { lane: 0 }));
  T().step(1100);
  const xs = T().enemies.filter(e => e.type === 'grunt').map(e => e.x).sort((a, b) => a - b);
  ok(xs.length === 3, 'all three melee attackers are alive at the wall');
  ok(xs[1] - xs[0] > 10 && xs[2] - xs[1] > 10, 'they queue in distinct slots instead of stacking on one pixel (' + xs.map(Math.round).join(',') + ')');
}

section('Type Siege: projectiles still land for damage');
{
  const g2 = runGame();
  g2.T().start(); g2.T().isolate(); g2.T().clearField();
  const hp0 = g2.T().hp;
  g2.T().spawn('rock', 'ab', { x: 700, y: 300 });
  g2.T().step(g2.T().layout.rockSteps + 4);
  ok(g2.T().hp === hp0 - g2.T().dmg('rock'), 'a rock that lands costs its damage (' + g2.T().hp + ' vs ' + hp0 + ')');
  ok(g2.T().enemies.filter(e => e.type === 'rock').length === 0, 'the landed rock is gone');
}

section('Type Siege: the wall falling ends the run with outcome "lose"');
{
  const gl = runGame();
  const T = gl.T;
  T().start(); T().clearField();
  T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  T().type('ant');
  T().setHp(1);
  T().spawn('grunt', 'ant', { x: T().layout.wallEdge + 2, lane: 1 });
  T().step(T().cadence('grunt') + ATK_SLOP);      // one strike is all the last HP can take
  ok(T().hp === 0, 'the last HP is taken by a strike');
  ok(T().state === 'over', 'the run ends when the wall falls');
  ok(T().outcome === 'lose', 'outcome is "lose" (got ' + T().outcome + ')');
  ok(T().record != null && T().record.time === 0, 'record.time is 0 (no time-primary mode)');
  ok(T().record.mode === 'Stages', 'record.mode is the stable English label (got ' + T().record.mode + ')');
  ok(T().record.outcome === 'lose', 'record carries the outcome');
  const st = T().record.stats || {};
  ok(typeof st.wave === 'number' && typeof st.wpm === 'number' && typeof st.accuracy === 'number',
    'record.stats has wave/wpm/accuracy');
  ok(st.wave === Math.round(st.wave) && st.wpm === Math.round(st.wpm) && st.accuracy === Math.round(st.accuracy),
    'stats are integers');
  ok(T().menu() != null, 'the end menu is shown');
  T().menu().activate('again');
  ok(T().state === 'playing', 'Play Again starts a new run');
  ok(T().score === 0, 'Play Again resets the score');
  ok(T().hp === T().hpMax, 'Play Again restores the wall');
}

section('Type Siege: clearing all 8 stages wins');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('stages', 'normal', 'en');
  for (let i = 0; i < 12 && T().state === 'playing'; i++) { T().finishWave(); T().step(1); }
  ok(T().state === 'over', 'the run ends after the last stage');
  ok(T().outcome === 'win', 'outcome is "win" (got ' + T().outcome + ')');
  ok(T().wave === 8, 'ends on wave 8 (got ' + T().wave + ')');
  ok(T().record.time === 0, 'a win still records time 0');
  ok(T().record.outcome === 'win', 'record.outcome is win');
}

section('Type Siege: best persists per mode');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'en');
  T().clearField();
  T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  T().type('ant');
  T().spawn('trebuchet', 'mountain', { x: 500, lane: 1 });
  T().type('mountain');
  const sc = T().score;
  ok(sc === 50, 'scored 50 before dying (got ' + sc + ')');
  T().setHp(1);
  T().spawn('grunt', 'ant', { x: T().layout.wallEdge + 2, lane: 2 });
  T().step(T().cadence('grunt') + ATK_SLOP);
  ok(T().state === 'over', 'run over');
  ok(pb(gl.store, 'Endless').score >= sc, 'best persisted under the "Endless" mode label');
  ok(pb(gl.store, 'Stages').score === undefined, 'nothing written under the wrong mode label');
  ok(T().best('endless') >= sc, 'bestScore reads it back');

  const gm = runGame({ store: { gamekit_pb: JSON.stringify({ 'type-siege': { Rain: { score: 720 } } }) } });
  ok(gm.T().best('rain') === 720, 'a seeded Rain best is read from the store');
}

// ---------------------------------------------------------------------------
section('Type Siege: diacritic-insensitive matching');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'pl');
  T().clearField();
  T().spawn('grunt', 'żółw', { x: 500, lane: 0 });
  T().type('zolw');
  ok(T().enemies.length === 0, 'typing "zolw" kills "żółw"');
  ok(T().misses === 0, 'no misses along the way');

  T().clearField();
  T().spawn('grunt', 'żółw', { x: 500, lane: 0 });
  T().type('żółw');
  ok(T().enemies.length === 0, 'typing the exact accented "żółw" also works');

  T().startMode('endless', 'normal', 'fr');
  T().clearField();
  T().spawn('grunt', 'garçon', { x: 500, lane: 0 });
  T().type('garcon');
  ok(T().enemies.length === 0, 'typing "garcon" kills "garçon"');

  T().startMode('endless', 'normal', 'cs');
  T().clearField();
  T().spawn('grunt', 'žralok', { x: 500, lane: 0 });
  T().type('zralok');
  ok(T().enemies.length === 0, 'typing "zralok" kills "žralok"');
}

section('Type Siege: Ukrainian Latin transliteration');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'uk');
  T().clearField();
  T().spawn('grunt', 'жаба', { x: 500, lane: 0 });
  T().type('zhaba');
  ok(T().enemies.length === 0, 'typing "zhaba" kills "жаба"');
  ok(T().misses === 0, 'the digraph "zh" is not a miss');

  T().clearField();
  T().spawn('grunt', 'жаба', { x: 500, lane: 0 });
  T().type('жаба');
  ok(T().enemies.length === 0, 'typing Cyrillic directly also works');

  T().clearField();
  T().spawn('grunt', 'щука', { x: 500, lane: 0 });
  T().type('shchuka');
  ok(T().enemies.length === 0, 'the 4-letter digraph "shch" matches "щ"');

  T().clearField();
  T().spawn('grunt', 'сіль', { x: 500, lane: 0 });
  T().type('sil');
  ok(T().enemies.length === 0, 'the soft sign needs no keystroke ("sil" kills "сіль")');

  T().clearField();
  T().spawn('grunt', 'чашка', { x: 500, lane: 0 });
  T().type('chashka');
  ok(T().enemies.length === 0, '"chashka" kills "чашка"');
}

section('Type Siege: perfectionist mode (exact accents)');
{
  // OFF (the default) — the shipped forgiving behaviour, unchanged
  const gf = runGame();
  gf.T().startMode('endless', 'normal', 'pl', false);
  ok(gf.T().exact === false, 'perfectionist is OFF by default');
  gf.T().isolate(); gf.T().clearField();
  gf.T().spawn('grunt', 'żółw', { x: 500, lane: 0 });
  gf.T().type('zolw');
  ok(gf.T().enemies.length === 0, 'forgiving: "zolw" kills "żółw"');

  // ON — the exact characters only
  const ge = runGame();
  ge.T().startMode('endless', 'normal', 'pl', true);
  ok(ge.T().exact === true, 'perfectionist can be switched on');
  ge.T().isolate(); ge.T().clearField();
  ge.T().spawn('grunt', 'żółw', { x: 500, lane: 0 });
  const sc0 = ge.T().score;
  ge.T().type('z');
  ok(ge.T().enemies.length === 1, 'exact: "z" does NOT satisfy "ż" — the enemy still stands');
  ok(ge.T().misses === 1, 'and it counts as a miss');
  ok(ge.T().fumble > 0, 'so the wrong-letter penalty fires (input jammed ' + ge.T().fumble + ' steps)');
  ok(ge.T().score <= sc0, 'and it costs points like any other mistake');
  ge.T().step(ge.T().fumble + 1);
  ge.T().type('żółw');
  ok(ge.T().enemies.length === 0, 'exact: the exact accented spelling still fells it');

  // Ukrainian: transliteration is off under perfectionist, Cyrillic still works
  const gu = runGame();
  gu.T().startMode('endless', 'normal', 'uk', true);
  gu.T().isolate(); gu.T().clearField();
  gu.T().spawn('grunt', 'жаба', { x: 500, lane: 0 });
  gu.T().type('zhaba');
  ok(gu.T().enemies.length === 1, 'exact: Latin "zhaba" no longer kills "жаба"');
  gu.T().step(60);
  gu.T().clearField();
  gu.T().spawn('grunt', 'жаба', { x: 500, lane: 0 });
  gu.T().type('жаба');
  ok(gu.T().enemies.length === 0, 'exact: typing real Cyrillic still fells it');
  // the soft sign must be typed under perfectionist
  gu.T().clearField();
  gu.T().spawn('grunt', 'сіль', { x: 500, lane: 0 });
  gu.T().type('сіл');
  ok(gu.T().enemies.length === 1, 'exact: the soft sign is no longer skippable');
  gu.T().type('ь');
  ok(gu.T().enemies.length === 0, 'exact: typing "ь" finishes it');

  // bests never share a board across the two rule sets
  ok(gf.T().modeKey() === 'Endless', 'forgiving runs store under the plain mode label');
  ok(ge.T().modeKey() === 'Endless · Exact', 'perfectionist runs store under a distinct label (got ' + ge.T().modeKey() + ')');
  const gb = runGame();
  gb.T().startMode('stages', 'normal', 'en', true);
  gb.T().isolate(); gb.T().clearField();
  gb.T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  gb.T().type('ant');
  gb.T().setHp(1);
  gb.T().spawn('grunt', 'bell', { x: gb.T().layout.wallEdge + 2, lane: 1 });
  gb.T().step(gb.T().cadence('grunt') + ATK_SLOP);
  ok(gb.T().state === 'over', 'a perfectionist run ends normally');
  ok(pb(gb.store, 'Stages · Exact').score >= 10, 'its best landed under "Stages · Exact"');
  ok(pb(gb.store, 'Stages').score === undefined, 'and nothing leaked into the forgiving "Stages" board');
  ok(gb.T().record.mode === 'Stages · Exact', 'the recorded mode label carries the suffix');

  // the pref persists, and the deep link works
  const gp = runGame();
  gp.T().setExact(true);
  let saved = {};
  try { saved = JSON.parse(gp.store['type-siege_prefs'] || '{}'); } catch (e) {}
  ok(saved.ex === 1 && saved.v === 2, 'perfectionist persists in the versioned prefs blob');
  const gd = runGame({ search: '?ex=1&wl=pl' });
  ok(gd.T().exact === true, '?ex=1 deep-links perfectionist on');
}

section('Type Siege: word language is its own persisted setting');
{
  const gl = runGame();
  gl.T().setWordLang('pl');
  ok(gl.T().wordLang === 'pl', 'word language switched to pl');
  let saved = {};
  try { saved = JSON.parse(gl.store['type-siege_prefs'] || '{}'); } catch (e) {}
  ok(saved.v === 2, 'prefs carry a schema version (got ' + saved.v + ')');
  ok(saved.wl === 'pl', 'the word language is persisted (got ' + saved.wl + ')');
  ok(JSON.stringify(saved).length < 120, 'the prefs blob stays tiny (' + JSON.stringify(saved).length + ' bytes)');

  const g2 = runGame({ store: { 'type-siege_prefs': JSON.stringify({ v: 1, mode: 'rain', diff: 'hard', wl: 'cs' }) } });
  ok(g2.T().wordLang === 'cs', 'a v1 prefs blob still restores the word language (got ' + g2.T().wordLang + ')');
  ok(g2.T().mode === 'rain', 'the saved mode is restored');
  ok(g2.T().diff === 'hard', 'the saved difficulty is restored');
  ok(g2.T().exact === false, 'a v1 blob (no `ex` field) reads forward as perfectionist OFF');
  const g2b = runGame({ store: { 'type-siege_prefs': JSON.stringify({ v: 2, mode: 'stages', diff: 'normal', wl: 'pl', ex: 1 }) } });
  ok(g2b.T().exact === true, 'a v2 blob restores perfectionist ON');

  const g3 = runGame({ search: '?wl=it&mode=endless&diff=easy' });
  ok(g3.T().wordLang === 'it', '?wl= deep-links the word language');
  ok(g3.T().mode === 'endless' && g3.T().diff === 'easy', '?mode= / ?diff= deep-link too');

  // with no saved prefs the word language follows the UI language
  const g4 = runGame({ store: { gamekit_lang: 'pl' } });
  ok(g4.T().wordLang === 'pl', 'with no prefs the word language defaults to the UI language');
}

section('Type Siege: Rain mode');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('rain', 'normal', 'en');
  ok(T().mode === 'rain', 'rain mode active');
  T().step(400);
  ok(T().enemies.length > 0, 'words fall in Rain mode');
  ok(T().enemies.every(e => e.type === 'rain'), 'Rain spawns only falling words (no rocks)');
  const hp0 = T().hp;
  T().isolate(); T().clearField();
  T().spawn('rain', 'ant', {});
  T().step(2000);
  ok(T().hp < hp0, 'a word that lands damages the parapet in Rain mode');
  const landed = T().enemies.filter(e => e.type === 'rain' && e.engaged);
  ok(landed.length === 1, 'the landed scrap STICKS on the parapet instead of vanishing');
  const h1 = T().hp;
  T().step(T().cadence('rain') + ATK_SLOP);
  ok(T().hp < h1, 'and keeps burning through it on a cadence');
  T().type('ant');
  const h2 = T().hp;
  T().step(600);
  ok(T().hp === h2, 'typing the landed word stops the burn');
  ok(T().enemies.filter(e => e.type === 'arrow' || e.type === 'rock' || e.type === 'trebuchet').length === 0,
    'Rain has no siege engines or projectiles');
}

section('Type Siege: difficulty moves the knobs that decide whether you keep up');
{
  const of = d => {
    const gl = runGame();
    gl.T().startMode('stages', d, 'en');
    gl.T().isolate(); gl.T().clearField();
    const L = gl.T().layout;
    return {
      hp: gl.T().hpMax, speed: L.speed.grunt, rock: L.rockSteps, cad: gl.T().cadence('grunt'),
      interval: gl.T().spawnInterval(), wordLen: gl.T().sampleWordLen(600), fumble: gl.T().fumble,
      jam: gl.T().missCost(), diffSpeed: L.diffSpeed,
    };
  };
  const e = of('easy'), n = of('normal'), h = of('hard');
  console.log('  easy   ' + JSON.stringify(e));
  console.log('  normal ' + JSON.stringify(n));
  console.log('  hard   ' + JSON.stringify(h));
  // 1. approach speed
  ok(e.speed < n.speed && n.speed < h.speed, 'APPROACH SPEED climbs with difficulty ('
    + e.speed.toFixed(2) + ' < ' + n.speed.toFixed(2) + ' < ' + h.speed.toFixed(2) + ' px/step)');
  ok(h.speed / e.speed > 1.5, 'and the spread is meaningful (hard marches ' + (h.speed / e.speed).toFixed(2) + '× easy)');
  // 2. word-length band
  ok(e.wordLen < n.wordLen && n.wordLen < h.wordLen, 'WORD LENGTH climbs with difficulty ('
    + e.wordLen.toFixed(2) + ' < ' + n.wordLen.toFixed(2) + ' < ' + h.wordLen.toFixed(2) + ' letters)');
  ok(h.wordLen - e.wordLen > 0.6, 'and by enough to feel (+' + (h.wordLen - e.wordLen).toFixed(2) + ' letters)');
  // 3. spawn rate
  ok(e.interval > n.interval && n.interval > h.interval, 'SPAWN INTERVAL tightens with difficulty ('
    + e.interval + ' > ' + n.interval + ' > ' + h.interval + ' steps)');
  // 4. attack cadence
  ok(e.cad > n.cad && n.cad > h.cad, 'ATTACK CADENCE tightens with difficulty ('
    + e.cad + ' > ' + n.cad + ' > ' + h.cad + ' steps)');
  // and the two it changed before
  ok(h.hp < n.hp && n.hp < e.hp, 'wall HP still falls with difficulty (' + e.hp + ' > ' + n.hp + ' > ' + h.hp + ')');
  ok(h.rock < e.rock, 'hard rocks fly in less time (' + h.rock + ' < ' + e.rock + ')');
  // 5. what a mistake costs
  ok(e.jam < n.jam && n.jam < h.jam, 'the FUMBLE jam lengthens with difficulty (' + e.jam + ' < ' + n.jam + ' < ' + h.jam + ' steps)');
  const cost = d => {
    const gl = runGame();
    gl.T().startMode('stages', d, 'en');
    gl.T().isolate(); gl.T().clearField();
    gl.T().spawn('grunt', 'ant', { x: 400, lane: 0 });
    gl.T().type('ant');
    const before = gl.T().score;
    gl.T().type('q');
    return before - gl.T().score;
  };
  const ce = cost('easy'), cn = cost('normal'), ch = cost('hard');
  ok(ce < cn && cn < ch, 'a mistake costs more points on harder settings (' + ce + ' < ' + cn + ' < ' + ch + ')');
}

section('Type Siege: Endless is a CONTINUOUS flood, not gated waves');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'en');
  ok(T().mode === 'endless', 'endless mode active');
  ok(T().spawnQueue === 0, 'no spawn QUEUE exists in Endless — nothing to drain and then wait on');

  // the spawner never stalls: clear the whole field and bodies keep arriving
  T().step(400);
  ok(T().enemies.length > 0, 'bodies stream in from the start');
  const ramp0 = T().ramp(), int0 = T().spawnInterval();
  T().clearField();
  T().step(200);
  ok(T().enemies.length > 0, 'an EMPTY field spawns straight away — no "wave cleared" pause');
  ok(T().spawnQueue === 0, 'and still no queue afterwards');

  // pressure ramps with time and kills, and never resets
  T().step(3600);
  const ramp1 = T().ramp(), int1 = T().spawnInterval();
  ok(ramp1 > ramp0, 'the siege ramp climbs with elapsed time (' + ramp0.toFixed(2) + ' → ' + ramp1.toFixed(2) + ')');
  ok(int1 < int0, 'the spawn interval tightens with it (' + int0 + ' → ' + int1 + ' steps)');
  T().finishWave();                 // fell everything: the ramp must NOT drop back
  T().step(30);
  ok(T().ramp() >= ramp1, 'clearing the field never lowers the pressure (' + T().ramp().toFixed(2) + ' >= ' + ramp1.toFixed(2) + ')');
  ok(T().cadence('grunt') <= 150, 'attackers strike at least as often as the base cadence as the ramp climbs ('
    + T().cadence('grunt') + ' <= 150)');

  // kills feed the ramp too, not just the clock
  const gk = runGame();
  gk.T().startMode('endless', 'normal', 'en');
  gk.T().isolate(); gk.T().clearField();
  gk.T().step(60);
  const rBefore = gk.T().ramp();
  for (let i = 0; i < 120; i++) { gk.T().clearField(); gk.T().spawn('grunt', 'ant', { x: 400, lane: 0 }); gk.T().type('ant'); }
  ok(gk.T().ramp() > rBefore + 0.9, 'kills feed the pressure too, not just the clock: 120 felled = a full step ('
    + rBefore.toFixed(2) + ' → ' + gk.T().ramp().toFixed(2) + ')');

  // ranks mix freely and the heavy ones only show up once the ramp has climbed
  const gm = runGame();
  gm.T().startMode('endless', 'normal', 'en');
  const kinds = new Set();
  for (let i = 0; i < 240; i++) { gm.T().step(60); gm.T().enemies.forEach(e => kinds.add(e.type)); gm.T().finishWave(); }
  ok(kinds.has('grunt') && kinds.has('archer') && kinds.has('trebuchet'),
    'the flood mixes footmen, archers and siege engines over time (' + [...kinds].sort().join(' ') + ')');

  // the read-out: a siege CLOCK, no wave number
  const ge = runGame();
  ge.T().startMode('endless', 'normal', 'en');
  ge.T().isolate();
  ge.T().step(600);
  const waveEl = ge.getEl('waveEl');
  const lblEl = ge.getEl('lblWave');
  ok(/^\d+:\d\d$/.test(waveEl.textContent), 'the 4th HUD stat reads as a clock in Endless (got "' + waveEl.textContent + '")');
  ok(lblEl.textContent === 'TIME', 'and its label is the shared TIME string, not WAVE (got "' + lblEl.textContent + '")');
  ok(ge.T().tier() >= 1, 'a pressure tier is still exposed for stats (' + ge.T().tier() + ')');

  // Stages keeps its authored waves — that is its identity
  const gs = runGame();
  gs.T().startMode('stages', 'normal', 'en');
  ok(gs.T().spawnQueue > 0, 'Stages still builds a per-wave spawn queue (' + gs.T().spawnQueue + ' bodies)');
  gs.T().finishWave(); gs.T().step(2);
  ok(gs.T().wave === 2, 'and clearing a Stages wave advances the counter');
  ok(gs.getEl('waveEl').textContent === '2/8', 'Stages HUD still shows wave 2/8');
}

section('Type Siege: supply drops');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'en');
  ok(T().dropKinds().join(',') === 'repair,slow,bonus', 'three visually distinct drop kinds');

  // repair
  T().isolate(); T().clearField();
  T().setHp(5);
  T().spawn('crate', 'rock', { x: 500, lane: 0, drop: { kind: 'repair', repair: 2 } });
  const hp0 = T().hp;
  T().step(120);
  ok(T().hp === hp0, 'a crate NEVER damages the wall while it sits there');
  T().type('rock');
  ok(T().hp === hp0 + 2, 'typing a repair crate patches the wall (' + hp0 + ' → ' + T().hp + ')');
  ok(T().enemies.length === 0, 'the crate is consumed');
  ok(T().cratesTaken === 1, 'the collection is counted');

  // slow-time
  T().clearField();
  T().spawn('crate', 'ant', { x: 500, lane: 0, drop: { kind: 'slow', slow: 170 } });
  T().type('ant');
  ok(T().slow > 100, 'a sand-glass crate buys slow-time (' + T().slow + ' steps)');
  T().clearField();
  const L = T().layout;
  const id = T().spawn('grunt', 'bell', { x: L.field.x + L.field.w * 0.9, lane: 1 });
  const x0 = T().enemies.filter(e => e.id === id)[0].x;
  T().step(60);
  const slowed = x0 - T().enemies.filter(e => e.id === id)[0].x;
  T().step(400);                     // let slow-time lapse
  ok(T().slow === 0, 'slow-time runs out');
  T().clearField();
  const id2 = T().spawn('grunt', 'bell', { x: L.field.x + L.field.w * 0.9, lane: 1 });
  const y0 = T().enemies.filter(e => e.id === id2)[0].x;
  T().step(60);
  const normal = y0 - T().enemies.filter(e => e.id === id2)[0].x;
  ok(slowed < normal * 0.6, 'the besiegers really do move at ~half speed under it (' + slowed.toFixed(1) + ' vs ' + normal.toFixed(1) + ' px/s)');

  // score bonus
  T().clearField();
  const sc0 = T().score;
  T().spawn('crate', 'tree', { x: 500, lane: 0, drop: { kind: 'bonus', score: 60 } });
  T().type('tree');
  ok(T().score === sc0 + 60, 'a coin crate pays a score bonus (+' + (T().score - sc0) + ')');

  // it expires if ignored — chasing it is a DECISION with a clock on it
  T().clearField();
  T().spawn('crate', 'star', { x: 500, lane: 0, drop: { kind: 'bonus', score: 60 }, life: 90 });
  const sc1 = T().score;
  T().step(120);
  ok(T().enemies.filter(e => e.type === 'crate').length === 0, 'an ignored crate expires off the page');
  ok(T().score === sc1, 'and pays nothing — it was never free score');

  // it sits OUT in the field, so grabbing it costs the seconds you owed the wall
  const gd = runGame();
  gd.T().startMode('endless', 'normal', 'en');
  gd.T().isolate(); gd.T().clearField();
  const cid = gd.T().spawn('crate', 'ant', {});
  const cr = gd.T().enemies.filter(e => e.id === cid)[0];
  const Ld = gd.T().layout;
  ok(cr.x > Ld.wallEdge + Ld.field.w * 0.3, 'a drop lands well out in the field, not at the wall');

  // Stages gets drops too, Rain does not
  const gs = runGame();
  gs.T().startMode('stages', 'normal', 'en');
  let sawStages = false;
  for (let i = 0; i < 40; i++) { gs.T().step(60); if (gs.T().enemies.some(e => e.type === 'crate')) { sawStages = true; break; } }
  ok(sawStages, 'Stages drops supplies during a run');
  const gr = runGame();
  gr.T().startMode('rain', 'normal', 'en');
  gr.T().step(3000);
  ok(!gr.T().enemies.some(e => e.type === 'crate'), 'Rain has no crates (falling scraps only)');
}

section('Type Siege: typing stats');
{
  const gl = runGame();
  const T = gl.T;
  T().startMode('endless', 'normal', 'en');
  T().clearField();
  T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  T().step(60);          // one second of run time
  T().type('ant');
  ok(T().hits === 3, 'every correct letter counts as a hit');
  ok(T().accuracy === 100, 'accuracy is 100% with no misses');
  ok(T().wpm > 0, 'WPM is computed from real keystrokes (got ' + T().wpm + ')');
}

section('Type Siege: cosmetics render');
{
  const gl = runGame({
    preCode: [CHALLENGES, COSMETICS],
    store: {
      gamekit_owned: JSON.stringify({ 'type-siege.ink.blueprint': { c: 0, t: 0 } }),
      gamekit_cos_sel: JSON.stringify({ 'type-siege.ink': 'type-siege.ink.blueprint' }),
    },
  });
  ok(gl.bootErr === null, 'boots with the challenges + cosmetics registries: ' + gl.bootErr);
  const inks = ['type-siege.ink.pencil', 'type-siege.ink.blueprint', 'type-siege.ink.marker'];
  ok(inks.indexOf(gl.T().ink) >= 0, 'the ink skin resolves to a known palette (got ' + gl.T().ink + ')');
  gl.T().start();
  gl.T().spawn('grunt', 'ant', { x: 400, lane: 0 });
  gl.T().spawn('trebuchet', 'mountain', { x: 500, lane: 1 });
  gl.T().spawn('boss', 'cat dog', { x: 700, lane: 2 });
  gl.T().spawn('rock', 'ab', { x: 600, y: 300 });
  gl.T().type('a');
  gl.step(6);            // real display frames → the kit loop renders
  ok(gl.errors.length === 0, 'the whole cast renders without errors: ' + gl.errors[0]);
  const gr = runGame({ preCode: [CHALLENGES, COSMETICS] });
  gr.T().startMode('rain', 'normal', 'uk');
  gr.step(8);
  ok(gr.errors.length === 0, 'Rain mode with Cyrillic words renders without errors: ' + gr.errors[0]);
}

// ---------------------------------------------------------------------------
section('Type Siege: layout + resolution fairness across viewports');
{
  const speeds = [];
  runLayoutSuite(
    () => { const gl = runGame(); gl.T().start(); return gl; },
    (gl, v, L0) => {
      const L = gl.T().layout;
      const kl = gl.win.gamekit.layout;
      const pr = kl.playRect();
      ok(L.field.x >= pr.x - 1 && L.field.y >= pr.y - 1, v.name + ': field starts inside playRect');
      ok(L.field.x + L.field.w <= pr.x + pr.w + 1, v.name + ': field within width');
      ok(L.field.y + L.field.h <= pr.y + pr.h + 1, v.name + ': field within height');
      ok(L.barY >= L.field.y + L.field.h - 1 && L.barY + L.barH <= L.H + 1, v.name + ': the type bar sits in the reserved bottom band');
      ok(L.field.y >= kl.hudTop(), v.name + ': field clears the HUD headroom');
      ok(L.wallEdge > L.field.x && L.wallEdge < L.field.x + L.field.w * 0.35, v.name + ': the wall occupies a sane slice of the left edge');
      ok(L.fontPx >= 13, v.name + ': word font stays >= 13px (got ' + L.fontPx + ')');
      ok(L.lanes >= 3, v.name + ': at least 3 lanes (got ' + L.lanes + ')');
      // FAIRNESS: crossing TIME is the invariant, so px/step must scale with the field
      const steps = (L.field.w - L.wallW) / L.speed.grunt;
      const want = L.crossSteps / L.diffSpeed;
      ok(Math.abs(steps - want) < 1,
        v.name + ': grunts always take ' + Math.round(want) + ' steps to cross (got ' + Math.round(steps) + ')');
      ok(L.rockSteps === 150, v.name + ': rock flight time is viewport-independent');
      // every spawn starts just past the right edge, never a screen away
      ok(L.spawnX > L.field.x + L.field.w && L.spawnX < L.field.x + L.field.w + 80,
        v.name + ': enemies spawn just past the right edge');
      speeds.push({ name: v.name, w: L.field.w, s: L.speed.grunt });
    }
  );
  const narrow = speeds.find(s => s.name === 'portrait phone');
  const wide = speeds.find(s => s.name === 'desktop 1440p');
  ok(narrow && wide && wide.s > narrow.s * 3,
    'enemy speed scales with viewport width (' + (narrow ? narrow.s.toFixed(2) : '?') + ' px/step @360 vs '
    + (wide ? wide.s.toFixed(2) : '?') + ' @2560)');
}

section('Type Siege: lane labels do not overlap');
{
  for (const v of [{ w: 360, h: 640 }, { w: 640, h: 360 }, { w: 1280, h: 800 }]) {
    const gl = runGame({ w: v.w, h: v.h });
    gl.T().start();
    gl.resize(v.w, v.h);
    const L = gl.T().layout;
    gl.T().clearField();
    const ids = [];
    for (let i = 0; i < L.lanes; i++) ids.push(gl.T().spawn('grunt', 'mountain', { x: 300, lane: i }));
    const ys = gl.T().enemies.map(e => e.y).sort((a, b) => a - b);
    let minGap = Infinity;
    for (let i = 1; i < ys.length; i++) minGap = Math.min(minGap, ys[i] - ys[i - 1]);
    const tagH = L.fontPx + 10;
    ok(minGap > tagH + 12, v.w + 'x' + v.h + ': lane spacing (' + Math.round(minGap) + 'px) clears a word tag (' + tagH + 'px)');
    ok(ys[0] - (L.fontPx + 14) - tagH / 2 >= L.field.y - 1, v.w + 'x' + v.h + ': the top lane label stays inside the field');
    ok(ys[ys.length - 1] + 24 <= L.field.y + L.field.h, v.w + 'x' + v.h + ': the bottom lane figure stays inside the field');
  }
}

// ---- Supply drops: never offer a repair crate at full wall ----
section('type-siege: no repair crate at full health');
{
  const g = runGame({ seed: 31 });
  const T = g.T;
  T().start();
  ok(T().hp === T().hpMax, 'wall starts at full health (' + T().hp + '/' + T().hpMax + ')');
  const kindsAt = () => {
    T().clearField();
    for (let i = 0; i < 150; i++) T().spawn('crate', 'box');
    return T().enemies.map(e => e.drop).filter(Boolean);
  };
  const full = kindsAt();
  ok(full.length > 0, 'crates spawn for the check (' + full.length + ')');
  ok(!full.includes('repair'), 'no repair crate while the wall is undamaged (kinds: ' + [...new Set(full)].join(',') + ')');
  ok(new Set(full).size >= 2, 'the other crate kinds still appear (' + [...new Set(full)].join(',') + ')');

  T().setHp(Math.max(1, T().hpMax - 5));
  const hurt = kindsAt();
  ok(hurt.includes('repair'), 'repair crates come back once the wall is damaged (kinds: ' + [...new Set(hurt)].join(',') + ')');
}

// ---- Landscape rotate gate: TOUCH only ----
// A typing game is unplayable in phone landscape (the soft keyboard owns the screen), but desktop
// landscape is the normal way to play — the gate must key off the pointer, never the orientation.
section('Type Siege: landscape rotate gate is touch-only');
{
  const t = runGame({ w: 360, h: 640, preCode: 'window.ontouchstart = null;' });
  ok(t.bootErr === null, 'boots on a touch device: ' + t.bootErr);
  ok(!t.doc.body.classList.contains('gk-rotate-lock'), 'touch portrait plays normally');
  t.resize(640, 360);
  ok(t.doc.body.classList.contains('gk-rotate-lock'), 'touch landscape asks the player to rotate');
  t.resize(360, 640);
  ok(!t.doc.body.classList.contains('gk-rotate-lock'), 'rotating back clears the prompt');

  const d = runGame({ w: 1280, h: 800 });
  d.resize(640, 360);
  ok(!d.doc.body.classList.contains('gk-rotate-lock'), 'a mouse device is never gated in landscape');
}

// ---- A run pauses behind the rotate splash ----
section('Type Siege: rotating mid-run pauses');
{
  const t = runGame({ w: 360, h: 640, preCode: 'window.ontouchstart = null;' });
  t.T().start();
  ok(t.T().state === 'playing', 'run is live before the flip');
  t.resize(640, 360);
  ok(t.T().state === 'paused', 'the siege pauses instead of marching behind the splash (got ' + t.T().state + ')');
}

summary();
