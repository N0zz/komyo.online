// Headless tests for Trap the Cat — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/trap-the-cat/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 5, ...opts });

// ---- Boot ----
section('trap-the-cat: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready"');

// ---- Start + prefill ----
section('trap-the-cat: start + prefilled hedges');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('easy');
  ok(T().state === 'playing', 'start → playing');
  ok(T().cat.x === 5 && T().cat.y === 5, 'cat starts at the centre');
  ok(T().wallCount() === 16, 'easy prefills 16 hedges (got ' + T().wallCount() + ')');
  ok(!T().wallAt(5, 5), 'no hedge on the cat');
  for (const [nx, ny] of T().neighbors(5, 5)) ok(!T().wallAt(nx, ny), 'no prefill hedge on ring-1 (' + nx + ',' + ny + ')');
  T().startMode('hard');
  ok(T().wallCount() === 7, 'hard prefills 7 hedges');
}

// ---- Hex neighbours (odd-r offset) ----
section('trap-the-cat: hex neighbourhood');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  const even = T().neighbors(5, 4).map(c => c.join(',')).sort();
  ok(even.join(' ') === ['4,3', '4,4', '4,5', '5,3', '5,5', '6,4'].join(' '), 'even-row neighbours correct (got ' + even.join(' ') + ')');
  const odd = T().neighbors(5, 5).map(c => c.join(',')).sort();
  ok(odd.join(' ') === ['4,5', '5,4', '5,6', '6,4', '6,5', '6,6'].join(' '), 'odd-row neighbours correct (got ' + odd.join(' ') + ')');
  ok(T().neighbors(0, 0).length === 2, 'top-left corner (even row) has 2 in-board neighbours');
  ok(T().neighbors(10, 10).length === 3, 'bottom-right corner has 3 in-board neighbours');
}

// ---- Click plants + cat responds ----
section('trap-the-cat: planting moves the cat');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setWalls([]);          // clean board for determinism
  T().setCat(5, 5);
  const okd = T().click(0, 0);
  ok(okd === true, 'a legal click returns true');
  ok(T().wallAt(0, 0), 'hedge planted where clicked');
  ok(T().clicks === 1, 'click counter increments');
  const c = T().cat;
  ok(!(c.x === 5 && c.y === 5), 'the cat hops after a plant');
  const wasNeighbor = T().neighbors(5, 5).some(([x, y]) => x === c.x && y === c.y);
  ok(wasNeighbor, 'the cat moved exactly one hex (to ' + c.x + ',' + c.y + ')');
  ok(T().click(c.x, c.y) === false, 'cannot plant on the cat');
  ok(T().click(0, 0) === false, 'cannot plant on an existing hedge');
}

// ---- Trapping wins ----
section('trap-the-cat: full enclosure = win');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setCat(5, 5);
  const ring = T().neighbors(5, 5);
  T().setWalls(ring.slice(0, 5));            // 5 of 6 hedges pre-set
  const last = ring[5];
  T().click(last[0], last[1]);               // close the ring
  ok(T().state === 'over', 'closing the ring ends the run');
  ok(T().won === true, 'a fully enclosed cat is a win');
  ok(T().score > 0, 'a win scores points (got ' + T().score + ')');
}

// ---- Escaping loses ----
section('trap-the-cat: reaching the edge = loss');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setWalls([]);
  T().setCat(1, 5);                          // one hop from the left edge
  T().click(9, 9);                           // irrelevant plant far away
  ok(T().state === 'over', 'the cat reaches the edge and the run ends');
  ok(T().escaped === true && T().won === false, 'an edge cat is an escape (loss)');
  ok(T().score === 0, 'an escape scores 0');
}

// ---- Cat prefers the shortest way out ----
section('trap-the-cat: BFS pathing');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setWalls([]);
  T().setCat(2, 5);                          // clearly closest to the LEFT edge
  T().click(10, 0);
  const c = T().cat;
  ok(c.x < 2 || T().state === 'over', 'the cat heads toward the nearest edge (now at ' + c.x + ',' + c.y + ')');
}

// ---- Layout ----
section('trap-the-cat: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().start(); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    const b = L.board;
    ok(b.y >= L.topReserve, v.name + ': board clears the HUD (top ' + Math.round(b.y) + ' >= ' + L.topReserve + ')');
    ok(b.x >= -1 && b.x + b.w <= L.W + 1, v.name + ': board within width');
    ok(b.y + b.h <= L.H + 1, v.name + ': board within height');
    ok(b.r >= 9, v.name + ': hexes stay tappable (r ' + b.r + 'px)');
    ok(L.catPx.x > b.x && L.catPx.x < b.x + b.w, v.name + ': cat inside the board');
  }
);

summary();
