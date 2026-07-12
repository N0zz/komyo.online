// Headless tests for Sudoku — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/sudoku/index.html';
const runGame = (opts) => bootGame(FILE, opts);

// ---- Boot ----
section('sudoku: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');

// ---- Generator: determinism, uniqueness, technique grading ----
section('sudoku: generator');
{
  const T = runGame().T;
  const a = T().gen(42, 3), b = T().gen(42, 3);
  ok(a.puzzle.every((v, i) => v === b.puzzle[i]), 'same seed → identical puzzle (deterministic)');
  const c = T().gen(43, 3);
  ok(!a.puzzle.every((v, i) => v === c.puzzle[i]), 'different seed → different puzzle');
  for (const band of [1, 2, 3, 4]) {
    const r = T().gen(1000 + band, band);
    ok(T().countSolutions(r.puzzle, 2) === 1, 'band ' + band + ': unique solution');
    const grade = T().grade(r.puzzle);
    ok(grade.solved && grade.level === band, 'band ' + band + ': graded level ' + grade.level + ' (want ' + band + ')');
    // the puzzle's givens all match its solution
    ok(r.puzzle.every((v, i) => v === 0 || v === r.solution[i]), 'band ' + band + ': givens agree with the solution');
  }
}

// ---- Placement, strikes, notes, undo ----
section('sudoku: placement + strikes');
{
  const gp = runGame();
  const T = gp.T;
  T().newGame({ mode: 'classic', band: 1, seed: 7 });
  ok(T().state === 'playing', 'newGame starts playing');
  const grid = T().grid, sol = T().solution, givens = T().givens;
  const empty = grid.findIndex((v, i) => v === 0 && !givens[i]);
  ok(empty >= 0, 'has an empty cell');
  // correct placement
  T().select(empty); T().input(sol[empty]);
  ok(T().grid[empty] === sol[empty], 'correct digit is placed');
  ok(T().mistakes === 0, 'correct digit costs no strike');
  // wrong placement — pick a wrong digit for another empty cell
  const empty2 = T().grid.findIndex((v, i) => v === 0 && !givens[i]);
  const wrongD = 1 + (sol[empty2] % 9);
  T().select(empty2); T().input(wrongD);
  ok(T().mistakes === 1, 'wrong digit = 1 strike (got ' + T().mistakes + ')');
  ok(T().grid[empty2] === wrongD, 'wrong digit stays visible (red)');
  // erase it
  T().erase();
  ok(T().grid[empty2] === 0, 'erase clears the wrong entry');
  // undo the erase → wrong digit back
  T().undo();
  ok(T().grid[empty2] === wrongD, 'undo restores the erased entry');
  T().erase();
  // three strikes end the run
  T().select(empty2); T().input(wrongD === sol[empty2] ? (1 + (wrongD % 9)) : wrongD);
  T().erase();
  const empty3 = T().grid.findIndex((v, i) => v === 0 && !givens[i]);
  T().select(empty3); T().input(1 + (sol[empty3] % 9));
  ok(T().state === 'over', 'third strike ends the run (state ' + T().state + ', mistakes ' + T().mistakes + ')');
  // a lost run must never fabricate a best score or best time
  const pbL = JSON.parse(gp.store['gamekit_pb'] || '{}');
  const easy = pbL.sudoku && pbL.sudoku.Easy;
  ok(!easy || (!(easy.score > 0) && !(easy.time > 0)), 'loss stores no best score/time (got ' + JSON.stringify(easy) + ')');
}

section('sudoku: correct entries lock in');
{
  const T = runGame().T;
  T().newGame({ mode: 'classic', band: 1, seed: 47 });
  const givens = T().givens, sol = T().solution;
  const i = T().grid.findIndex((v, k) => v === 0 && !givens[k]);
  T().select(i); T().input(sol[i]);
  ok(T().grid[i] === sol[i], 'correct digit placed');
  T().input(sol[i]);
  ok(T().grid[i] === sol[i], 'retapping the same digit does NOT clear a correct entry');
  T().input(1 + (sol[i] % 9));
  ok(T().grid[i] === sol[i], 'a different digit does NOT overwrite a correct entry');
  ok(T().mistakes === 0, '…and costs no strike');
  T().erase();
  ok(T().grid[i] === sol[i], 'erase does NOT remove a correct entry');
  T().undo();
  ok(T().grid[i] === 0, 'undo (deliberate) still reverts the placement');
}

section('sudoku: pencil marks');
{
  const T = runGame().T;
  T().newGame({ mode: 'classic', band: 1, seed: 11 });
  const givens = T().givens;
  const i = T().grid.findIndex((v, k) => v === 0 && !givens[k]);
  T().select(i); T().setPencil(true);
  T().input(3); T().input(5);
  ok(T().notes[i] === ((1 << 2) | (1 << 4)), 'pencil marks toggle bits (got ' + T().notes[i] + ')');
  T().input(3);
  ok(T().notes[i] === (1 << 4), 'same digit toggles a mark off');
  ok(T().mistakes === 0, 'pencil marks never cost strikes');
  T().setPencil(false);
  const sol = T().solution;
  T().input(sol[i]);
  ok(T().grid[i] === sol[i] && T().notes[i] === 0, 'placing a digit clears the cell notes');
}

// ---- Zen: no strikes ----
section('sudoku: zen');
{
  const T = runGame().T;
  T().newGame({ mode: 'zen', band: 1, seed: 13 });
  const givens = T().givens, sol = T().solution;
  const i = T().grid.findIndex((v, k) => v === 0 && !givens[k]);
  T().select(i); T().input(1 + (sol[i] % 9));
  ok(T().mistakes === 0, 'zen: wrong digit costs no strike');
  ok(T().state === 'playing', 'zen: run continues');
}

// ---- Logical hints ----
section('sudoku: logical hints');
{
  const T = runGame().T;
  T().newGame({ mode: 'classic', band: 1, seed: 17 });
  T().hint();
  const h = T().hintInfo;
  ok(h != null && h.type === 'place', 'hint finds a logical placement');
  ok(typeof h.text === 'string' && h.text.length > 0, 'hint carries an explanation');
  const cell = h.cell, digit = h.digit;
  ok(T().solution[cell] === digit, 'hint placement matches the solution');
  T().hint();   // second tap applies
  ok(T().grid[cell] === digit, 'second hint() applies the placement');
  ok(T().hintsUsed === 1, 'hint counted (got ' + T().hintsUsed + ')');
  ok(T().mistakes === 0, 'hint costs no strike');
  // wrong entry → hint points at it
  const givens = T().givens, sol = T().solution;
  const j = T().grid.findIndex((v, k) => v === 0 && !givens[k]);
  T().select(j); T().input(1 + (sol[j] % 9));
  T().hint();
  const hw = T().hintInfo;
  ok(hw != null && hw.type === 'wrong' && hw.cell === j, 'hint flags the wrong entry first');
  T().hint();   // apply = erase the wrong entry
  ok(T().grid[j] === 0, 'applying the wrong-entry hint erases it');
  ok(T().hintsUsed === 1, 'wrong-entry fix is free (hints still 1)');
}

// ---- Hints solve the whole board (the engine never dead-ends on our puzzles) ----
section('sudoku: hint engine completes every band');
{
  const T = runGame().T;
  for (const band of [1, 2, 3, 4]) {
    T().newGame({ mode: 'zen', band, seed: 100 + band });
    let guard = 81;
    while (T().state === 'playing' && guard-- > 0) {
      T().hint(); T().hint();
    }
    ok(T().state === 'over', 'band ' + band + ': hint-driven solve completes the board');
    const revealed = T().hintInfo;
    ok(revealed === null, 'band ' + band + ': no hint left pending after the win');
  }
}

// ---- Win path + scoring + record ----
section('sudoku: win + score + record');
{
  const gw = runGame();
  const T = gw.T;
  T().newGame({ mode: 'classic', band: 1, seed: 19 });
  T().step(120);                          // 2 s on the clock → the stored time must be 2000 ms
  const sol = T().solution, givens = T().givens;
  for (let i = 0; i < 81; i++) {
    if (givens[i]) continue;
    T().select(i); T().input(sol[i]);
  }
  ok(T().state === 'over', 'filling the solution ends the run');
  ok(T().menu() != null, 'end menu is shown');
  ok(T().score >= 100, 'score is at least the floor (got ' + T().score + ')');
  // best store received the result via the end menu's record:
  const pb = JSON.parse(gw.store['gamekit_pb'] || '{}');
  ok(pb && pb.sudoku && pb.sudoku.Easy && pb.sudoku.Easy.score > 0, 'best stored under sudoku/Easy');
  ok(pb.sudoku.Easy.time === 2000, 'win time stored in ms (got ' + pb.sudoku.Easy.time + ', expected 2000)');
}

// ---- Zen: unscored, but still counts as a play ----
section('sudoku: zen records a play, never a score');
{
  const gz = runGame();
  const T = gz.T;
  T().newGame({ mode: 'zen', band: 1, seed: 19 });
  const sol = T().solution, givens = T().givens;
  for (let i = 0; i < 81; i++) {
    if (givens[i]) continue;
    T().select(i); T().input(sol[i]);
  }
  ok(T().state === 'over', 'zen solve ends the run');
  const pb = JSON.parse(gz.store['gamekit_pb'] || '{}');
  ok(!pb.sudoku || !Object.values(pb.sudoku).some(m => m.score > 0), 'zen never records a score best');
  const played = Object.keys(gz.store).some(k => k.startsWith('gamekit_played_') && gz.store[k].includes('sudoku'));
  ok(played, 'zen solve still counts in the daily activity log (cross-game challenges)');
}

// ---- Daily is deterministic for the day ----
section('sudoku: daily');
{
  const T1 = runGame().T, T2 = runGame().T;
  T1().newGame({ mode: 'daily' });
  T2().newGame({ mode: 'daily' });
  ok(T1().grid.every((v, i) => v === T2().grid[i]), 'two daily boots share the same puzzle');
  ok(T1().band >= 1 && T1().band <= 4, 'daily band in range (got ' + T1().band + ')');
}

// ---- Unfinished-board history: ONE list, newest-played first; Continue = entry 0 ----
section('sudoku: board history');
{
  const gh = runGame();
  const T = gh.T;
  T().newGame({ mode: 'classic', band: 1, seed: 31 });
  const sol1 = T().solution, givens1 = T().givens;
  const i1 = T().grid.findIndex((v, k) => v === 0 && !givens1[k]);
  T().select(i1); T().input(sol1[i1]);       // make progress → the board enters the list
  ok(T().history().length === 1, 'a touched board appears in the list (got ' + T().history().length + ')');
  ok(T().currentSave() != null, 'Continue points at the top entry');
  const savedGrid = T().grid.slice();
  // an untouched new game adds NO entry — board A stays alone in the list
  T().newGame({ mode: 'classic', band: 1, seed: 32 });
  ok(T().history().length === 1, 'an untouched new board adds no entry (got ' + T().history().length + ')');
  // progress on board B → two entries, B on top (newest played)
  const gv2 = T().givens, sol2 = T().solution;
  const j2 = T().grid.findIndex((v, k) => v === 0 && !gv2[k]);
  T().select(j2); T().input(sol2[j2]);
  ok(T().history().length === 2, 'both unfinished boards are listed (got ' + T().history().length + ')');
  // resume board A (index 1) — it STAYS in the list and bubbles to the top
  ok(T().resumeHistory(1) === true, 'resumeHistory(1) succeeds');
  ok(T().grid.every((v, k) => v === savedGrid[k]), 'resumed grid matches the saved board');
  ok(T().state === 'playing', 'resumed board is playing');
  ok(T().history().length === 2, 'resuming never removes a board from the list (got ' + T().history().length + ')');
  ok(T().history()[0].grid === savedGrid.join(''), 'resumed board bubbled to the top');
  // finishing a board removes ITS entry only
  const sol = T().solution, gv = T().givens;
  for (let i = 0; i < 81; i++) { if (gv[i] || T().grid[i] === sol[i]) continue; T().select(i); T().input(sol[i]); }
  ok(T().state === 'over', 'resumed board can be finished');
  ok(T().history().length === 1, 'finished board leaves the list; the other stays (got ' + T().history().length + ')');
}
{
  // cap: history never exceeds 20
  const gc = runGame();
  const T = gc.T;
  const fake = [];
  for (let k = 0; k < 25; k++) fake.push({ v: 1, ts: k, mode: 'classic', band: 1, givens: '1' + '0'.repeat(80), grid: '12' + '0'.repeat(79), solution: '1'.repeat(81), notes: [], mistakes: 0, hints: 0, ticks: 60 });
  gc.store['sudoku_history'] = JSON.stringify(fake.slice(0, 19));
  T().newGame({ mode: 'classic', band: 1, seed: 41 });
  const givens2 = T().givens, sol2 = T().solution;
  const j = T().grid.findIndex((v, k) => v === 0 && !givens2[k]);
  T().select(j); T().input(sol2[j]); T().saveNow();
  T().newGame({ mode: 'classic', band: 1, seed: 42 });
  ok(T().history().length === 20, 'history caps at 20 (got ' + T().history().length + ')');
}

// ---- Timer ticks + pause-by-menu ----
section('sudoku: timer');
{
  const T = runGame().T;
  T().newGame({ mode: 'classic', band: 1, seed: 23 });
  const s0 = T().score;
  T().step(600);   // 10 s
  ok(T().score < s0, 'score decays with time (' + s0 + ' → ' + T().score + ')');
}

// ---- Layout: board between HUD and pad, square cells, all viewports ----
section('sudoku: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().newGame({ mode: 'classic', band: 1, seed: 3 }); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    ok(L.board.y >= L.topReserve, v.name + ': board clears the HUD (' + Math.round(L.board.y) + ' >= ' + L.topReserve + ')');
    ok(L.board.x >= 0 && L.board.x + L.board.size <= L.W + 0.5, v.name + ': board within width');
    ok(L.board.y + L.board.size <= L.padTop, v.name + ': board clears a bottom pad (' + Math.round(L.board.y + L.board.size) + ' <= ' + Math.round(L.padTop) + ')');
    ok(L.board.x + L.board.size <= L.padLeft, v.name + ': board clears a side pad (' + Math.round(L.board.x + L.board.size) + ' <= ' + Math.round(L.padLeft) + ')');
    ok(L.board.y + L.board.size <= L.H, v.name + ': board within height');
    ok(L.cell * 9 <= L.board.size, v.name + ': 9 cells fit inside the card');
    ok(L.cell >= 20, v.name + ': cells are tappable (' + Math.round(L.cell) + 'px)');
  }
);

summary();
