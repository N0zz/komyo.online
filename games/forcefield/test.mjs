// Headless tests for Forcefield — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/forcefield/index.html';
const runGame = (opts) => bootGame(FILE, opts);
const DEF_MODE = 'Lives · Medium';   // default mode+difficulty → the storage label

const pbScore = (store, mode) => {
  try { return ((JSON.parse(store['gamekit_pb'] || '{}').forcefield || {})[mode] || {}).score || 0; }
  catch (e) { return 0; }
};

// ---- Boot ----
section('forcefield: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');

// ---- Core state ----
section('forcefield: start()');
{
  const T = runGame().T;
  ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
  T().start();
  ok(T().state === 'playing', 'start() sets state to "playing"');
  ok(T().score === 0, 'score starts at 0');
  ok(T().lives === 3, 'lives start at 3 (got ' + T().lives + ')');
  ok(T().mode === 'lives' && T().difficulty === 'medium', 'defaults to Lives · Medium');
}

// ---- Tap on the mark → instant deflect, scores + ramps difficulty ----
section('forcefield: tap on the mark deflects');
{
  const T = runGame({ seed: 7 }).T;
  T().start();
  T().setZone(0.5, 0.13);
  const speed0 = T().speed, half0 = T().zoneHalf;   // capture after setting the window
  T().setPos(0.5); T().stop();     // dome dead-centre → tap
  ok(T().score > 0, 'a deflect raises the score instantly (got ' + T().score + ')');
  ok(T().lives === 3, 'a deflect costs no shield');
  ok(T().hits === 1, 'a deflect increments the hit counter');
  ok(T().speed > speed0, 'the sweep speeds up after a deflect');
  ok(T().zoneHalf < half0, 'the dome narrows after a deflect');
}

// ---- Tap off the mark → instant breach ----
section('forcefield: tap off the mark breaches');
{
  const T = runGame({ seed: 7 }).T;
  T().start();
  T().setZone(0.5, 0.1);
  T().setPos(0.05); T().stop();    // far outside the mark
  ok(T().lives === 2, 'a breach drops a shield (got ' + T().lives + ')');
  ok(T().score === 0, 'a breach scores nothing');
}

// ---- Never tapping → the station fires at the deadline (block if the dome's on the mark) ----
section('forcefield: the station fires on its own at the deadline');
{
  const T = runGame({ seed: 7 }).T;
  T().start();
  const c = T().lanes[0].charge0;
  T().step(c + 2);                 // never tap; the charge completes on its own
  ok(T().lives < 3 || T().hits > 0, 'not acting still fires a shot — deflect if the dome sweeps through the mark, else breach');
}

// ---- Difficulty scales BOTH speed and zone size ----
section('forcefield: difficulty scales speed + zone');
{
  const e = runGame({ seed: 7 }).T; e().setMode('lives', 'easy'); e().start();
  const h = runGame({ seed: 7 }).T; h().setMode('lives', 'hard'); h().start();
  ok(h().zoneHalf < e().zoneHalf, 'hard starts with a smaller dome than easy (' + h().zoneHalf + ' < ' + e().zoneHalf + ')');
  ok(h().speed > e().speed, 'hard sweeps faster than easy (' + h().speed + ' > ' + e().speed + ')');
}

// ---- Timed mode: runs on a clock, breaches burn time not shields ----
section('forcefield: timed mode runs on a clock');
{
  const T = runGame({ seed: 7 }).T;
  T().setMode('timed', 'medium'); T().start();
  ok(T().mode === 'timed', 'mode is timed');
  const t0 = T().timeLeft;
  T().step(60);
  ok(T().timeLeft < t0, 'the clock ticks down');
  const before = T().timeLeft;
  T().setZone(0.5, 0.1); T().setPos(0.02); T().stop();   // an instant breach
  ok(T().timeLeft < before, 'a breach burns time in timed mode');
  ok(T().lives === 3, 'timed mode never touches shields');
  T().step(70 * 60);   // drain the clock
  ok(T().state === 'over', 'timed run ends when the clock hits 0 (state ' + T().state + ')');
}

// ---- Double mode: two lanes on a shared clock, per-lane score, no shared-life grief ----
section('forcefield: double mode = two lanes on a shared clock');
{
  const T = runGame({ seed: 7 }).T;
  T().setMode('double', 'medium'); T().start();
  ok(T().mode === 'double', 'mode is double');
  ok(T().forcefields.length === 2, 'two lanes exist (got ' + T().forcefields.length + ')');
  ok(T().timeLeft > 0, 'double runs on a shared clock');
  T().setZone(0.5, 0.13, 0); T().setPos(0.5, 0); T().stop(0);
  T().setZone(0.5, 0.13, 1); T().setPos(0.5, 1); T().stop(1);
  ok(T().forcefields[0].score > 0 && T().forcefields[1].score > 0, 'each lane keeps its own score');
  ok(T().score === T().forcefields[0].score + T().forcefields[1].score, 'total = sum of both lanes');
  T().setZone(0.5, 0.1, 0); T().setPos(0.02, 0); T().stop(0);   // breach on lane 0
  ok(T().state === 'playing', 'a breach in double never ends the run (no shared-life grief)');
  ok(T().forcefields[0].streak === 0, 'a breach resets that lane\'s combo');
}

// ---- Three breaches => game over, best persisted ----
section('forcefield: three breaches end the run + best persists');
{
  const gm = runGame({ seed: 7 });
  const T = gm.T;
  T().start();
  T().setZone(0.5, 0.1); T().setPos(0.5); T().stop();   // one deflect for a non-zero score
  const sc = T().score;
  for (let i = 0; i < 3; i++) { T().setZone(0.5, 0.1); T().setPos(0.02); T().stop(); }
  ok(T().state === 'over', 'run ends after shields reach 0 (state ' + T().state + ')');
  ok(T().menu() != null, 'the kit end menu shows on game over');
  ok(pbScore(gm.store, DEF_MODE) >= sc, 'best persisted >= final score (' + pbScore(gm.store, DEF_MODE) + ' >= ' + sc + ')');
}

// ---- End menu: Play Again restarts ----
section('forcefield: Play Again restarts');
{
  const T = runGame({ seed: 7 }).T;
  T().start();
  for (let i = 0; i < 3; i++) { T().setZone(0.5, 0.1); T().setPos(0.02); T().stop(); }
  ok(T().state === 'over', 'reached game over');
  T().menu().activate('again');
  ok(T().state === 'playing', 'Play Again returns to play');
  ok(T().score === 0, 'Play Again resets the score');
  ok(T().lives === 3, 'Play Again restores shields');
}

// ---- The dome sweeps under step() and bounces at the ends ----
section('forcefield: the dome sweeps and bounces');
{
  const T = runGame({ seed: 7 }).T;
  T().start();
  T().setPos(0);
  T().step(1);
  ok(T().pos > 0, 'the dome advances across the arc');
  T().setPos(0.999);
  T().step(20);
  ok(T().pos <= 1, 'the dome never overruns the far end (clamps at 1)');
}

// ---- Best restored from storage ----
section('forcefield: best read from store');
{
  const gb = runGame({ store: { gamekit_pb: JSON.stringify({ forcefield: { [DEF_MODE]: { score: 340 } } }) } });
  gb.T().start();
  ok(gb.T().best === 340, 'best read from store (got ' + gb.T().best + ')');
}

// ---- Layout: on-screen + HUD headroom, in portrait / landscape / desktop ----
section('forcefield: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame({ seed: 7 }); gl.T().start(); return gl; },
  (gl, v, L0) => {
    gl.T().step(1);
    const L = gl.T().layout;
    ok(L.barTop >= L.topReserve, v.name + ': the dome clears the HUD (top ' + Math.round(L.barTop) + ' >= ' + L.topReserve + ')');
    ok(L.barLeft >= 0 && L.barRight <= L.W, v.name + ': the dome fits the width (' + Math.round(L.barLeft) + '..' + Math.round(L.barRight) + ' in 0..' + L.W + ')');
    ok(L.barBottom < L.H, v.name + ': the dome sits within the height');
    ok(L.markerX >= L.barLeft - 3 && L.markerX <= L.barRight + 3, v.name + ': the dome stays on the arc');
    ok(L.zoneLeft >= L.barLeft - 1 && L.zoneRight <= L.barRight + 1, v.name + ': the target mark stays on the arc');
  }
);

summary();
