// Headless tests for 2048 — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/2048/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 11, ...opts });

// ---- Boot ----
section('2048: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');

// ---- Start ----
section('2048: start');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  ok(T().state === 'playing', 'start() → playing');
  ok(T().n === 4, 'classic board is 4×4');
  const tiles = T().grid.flat().filter(Boolean);
  ok(tiles.length === 2, 'starts with 2 tiles (got ' + tiles.length + ')');
  ok(tiles.every(v => v === 2 || v === 4), 'starting tiles are 2s or 4s');
  T().startMode('mini');
  ok(T().n === 3, 'mini board is 3×3');
  T().startMode('big');
  ok(T().n === 5, 'big board is 5×5');
}

// ---- Slide & merge mechanics (deterministic via setGrid) ----
section('2048: slide + merge');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setGrid([
    [2, 2, 0, 0],
    [4, 0, 4, 0],
    [2, 4, 2, 4],
    [0, 0, 0, 8],
  ]);
  const moved = T().move('left');
  ok(moved === true, 'a changing move returns true');
  const gr = T().grid;
  ok(gr[0][0] === 4, 'row0: 2+2 merge into 4 (got ' + gr[0][0] + ')');
  ok(gr[1][0] === 8, 'row1: 4+4 merge across a gap (got ' + gr[1][0] + ')');
  ok(gr[2][0] === 2 && gr[2][1] === 4 && gr[2][2] === 2 && gr[2][3] === 4, 'row2: alternating tiles never merge');
  ok(gr[3][0] === 8, 'row3: lone tile slides to the wall');
  ok(T().score === 12, 'score adds merged values (4+8 = 12, got ' + T().score + ')');
  const count = gr.flat().filter(Boolean).length;
  ok(count === 8, 'a new tile spawns after a successful move (got ' + count + ' tiles)');
}

// ---- Merge-once rule ----
section('2048: a merged tile cannot merge twice in one move');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setGrid([
    [4, 2, 2, 0],
    [2, 2, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  T().move('left');
  const gr = T().grid;
  ok(gr[0][0] === 4 && gr[0][1] === 4, 'row0: 4,2,2 → 4,4 — the fresh 4 does not chain into 8');
  ok(gr[1][0] === 4 && gr[1][1] === 4, 'row1: 2,2,2,2 → 4,4 (pairwise, not 8)');
}

// ---- Invalid move ----
section('2048: an unchanging move is rejected');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setGrid([
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const before = T().grid.flat().filter(Boolean).length;
  const moved = T().move('left');
  ok(moved === false, 'a move that changes nothing returns false');
  ok(T().grid.flat().filter(Boolean).length === before, 'no tile spawns after a rejected move');
}

// ---- Directions ----
section('2048: all four directions');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setGrid([
    [2, 0, 0, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [2, 0, 0, 2],
  ]);
  T().move('down');
  const gr = T().grid;
  ok(gr[3][0] === 4 && gr[3][3] === 4, 'down merges the columns (got ' + gr[3][0] + ',' + gr[3][3] + ')');
  T().setGrid([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [4, 0, 0, 4],
  ]);
  T().move('right');
  ok(T().grid[3][3] === 8, 'right merges toward the right wall');
}

// ---- Game over ----
section('2048: game over when no moves remain');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 8],
  ]);
  ok(T().movesAvailable() === false, 'checker sees the dead board');
  const moved = T().move('left');
  ok(moved === false, 'no direction changes a dead alternating board');
  // one loose pair; after merging, the spawn cell's neighbours (8, 64) can't match a fresh 2/4,
  // so the board is dead no matter what spawns
  T().setGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 64],
    [16, 16, 64, 8],
  ]);
  T().move('left');
  ok(T().state === 'over', 'board locks after the final merge → over (got ' + T().state + ')');
}

// ---- Reaching 2048 wins (and can continue) ----
section('2048: reaching the 2048 tile');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().setGrid([
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  T().move('left');
  ok(T().maxTile === 2048, 'merging two 1024s makes 2048');
  ok(T().reached2048 === true, '2048 flag set');
  ok(T().state === 'over', 'win pauses into the end menu');
  const menu = T().menu();
  ok(menu != null, 'end menu is shown');
}

// ---- Layout ----
section('2048: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().startMode('big'); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    const b = L.board;
    ok(b.y >= L.topReserve, v.name + ': board clears the HUD (top ' + Math.round(b.y) + ' >= ' + L.topReserve + ')');
    ok(b.x >= 0 && b.x + b.w <= L.W, v.name + ': board within width');
    ok(b.y + b.h <= L.H, v.name + ': board within height');
    ok(b.cell >= 40, v.name + ': cells stay readable (cell ' + b.cell + 'px)');
  }
);

summary();
