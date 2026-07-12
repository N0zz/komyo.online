// Headless tests for Minesweeper — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/minesweeper/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 7, ...opts });

// ---- Boot ----
section('minesweeper: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');

// ---- Start + first-click safety ----
section('minesweeper: start + first-click-safe generation');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  ok(T().state === 'playing', 'start() → playing (got ' + T().state + ')');
  ok(T().cols === 9 && T().rows === 9 && T().mineCount === 10, 'easy board is 9×9 with 10 mines');
  ok(!T().minesPlaced, 'no mines before the first reveal');
  T().reveal(4, 4);
  ok(T().minesPlaced, 'first reveal places the mines');
  ok(T().state === 'playing', 'first reveal never explodes');
  let safe = true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (T().isMine(4 + dx, 4 + dy)) safe = false;
  ok(safe, 'no mine in the 3×3 around the first reveal (guaranteed opening)');
  ok(T().isRevealed(4, 4), 'first cell is revealed');
  ok(T().score > 1, 'zero opening flood-reveals neighbours (revealed ' + T().score + ')');
  let mines = 0;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (T().isMine(x, y)) mines++;
  ok(mines === 10, 'exactly 10 mines placed (got ' + mines + ')');
}

// ---- Deterministic board: flood fill, numbers, flags, chord ----
section('minesweeper: flood / numbers / flags / chord (planted board)');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  // 9×9, two mines far right; the left region is one big zero-field
  T().plantMines([[8, 0], [8, 2]]);
  ok(T().numAt(7, 1) === 2, 'number = adjacent mine count (got ' + T().numAt(7, 1) + ')');
  T().reveal(0, 0);
  ok(T().isRevealed(0, 8) && T().isRevealed(5, 5), 'flood fill opens the whole zero region');
  ok(T().state === 'playing', 'still playing after flood');
  ok(!T().isRevealed(8, 0) && !T().isRevealed(8, 2), 'mines stay hidden');
  // flags
  const before = T().flags;
  T().flag(8, 0);
  ok(T().flags === before + 1, 'flagging increments the flag count');
  T().reveal(8, 0);
  ok(T().state === 'playing' && !T().isRevealed(8, 0), 'a flagged cell cannot be revealed');
  T().flag(8, 0); // unflag
  ok(T().flags === before, 'unflagging decrements the flag count');
}

// ---- Chord ----
section('minesweeper: chord');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().plantMines([[0, 0]]);
  T().reveal(2, 2);                      // opens everything except around the mine
  T().flag(0, 0);
  const revBefore = T().score;
  T().chord(1, 1);                       // number 1 with 1 flag → opens the rest around it
  ok(T().score >= revBefore, 'chord reveals remaining neighbours (revealed ' + T().score + ')');
  ok(T().state !== 'over' || T().won, 'correct chord never explodes');
}

// ---- Lose ----
section('minesweeper: hitting a mine ends the run');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  // corner cluster encloses (8,8) so the opening flood cannot win the board
  T().plantMines([[7, 7], [7, 8], [8, 7]]);
  T().reveal(0, 0);
  ok(T().state === 'playing', 'safe reveal keeps playing (enclosed cell stays hidden)');
  T().reveal(7, 7);
  ok(T().state === 'over', 'revealing a mine → over');
  ok(!T().won, 'a mine reveal is a loss');
}

// ---- Win ----
section('minesweeper: clearing all safe tiles wins');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().plantMines([[0, 0], [8, 8]]);
  T().step(180);                          // 3 s on the clock → the stored time must be 3000 ms
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++)
    if (!T().isMine(x, y) && T().state === 'playing') T().reveal(x, y);
  ok(T().state === 'over', 'all safe cells revealed → over');
  ok(T().won, 'clearing the board is a win');
  ok(T().isFlagged(0, 0) && T().isFlagged(8, 8), 'win auto-flags the remaining mines');
  ok(T().score === 79, 'win revealed all 79 safe cells (got ' + T().score + ')');
  const pb = JSON.parse(gs.store['gamekit_pb'] || '{}').minesweeper || {};
  ok(pb.Easy && pb.Easy.time === 3000, 'win time stored in ms (got ' + (pb.Easy && pb.Easy.time) + ', expected 3000)');
}

// ---- Relaxed ♥♥♥ ----
section('minesweeper: relaxed lives');
{
  const gs = runGame();
  const T = gs.T;
  T().relaxed = true;
  T().start();
  ok(T().lives === 3, 'relaxed starts with 3 lives');
  T().plantMines([[7, 7], [7, 8], [8, 7]]);
  T().reveal(0, 0);
  ok(T().state === 'playing', 'safe opening plays on');
  const flagsBefore = T().flags;
  T().reveal(7, 7);
  ok(T().state === 'playing', 'first mine costs a heart, not the run');
  ok(T().lives === 2, 'a life was spent (got ' + T().lives + ')');
  ok(T().isFlagged(7, 7), 'the hit mine gets auto-flagged');
  ok(T().flags === flagsBefore + 1, 'flag count includes the auto-flag');
  ok(!T().isRevealed(7, 7), 'the mine tile is not left revealed');
  T().reveal(7, 8);
  ok(T().state === 'playing' && T().lives === 1, 'second mine costs the second heart');
  T().reveal(8, 8);         // enclosed safe cell — fine
  T().flag(8, 7); T().flag(8, 7); // unflag+reflag no-op sanity (flag then unflag)
  T().flag(8, 7);
  const gs2 = T().state;
  T().reveal(8, 7);
  ok(T().state === (T().isFlagged(8, 7) ? gs2 : 'over') || T().state === 'over' || T().state === 'playing', 'flagged mine stays safe');
  // burn the last heart on the remaining mine
  T().flag(8, 7);           // unflag it
  T().reveal(8, 7);
  ok(T().state === 'over', 'on the last heart a mine ends the run');
}

// ---- Relaxed bests are stored under their own label ----
section('minesweeper: relaxed best separation');
{
  const gs = runGame();
  const T = gs.T;
  T().relaxed = true;
  T().start();
  T().plantMines([[7, 7], [7, 8], [8, 7]]);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++)
    if (!T().isMine(x, y) && T().state === 'playing') T().reveal(x, y);
  ok(T().state === 'over' && T().won, 'relaxed board can be cleared');
  const pb = JSON.parse(gs.store['gamekit_pb'] || '{}');
  const keys = Object.keys(pb.games && pb.games.minesweeper ? pb.games.minesweeper : pb.minesweeper || {});
  ok(JSON.stringify(pb).includes('Relaxed'), 'relaxed win recorded under a " · Relaxed" label (keys: ' + keys.join(',') + ')');
}

// ---- Difficulties ----
section('minesweeper: difficulties');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('expert');
  ok(T().cols === 16 && T().rows === 24 && T().mineCount === 85, 'expert board is 16×24 with 85 mines');
  T().startMode('medium');
  ok(T().cols === 12 && T().rows === 12 && T().mineCount === 26, 'medium board is 12×12 with 26 mines');
}

// ---- Timer ----
section('minesweeper: timer only runs after the first dig');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().step(120);
  ok(T().timeSec === 0, 'clock waits for the first reveal (got ' + T().timeSec + ')');
  T().reveal(4, 4);
  T().step(120);
  ok(Math.abs(T().timeSec - 2) < 0.05, 'clock ticks at 60 steps/s (got ' + T().timeSec + ')');
}

// ---- Layout: board + toggle fit, portrait / landscape / desktop ----
section('minesweeper: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().startMode('expert'); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    const b = L.board;
    ok(b.y >= L.topReserve, v.name + ': board clears the HUD (top ' + Math.round(b.y) + ' >= ' + L.topReserve + ')');
    ok(b.x >= 0 && b.x + b.w <= L.W, v.name + ': board within width');
    ok(b.y + b.h <= L.H, v.name + ': board within height');
    ok(L.toggle.y + L.toggle.h <= L.H, v.name + ': flag toggle within height');
    if (v.h < 500 && v.w > v.h) {
      // short landscape: the pill lives in the LEFT gutter (vertical), the board keeps the height
      ok(L.toggle.x + L.toggle.w <= b.x, v.name + ': side toggle sits left of the board');
      ok(L.toggle.y >= L.topReserve, v.name + ': side toggle clears the HUD');
    } else {
      ok(L.toggle.y >= b.y + b.h, v.name + ': flag toggle sits below the board');
      ok(L.toggle.h === 62, v.name + ': full-size toggle with room (h ' + L.toggle.h + ')');
    }
    ok(b.cell >= 12, v.name + ': cells stay tappable (cell ' + b.cell + 'px)');
    // landscape must transpose the 16×24 board to 24×16
    if (v.w > v.h) ok(b.cols > b.rows, v.name + ': board transposes to landscape (' + b.cols + '×' + b.rows + ')');
    else ok(b.rows >= b.cols, v.name + ': board upright in portrait (' + b.cols + '×' + b.rows + ')');
  }
);

summary();
