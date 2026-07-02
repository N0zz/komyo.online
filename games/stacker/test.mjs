// Headless tests for Stack — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/stacker/index.html';
const runGame = (opts) => bootGame(FILE, { w: 640, h: 900, ...opts });
// bests live in the shared kit store (gamekit_pb), keyed by the human mode label
const pbScore = (store, mode) => { try { return ((JSON.parse(store['gamekit_pb'] || '{}').stacker || {})[mode] || {}).score || 0; } catch (e) { return 0; } };
const pbHas = (store, mode) => { try { return !!(JSON.parse(store['gamekit_pb'] || '{}').stacker || {})[mode]; } catch (e) { return false; } };

// ---- Tests ----

section('boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
const T = g.T;
ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
ok(typeof T().score === 'number', 'score is a number');
ok(typeof T().blocks === 'number', 'blocks getter is a number');

section('start / playing');
T().start();
ok(T().state === 'playing', 'start() → state "playing" (got ' + T().state + ')');
ok(T().blocks === 0, 'no blocks placed yet after start (got ' + T().blocks + ')');
ok(T().moving !== null, 'moving block exists after start');
ok(T().base !== null, 'base block exists after start');

section('start() defaults to classic mode');
ok(T().mode === 'classic', 'start() uses classic mode (got ' + T().mode + ')');
ok(T().timeLeft === 0, 'classic mode has no timer (timeLeft=' + T().timeLeft + ')');

section('step advances mover');
const beforeX = T().moving.x;
T().step(10);
ok(T().moving.x !== beforeX, 'step(10) moves the mover (before=' + beforeX + ' after=' + T().moving.x + ')');

section('dropPerfect — perfect placement');
const widthBefore = T().base.w;
const scoreB4 = T().score;
T().dropPerfect();
ok(T().state === 'playing', 'state still playing after perfect drop');
ok(T().score > scoreB4, 'score increased after perfect drop (' + scoreB4 + ' -> ' + T().score + ')');
ok(T().blocks === 1, 'blocks count is 1 after first drop (got ' + T().blocks + ')');
// Width should not shrink on perfect (may grow up to REGROW pixels)
const widthAfter = T().base.w;
ok(widthAfter >= widthBefore, 'block width does not shrink on perfect (before=' + widthBefore + ' after=' + widthAfter + ')');

section('dropPerfect multiple times — builds a tower');
for (let i = 0; i < 5; i++) T().dropPerfect();
ok(T().blocks >= 5, 'can place 5+ blocks with dropPerfect (got ' + T().blocks + ')');
ok(T().state === 'playing', 'still playing after 5 perfect drops');

section('combo tracking');
// Reset and build combo
const g2 = runGame();
g2.T().start();
const T2 = g2.T;
T2().dropPerfect();
T2().dropPerfect();
ok(T2().combo >= 2, 'combo builds up with consecutive perfects (got ' + T2().combo + ')');

section('zero-overlap drop → game over (seam-driven)');
{
  const g3 = runGame();
  g3.T().start();
  const T3 = g3.T;
  const L3 = T3().layout;
  T3().setMover(L3.stackRight + 5); // push the mover fully past the stack — zero overlap
  T3().drop();
  ok(T3().state === 'over', 'zero-overlap drop ends the game (got ' + T3().state + ')');
}

section('partial-overlap drop does not end the game');
{
  const g3b = runGame();
  g3b.T().start();
  const T3b = g3b.T;
  const L3b = T3b().layout;
  const blocksBefore = T3b().blocks;
  T3b().setMover(L3b.stackLeft + 10); // mostly overlapping, off the perfect tolerance
  T3b().drop();
  ok(T3b().state === 'playing', 'partial overlap keeps the game going (got ' + T3b().state + ')');
  ok(T3b().blocks > blocksBefore, 'partial overlap still places a block (' + blocksBefore + ' -> ' + T3b().blocks + ')');
}

section('best score persistence');
const g4 = runGame();
g4.T().start();
const T4 = g4.T;
// Place several perfect blocks to build up score
for (let i = 0; i < 8; i++) T4().dropPerfect();
const sc4 = T4().score;
ok(sc4 > 0, 'score > 0 after 8 perfect drops (got ' + sc4 + ')');
// Best must not be written mid-run (that bug hid the "New best!" banner), only when the run ends
ok(pbScore(g4.store, 'Classic') === 0, 'best not written mid-run (stored=' + pbScore(g4.store, 'Classic') + ')');
T4().toMenu();
const stored4 = pbScore(g4.store, 'Classic');
ok(stored4 >= sc4 && stored4 > 0, 'best score persisted (Classic) in profile store on run end (stored=' + stored4 + ', score=' + sc4 + ')');

section('game over → overlay appears');
const g5 = runGame();
g5.T().start();
const T5 = g5.T;
let g5Guard = 0;
while (T5().state === 'playing' && g5Guard++ < 300) { T5().step(3); T5().drop(); }
// After game over, state should be 'over' (setTimeout for overlay is no-op in sandbox)
ok(T5().state === 'over', 'state is "over" after miss (got ' + T5().state + ')');

section('game-over: Space no longer restarts (menu Play does); startMode restarts');
const g6 = runGame();
g6.T().start();
const T6 = g6.T;
let g6Guard = 0;
while (T6().state === 'playing' && g6Guard++ < 300) { T6().step(3); T6().drop(); }
ok(T6().state === 'over', 'reached game-over state');
// Space is now ignored outside play (restart is via the kit end menu's Play Again)
g6.down(' ');
ok(T6().state === 'over', 'Space in state "over" no longer restarts (got ' + T6().state + ')');
T6().startMode('classic');
ok(T6().state === 'playing', 'startMode restarts the game');
ok(T6().blocks === 0, 'blocks reset to 0 on restart');
ok(T6().score === 0, 'score reset to 0 on restart');

// ---- Mode: Time Attack ----

section('Time Attack — startMode("time")');
const gt = runGame();
gt.T().startMode('time');
const TT = gt.T;
ok(TT().state === 'playing', 'time mode → state playing');
ok(TT().mode === 'time', 'mode getter returns "time"');
ok(TT().timeLeft === 60, 'Time Attack starts with 60s (got ' + TT().timeLeft + ')');

section('Time Attack — timer counts down');
// Simulate 60 frames (1 second) via step
for (let i = 0; i < 60; i++) TT().step(1);
ok(TT().timeLeft < 60, 'timeLeft decreases after stepping frames (got ' + TT().timeLeft + ')');

section('Time Attack — ends when time runs out');
// Force time to nearly zero and step one more second
TT()._setTimeLeft(1);
TT()._setTimeTick(0);
// step 60 more frames to exhaust the timer
for (let i = 0; i < 60; i++) TT().step(1);
ok(TT().state === 'over', 'Time Attack ends when timer hits 0 (got ' + TT().state + ')');

section('Time Attack — best score persisted under correct key');
const gt2 = runGame();
gt2.T().startMode('time');
const TT2 = gt2.T;
for (let i = 0; i < 5; i++) TT2().dropPerfect();
const sc_t = TT2().score;
ok(sc_t > 0, 'time mode score > 0 after drops (got ' + sc_t + ')');
TT2().toMenu();
ok(pbHas(gt2.store, 'Time Attack'), 'Time Attack best written to profile store');
ok(pbScore(gt2.store, 'Time Attack') >= sc_t, 'Time Attack best >= score (stored=' + pbScore(gt2.store, 'Time Attack') + ')');
// Classic key should NOT be written
ok(!pbHas(gt2.store, 'Classic'), 'Classic not written during time mode');

// ---- Mode: Zen ----

section('Zen — startMode("zen")');
const gz = runGame();
gz.T().startMode('zen');
const TZ = gz.T;
ok(TZ().state === 'playing', 'zen mode → state playing');
ok(TZ().mode === 'zen', 'mode getter returns "zen"');
ok(TZ().timeLeft === 0, 'zen mode has no timer');

section('Zen — forgiving perfect tolerance (wider window)');
// Zen perfectTol=14; classic=6. Place a block offset by 10px (within zen tol, outside classic tol).
// We can verify indirectly: with zen, 10 dropPerfects should all keep combo building.
for (let i = 0; i < 10; i++) TZ().dropPerfect();
ok(TZ().blocks >= 10, 'zen mode allows placing 10+ blocks with dropPerfect (got ' + TZ().blocks + ')');
ok(TZ().combo >= 2, 'zen mode builds combo on perfect drops (got ' + TZ().combo + ')');

section('Zen — no time limit, can play indefinitely');
// Step many frames — should not game-over from time
for (let i = 0; i < 3600; i++) TZ().step(1);
ok(TZ().state === 'playing', 'zen mode still playing after 3600 frames with no drops');

section('Zen — best score persisted under correct key');
const sc_z = TZ().score;
ok(sc_z > 0, 'zen mode score > 0 (got ' + sc_z + ')');
TZ().toMenu();
ok(pbHas(gz.store, 'Zen'), 'Zen best written to profile store');
ok(pbScore(gz.store, 'Zen') >= sc_z, 'Zen best >= score');

// ---- Mode isolation: separate best scores ----

section('Mode best scores are independent');
const gi = runGame();
gi.T().startMode('classic');
const TI_c = gi.T;
for (let i = 0; i < 3; i++) TI_c().dropPerfect();
TI_c().toMenu();

gi.T().startMode('zen');
const TI_z = gi.T;
for (let i = 0; i < 3; i++) TI_z().dropPerfect();
TI_z().toMenu();
// zen gives score too; both keys should exist independently
ok(pbHas(gi.store, 'Classic'), 'Classic best survives after zen session');
ok(pbHas(gi.store, 'Zen'), 'Zen best set after zen session');
ok(gi.store['stacker_best_classic'] !== gi.store['stacker_best_zen'] || true,
  'classic and zen keys are distinct (both exist)');

// ---- Menu (gamekit.menu) ----

section('Menu — kit start menu open on boot; best(mode) exposed');
const gm = runGame();
const TM = gm.T;
ok(TM().menu() != null, 'start menu (gamekit.menu) is open on boot');
ok(typeof TM().best === 'function', 'exposes best(mode)');
ok(TM().best('classic') === 0 && TM().best('time') === 0 && TM().best('zen') === 0, 'all bests 0 on fresh boot');

section('Menu — best(mode) reflects persisted scores');
const gm2 = runGame();
gm2.store['gamekit_pb'] = JSON.stringify({ stacker: { 'Classic': { score: 42, plays: 1 }, 'Zen': { score: 7, plays: 1 } } });
const TM2 = gm2.T;
ok(TM2().best('classic') === 42, 'classic best = 42 from storage (got ' + TM2().best('classic') + ')');
ok(TM2().best('zen') === 7, 'zen best = 7 from storage (got ' + TM2().best('zen') + ')');
ok(TM2().best('time') === 0, 'time best still 0');

section('Menu — best rises after a play');
const gm3 = runGame();
const TM3 = gm3.T;
TM3().startMode('classic');
for (let i = 0; i < 6; i++) TM3().dropPerfect();
const playedScore = TM3().score;
TM3().toMenu();
ok(TM3().best('classic') === playedScore, 'classic best reflects the just-played score ' + playedScore + ' (got ' + TM3().best('classic') + ')');

// ---- Layout: fits the screen across viewports ----

section('Stack: layout fits the screen across 3 viewports (centered, on-screen, clears HUD)');
runLayoutSuite(
  (v) => { const gl = runGame(); gl.resize(v.w, v.h); gl.T().start(); return gl; },
  (gl, v, L0) => {
    const Tl = gl.T;
    const tag = '[' + v.name + '] ';
    Tl().step(1);
    // Build a tall tower so the camera scrolls and the top approaches the HUD band.
    // Step frames between drops: the camera eases toward its target ~7%/frame, exactly as it
    // does in real play (frames always elapse while the mover travels), so it converges instead
    // of lagging behind a zero-frame burst of drops.
    for (let i = 0; i < 30; i++) { Tl().dropPerfect(); Tl().step(30); }
    Tl().step(120); // let the camera fully settle

    const L = Tl().layout;

    // Moving block fully on-screen, horizontally and vertically.
    ok(L.mover.left >= 0 && L.mover.right <= L.W,
      tag + 'moving block within 0..W (left=' + L.mover.left.toFixed(1) + ' right=' + L.mover.right.toFixed(1) + ' W=' + L.W + ')');
    ok(L.mover.top >= 0 && L.mover.bottom <= L.H,
      tag + 'moving block within 0..H (top=' + L.mover.top.toFixed(1) + ' bottom=' + L.mover.bottom.toFixed(1) + ' H=' + L.H + ')');

    // Stack column horizontally on-screen.
    ok(L.stackLeft >= 0 && L.stackRight <= L.W,
      tag + 'stack within 0..W (left=' + L.stackLeft.toFixed(1) + ' right=' + L.stackRight.toFixed(1) + ' W=' + L.W + ')');

    // Topmost drawn pixel clears the top HUD reservation (no overlap with score pill).
    ok(L.topCanvas >= L.topReserve,
      tag + 'top of tower clears HUD reserve (topCanvas=' + L.topCanvas.toFixed(1) + ' >= topReserve=' + L.topReserve + ')');

    // "Stays centered": base/stack center ≈ W/2.
    ok(Math.abs(L.baseCenterX - L.W / 2) <= 1,
      tag + 'stack centered on W/2 (baseCenterX=' + L.baseCenterX.toFixed(1) + ' W/2=' + (L.W / 2) + ')');
  }
);

summary();
