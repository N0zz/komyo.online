// Headless tests for Critter Match — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/critter-match/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 13, ...opts });

// ---- Boot ----
section('critter-match: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready"');

// ---- Start + deck ----
section('critter-match: deck setup');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  ok(T().state === 'playing', 'start → playing');
  ok(T().cardCount === 20, 'medium board deals 20 cards (10 pairs)');
  const counts = {};
  for (let i = 0; i < T().cardCount; i++) counts[T().cardPair(i)] = (counts[T().cardPair(i)] || 0) + 1;
  ok(Object.values(counts).every(c => c === 2), 'every critter appears exactly twice');
  T().startMode('small');
  ok(T().cardCount === 12, 'small board deals 12 cards');
  T().startMode('large');
  ok(T().cardCount === 30, 'large board deals 30 cards');
}

// ---- Matching ----
section('critter-match: matching pairs');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('small');
  T().setDeck([0, 0, 1, 2, 1, 2]);      // known layout
  T().flip(0); T().flip(1);              // pair 0 + pair 0
  ok(T().matched === 1, 'two equal critters match (got ' + T().matched + ')');
  ok(T().isMatched(0) && T().isMatched(1), 'matched cards stay revealed');
  ok(T().flips === 2, 'two flips counted');
  ok(T().flip(0) === false, 'a matched card cannot be flipped again');
}

// ---- Mismatch peeks then hides ----
section('critter-match: mismatch behaviour');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('small');
  T().setDeck([0, 1, 0, 1, 2, 2]);
  T().flip(0); T().flip(1);              // 0 vs 1 — mismatch
  ok(T().peeking === true, 'mismatch stays visible for a peek');
  ok(T().flip(4) === false, 'flipping is locked during the peek');
  T().step(60);
  ok(T().peeking === false, 'peek ends');
  ok(!T().isOpen(0) && !T().isOpen(1), 'mismatched cards flip back down');
  ok(T().matched === 0, 'no match banked');
}

// ---- Winning ----
section('critter-match: clearing the board');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('small');
  T().setDeck([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  for (let k = 0; k < 12; k += 2) { T().flip(k); T().flip(k + 1); }
  ok(T().matched === 6, 'all six pairs found');
  ok(T().state === 'over', 'board cleared → over');
  ok(T().score === 6 * 20, 'perfect play scores full points (got ' + T().score + ')');
}

// ---- Extra flips trim the score, never below the floor ----
section('critter-match: gentle scoring');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('small');
  T().setDeck([0, 1, 2, 0, 1, 2, 3, 4, 5, 3, 4, 5]);
  // stumble around: 8 mismatches (16 flips) — perfect play would be 12 flips total
  for (let k = 0; k < 8; k++) { T().flip(0); T().flip(1); T().step(60); }
  ok(T().flips === 16, 'sixteen flips wasted (got ' + T().flips + ')');
  const mid = T().score;
  ok(mid < 6 * 20, 'flips beyond perfect play reduce the projected score (got ' + mid + ')');
  ok(mid >= 6 * 5, 'score never drops below the kid-kind floor');
}

// ---- Layout ----
section('critter-match: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().startMode('large'); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    const b = L.board;
    ok(b.y >= L.topReserve, v.name + ': cards clear the HUD (top ' + Math.round(b.y) + ' >= ' + L.topReserve + ')');
    ok(b.x >= 0 && b.x + b.w <= L.W, v.name + ': cards within width');
    ok(b.y + b.h <= L.H, v.name + ': cards within height');
    ok(b.cardW >= 30, v.name + ': cards stay tappable (w ' + b.cardW + 'px)');
  }
);

summary();
