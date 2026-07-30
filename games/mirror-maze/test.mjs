// Headless tests for Mirror Maze — boots via the shared harness, drives window.__test.
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/mirror-maze/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 11, ...opts });
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');

// a signature of every beam segment on the board (cell × direction × colour mask)
function beamSig(T) {
  const n = T().size, out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let d = 0; d < 4; d++) {
    const m = T().beamAt(x, y, d); if (m) out.push(x + ',' + y + ',' + d + ':' + m);
  }
  return out.join('|');
}
const pb = (store, mode) => {
  try { return ((JSON.parse(store['gamekit_pb'] || '{}')['mirror-maze'] || {})[mode] || {}); }
  catch (e) { return {}; }
};
const lastResult = (store) => { try { return JSON.parse(store['gamekit_result_mirror-maze'] || '{}'); } catch (e) { return {}; } };

// ---------------------------------------------------------------------------
// INDEPENDENT solver — its OWN beam simulator and its OWN search, sharing no code with the game.
// The game's own `solutionLights()` only replays the solution the generator STORED, so it can never
// catch a scramble that walks the board somewhere the stored solution cannot come back from. This
// reads the DEALT board out through __test.cell()/emitter() and searches for a solution from scratch.
// A mirror flip is its own inverse, so a k-move route changes exactly k mirrors: enumerating flip
// SETS by size is a breadth-first walk of the reachable states, and the first size that solves IS the
// true minimum move count.
// ---------------------------------------------------------------------------
const CR = 1, CG = 2, CB = 4;
const DIRS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const SL = [1, 0, 3, 2], BK = [3, 2, 1, 0];
function simLit(n, cells, em) {
  const tot = n * n, seg = new Uint8Array(tot * 4), comb = new Uint8Array(tot);
  const q = [(em.y * n + em.x) * 4 + em.d];
  seg[q[0]] = 7;
  let guard = tot * 64 + 512;
  while (q.length && guard-- > 0) {
    const k = q.pop(), cell = k >> 2, d = k & 3, m = seg[k];
    if (!m) continue;
    const p = cells[cell], outs = [];
    if (!p) outs.push([d, m]);
    else if (p.t === 'mirror') outs.push([p.o === 0 ? SL[d] : BK[d], m]);
    else if (p.t === 'prism') {
      if (m & CR) outs.push([(d + 3) % 4, CR]);
      if (m & CG) outs.push([d, CG]);
      if (m & CB) outs.push([(d + 1) % 4, CB]);
    } else if (p.t === 'filter') { const f = m & p.ch; if (f) outs.push([d, f]); }
    else if (p.t === 'combiner') {
      const nm = comb[cell] | m;
      if (nm === comb[cell]) continue;
      comb[cell] = nm; outs.push([p.dir, nm]);
    }
    const x = cell % n, y = (cell - x) / n;
    for (const [od, om] of outs) {
      const nx = x + DIRS[od].x, ny = y + DIRS[od].y;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const k2 = (ny * n + nx) * 4 + od;
      if ((seg[k2] | om) !== seg[k2]) { seg[k2] |= om; q.push(k2); }
    }
  }
  let lit = 0, total = 0;
  for (let cell = 0; cell < tot; cell++) {
    const p = cells[cell];
    if (!p || p.t !== 'target') continue;
    total++;
    for (let d = 0; d < 4; d++) if (seg[cell * 4 + d] === p.col) { lit++; break; }
  }
  return { lit, total };
}
function readDealt(T) {
  const n = T().size, cells = new Array(n * n).fill(null), mirrors = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = T().cell(x, y);
    if (!c) continue;
    cells[y * n + x] = c;
    if (c.t === 'mirror') mirrors.push(y * n + x);
  }
  return { n, cells, mirrors, em: T().emitter() };
}
// → { depth, set } for the shallowest solution, or { depth: -1 } if none exists within maxDepth
function independentSolve(b, maxDepth) {
  const { n, cells, mirrors, em } = b, M = mirrors.length;
  const base = mirrors.map(i => cells[i].o);
  const solved = () => { const r = simLit(n, cells, em); return r.total > 0 && r.lit === r.total; };
  if (solved()) return { depth: 0, set: [], M };
  const idx = new Array(M);
  for (let k = 1; k <= Math.min(maxDepth, M); k++) {
    for (let i = 0; i < k; i++) idx[i] = i;
    for (;;) {
      for (let i = 0; i < k; i++) cells[mirrors[idx[i]]].o = 1 - base[idx[i]];
      const hit = solved();
      const snap = idx.slice(0, k);
      for (let i = 0; i < k; i++) cells[mirrors[idx[i]]].o = base[idx[i]];
      if (hit) return { depth: k, set: snap.map(j => mirrors[j]), M };
      let p = k - 1;
      while (p >= 0 && idx[p] === M - k + p) p--;
      if (p < 0) break;
      idx[p]++;
      for (let q = p + 1; q < k; q++) idx[q] = idx[q - 1] + 1;
    }
  }
  return { depth: -1, set: null, M };
}

// ---- Boot ----
section('mirror-maze: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');
ok(g.T().menu() != null, 'start menu is shown at boot');

// ---- Initial board ----
section('mirror-maze: initial board');
{
  const T = g.T;
  T().start();
  ok(T().state === 'playing', 'start() → playing (got ' + T().state + ')');
  ok(T().mode === 'campaign' && T().level === 0, 'start() opens campaign maze 1');
  ok(T().size === 5 && T().tier === 1, 'campaign maze 1 is a 5×5 tier-1 board (got ' + T().size + '/' + T().tier + ')');
  ok(T().targets === 1, 'tier 1 has exactly one target (got ' + T().targets + ')');
  ok(T().lit < T().targets, 'the scrambled board starts unsolved (' + T().lit + '/' + T().targets + ')');
  ok(T().mirrors() >= 2, 'board has rotatable mirrors (got ' + T().mirrors() + ')');
  ok(T().beams > 0, 'the emitter beam propagates (segments ' + T().beams + ')');
  ok(T().moves === 0, 'spin counter starts at 0');
}

// ---- Rotating a mirror changes the beam path ----
section('mirror-maze: rotating a mirror re-routes the beam');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  const n = T().size;
  // find a mirror the beam actually reaches
  let hit = null;
  for (let y = 0; y < n && !hit; y++) for (let x = 0; x < n && !hit; x++) {
    const c = T().cell(x, y);
    if (!c || c.t !== 'mirror') continue;
    for (let d = 0; d < 4; d++) if (T().beamAt(x, y, d)) { hit = { x, y, o: c.o }; break; }
  }
  ok(hit != null, 'the beam reaches at least one mirror');
  const before = beamSig(T), mv = T().moves;
  const okRot = T().rotate(hit.x, hit.y);
  ok(okRot === true, 'rotate() on a mirror succeeds');
  ok(T().cell(hit.x, hit.y).o !== hit.o, 'the mirror flipped orientation');
  ok(T().moves === mv + 1, 'spin counter incremented');
  ok(beamSig(T) !== before, 'the beam path changed after the flip');
  // a non-mirror cell cannot be rotated
  let solid = null;
  for (let y = 0; y < n && !solid; y++) for (let x = 0; x < n && !solid; x++) {
    const c = T().cell(x, y); if (c && c.t !== 'mirror') solid = { x, y };
  }
  if (solid) { const m2 = T().moves; ok(T().rotate(solid.x, solid.y) === false, 'rotate() on a non-mirror is refused');
    ok(T().moves === m2, 'a refused rotate does not count as a spin'); }
}

// ---- Solution DEPTH: no maze may solve itself by accident ----
section('mirror-maze: every campaign maze is far from solved when dealt');
{
  const gs = runGame();
  const T = gs.T;
  const FLOORS = { 1: 3, 2: 5, 3: 7, 4: 9 };
  const CAMP = [[10101, 1, 5], [10207, 1, 5], [10313, 1, 6], [20419, 2, 7], [20523, 2, 7], [20629, 2, 7],
    [30731, 3, 8], [30837, 3, 8], [30941, 3, 8], [41043, 4, 9], [41147, 4, 9], [41269, 4, 9]];
  const STAGE_FLOORS = { 1: 1, 2: 3, 3: 3, 4: 3 };
  const rows = [];
  for (let i = 0; i < CAMP.length; i++) {
    const [seed, tier, n] = CAMP[i];
    T().startMode('campaign', i);
    ok(T().tier === tier && T().size === n, 'maze ' + (i + 1) + ': tier ' + tier + ' on a ' + n + '×' + n + ' board (got ' + T().tier + '/' + T().size + ')');
    ok(T().lit < T().targets, 'maze ' + (i + 1) + ': NOT solved at deal time (' + T().lit + '/' + T().targets + ')');
    ok(T().solutionLights() === true, 'maze ' + (i + 1) + ': is solvable');
    // measured exactly: the fewest single-mirror flips to ANY solved board
    const d = T().solutionDepth();
    ok(d >= FLOORS[tier], 'maze ' + (i + 1) + ': solution depth ' + d + ' ≥ tier-' + tier + ' floor ' + FLOORS[tier]);
    ok(d >= 3, 'maze ' + (i + 1) + ': no 1- or 2-flip accident can solve it (depth ' + d + ')');
    // STAGED progress: the satisfied-target count must climb in several separate steps, never in one jump
    const prof = T().stageProfile();
    ok(prof.steps >= STAGE_FLOORS[tier], 'maze ' + (i + 1) + ': ' + prof.steps + ' target-lighting stages ≥ floor ' + STAGE_FLOORS[tier]);
    ok(prof.maxJump <= 1, 'maze ' + (i + 1) + ': no step in the solution lights more than one target at once (max ' + prof.maxJump + ')');
    ok(prof.down === 0, 'maze ' + (i + 1) + ': a staged route exists that never un-lights a target');
    if (tier >= 2) ok(T().worstSingleJump() <= 1, 'maze ' + (i + 1) + ': no single flip from the dealt board lights 2+ targets');
    ok(T().targets >= (tier === 1 ? 1 : 3), 'maze ' + (i + 1) + ': ' + T().targets + ' targets to finish one at a time');
    ok(T().par >= d, 'maze ' + (i + 1) + ': par ' + T().par + ' is reachable (≥ depth ' + d + ')');
    rows.push('maze ' + (i + 1) + ' (t' + tier + '): depth ' + d + ', stages ' + prof.steps + ', maxJump ' + prof.maxJump + ', par ' + T().par + ', targets ' + T().targets);
  }
  console.log('  ' + rows.join('\n  '));
}

// ---- The regression net for the "I can't find a solution for level 11" playtest report ----
section('mirror-maze: an INDEPENDENT search finds a solution for all 12 campaign mazes');
{
  const gs = runGame();
  const T = gs.T;
  const rows = [];
  for (let i = 0; i < 12; i++) {
    T().startMode('campaign', i);
    const dealt = readDealt(T);
    const r = independentSolve(dealt, 14);
    ok(r.depth > 0, 'maze ' + (i + 1) + ': an independent search (own simulator, own BFS — the stored ' +
      'solution is never consulted) finds a solution ' + r.depth + ' flips from the dealt board');
    ok(r.depth === T().depth, 'maze ' + (i + 1) + ': the independent minimum (' + r.depth +
      ') matches the depth the generator claims (' + T().depth + ')');
    // and the found flip set really does light every target when applied to the LIVE board
    if (r.set) {
      let applied = 0;
      for (const c of r.set) { const x = c % T().size, y = (c - c % T().size) / T().size; if (T().rotate(x, y)) applied++; }
      ok(applied === r.set.length, 'maze ' + (i + 1) + ': every flip in the found set lands on a mirror');
      ok(T().solved === true, 'maze ' + (i + 1) + ': the independently-found flip set lights every target on the live board');
    }
    rows.push('maze ' + (i + 1) + ': independent depth ' + r.depth + ' of ' + r.M + ' mirrors');
  }
  console.log('  ' + rows.join('\n  '));
}

section('mirror-maze: no maze opens with a long blind stretch (legibility floor)');
{
  const gs = runGame();
  const T = gs.T;
  // firstBlind / maxBlind = flips in a row that do NOT change the lit count, on the best staged route.
  // The tier-4 machine has three stages of three mirrors, so 2 is the structural best it can do; 3
  // means the scramble wasted a flip and the opening is longer than the puzzle needs.
  const FB = { 1: 3, 2: 2, 3: 3, 4: 2 }, MB = { 1: 3, 2: 3, 3: 3, 4: 3 };
  for (let i = 0; i < 12; i++) {
    T().startMode('campaign', i);
    const t = T().tier;
    ok(T().firstBlind <= FB[t], 'maze ' + (i + 1) + ' (t' + t + '): blind opening ' + T().firstBlind + ' ≤ ' + FB[t]);
    ok(T().maxBlind <= MB[t], 'maze ' + (i + 1) + ' (t' + t + '): worst blind stretch ' + T().maxBlind + ' ≤ ' + MB[t]);
  }
  T().startMode('daily');
  ok(T().firstBlind <= 3 && T().maxBlind <= 3, "today's daily keeps the blind bounds (" + T().firstBlind + '/' + T().maxBlind + ')');
  T().startMode('endless');
  for (let i = 0; i < 5; i++) {
    ok(T().firstBlind <= 3 && T().maxBlind <= 3, 'endless board ' + (i + 1) + ' keeps the blind bounds (' +
      T().firstBlind + '/' + T().maxBlind + ')');
    T().solve(); T().step(90); if (T().menu()) T().menu().activate('next');
  }
}

section('mirror-maze: generated mazes hold their depth floor across many seeds');
{
  const gs = runGame();
  const T = gs.T;
  const FLOORS = { 1: 3, 2: 5, 3: 7, 4: 9 }, SIZES = { 1: 5, 2: 7, 3: 8, 4: 9 };
  for (const tier of [1, 2, 3, 4]) {
    let below = 0, min = 99, single = 0;
    for (let s = 0; s < 20; s++) {
      const b = T().genBoard(7700 + s * 613, tier, SIZES[tier]);
      const d = T().solutionDepth(b);
      if (d < FLOORS[tier]) below++;
      if (d <= 1) single++;
      min = Math.min(min, d);
    }
    ok(below === 0, 'tier ' + tier + ': 20/20 boards meet the depth floor ' + FLOORS[tier] + ' (min ' + min + ')');
    ok(single === 0, 'tier ' + tier + ': no board is one flip from solved');
    // staged progress on freshly generated boards too
    let stgBad = 0, jumpBad = 0;
    const STAGE_FLOORS = { 1: 1, 2: 3, 3: 3, 4: 3 };
    for (let s = 0; s < 8; s++) {
      T().startMode(tier === 1 ? 'campaign' : 'campaign', tier === 1 ? 0 : tier === 2 ? 3 + (s % 3) : tier === 3 ? 6 + (s % 3) : 9 + (s % 3));
      const pf = T().stageProfile();
      if (pf.steps < STAGE_FLOORS[tier]) stgBad++;
      if (pf.maxJump > 1 || pf.down > 0) jumpBad++;
    }
    ok(stgBad === 0, 'tier ' + tier + ': staged progress holds on every campaign board of this tier');
    ok(jumpBad === 0, 'tier ' + tier + ': no board lights 2+ targets in one step');
  }
}

section('mirror-maze: the daily and endless boards hold the floor too');
{
  const gs = runGame();
  const T = gs.T;
  const FLOORS = { 1: 3, 2: 5, 3: 7, 4: 9 };
  T().startMode('daily');
  ok(T().lit < T().targets, 'the daily board is not solved when dealt');
  ok(T().depth >= FLOORS[T().tier], "today's daily depth " + T().depth + ' ≥ floor ' + FLOORS[T().tier]);
  T().startMode('endless');
  for (let i = 0; i < 5; i++) {
    ok(T().depth >= FLOORS[T().tier], 'endless board ' + (i + 1) + ' (tier ' + T().tier + '): depth ' + T().depth + ' ≥ floor ' + FLOORS[T().tier]);
    ok(T().lit < T().targets, 'endless board ' + (i + 1) + ' is not solved when dealt');
    T().solve(); T().step(90); if (T().menu()) T().menu().activate('next');
  }
}

// ---- Generation is solvable BY CONSTRUCTION (all four tiers) ----
section('mirror-maze: every generated board is solvable by construction');
{
  const gs = runGame();
  const T = gs.T;
  const sizes = { 1: 5, 2: 6, 3: 7, 4: 8 };
  for (const tier of [1, 2, 3, 4]) {
    let good = 0, unsolved = 0, tg = 0, worstPops = 0;
    for (let s = 0; s < 24; s++) {
      const r = T().checkGen(4000 + s * 331, tier, sizes[tier]);
      if (r.solvedByConstruction) good++;
      if (r.scrambledUnsolved) unsolved++;
      tg += r.targets; worstPops = Math.max(worstPops, r.pops);
    }
    ok(good === 24, 'tier ' + tier + ': the stored solution lights every target on 24/24 boards (got ' + good + ')');
    ok(unsolved === 24, 'tier ' + tier + ': the scrambled board is never already solved (got ' + unsolved + ')');
    ok(tg / 24 >= 1, 'tier ' + tier + ': boards carry targets (avg ' + (tg / 24).toFixed(2) + ')');
    ok(worstPops < sizes[tier] * sizes[tier] * 16, 'tier ' + tier + ': propagation stays well under the segment cap (' + worstPops + ')');
  }
}

section('mirror-maze: the generator solution drives the live board to solved');
{
  const gs = runGame();
  const T = gs.T;
  for (const [m, lv] of [['campaign', 0], ['campaign', 4], ['campaign', 7], ['campaign', 10]]) {
    T().startMode(m, lv);
    ok(T().solutionLights() === true, 'maze ' + (lv + 1) + ' (tier ' + T().tier + '): the stored solution lights every target');
    ok(T().lit < T().targets, 'maze ' + (lv + 1) + ': the board is still unsolved after peeking at the solution');
  }
  T().startMode('campaign', 0);
  ok(T().solve() === true, 'solve() lights every target');
  ok(T().solved === true, 'the board reads as solved');
  ok(T().state === 'over', 'solving ends the board');
}

// ---- Colour mixing at a combiner ----
section('mirror-maze: additive mixing happens at a combiner (red + green = yellow)');
{
  const gs = runGame();
  const T = gs.T;
  // emitter fires right into row 2; prism splits; the red (left) and green (straight) branches
  // meet perpendicular at the combiner (3,2), which fires yellow into the Y target at (4,2).
  T().loadCustom({ n: 5, em: { x: 0, y: 2, d: 1 }, cells: [
    [1, 2, { t: 'prism' }],
    [1, 1, { t: 'mirror', o: 0 }],
    [3, 1, { t: 'mirror', o: 1 }],
    [3, 2, { t: 'combiner', dir: 1 }],
    [4, 2, { t: 'target', col: 3 }],
  ] });
  ok(T().beamAt(3, 2, 2) === 1, 'the red branch arrives at the combiner from above (got ' + T().beamAt(3, 2, 2) + ')');
  ok(T().beamAt(3, 2, 1) === 2, 'the green branch arrives at the combiner from the left (got ' + T().beamAt(3, 2, 1) + ')');
  ok(T().beamAt(4, 2, 1) === 3, 'the combiner emits yellow (mask 3, got ' + T().beamAt(4, 2, 1) + ')');
  ok(T().targetLit(4, 2) === true, 'the yellow target lights when BOTH beams reach the combiner');
  ok(T().lit === 1 && T().targets === 1, 'the board reads as solved with one lit target');
  // break the red branch: the combiner now only carries green, so yellow never forms
  T().setCell(3, 1, { t: 'mirror', o: 0 });
  ok(T().beamAt(4, 2, 1) === 2, 'with red missing the combiner emits plain green (got ' + T().beamAt(4, 2, 1) + ')');
  ok(T().targetLit(4, 2) === false, 'the yellow target stays dark with only one beam');
}

// ---- 90° crossing does NOT merge ----
section('mirror-maze: beams crossing at 90° pass through each other');
{
  const gs = runGame();
  const T = gs.T;
  // red runs right along row 1, green runs up column 3 — they cross at the empty cell (3,1)
  T().loadCustom({ n: 5, em: { x: 0, y: 2, d: 1 }, cells: [
    [1, 2, { t: 'prism' }],
    [1, 1, { t: 'mirror', o: 0 }],
    [3, 2, { t: 'mirror', o: 0 }],
    [4, 1, { t: 'target', col: 1 }],
    [3, 0, { t: 'target', col: 2 }],
  ] });
  ok(T().beamAt(3, 1, 1) === 1, 'the horizontal beam through the crossing is still pure red (got ' + T().beamAt(3, 1, 1) + ')');
  ok(T().beamAt(3, 1, 0) === 2, 'the vertical beam through the crossing is still pure green (got ' + T().beamAt(3, 1, 0) + ')');
  ok(T().cell(3, 1) === null, 'the crossing cell is empty (no combiner)');
  ok(T().targetLit(4, 1) === true, 'the red target past the crossing is lit');
  ok(T().targetLit(3, 0) === true, 'the green target past the crossing is lit');
  let anyYellow = false;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) for (let d = 0; d < 4; d++) if (T().beamAt(x, y, d) === 3) anyYellow = true;
  ok(anyYellow === false, 'crossing never produces a mixed (yellow) segment');
}

section('mirror-maze: two beams overlapping in the SAME direction do merge');
{
  const gs = runGame();
  const T = gs.T;
  // The red and green branches of prism 1 are routed into prism 2 from two different sides. Prism 2
  // sends red's channel out on its left turn and green's channel straight on — both eastbound, so the
  // two beams share one segment and add to yellow.
  T().loadCustom({ n: 7, em: { x: 0, y: 4, d: 1 }, cells: [
    [1, 4, { t: 'prism' }],                    // red bends up, green carries on east, blue bends down
    [1, 1, { t: 'mirror', o: 0 }],             // red: north → east along row 1
    [3, 1, { t: 'mirror', o: 1 }],             // red: east → south down column 3
    [2, 4, { t: 'mirror', o: 0 }],             // green: east → north up column 2
    [2, 2, { t: 'mirror', o: 0 }],             // green: north → east along row 2
    [3, 2, { t: 'prism' }],                    // red arrives from the north, green from the west
    [4, 2, { t: 'target', col: 3 }],
  ] });
  ok(T().beamAt(3, 2, 2) === 1, 'red reaches the second prism travelling south (got ' + T().beamAt(3, 2, 2) + ')');
  ok(T().beamAt(3, 2, 1) === 2, 'green reaches the second prism travelling east (got ' + T().beamAt(3, 2, 1) + ')');
  ok(T().beamAt(4, 2, 1) === 3, 'the shared eastbound segment carries red+green = yellow (got ' + T().beamAt(4, 2, 1) + ')');
  ok(T().targetLit(4, 2) === true, 'the yellow target lights from the same-direction overlap');
  T().setCell(3, 1, { t: 'mirror', o: 0 });    // send red away — the shared segment loses its red half
  ok(T().beamAt(4, 2, 1) === 2, 'with red gone the shared segment is plain green (got ' + T().beamAt(4, 2, 1) + ')');
  ok(T().targetLit(4, 2) === false, 'the yellow target goes dark when one half of the overlap is lost');
}

// ---- Filters gate a channel ----
section('mirror-maze: a filter only passes its own channel');
{
  const gs = runGame();
  const T = gs.T;
  T().loadCustom({ n: 5, em: { x: 0, y: 2, d: 1 }, cells: [
    [2, 2, { t: 'filter', ch: 1 }],
    [4, 2, { t: 'target', col: 1 }],
  ] });
  ok(T().beamAt(3, 2, 1) === 1, 'white through a red filter leaves red only (got ' + T().beamAt(3, 2, 1) + ')');
  ok(T().targetLit(4, 2) === true, 'the red target lights behind a red filter');
  T().setCell(2, 2, { t: 'filter', ch: 2 });
  ok(T().beamAt(3, 2, 1) === 2, 'a green filter leaves green only (got ' + T().beamAt(3, 2, 1) + ')');
  ok(T().targetLit(4, 2) === false, 'the red target stays dark behind a green filter');
  // a filter that removes every channel kills the beam
  T().loadCustom({ n: 5, em: { x: 0, y: 2, d: 1 }, cells: [
    [1, 2, { t: 'filter', ch: 1 }],
    [2, 2, { t: 'filter', ch: 2 }],
    [4, 2, { t: 'target', col: 1 }],
  ] });
  ok(T().beamAt(3, 2, 1) === 0, 'two disjoint filters extinguish the beam (got ' + T().beamAt(3, 2, 1) + ')');
  ok(T().targetLit(4, 2) === false, 'nothing lights behind an extinguished beam');
}

// ---- A beam loop terminates (bounded fixed point, no hang) ----
section('mirror-maze: a beam loop terminates with bounded segments');
{
  const gs = runGame();
  const T = gs.T;
  // combiner at (1,1) fires east; three mirrors bring the beam back into it from below → a closed cycle
  T().loadCustom({ n: 5, em: { x: 0, y: 1, d: 1 }, cells: [
    [1, 1, { t: 'combiner', dir: 1 }],
    [2, 1, { t: 'mirror', o: 1 }],
    [2, 2, { t: 'mirror', o: 0 }],
    [1, 2, { t: 'mirror', o: 1 }],
    [4, 4, { t: 'target', col: 7 }],
  ] });
  ok(gs.errors.length === 0, 'a looping board resolves without throwing');
  ok(T().beamAt(1, 1, 0) === 7, 'the loop closes back into the combiner from below (got ' + T().beamAt(1, 1, 0) + ')');
  ok(T().pops < 5 * 5 * 16 + 256, 'the worklist stops far below the segment cap (pops ' + T().pops + ')');
  ok(T().beams <= 5 * 5 * 4, 'segment count is bounded by cells × directions (' + T().beams + ')');
  ok(T().targetLit(4, 4) === false, 'a beam trapped in the loop never reaches the target');
  // and the loop is still stable after a re-resolve
  const before = beamSig(T);
  T().resolve();
  ok(beamSig(T) === before, 're-resolving a looping board is idempotent');
  // a mirror-only board can never loop (mirrors are reversible) — the beam always leaves
  T().loadCustom({ n: 4, em: { x: 0, y: 1, d: 1 }, cells: [
    [1, 1, { t: 'mirror', o: 0 }], [2, 1, { t: 'mirror', o: 1 }],
    [2, 2, { t: 'mirror', o: 0 }], [1, 2, { t: 'mirror', o: 1 }],
  ] });
  ok(gs.errors.length === 0, 'a mirror square resolves without throwing');
  ok(T().pops < 4 * 4 * 16 + 256, 'mirror-only propagation terminates (pops ' + T().pops + ')');
}

// ---- Solving advances / end menu ----
section('mirror-maze: solving advances to the next maze');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 0);
  T().solve();
  ok(T().mazes === 1, 'solving counts one maze (got ' + T().mazes + ')');
  ok(T().score > 0, 'solving awards points (got ' + T().score + ')');
  ok(T().state === 'over', 'state is over while the win flourish plays');
  T().step(90);
  ok(T().menu() != null, 'the end menu appears after the flourish');
  T().menu().activate('next');
  ok(T().state === 'playing', 'NEXT MAZE starts the next board');
  ok(T().level === 1, 'campaign advanced to maze 2 (got ' + (T().level + 1) + ')');
  ok(T().score > 0, 'the run score carries over into the next maze (' + T().score + ')');
  ok(T().moves === 0, 'the spin counter resets per maze');
  T().solve(); T().step(90);
  ok(T().mazes === 2, 'a second solve makes it 2 mazes this run (got ' + T().mazes + ')');
}

section('mirror-maze: end menu "play again" restarts the run');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('daily');                 // no "next maze" in daily → PLAY AGAIN is the primary action
  T().solve(); T().step(90);
  ok(T().menu() != null, 'end menu present');
  ok(T().menu().activate('next') === false, 'daily has no NEXT MAZE action');
  T().menu().activate('again');
  ok(T().state === 'playing', 'PLAY AGAIN starts a new run');
  ok(T().score === 0 && T().mazes === 0, 'PLAY AGAIN resets the run score and the maze count');
  ok(T().lit < T().targets, 'PLAY AGAIN hands back an unsolved board');
  // the last campaign maze also ends on PLAY AGAIN
  const g2 = runGame();
  g2.T().startMode('campaign', 11);
  g2.T().solve(); g2.T().step(90);
  ok(g2.T().menu().activate('next') === false, 'the last campaign maze has no NEXT MAZE action');
  g2.T().menu().activate('again');
  ok(g2.T().state === 'playing' && g2.T().level === 11, 'PLAY AGAIN replays the last maze');
}

// ---- Best score + record ----
section('mirror-maze: best persists under the mode label');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 0);
  T().solve(); T().step(90);
  const camp1 = pb(gs.store, 'Campaign').score;
  ok(camp1 > 0, 'best stored under "Campaign" (got ' + camp1 + ')');
  T().menu().activate('next');
  T().solve(); T().step(90);
  ok(pb(gs.store, 'Campaign').score > camp1, 'best tracks the higher-scoring run (' + camp1 + ' → ' + pb(gs.store, 'Campaign').score + ')');

  const g2 = runGame({ store: { gamekit_pb: JSON.stringify({ 'mirror-maze': { Endless: { score: 7 } } }) } });
  ok(g2.T().state === 'ready', 'a seeded store still boots to the menu');
  g2.T().startMode('endless');
  ok(g2.T().mode === 'endless', 'endless mode starts');
}

section('mirror-maze: Campaign and Daily record time 0 (not time-primary)');
{
  const gc = runGame();
  gc.T().startMode('campaign', 0);
  gc.T().solve(); gc.T().step(90);
  const rc = lastResult(gc.store);
  ok(rc.mode === 'Campaign', 'campaign result stored under mode "Campaign" (got ' + rc.mode + ')');
  ok(rc.time === 0, 'campaign record.time is 0 (got ' + rc.time + ')');
  ok(rc.score > 0, 'campaign record.score is the points earned (got ' + rc.score + ')');
  ok(rc.stats && rc.stats.mazes === 1, 'campaign record.stats carries the maze count (got ' + JSON.stringify(rc.stats) + ')');

  const gd = runGame();
  gd.T().startMode('daily');
  ok(gd.T().mode === 'daily', 'daily mode starts');
  gd.T().solve(); gd.T().step(90);
  const rd = lastResult(gd.store);
  ok(rd.mode === 'Daily', 'daily result stored under mode "Daily" (got ' + rd.mode + ')');
  ok(rd.time === 0, 'daily record.time is 0 (got ' + rd.time + ')');
  ok(pb(gd.store, 'Daily').score >= 1, 'daily best stored under "Daily"');
}

section('mirror-maze: Endless grows the board and records under "Endless"');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('endless');
  const s0 = T().size, t0 = T().tier;
  ok(s0 === 5 && t0 === 1, 'endless opens on a small tier-1 board (got ' + s0 + '/' + t0 + ')');
  for (let i = 0; i < 6; i++) { T().solve(); T().step(90); if (T().menu()) T().menu().activate('next'); }
  ok(T().mazes === 6, 'six solves = six boards this run (got ' + T().mazes + ')');
  ok(T().tier > t0, 'the tier escalates with the run (got ' + T().tier + ')');
  ok(T().size > s0, 'the board grows with the run (got ' + T().size + ')');
  ok(pb(gs.store, 'Endless').score === T().score, 'endless best is the run points (got ' + pb(gs.store, 'Endless').score + ')');
  ok(pb(gs.store, 'Endless').score > 6, 'endless best is a POINTS scale, not a board count (' + pb(gs.store, 'Endless').score + ')');
  ok(lastResult(gs.store).time === 0, 'endless record.time is 0 as well');
}

// ---- Campaign completion persists + unlocks ----
section('mirror-maze: campaign completion persists and unlocks the next maze');
{
  const gs = runGame();
  gs.T().startMode('campaign', 0);
  gs.T().solve(); gs.T().step(90);
  const raw = gs.store['mirror-maze_done'];
  ok(!!raw, 'a cleared maze writes mirror-maze_done');
  const o = JSON.parse(raw || '{}');
  ok(o.v === 1 && Array.isArray(o.done) && o.done.indexOf(0) === 0, 'stored as a versioned list {v:1,done:[0]} (got ' + raw + ')');
  ok(raw.length < 200, 'the completion record stays tiny (' + raw.length + ' bytes)');

  const g2 = bootGame(FILE, { seed: 11, store: gs.store });
  ok(g2.T().campaignDone().indexOf(0) >= 0, 'completion survives a fresh session');
  ok(g2.T().level === 1, 'the start menu preselects the next unlocked maze (got ' + (g2.T().level + 1) + ')');
  const g3 = bootGame(FILE, { seed: 11 });
  ok(g3.T().level === 0, 'a fresh profile starts on maze 1');
}

// ---- Daily seed stability ----
section('mirror-maze: the daily maze is one board per UTC day');
{
  const gs = runGame();
  const T = gs.T;
  const a = T().dailySpec(20500), b = T().dailySpec(20500), c = T().dailySpec(20501);
  ok(a.seed === b.seed && a.tier === b.tier && a.size === b.size, 'the same day number always yields the same spec');
  ok(a.seed !== c.seed, 'a different day yields a different seed');
  ok(a.tier >= 2 && a.tier <= 4 && a.size >= 6 && a.size <= 8, 'daily boards stay in the tier 2–4 / 6–8 band (' + a.tier + '/' + a.size + ')');
  const today = T().dailySpec();
  T().startMode('daily');
  ok(T().size === today.size && T().tier === today.tier, "the daily board matches today's spec (" + T().size + '/' + T().tier + ' vs ' + today.size + '/' + today.tier + ')');
  // two independent sessions on the same day get the same board
  const s1 = (() => { const x = runGame(); x.T().startMode('daily'); return x.T().orient().length + ':' + x.T().size + ':' + x.T().emitter().x + ',' + x.T().emitter().y + ',' + x.T().emitter().d; })();
  const s2 = (() => { const x = runGame(); x.T().startMode('daily'); return x.T().orient().length + ':' + x.T().size + ':' + x.T().emitter().x + ',' + x.T().emitter().y + ',' + x.T().emitter().d; })();
  ok(s1 === s2, 'the same day gives every player the same maze (' + s1 + ' vs ' + s2 + ')');
}

// ---- Resume ----
section('mirror-maze: resume an in-progress maze');
{
  const g1 = runGame();
  g1.T().startMode('campaign', 2);
  const n = g1.T().size;
  // spin a mirror so the saved state differs from a fresh board
  let did = false;
  for (let y = 0; y < n && !did; y++) for (let x = 0; x < n && !did; x++) {
    const c = g1.T().cell(x, y); if (c && c.t === 'mirror') { did = g1.T().rotate(x, y); }
  }
  ok(did, 'a mirror was spun');
  g1.T().saveNow();
  const savedOrient = g1.T().orient(), savedMoves = g1.T().moves;
  ok(g1.T().hasSave(), 'a spin creates a resume save');
  g1.T().toMenu();
  ok(g1.T().state === 'ready', 'toMenu returns to the start screen');

  const g2 = bootGame(FILE, { seed: 11, store: g1.store });
  ok(g2.T().hasSave(), 'the save persists into a fresh session');
  ok(g2.T().resume() === true, 'resume() succeeds');
  ok(g2.T().state === 'playing', 'the resumed run is playing');
  ok(g2.T().level === 2, 'the resumed maze index matches (got ' + g2.T().level + ')');
  ok(g2.T().orient() === savedOrient, 'the resumed mirror orientations match (' + g2.T().orient() + ' vs ' + savedOrient + ')');
  ok(g2.T().moves === savedMoves, 'the resumed spin count matches');
  ok(g2.T().solutionLights() === true, 'the resumed board is still solvable');
  g2.T().solve();
  ok(g2.T().solved === true, 'the resumed board can be solved');
  ok(!g2.T().hasSave(), 'solving clears the resume save');

  const g3 = bootGame(FILE, { seed: 11, store: g1.store });
  g3.T().startMode('campaign', 0);
  ok(!g3.T().hasSave() || g3.T().savedRun().level === 0, 'a fresh start replaces the prior save');
}

section('mirror-maze: the progress store stays small and versioned');
{
  const gs = runGame();
  gs.T().startMode('campaign', 11);       // the biggest board
  gs.T().saveNow();
  const raw = gs.store['mirror-maze_progress'] || '';
  ok(raw.length > 0, 'a progress entry is written');
  ok(raw.length < 400, 'the progress blob stays tiny (' + raw.length + ' bytes)');
  ok(JSON.parse(raw)[0].v === 1, 'the progress entry carries a schema version');
  const total = Object.keys(gs.store).filter(k => k.indexOf('mirror-maze') === 0)
    .reduce((a, k) => a + k.length + String(gs.store[k]).length, 0);
  ok(total < 2000, 'all mirror-maze keys together stay far under 10 KB (' + total + ' bytes)');
}

// ---- Pause ----
section('mirror-maze: pause menu');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().pause();
  ok(T().menu() != null, 'Esc/⏸ opens the pause menu');
  T().menu().activate('resume');
  ok(T().state === 'playing', 'resume returns to the board');
  T().pause();
  T().menu().activate('menu');
  ok(T().state === 'ready', 'quit to menu returns to the start screen');
  ok(T().hasSave(), 'quitting keeps the resume save');
}

// ---- Cosmetics ----
section('mirror-maze: beam skins render');
{
  const g0 = runGame({ preCode: [CHALLENGES, COSMETICS] });
  ok(g0.T().skinId() === 'mirror-maze.beam.neon', 'unset cosmetics fall back to the free neon palette (got ' + g0.T().skinId() + ')');
  g0.T().start(); g0.step(4);
  ok(g0.errors.length === 0, 'default palette renders without errors: ' + g0.errors[0]);

  for (const key of ['sunset', 'spectrum', 'aurora']) {
    const id = 'mirror-maze.beam.' + key;
    const gx = runGame({ preCode: [CHALLENGES, COSMETICS], store: {
      gamekit_owned: JSON.stringify({ [id]: { c: 0, t: 0 } }),
      gamekit_cos_sel: JSON.stringify({ 'mirror-maze.beam': id }),
    } });
    gx.T().startMode('campaign', 10); gx.step(4);
    ok(gx.errors.length === 0, key + ' palette renders without errors: ' + gx.errors[0]);
  }
  // an unknown / not-yet-registered skin id must never crash the render
  const gu = runGame({ preCode: [CHALLENGES, COSMETICS], store: {
    gamekit_cos_sel: JSON.stringify({ 'mirror-maze.beam': 'mirror-maze.beam.doesnotexist' }),
  } });
  gu.T().start(); gu.step(4);
  ok(gu.errors.length === 0, 'an unknown skin id falls back safely: ' + gu.errors[0]);
  ok(gu.T().skinId() === 'mirror-maze.beam.neon', 'unknown skin resolves to the default palette');
}

// ---- Pointer input ----
section('mirror-maze: tapping a mirror on the canvas spins it');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().dismissLegend();                    // the first-maze legend would swallow the first tap
  const L = T().layout, n = L.board.n;
  let hit = null;
  for (let y = 0; y < n && !hit; y++) for (let x = 0; x < n && !hit; x++) {
    const c = T().cell(x, y); if (c && c.t === 'mirror') hit = { x, y, o: c.o };
  }
  const px = L.board.x + hit.x * L.cell + L.cell / 2, py = L.board.y + hit.y * L.cell + L.cell / 2;
  gs.el('game').fire('pointerdown', { clientX: px, clientY: py });
  gs.el('game').fire('pointerup', { clientX: px, clientY: py });
  ok(T().moves === 1, 'a canvas tap counts one spin (got ' + T().moves + ')');
  ok(T().cell(hit.x, hit.y).o !== hit.o, 'the tapped mirror flipped');
  // a tap outside the board does nothing
  gs.el('game').fire('pointerdown', { clientX: 4, clientY: 4 });
  gs.el('game').fire('pointerup', { clientX: 4, clientY: 4 });
  ok(T().moves === 1, 'a tap off the board is ignored');
}

section('mirror-maze: keyboard cursor spins the selected mirror');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  const n = T().size;
  let spun = false;
  // walk the cursor across the board pressing Enter until a mirror flips
  for (let i = 0; i < n * n && !spun; i++) {
    const before = T().moves;
    gs.down('Enter');
    if (T().moves > before) spun = true; else gs.down(i % n === n - 1 ? 'ArrowDown' : 'ArrowRight');
  }
  ok(spun, 'Enter spins the mirror under the keyboard cursor');
  gs.down('Escape');
  ok(T().menu() != null, 'Escape opens the pause menu');
}

// ---- Direct render coverage (the kit loop swallows draw errors, so call render() ourselves) ----
section('mirror-maze: every piece renders without throwing');
{
  for (const lv of [0, 3, 6, 9, 11]) {
    const gs = runGame({ preCode: [CHALLENGES, COSMETICS] });
    gs.T().startMode('campaign', lv);
    gs.T().dismissLegend();
    let threw = null;
    try { for (let i = 0; i < 4; i++) { gs.T().step(3); gs.T().render(); } } catch (e) { threw = e; }
    ok(threw === null, 'maze ' + (lv + 1) + ' renders every piece: ' + (threw && threw.message));
    // and mid-animation: a fresh spin + a partly-propagated beam + a filling target
    const n = gs.T().size;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = gs.T().cell(x, y); if (c && c.t === 'mirror') { gs.T().rotate(x, y); y = n; break; } }
    try { gs.T().render(); gs.T().step(2); gs.T().render(); gs.T().step(30); gs.T().render(); } catch (e) { threw = e; }
    ok(threw === null, 'maze ' + (lv + 1) + ' renders mid-animation: ' + (threw && threw.message));
  }
  // the legend and the solved flourish render too
  const gl = runGame({ preCode: [CHALLENGES, COSMETICS] });
  gl.T().startMode('campaign', 11);
  gl.T().showLegend();
  let e2 = null;
  try { gl.T().render(); } catch (e) { e2 = e; }
  ok(e2 === null, 'the legend renders: ' + (e2 && e2.message));
  gl.T().dismissLegend();
  gl.T().solve();
  try { for (let i = 0; i < 20; i++) { gl.T().step(2); gl.T().render(); } } catch (e) { e2 = e; }
  ok(e2 === null, 'the solve flourish renders: ' + (e2 && e2.message));
}

section('mirror-maze: the beam propagates outward instead of snapping on');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 11);
  T().dismissLegend();
  const r0 = T().resolve();
  ok(r0.draws.some(d => d.hop === 0), 'the first segment sits at hop 0');
  ok(r0.maxHop >= 1, 'a scrambled board still tracks hop distance (' + r0.maxHop + ')');
  T().solve();                              // the solved machine runs the beam right across the board
  const r = T().resolve();
  ok(r.maxHop > 6, 'the solved beam path is many hops deep (' + r.maxHop + ')');
  let bad = 0;
  for (const d of r.draws) if (!(d.hop >= 0)) bad++;
  ok(bad === 0, 'every drawn segment carries a distance from the emitter');
}

// ---- Layout ----
section('mirror-maze: layout fits every viewport');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().startMode('campaign', 11); return gl; },
  (gl, v, L0) => {
    gl.T().step(1);
    const L = gl.T().layout, b = L.board;
    ok(b.n === gl.T().size, v.name + ': the drawn board matches the model size');
    ok(b.y >= L.topReserve - 1, v.name + ': board clears the HUD (top ' + Math.round(b.y) + ' >= ' + L.topReserve + ')');
    ok(b.x >= 0 && b.x + b.w <= L.W, v.name + ': board within width');
    ok(b.y >= 0 && b.y + b.h <= L.H, v.name + ': board within height');
    ok(Math.abs(b.w - b.h) < 2, v.name + ': board stays square');
    ok(L.cell >= 20, v.name + ': cells stay tappable (cell ' + L.cell + 'px)');
    // the emitter housing sits in the ring OUTSIDE the grid — it must be fully on screen, clear of the
    // HUD band and clear of the right edge the kit side-stack tab owns
    const e = gl.T().emitterBox();
    ok(e.x >= 0 && e.x + e.w <= L.W - 12, v.name + ': the emitter housing is on screen horizontally (' +
      Math.round(e.x) + '..' + Math.round(e.x + e.w) + ' of ' + L.W + ')');
    ok(e.y >= L.topReserve - L.cell && e.y + e.h <= L.H, v.name + ': the emitter housing is on screen vertically');
  }
);

// ---- Teaching: legend + new-piece toasts ----
section('mirror-maze: the piece legend teaches the board');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 0);
  ok(T().legendOn === true, 'the first campaign maze opens with the piece legend');
  const rows = T().legendRows;
  ok(rows.indexOf('emitter') >= 0 && rows.indexOf('mirror') >= 0 && rows.indexOf('target') >= 0,
    'the legend covers the laser, the mirror and the target (' + rows.join(',') + ')');
  ok(rows.indexOf('prism') < 0, 'a tier-1 legend does not mention pieces that are not on the board');
  gs.step(3);
  ok(gs.errors.length === 0, 'the legend renders without errors: ' + gs.errors[0]);
  // a tap dismisses it and does NOT spin a mirror
  const L = T().layout;
  gs.el('game').fire('pointerdown', { clientX: L.board.x + L.cell / 2, clientY: L.board.y + L.cell / 2 });
  gs.el('game').fire('pointerup', { clientX: L.board.x + L.cell / 2, clientY: L.board.y + L.cell / 2 });
  ok(T().legendOn === false, 'a tap dismisses the legend');
  ok(T().moves === 0, 'the dismissing tap does not spin a mirror');
  ok(T().ui().legend === true, 'the legend-seen flag persists');

  const g2 = bootGame(FILE, { seed: 11, store: gs.store });
  g2.T().startMode('campaign', 0);
  ok(g2.T().legendOn === false, 'the legend does not reappear on the next session');
  // …but it is always reachable from the pause menu
  g2.T().pause();
  g2.T().menu().activate('guide');
  ok(g2.T().legendOn === true, 'the pause menu re-opens the piece guide');
  g2.down('Escape');
  ok(g2.T().legendOn === false, 'any key dismisses the guide');

  // the legend of a tier-4 board lists every piece on it
  const g3 = bootGame(FILE, { seed: 11, store: gs.store });
  g3.T().startMode('campaign', 11);
  g3.T().showLegend();
  const r4 = g3.T().legendRows;
  ok(r4.indexOf('prism') >= 0 && r4.indexOf('combiner') >= 0, 'a tier-4 legend lists the prism and combiner (' + r4.join(',') + ')');
  g3.step(3);
  ok(g3.errors.length === 0, 'the tier-4 legend renders without errors: ' + g3.errors[0]);
}

section('mirror-maze: a new piece type announces itself once');
{
  const gs = runGame();
  const T = gs.T;
  T().dismissLegend();
  T().startMode('campaign', 3);              // tier 2 → the prism is new
  ok(T().ui().seen.indexOf('prism') >= 0, 'meeting a prism marks it as introduced');
  T().startMode('campaign', 6);              // tier 3 → the filter is new
  ok(T().ui().seen.indexOf('filter') >= 0, 'meeting a filter marks it as introduced');
  T().startMode('campaign', 9);              // tier 4 → the combiner is new
  ok(T().ui().seen.indexOf('combiner') >= 0, 'meeting a combiner marks it as introduced');
  const ui = T().ui();
  ok(JSON.stringify(ui).length < 160, 'the teaching blob stays tiny (' + JSON.stringify(ui).length + ' bytes)');
  ok(ui.v === 1, 'the teaching blob is versioned');
}

section('mirror-maze: the emitter housing fits on every edge, on every viewport');
{
  // top / right / bottom / left, each at the mid row/column and at a corner row/column
  const edges = [[3, 0, 2, 'top'], [7, 3, 3, 'right'], [3, 7, 0, 'bottom'], [0, 3, 1, 'left'],
    [0, 0, 2, 'top-corner'], [7, 7, 3, 'right-corner']];
  for (const [w, h] of [[360, 640], [640, 360], [1280, 800], [2560, 1440]]) {
    for (const [ex, ey, ed, nm] of edges) {
      const gs = runGame({ w, h });
      gs.T().loadCustom({ n: 8, em: { x: ex, y: ey, d: ed }, cells: [[4, 4, { t: 'target', col: 7 }]] });
      gs.resize(w, h);
      const L = gs.T().layout, e = gs.T().emitterBox();
      ok(e.x >= 0 && e.x + e.w <= L.W - 12 && e.y >= 0 && e.y + e.h <= L.H,
        w + '×' + h + ' ' + nm + ' emitter: housing on screen [' + [e.x, e.y, e.w, e.h].map(Math.round).join(',') + '] in ' + L.W + '×' + L.H);
      const b = L.board;
      const outside = e.x + e.w <= b.x + 1 || e.x >= b.x + b.w - 1 || e.y + e.h <= b.y + 1 || e.y >= b.y + b.h - 1;
      ok(outside, w + '×' + h + ' ' + nm + ' emitter: housing sits outside the grid');
    }
  }
}

section('mirror-maze: Endless plays differently — a spin power pool that a solve tops up');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('endless');
  const start = T().budget;
  ok(start > 0, 'endless starts with a spin pool (' + start + ')');
  ok(start >= T().par, 'the starting pool covers par (' + start + ' vs par ' + T().par + ')');
  const n = T().size;
  let did = false;
  for (let y = 0; y < n && !did; y++) for (let x = 0; x < n && !did; x++) {
    const c = T().cell(x, y); if (c && c.t === 'mirror') did = T().rotate(x, y);
  }
  ok(T().budget === start - 1, 'a spin costs one from the pool (' + T().budget + ')');
  T().solve(); T().step(90);
  ok(T().menu() != null, 'solving shows the end screen');
  T().menu().activate('next');
  ok(T().budget > 0, 'a solve tops the pool back up (' + T().budget + ')');
  // burn the pool down: the run ends when the laser runs out of power
  let guard = 0;
  while (T().budget > 0 && T().state === 'playing' && guard++ < 200) {
    let done = false;
    for (let y = 0; y < T().size && !done; y++) for (let x = 0; x < T().size && !done; x++) {
      const c = T().cell(x, y); if (c && c.t === 'mirror') done = T().rotate(x, y);
    }
    if (!done) break;
  }
  ok(T().state === 'over', 'running out of power ends the run');
  T().step(90);
  ok(T().menu() != null, 'the out-of-power end screen shows');
  ok(T().outOfPower === true, 'the run ended because the pool ran dry');
  const rec = lastResult(gs.store);
  ok(rec.mode === 'Endless' && rec.time === 0, 'endless result stays under "Endless" with time 0');
  // campaign has no power pool
  const g2 = runGame();
  g2.T().startMode('campaign', 0);
  ok(g2.T().budget === 0, 'campaign runs carry no spin pool');
}

// ---- Hints ----
section('mirror-maze: a hint always names a mirror that is genuinely the wrong way round');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 10);           // the maze the playtest got stuck on
  T().dismissLegend();
  ok(T().hints === 0, 'a fresh board has used no hints');
  ok(T().hintCell === -1, 'nothing is ringed before the first hint');
  ok(T().hintBtnShown() === true, 'the HINT button is visible during play');

  // the hint set is exactly the flips of a REAL nearest solution — verified with the independent solver
  const flips = T().nearestFlips();
  const dealt = readDealt(T);
  const indep = independentSolve(dealt, 14);
  ok(flips.length === indep.depth, 'the hint source set is a shortest solution (' + flips.length + ' vs independent ' + indep.depth + ')');

  ok(T().hint() === true, 'hint() succeeds on an unsolved board');
  ok(T().hints === 1, 'the hint counter incremented');
  const first = T().hintCell;
  ok(first >= 0, 'a mirror is now ringed (cell ' + first + ')');
  ok(flips.indexOf(first) >= 0, 'the ringed mirror is one the solution needs flipped');
  const xy = T().hintXY;
  ok(T().cell(xy.x, xy.y).t === 'mirror', 'the ringed cell really holds a mirror');

  // repeated hints CYCLE to a different wrong piece
  T().hint();
  ok(T().hintCell !== first, 'a second hint rings a DIFFERENT mirror (' + T().hintCell + ' vs ' + first + ')');
  ok(T().hints === 2, 'the second hint counted too');
  const seen = new Set([first, T().hintCell]);
  for (let i = 0; i < flips.length - 2; i++) { T().hint(); seen.add(T().hintCell); }
  ok(seen.size === flips.length, 'repeated hints walk every wrong mirror before repeating (' + seen.size + ' of ' + flips.length + ')');

  // taking the hint clears the ring
  const cur = T().hintXY;
  T().rotate(cur.x, cur.y);
  ok(T().hintCell === -1, 'flipping the ringed mirror clears the ring');

  // a hint is still honest after the player has drifted off the intended route
  const g2 = runGame();
  g2.T().startMode('campaign', 10);
  g2.T().dismissLegend();
  const n2 = g2.T().size;
  let spun = 0;
  for (let y = 0; y < n2 && spun < 3; y++) for (let x = 0; x < n2 && spun < 3; x++) {
    const c = g2.T().cell(x, y); if (c && c.t === 'mirror' && g2.T().rotate(x, y)) spun++;
  }
  ok(spun === 3, 'three arbitrary mirrors were spun (the player wandered off)');
  const f2 = g2.T().nearestFlips();
  ok(f2.length > 0, 'a nearest solution still exists from the drifted board (' + f2.length + ' flips)');
  for (const c of f2) { const x = c % n2, y = (c - c % n2) / n2; g2.T().rotate(x, y); }
  ok(g2.T().solved === true, 'applying the hint set from a drifted board solves it');
}

section('mirror-maze: hints carry a visible cost');
{
  // a hinted maze cannot earn "par or better", and the count shows on the end screen
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 0);
  T().dismissLegend();
  T().hint();
  ok(T().hints === 1, 'one hint used');
  T().solve(); T().step(120);
  const m = T().menu();
  ok(m != null, 'end screen shown after a hinted solve');
  ok(T().hints === 1, 'the hint count survives to the end screen');

  // the HUD only shows HINTS once one has been used
  const g2 = runGame();
  g2.T().startMode('campaign', 0);
  ok(g2.el('hintStat').style.display === 'none', 'the HUD hides the HINTS stat at zero');
  g2.T().dismissLegend(); g2.T().hint();
  ok(g2.el('hintStat').style.display !== 'none', 'the HUD shows HINTS once one is used');
  ok(g2.el('hintsEl').textContent === '1', 'the HUD hint count reads 1');

  // Endless charges hints against the spin-power pool
  const g3 = runGame();
  g3.T().startMode('endless');
  const b0 = g3.T().budget, cost = g3.T().hintCost;
  ok(cost > 0, 'a hint has a power cost in endless (' + cost + ')');
  ok(g3.T().hintUi().label.indexOf(String(cost)) >= 0,
    'the button says what it costs in endless ("' + g3.T().hintUi().label + '")');
  ok(g3.T().hint() === true, 'endless hint granted while the pool holds up');
  ok(g3.T().budget === b0 - cost, 'the hint cost came out of the spin pool (' + b0 + ' → ' + g3.T().budget + ')');
  // and it is refused (not fatal) once the pool is too thin
  let guard = 0;
  while (g3.T().budget > cost && g3.T().state === 'playing' && guard++ < 400) {
    let did = false;
    for (let y = 0; y < g3.T().size && !did; y++) for (let x = 0; x < g3.T().size && !did; x++) {
      const c = g3.T().cell(x, y); if (c && c.t === 'mirror') did = g3.T().rotate(x, y);
    }
    if (!did) break;
  }
  if (g3.T().state === 'playing') {
    const hb = g3.T().hints, bb = g3.T().budget;
    ok(g3.T().hint() === false, 'a hint is refused when the pool cannot pay for it (budget ' + bb + ')');
    ok(g3.T().hints === hb, 'a refused hint does not count');
    ok(g3.T().state === 'playing', 'a refused hint never ends the run');
  }
  // campaign hints cost no power
  const g4 = runGame();
  g4.T().startMode('campaign', 3);
  g4.T().hint();
  ok(g4.T().budget === 0, 'a campaign hint touches no power pool');
}

section('mirror-maze: the hint is reachable from the pause menu and by keyboard');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 4);
  T().pause();
  ok(T().menu() != null, 'pause menu open');
  ok(T().menu().activate('hint') === true, 'the pause menu carries a HINT action');
  ok(T().hints === 1, 'the pause-menu hint counted');
  ok(T().hintCell >= 0, 'the pause-menu hint rings a mirror');
  ok(T().state === 'playing', 'taking a hint from pause returns to the board');

  const g2 = runGame();
  g2.T().startMode('campaign', 4);
  g2.down('h');
  ok(g2.T().hints === 1, 'the H key gives a hint');
  ok(g2.T().moves === 0, 'a hint is not a spin');
}

// ---- Menu: the primary action always plays the SELECTED mode ----
section('mirror-maze: the primary action follows the selected mode, even with a run in progress');
{
  // seed a campaign save so a "Continue" action exists — that is what used to hijack the play button
  const seed = runGame();
  seed.T().startMode('campaign', 1);
  let did = false;
  for (let y = 0; y < seed.T().size && !did; y++) for (let x = 0; x < seed.T().size && !did; x++) {
    const c = seed.T().cell(x, y); if (c && c.t === 'mirror') did = seed.T().rotate(x, y);
  }
  seed.T().saveNow();
  ok(seed.T().hasSave(), 'a campaign run is saved');
  const store = seed.store;

  for (const want of ['campaign', 'daily', 'endless']) {
    const g2 = bootGame(FILE, { seed: 11, store: { ...store } });
    ok(g2.T().savedRun() && g2.T().savedRun().mode === 'campaign', want + ': the saved run is a campaign one');
    const m = g2.T().menu();
    ok(m != null, want + ': start menu present');
    m.select('mode', want);
    const m2 = g2.T().menu();          // changing mode re-shows the menu
    ok(g2.T().mode === want, want + ': mode selected');
    const pid = g2.T().menuPrimary;
    // the primary is ALWAYS 'play' now: in campaign it opens level select (so it can never resume a
    // maze the player did not choose), in daily/endless it starts the run
    ok(pid === 'play', want + ': primary action is "' + pid + '" (play THIS mode)');
    m2.activate(pid);
    if (want === 'campaign') {
      ok(g2.T().menuScreen === 'levels', 'campaign: the primary opens level select (screen "' + g2.T().menuScreen + '")');
      g2.T().menu().activate('start');
    }
    ok(g2.T().state === 'playing', want + ': the primary action starts a run');
    ok(g2.T().mode === want, want + ': the run that started is ' + want + ' mode (got ' + g2.T().mode + ')');
  }

  // a saved run stays reachable — as the SECONDARY action, in the mode it belongs to
  {
    const g2 = bootGame(FILE, { seed: 11, store: { ...store } });
    ok(g2.T().level === 1, 'a cold load preselects the saved maze (got maze ' + (g2.T().level + 1) + ')');
    ok(g2.T().menuPrimary === 'play', 'the campaign primary is PLAY, never a hijacking Continue');
    ok(g2.T().menu().activate('continue') === true, 'the start menu carries a Continue action');
    ok(g2.T().state === 'playing' && g2.T().level === 1, 'Continue resumes the saved maze (maze ' + (g2.T().level + 1) + ')');

    // …and the maze picked on the level screen is the maze that plays, saved run or not
    const g3 = bootGame(FILE, { seed: 11, store: { ...store } });
    g3.T().menu().activate('play');
    const lm = g3.T().menu();
    ok(lm.select('level', '0') === true, 'a different maze is selected on the level screen');
    lm.activate('start');
    ok(g3.T().state === 'playing' && g3.T().level === 0, 'the maze that was picked is the maze that plays (maze ' + (g3.T().level + 1) + ')');
    ok(g3.T().moves === 0, 'it started fresh rather than resuming the saved maze');
  }

  // with no save at all, the single primary action still plays the selected mode
  for (const want of ['campaign', 'daily', 'endless']) {
    const g3 = runGame();
    g3.T().menu().select('mode', want);
    ok(g3.T().menuPrimary === 'play', want + ' (fresh profile): the primary action is PLAY');
    g3.T().menu().activate('play');
    if (want === 'campaign') g3.T().menu().activate('start');
    ok(g3.T().mode === want, want + ' (fresh profile): PLAY starts ' + want);
    ok(g3.T().state === 'playing', want + ' (fresh profile): a run is running');
  }
}

// ---- Endless opening difficulty scales with campaign progress ----
section('mirror-maze: Endless opens at the tier the campaign already cleared');
{
  const done = list => ({ 'mirror-maze_done': JSON.stringify({ v: 1, done: list }) });
  const upto = k => [...Array(k).keys()];

  const fresh = runGame();
  ok(fresh.T().endlessStartIdx() === 0, 'fresh profile → endless start offset 0');
  fresh.T().startMode('endless');
  ok(fresh.T().tier === 1 && fresh.T().size === 5, 'fresh profile → endless opens on a 5×5 tier-1 board (got ' +
    fresh.T().size + '/' + fresh.T().tier + ')');

  const cases = [
    { n: 2, off: 0, tier: 1, size: 5, why: 'part of tier 1 cleared → still the gentle opening' },
    { n: 3, off: 2, tier: 2, size: 7, why: 'all of tier 1 cleared → opens on prisms' },
    { n: 6, off: 4, tier: 3, size: 8, why: 'all of tier 2 cleared → opens on filters' },
    { n: 9, off: 6, tier: 4, size: 9, why: 'maze 9 cleared → opens on combiners' },
    { n: 12, off: 6, tier: 4, size: 9, why: 'whole campaign cleared → capped at tier 4 / 9×9' },
  ];
  for (const c of cases) {
    const g2 = bootGame(FILE, { seed: 11, store: done(upto(c.n)) });
    ok(g2.T().endlessStartIdx() === c.off, c.n + ' mazes cleared → start offset ' + g2.T().endlessStartIdx() + ' (want ' + c.off + ')');
    g2.T().startMode('endless');
    ok(g2.T().tier === c.tier && g2.T().size === c.size,
      c.why + ' — tier ' + g2.T().tier + ' ' + g2.T().size + '×' + g2.T().size + ' (want ' + c.tier + '/' + c.size + ')');
    ok(g2.T().lit < g2.T().targets, c.n + ' cleared: the head-start board is still unsolved when dealt');
    ok(g2.T().budget >= g2.T().par, c.n + ' cleared: the starting pool still covers par (' + g2.T().budget + ' vs ' + g2.T().par + ')');
    ok(g2.T().score === 0 && g2.T().mazes === 0, c.n + ' cleared: a head start does not pre-award anything');
  }
  // the ramp still climbs from wherever it opened
  const g4 = bootGame(FILE, { seed: 11, store: done(upto(6)) });
  g4.T().startMode('endless');
  const s0 = g4.T().size;
  for (let i = 0; i < 4; i++) { g4.T().solve(); g4.T().step(120); if (g4.T().menu()) g4.T().menu().activate('next'); }
  ok(g4.T().tier === 4, 'the ramp keeps climbing past the head start (tier ' + g4.T().tier + ')');
  ok(g4.T().size >= s0, 'the board never shrinks along the ramp (' + s0 + ' → ' + g4.T().size + ')');
}

// ---- Colour-blind accessibility ----
section('mirror-maze: the colour-blind palette toggle and the non-colour cues');
{
  const gs = runGame({ preCode: [CHALLENGES, COSMETICS] });
  ok(gs.T().cvd === false, 'the CVD palette is off by default');
  // the toggle lives in the PAUSE menu — the campaign start screen has no room for a second toggle
  // row at 640×360 (measured: it pushed the card pane 58px past the box)
  // COLOUR HELP lives in the PAUSE menu as one 3-choice row — the start screen has no room for an
  // extra row in landscape once the mode group, maze picker, goal line and two actions are in
  ok(gs.T().menu().select('clr', 'cb') === false, 'the start menu carries no colour-help row');
  gs.T().startMode('campaign', 10);
  gs.T().dismissLegend();
  gs.T().pause();
  ok(gs.T().menu().select('clr', 'cb') === true, 'the pause menu carries the colour-help row');
  ok(gs.T().cvd === true, 'picking "Colour-blind" turns the CVD palette on');
  ok(gs.T().labels === true, '"Colour-blind" keeps the colour letters on');
  gs.T().menu().select('clr', 'plain');
  ok(gs.T().cvd === false && gs.T().labels === false, '"No letters" drops both the palette and the letters');
  gs.T().menu().select('clr', 'letters');
  ok(gs.T().cvd === false && gs.T().labels === true, '"Colour letters" is letters without the CVD palette');
  gs.T().menu().select('clr', 'cb');
  gs.T().menu().activate('resume');
  ok(gs.T().cvd === true, 'the choice survives closing the pause menu');
  let threw = null;
  try { for (let i = 0; i < 4; i++) { gs.T().step(3); gs.T().render(); } } catch (e) { threw = e; }
  ok(threw === null, 'the CVD palette renders every piece: ' + (threw && threw.message));
  ok(JSON.parse(gs.store['mirror-maze_ui']).cvd === true, 'the CVD choice persists in the tiny UI blob');
  const g2 = bootGame(FILE, { seed: 11, store: gs.store });
  ok(g2.T().cvd === true, 'the CVD choice survives a fresh session');
  // the legend teaches the non-colour stroke cue
  const g3 = runGame();
  g3.T().startMode('campaign', 10);
  g3.T().showLegend();
  ok(g3.T().legendRows.indexOf('beamCue') >= 0, 'the piece guide explains the beam stroke cue (' + g3.T().legendRows.join(',') + ')');
  let e3 = null;
  try { g3.T().render(); } catch (e) { e3 = e; }
  ok(e3 === null, 'the guide with the beam-cue row renders: ' + (e3 && e3.message));
}

// ---- Scoring measures difficulty conquered, not boards counted ----
section('mirror-maze: a maze pays out its OWN difficulty, scaled by how well it was solved');
{
  const gs = runGame();
  const T = gs.T;
  // tier 4 pays strictly more than tier 1, even when the tier-1 board was solved perfectly and the
  // tier-4 one sloppily — a low-tier farm run can never catch a high-tier one
  T().startMode('campaign', 0);
  const t1par = T().par, t1Clean = T().mazeAward(0, 0);
  T().startMode('campaign', 10);
  const t4par = T().par, t4Clean = T().mazeAward(0, 0), t4Sloppy = T().mazeAward(t4par * 3, 0);
  ok(t4Clean > t1Clean, 'a clean tier-4 9×9 pays more than a clean tier-1 5×5 (' + t4Clean + ' vs ' + t1Clean + ')');
  ok(t4Clean >= t1Clean * 3, 'a tier-4 board is worth several tier-1 boards (' + t4Clean + ' vs ' + t1Clean + ')');
  ok(t4Sloppy > t1Clean, 'even a sloppy tier-4 solve beats a perfect tier-1 one (' + t4Sloppy + ' vs ' + t1Clean + ')');

  // efficiency: at or under par pays the bonus, over par decays
  const atPar = T().mazeAward(t4par, 0), overPar = T().mazeAward(t4par + 6, 0), wayOver = T().mazeAward(t4par * 4, 0);
  ok(atPar > overPar, 'solving at par pays more than going over it (' + atPar + ' vs ' + overPar + ')');
  ok(overPar > wayOver, 'the further over par, the less it pays (' + overPar + ' vs ' + wayOver + ')');
  ok(wayOver >= Math.round(t4Clean / 3), 'the efficiency decay has a floor (' + wayOver + ')');

  // hints cost points as well as the "par or better" title
  const hinted1 = T().mazeAward(t4par, 1), hinted3 = T().mazeAward(t4par, 3);
  ok(hinted1 < atPar, 'a hinted solve pays less than an unhinted one (' + hinted1 + ' vs ' + atPar + ')');
  ok(hinted3 < hinted1, 'more hints pay less still (' + hinted3 + ' vs ' + hinted1 + ')');
  ok(hinted3 > 0, 'a heavily hinted solve still pays something (' + hinted3 + ')');

  // and the live run really banks the award
  const g2 = runGame();
  g2.T().startMode('campaign', 10);
  g2.T().dismissLegend();
  ok(g2.T().score === 0, 'a run starts at 0 points');
  g2.T().solve(); g2.T().step(150);
  const aw = g2.T().award;
  ok(aw > 0, 'the solved maze reports its award (' + aw + ')');
  ok(g2.T().score === aw, 'the run total is the sum of the awards (' + g2.T().score + ')');
  g2.T().menu().activate('next');
  g2.T().solve(); g2.T().step(150);
  ok(g2.T().score === aw + g2.T().award, 'a second solve adds its own award (' + g2.T().score + ')');

  // a HIGH-tier endless start out-scores a low-tier farm over the same number of boards
  const done = list => ({ 'mirror-maze_done': JSON.stringify({ v: 1, done: list }) });
  const runN = (store, n) => {
    const g = bootGame(FILE, { seed: 11, store });
    g.T().startMode('endless'); g.T().dismissLegend();
    for (let i = 0; i < n; i++) { g.T().solve(); g.T().step(150); if (g.T().menu()) g.T().menu().activate('next'); }
    return g.T().score;
  };
  const farm = runN({}, 3), veteran = runN(done([...Array(9).keys()]), 3);
  ok(veteran > farm, '3 boards from a tier-4 start out-score 3 boards from a tier-1 farm (' + veteran + ' vs ' + farm + ')');
}

section('mirror-maze: the hint toast never sits under the HINT button (kit affordance)');
{
  // The toast is the kit's now (gamekit.hintButton): a bottom-anchored column whose FIRST child is the
  // text and last child the button — that ordering IS "the text is above the tap target". Pixel
  // geometry lives in CSS, so the browser pass measures it; what a mocked DOM can hold to is the
  // structure plus the reserved band: the play rect (board AND the HUD headroom above it) must stop
  // short of the band the button owns, at every viewport.
  for (const [w, h] of [[360, 640], [640, 360], [1280, 800], [1920, 1080], [2560, 1440]]) {
    const gs = runGame({ w, h });
    gs.T().startMode('campaign', 10);
    gs.T().dismissLegend();
    gs.resize(w, h);
    gs.T().hint();
    const ui = gs.T().hintUi(), L = gs.T().layout;
    ok(ui != null, w + '×' + h + ': the kit hint affordance is mounted');
    if (!ui) continue;
    ok(ui.shown === true, w + '×' + h + ': the 🔍 button is visible during play');
    ok(ui.tipFirst === true, w + '×' + h + ': the toast is laid out ABOVE the button, never under it');
    ok(ui.tipShown === true && ui.text.length > 0, w + '×' + h + ': the hint printed its text ("' + ui.text.slice(0, 24) + '…")');
    ok(ui.band >= 40, w + '×' + h + ': the button owns a reserved band (' + ui.band + 'px)');
    // the board never grows into the band, and the HUD headroom is above the board — so neither the
    // text nor the button can overlap live play or the score pill
    // landscape phones dock the affordance to a LEFT rail instead (a bottom strip costs a 640×360
    // board a quarter of its height) — there the board must clear the rail's width, not a bottom band
    if (ui.dock === 'left') {
      ok(L.board.x >= ui.rail - 1, w + '×' + h + ': the board clears the left hint rail (' +
        Math.round(L.board.x) + ' ≥ ' + ui.rail + ')');
      ok(L.board.y + L.board.h <= L.H + 1, w + '×' + h + ': and uses the full height (' +
        Math.round(L.board.y + L.board.h) + ' ≤ ' + L.H + ')');
    } else {
      ok(L.board.y + L.board.h <= L.H - ui.band + 1, w + '×' + h + ': the board stops above the band (' +
        Math.round(L.board.y + L.board.h) + ' ≤ ' + (L.H - ui.band) + ')');
    }
    ok(L.board.y >= L.topReserve - 1, w + '×' + h + ': and starts below the HUD (' + L.board.y + ' ≥ ' + L.topReserve + ')');
  }
  // the teaching toasts (a new-piece announcement is much longer text) ride the same affordance
  for (const [w, h] of [[360, 640], [640, 360]]) {
    const gs = runGame({ w, h });
    gs.T().startMode('campaign', 9);            // tier 4 → the combiner toast
    gs.resize(w, h);
    const ui = gs.T().hintUi();
    ok(ui != null && ui.tipFirst === true, w + '×' + h + ': the new-piece toast is above the button too');
    ok(ui.text.length > 0, w + '×' + h + ': …and it printed ("' + ui.text.slice(0, 24) + '…")');
  }
  // on a menu the whole affordance is gone — no stray button over the start screen
  const gm = runGame();
  ok(gm.T().hintUi().shown === false, 'the 🔍 button is hidden on the start menu');
  gm.T().startMode('campaign', 4);
  ok(gm.T().hintUi().shown === true, 'it appears when a run starts');
  gm.T().solve(); gm.T().step(150);
  ok(gm.T().hintUi().shown === false, 'and goes away again on the end screen');
}

section('mirror-maze: level select is its own screen (the shared kit component), and it locks');
{
  // the start menu carries ONE group — which maze is the level screen's question, in every mode
  const gs = runGame();
  ok(gs.T().menuGroups.join(',') === 'mode', 'the start menu carries only the MODE group (' + gs.T().menuGroups.join(',') + ')');
  gs.T().menu().select('mode', 'daily');
  ok(gs.T().menuGroups.join(',') === 'mode', 'daily too (' + gs.T().menuGroups.join(',') + ')');
  gs.T().menu().select('mode', 'campaign');
  ok(gs.T().menuScreen === 'start', 'the start menu is the screen that is up');

  // campaign PLAY opens the shared level screen — a grid group of all twelve mazes plus BACK
  gs.T().menu().activate('play');
  ok(gs.T().menuScreen === 'levels', 'campaign PLAY opens level select');
  ok(gs.T().state === 'ready', 'no run has started yet — the maze is still to be chosen');
  const lm = gs.T().menu();
  ok(lm != null, 'the level screen is a kit menu');
  ok(gs.T().menuGroups.join(',') === 'level', 'it carries the level grid (' + gs.T().menuGroups.join(',') + ')');
  ok(String(lm.selection().level) === '0', 'a fresh profile preselects maze 1 (got ' + lm.selection().level + ')');

  // BACK / Esc lands on the start menu, never a dead end
  ok(lm.activate('back') === true, 'the level screen carries a BACK action');
  ok(gs.T().menuScreen === 'start', 'BACK returns to the start menu');

  // locked mazes cannot be selected or started
  const g2 = runGame();
  g2.T().menu().activate('play');
  const lm2 = g2.T().menu();
  lm2.select('level', '5');
  ok(String(lm2.selection().level) === '0', 'a locked maze cannot be selected (still on ' + lm2.selection().level + ')');
  lm2.activate('start');
  ok(g2.T().state === 'playing' && g2.T().level === 0, 'starting plays the unlocked maze that IS selected');

  // …and with progress, the cleared mazes plus the next one are open
  const store = { 'mirror-maze_done': JSON.stringify({ v: 1, done: [0, 1, 2] }) };
  const g3 = bootGame(FILE, { seed: 11, store });
  ok(g3.T().level === 3, 'a returning player lands on the first unfinished maze (maze ' + (g3.T().level + 1) + ')');
  g3.T().menu().activate('play');
  const lm3 = g3.T().menu();
  ok(String(lm3.selection().level) === '3', 'the level screen opens on that maze');
  ok(lm3.select('level', '1') === true && String(lm3.selection().level) === '1', 'a cleared maze can be replayed');
  lm3.select('level', '7');
  ok(String(lm3.selection().level) === '1', 'the maze two tiers ahead is still locked (' + lm3.selection().level + ')');
  lm3.select('level', '3');
  lm3.activate('start');
  ok(g3.T().state === 'playing' && g3.T().level === 3, 'the next maze starts from the level screen');
}

section('mirror-maze: the par the level screen prints is the par the board really has');
{
  // the grid can't afford to generate twelve boards on open (~280ms), so par is tabled in CAMPAIGN —
  // this is what stops the table drifting away from the generator
  const gs = runGame();
  for (let i = 0; i < 12; i++) {
    const spec = [[10101, 1, 5], [10207, 1, 5], [10313, 1, 6], [20419, 2, 7], [20523, 2, 7], [20629, 2, 7],
      [30731, 3, 8], [30837, 3, 8], [30941, 3, 8], [41043, 4, 9], [41147, 4, 9], [41269, 4, 9]][i];
    const real = gs.T().genBoard(spec[0], spec[1], spec[2]).par;
    ok(real === gs.T().campaignPar(i), 'maze ' + (i + 1) + ': tabled par ' + gs.T().campaignPar(i) + ' matches the generated board (' + real + ')');
  }
}

section('mirror-maze: par and the moves-to-par end line');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('campaign', 6);
  const par = T().par;
  ok(par > 0, 'the maze exposes a par (' + par + ')');
  ok(par > T().depth, 'par leaves some slack over the minimum (' + par + ' vs ' + T().depth + ')');
  T().solve(); T().step(90);
  const m = T().menu();
  ok(m != null, 'end screen shown');
}

// runScore is CUMULATIVE and every solved board saves it, so comparing against the LIVE store
// compared the run against itself. failRun (out of power) pays nothing, so runScore was unchanged
// and `runScore > bestOf()` could never be true — endless mode's only natural ending, which meant
// endless never reported a best at all.
section('mirror-maze: endless failRun reports a best against the run-START record');
{
  const g = bootGame(FILE, { seed: 11, store: { gamekit_pb: JSON.stringify({ 'mirror-maze': { Endless: { score: 5, time: 0, plays: 1, stats: {} } } }) } });
  const T = g.T;
  T().startMode('endless');
  T().solve();                                        // board 1 banks its award into runScore
  T().step(90);
  const afterBoard = T().menu();
  ok(afterBoard != null, 'the solved board opened its end screen');
  afterBoard.activate('next');
  const scored = T().score;
  ok(scored > 5, 'one solved board already beat the stored 5 (runScore=' + scored + ')');
  // toggle ONE mirror back and forth: each spin costs power but the board never accidentally solves
  let seat = null, n = T().size || 0;
  for (let y = 0; y < n && !seat; y++) for (let x = 0; x < n && !seat; x++) {
    const c = T().cell(x, y); if (c && c.t === 'mirror') seat = { x, y };
  }
  ok(!!seat, 'found a mirror to burn power on');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 400) T().rotate(seat.x, seat.y);
  ok(T().state === 'over', 'the spin pool ran dry and ended the run (spins=' + guard + ')');
  T().step(60);
  ok(T().menu() && T().menu().cfg.newBest === true,
    'a run that out-scored its starting record reports a best even though the fatal maze paid nothing');
}

summary();
