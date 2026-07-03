// Headless tests for Range (aim-trainer) — boots via the shared harness, drives window.__test.
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/aim-trainer/index.html';
const runGame = (opts) => bootGame(FILE, opts);
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');
// bests now live in the shared kit store (gamekit_pb): Timed keeps score, Sprint keeps time (per amount)
const pbG = (store) => { try { return JSON.parse(store['gamekit_pb'] || '{}')['aim-trainer'] || {}; } catch (e) { return {}; } };
const pbScore = (store, mode) => (pbG(store)[mode] || {}).score || 0;
const pbTime = (store, mode) => (pbG(store)[mode] || {}).time || 0;
const pbHas = (store, mode) => !!pbG(store)[mode];

console.log('Running Range (aim-trainer) headless tests…');

section('boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
const T = g.T;
ok(T() != null, 'exposes window.__test');

section('__test API surface');
ok(typeof T().state === 'string', 'state is a string');
ok(typeof T().score === 'number', 'score is a number');
ok(typeof T().hits === 'number', 'hits is a number');
ok(typeof T().misses === 'number', 'misses is a number');
ok(typeof T().accuracy === 'number', 'accuracy is a number');
ok(typeof T().timeLeft === 'number', 'timeLeft is a number');
ok(Array.isArray(T().targets), 'targets is an array');
ok(typeof T().start === 'function', 'start() exposed');
ok(typeof T().startMode === 'function', 'startMode() exposed');
ok(typeof T().shootAt === 'function', 'shootAt() exposed');
ok(typeof T().step === 'function', 'step() exposed');
ok(typeof T().setSeed === 'function', 'setSeed() exposed');
ok(typeof T().elapsed === 'number', 'elapsed getter exposed');
ok(typeof T().bestTime === 'number', 'bestTime getter exposed');
ok(typeof T().mode === 'string', 'mode getter exposed');

section('seeded RNG');
{
  function seededPositions(seed) {
    const gi = runGame();
    const Ti = gi.T;
    Ti().start();
    Ti().setSeed(seed);
    Ti().step(5);
    const first = Ti().targets[0];
    if (first) Ti().shootAt(first.x, first.y);
    Ti().step(1);
    return Ti().targets.map(t => t.x + ',' + t.y);
  }
  const run1 = seededPositions(7);
  const run2 = seededPositions(7);
  ok(JSON.stringify(run1) === JSON.stringify(run2), 'seeded RNG produces deterministic spawns (run1=' + run1 + ')');

  const gBounds = runGame();
  const Tb = gBounds.T;
  Tb().start();
  Tb().setSeed(0xffffffff);
  const firstTgt = Tb().targets[0];
  if (firstTgt) Tb().shootAt(firstTgt.x, firstTgt.y);
  Tb().step(1);
  const seededTgt = Tb().targets[0];
  if (seededTgt) {
    ok(seededTgt.x <= 1200 && seededTgt.x >= 80, 'seeded target x within spawn bounds (got ' + seededTgt.x + ')');
    ok(seededTgt.y <= 720 && seededTgt.y >= 128, 'seeded target y within spawn bounds (got ' + seededTgt.y + ')');
  }
}

section('initial state');
ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
ok(T().score === 0, 'initial score is 0');
ok(T().hits === 0, 'initial hits is 0');
ok(T().misses === 0, 'initial misses is 0');

section('start → playing with target');
T().start();
ok(T().state === 'playing', 'start() → state is "playing"');
ok(T().targets.length >= 1, 'at least one target present after start');
const tgt = T().targets[0];
ok(typeof tgt.x === 'number' && typeof tgt.y === 'number' && tgt.r > 0, 'target has x,y,r fields');

section('start() defaults to timed 30s mode');
T().start();
ok(T().mode === 'timed', 'start() uses timed mode');
ok(T().timeLeft >= 29 && T().timeLeft <= 30, 'start() sets timeLeft to ~30 (got ' + T().timeLeft + ')');

section('hit: shootAt center of target');
T().start();
const t0 = T().targets[0];
T().step(10);
const scoreBefore = T().score;
const hitsBefore = T().hits;
T().shootAt(t0.x, t0.y);
ok(T().hits > hitsBefore, 'hits incremented after shootAt target center');
ok(T().score > scoreBefore, 'score increased after hit');

section('miss: shootAt empty space');
T().start();
T().step(5);
const missesBefore = T().misses;
T().shootAt(1, 1);
ok(T().misses > missesBefore, 'misses incremented after shooting empty space');

section('accuracy calculation');
T().start();
T().step(5);
const t1 = T().targets[0];
T().shootAt(t1.x, t1.y);  // hit
T().step(5);
T().shootAt(0, 0);          // miss (top-left corner, no target)
const acc = T().accuracy;
ok(Math.abs(acc - 0.5) < 0.01, 'accuracy = hits/(hits+misses) = 0.5 (got ' + acc + ')');

section('accuracy stays 0 with no shots');
T().start();
ok(T().accuracy === 0, 'accuracy 0 when no shots fired');

section('timed mode: step past session → game over at limit');
{
  const fps = 60;
  // test with 10s timed
  const g10 = runGame();
  const T10 = g10.T;
  T10().startMode(10);
  ok(T10().state === 'playing', 'startMode(10) → playing');
  ok(T10().timeLeft >= 9.9 && T10().timeLeft <= 10, 'timeLeft starts at ~10 (got ' + T10().timeLeft + ')');
  // step exactly 10s + a few frames
  T10().step(10 * fps + 5);
  ok(T10().state === 'over', 'state is "over" after 10s (got ' + T10().state + ')');
  ok(T10().timeLeft <= 0, 'timeLeft ≤ 0 at end of 10s mode (got ' + T10().timeLeft + ')');

  // verify 30s mode also works
  T().start();
  const sessionFrames = 30 * fps + 5;
  T().step(sessionFrames);
  ok(T().state === 'over', 'state becomes "over" after stepping past 30s session (got ' + T().state + ')');
  ok(T().timeLeft <= 0, 'timeLeft ≤ 0 at game over (got ' + T().timeLeft + ')');
}

section('sprint mode: ends after 100 targets hit');
{
  const gsp = runGame();
  const Ts = gsp.T;
  Ts().startMode('sprint');
  ok(Ts().state === 'playing', 'startMode("sprint") → playing');
  ok(Ts().mode === 'sprint', 'mode is "sprint"');
  ok(Ts().timeLeft === 0, 'sprint has no timeLeft countdown (got ' + Ts().timeLeft + ')');

  // drive hits until 100 targets are hit
  let safetyIter = 0;
  while (Ts().state === 'playing' && Ts().hits < 100 && safetyIter++ < 4000) {
    Ts().step(3);
    const tgt = Ts().targets[0];
    if (tgt) Ts().shootAt(tgt.x, tgt.y);
  }
  ok(Ts().state === 'over', 'sprint ends after 100 hits (hits=' + Ts().hits + ', state=' + Ts().state + ')');
  ok(Ts().hits >= 100, 'sprint hits is >= 100 at end (got ' + Ts().hits + ')');
  ok(Ts().elapsedFrames > 0, 'elapsedFrames > 0 after sprint (got ' + Ts().elapsedFrames + ')');
  ok(Ts().elapsed > 0, 'elapsed seconds > 0 after sprint (got ' + Ts().elapsed + ')');
}

section('sprint: best time persists to localStorage');
{
  const gsp2 = runGame();
  const Ts2 = gsp2.T;
  Ts2().startMode('sprint');
  let safetyIter = 0;
  while (Ts2().state === 'playing' && Ts2().hits < 100 && safetyIter++ < 4000) {
    Ts2().step(3);
    const tgt = Ts2().targets[0];
    if (tgt) Ts2().shootAt(tgt.x, tgt.y);
  }
  const savedTime = pbTime(gsp2.store, 'Sprint · 100 targets'); // sprint best time, keyed per target count
  ok(savedTime > 0, 'sprint best time saved to profile store (got ' + savedTime + ')');
  ok(Ts2().bestTime === savedTime, 'bestTime getter matches localStorage (bestTime=' + Ts2().bestTime + ', saved=' + savedTime + ')');
}

section('timed best score persists');
const g2 = runGame();
const T2 = g2.T;
T2().start();
T2().step(5);
const tgt2 = T2().targets[0];
for (let i = 0; i < 10; i++) {
  T2().step(3);
  const tt = T2().targets[0];
  if (tt) T2().shootAt(tt.x, tt.y);
}
const scoreAfterHits = T2().score;
T2().step(30 * 60 + 5);
ok(T2().state === 'over', 'game over in fresh instance');
const savedBest = pbScore(g2.store, 'Timed · 30s');
ok(savedBest >= scoreAfterHits, 'best score written to profile store (saved=' + savedBest + ', score=' + scoreAfterHits + ')');

section('new session loads saved best');
const g4 = runGame({ store: { gamekit_pb: JSON.stringify({ 'aim-trainer': { 'Timed · 30s': { score: 9999, plays: 1 } } }) } });
g4.T().start(); // start timed 30s so bestScore reads aim-trainer_best_30
ok(g4.T().bestScore === 9999, 'best score loaded from localStorage on boot (got ' + g4.T().bestScore + ')');

section('per-mode best isolation: different timed durations use different keys');
{
  const giso = runGame();
  const Tiso = giso.T;

  // play 10s mode and end it
  Tiso().startMode(10);
  for (let i = 0; i < 5; i++) {
    Tiso().step(3);
    const tt = Tiso().targets[0];
    if (tt) Tiso().shootAt(tt.x, tt.y);
  }
  Tiso().step(10 * 60 + 5);
  const score10 = pbScore(giso.store, 'Timed · 10s');

  // play 30s mode and end it
  Tiso().startMode(30);
  for (let i = 0; i < 5; i++) {
    Tiso().step(3);
    const tt = Tiso().targets[0];
    if (tt) Tiso().shootAt(tt.x, tt.y);
  }
  Tiso().step(30 * 60 + 5);
  const score30 = pbScore(giso.store, 'Timed · 30s');

  ok(pbHas(giso.store, 'Timed · 10s'), '10s mode saves under "Timed · 10s"');
  ok(pbHas(giso.store, 'Timed · 30s'), '30s mode saves under "Timed · 30s"');
  ok(!pbHas(giso.store, 'Timed · 60s'), 'an unplayed duration (60s) has no best — per-duration isolation');
}

section('portrait HUD clearance: targets spawn below nav + HUD band');
{
  // Portrait viewport (taller than wide): the center-top HUD pill drops below the nav
  // to top:50px, so the playfield must clear ~92px of headroom, plus the 80px spawn pad = 172.
  const gp = runGame({ w: 400, h: 900 });
  const Tp = gp.T;
  ok(gp.bootErr === null, 'portrait boots without error: ' + gp.bootErr);
  Tp().start();
  Tp().setSeed(3);
  Tp().step(2);
  const ys = Tp().targets.map(t => t.y);
  ok(ys.length >= 1, 'portrait has a target after start');
  ok(ys.every(y => y >= 92 + 80), 'portrait targets clear nav + HUD (min y=' + Math.min(...ys) + ', need ≥172)');
}

section('moving targets: API surface');
ok(typeof T().movingTargets === 'boolean', 'movingTargets getter is a boolean');
ok(typeof T().setMoving === 'function', 'setMoving() exposed');

section('moving targets: off by default, targets stay put');
{
  const gm = runGame();
  const Tm = gm.T;
  ok(Tm().movingTargets === false, 'moving targets default off');
  Tm().start();
  Tm().setSeed(11);
  Tm().step(2);
  const before = Tm().targets[0];
  Tm().step(40);
  const after = Tm().targets[0];
  // same target (no hit fired), should not have drifted
  ok(after && before && Math.abs(after.x - before.x) < 0.001 && Math.abs(after.y - before.y) < 0.001,
    'stationary target does not move when moving disabled');
  ok(Tm().targets.every(t => t.moving === false), 'no target flagged moving when disabled');
}

section('moving targets: toggle persists to localStorage');
{
  const gm = runGame();
  const Tm = gm.T;
  Tm().setMoving(true);
  ok(gm.store['aim-trainer_moving'] === '1', 'enabling moving writes "1" to localStorage');
  ok(Tm().movingTargets === true, 'movingTargets reflects enabled');
  Tm().setMoving(false);
  ok(gm.store['aim-trainer_moving'] === '0', 'disabling moving writes "0" to localStorage');

  // fresh instance reads the persisted value
  const gm3 = runGame({ store: { 'aim-trainer_moving': '1' } });
  ok(gm3.T().movingTargets === true, 'persisted moving=1 loaded on fresh boot');
}

section('moving targets: ramp — more targets move and faster as score grows');
{
  const gm = runGame();
  const Tm = gm.T;
  Tm().setMoving(true);
  Tm().startMode('sprint'); // sprint escalates spawn so multiple targets appear
  Tm().setSeed(5);

  // low score: at/below MOVE_START_SCORE nothing should be moving
  Tm().step(20);
  ok(Tm().targets.every(t => !t.moving) || Tm().score <= 50,
    'no movement at very low score');

  // sprint ends at 100, so sample the ramp from a long timed run instead.
  const gt = runGame();
  const Tt = gt.T;
  Tt().setMoving(true);
  Tt().startMode(60);
  Tt().setSeed(9);
  function speedAndFractionAt(scoreTarget) {
    let safety = 0;
    while (Tt().state === 'playing' && Tt().score < scoreTarget && safety++ < 8000) {
      Tt().step(2);
      const t = Tt().targets[0];
      if (t) Tt().shootAt(t.x, t.y);
    }
    Tt().step(5); // let movement assign velocities
    const ts = Tt().targets;
    const movingFrac = ts.length ? ts.filter(t => t.moving).length / ts.length : 0;
    const maxSpeed = ts.reduce((mx, t) => Math.max(mx, Math.hypot(t.vx, t.vy)), 0);
    return { movingFrac, maxSpeed, score: Tt().score };
  }
  const low = speedAndFractionAt(80);
  const high = speedAndFractionAt(300);
  ok(high.score > low.score, 'reached a higher score for the high sample (' + low.score + ' → ' + high.score + ')');
  ok(high.movingFrac >= low.movingFrac, 'moving fraction does not decrease as score grows (' + low.movingFrac.toFixed(2) + ' → ' + high.movingFrac.toFixed(2) + ')');
  ok(high.maxSpeed >= low.maxSpeed - 0.001, 'max target speed grows (or holds) with score (' + low.maxSpeed.toFixed(2) + ' → ' + high.maxSpeed.toFixed(2) + ')');
  ok(high.maxSpeed > 0, 'targets are moving at high score (maxSpeed=' + high.maxSpeed.toFixed(2) + ')');
}

section('moving targets: stay within the playfield (bounce)');
{
  const gm = runGame();
  const Tm = gm.T;
  Tm().setMoving(true);
  Tm().startMode(60);
  Tm().setSeed(13);
  // push score up so plenty of targets move fast, then run many frames
  let safety = 0;
  while (Tm().state === 'playing' && Tm().score < 400 && safety++ < 8000) {
    Tm().step(2);
    const t = Tm().targets[0];
    if (t) Tm().shootAt(t.x, t.y);
  }
  let outOfBounds = false;
  for (let i = 0; i < 600 && Tm().state === 'playing'; i++) {
    Tm().step(1);
    for (const t of Tm().targets) {
      if (t.x < t.r - 1 || t.x > 1280 - t.r + 1 || t.y < 48 + t.r - 1 || t.y > 800 - 8 - t.r + 1) {
        outOfBounds = true;
      }
    }
  }
  ok(!outOfBounds, 'moving targets never leave the playfield bounds');
}

section('rotation: a live target is pulled back on-screen');
{
  const gr = runGame(); // boots at 1280×800
  const Tr = gr.T;
  Tr().start();
  ok(Tr().targets.length > 0, 'a target is live before the rotate');
  gr.resize(390, 780); // landscape → portrait: the old spawn area is mostly gone
  const t = Tr().targets[0];
  ok(t && t.x >= 0 && t.x <= 390 && t.y >= 0 && t.y <= 780,
    'target clamped into the new viewport (got ' + (t && (Math.round(t.x) + ',' + Math.round(t.y))) + ')');
}

section('moving targets: flick aim still hits a moving target at its current position');
{
  const gm = runGame();
  const Tm = gm.T;
  Tm().setMoving(true);
  Tm().startMode(60);
  Tm().setSeed(21);
  // build up score so the first target is moving
  let safety = 0;
  while (Tm().state === 'playing' && Tm().score < 200 && safety++ < 8000) {
    Tm().step(2);
    const t = Tm().targets[0];
    if (t) Tm().shootAt(t.x, t.y);
  }
  Tm().step(10);
  const moving = Tm().targets.find(t => t.moving) || Tm().targets[0];
  const hitsBefore = Tm().hits;
  if (moving) Tm().shootAt(moving.x, moving.y);
  ok(Tm().hits === hitsBefore + 1, 'clicking a moving target at its reported position registers a hit');
}

// ---- Layout: everything on-screen + no targets under the HUD, in portrait / landscape / desktop ----
section('Range: layout fits the screen (on-screen + no targets under the HUD)');
runLayoutSuite(
  () => runGame(),
  (gl, v, L0) => {
    const Tl = gl.T;
    Tl().start();     // first target spawns into the resized playfield
    Tl().setSeed(7);
    Tl().step(2);
    const L = Tl().layout;
    // spawn region (full target disc) stays within the canvas
    ok(L.spawn.left >= 0 && L.spawn.right <= L.W, v.name + ': spawn region within width (' + Math.round(L.spawn.left) + '..' + Math.round(L.spawn.right) + ' in 0..' + L.W + ')');
    ok(L.spawn.top >= 0 && L.spawn.bottom <= L.H, v.name + ': spawn region within height (' + Math.round(L.spawn.top) + '..' + Math.round(L.spawn.bottom) + ' in 0..' + L.H + ')');
    // spawn region clears the top HUD pill (targets never spawn under the score HUD)
    ok(L.spawn.top >= L.topReserve, v.name + ': spawn clears the HUD (spawnTop ' + Math.round(L.spawn.top) + ' >= topReserve ' + L.topReserve + ')');
    // any live targets are fully on-screen (including their radius) and below the HUD
    ok(L.targetsBox != null, v.name + ': has a live target after start');
    if (L.targetsBox) {
      const b = L.targetsBox;
      ok(b.left >= 0 && b.right <= L.W, v.name + ': live targets within width (' + Math.round(b.left) + '..' + Math.round(b.right) + ' in 0..' + L.W + ')');
      ok(b.top >= L.topReserve && b.bottom <= L.H, v.name + ': live targets on-screen + below HUD (' + Math.round(b.top) + '..' + Math.round(b.bottom) + ' in ' + L.topReserve + '..' + L.H + ')');
    }
  }
);

// ---- cosmetics: target + hit-marker skins (visual only; hitbox unchanged) ----
section('cosmetics — target & hit-marker skins');
{
  const runCos = (store) => runGame({ preCode: [CHALLENGES, COSMETICS], store: { gamekit_pts_x10: '1', gamekit_flappy_migrated: '1', gamekit_done: JSON.stringify({ a: 100 }), ...(store || {}) } });
  const g = runCos();
  ok(g.bootErr === null, 'boots with cosmetics loaded: ' + g.bootErr);
  ok(g.win.gamekit.cosmetics.selected('aim-trainer.target') === 'aim-trainer.target.rings' && g.win.gamekit.cosmetics.selected('aim-trainer.marker') === 'aim-trainer.marker.classic',
    'cosmetics target+marker default in-game (picked via the 🎨 modal)');
  // each target + marker combo renders (with a live target + a hit marker) without error
  const targs = ['rings', 'donut', 'fruit', 'alien', 'goldstar'], marks = ['classic', 'spark', 'boom'];
  for (let i = 0; i < Math.max(targs.length, marks.length); i++) {
    const tid = 'aim-trainer.target.' + targs[i % targs.length], mid = 'aim-trainer.marker.' + marks[i % marks.length];
    const owned = {}; owned[tid] = { c: 0, t: 0 }; owned[mid] = { c: 0, t: 0 };
    const g2 = runCos({ gamekit_owned: JSON.stringify(owned), gamekit_cos_sel: JSON.stringify({ 'aim-trainer.target': tid, 'aim-trainer.marker': mid }) });
    g2.test().start(); g2.test().step(3);
    const tg = g2.test().targets[0];
    if (tg) g2.test().shootAt(tg.x, tg.y); // hit → spawns a marker in this skin
    g2.test().render();
    ok(g2.errors.length === 0, targs[i % targs.length] + ' + ' + marks[i % marks.length] + ': renders without errors' + (g2.errors.length ? ' — ' + g2.errors[0] : ''));
  }
  // hit detection is identical for a skinned target — a shot at the target centre still scores
  {
    const owned = { 'aim-trainer.target.goldstar': { c: 0, t: 0 } };
    const g3 = runCos({ gamekit_owned: JSON.stringify(owned), gamekit_cos_sel: JSON.stringify({ 'aim-trainer.target': 'aim-trainer.target.goldstar' }) });
    g3.test().start(); g3.test().step(3);
    const h0 = g3.test().hits, tg = g3.test().targets[0];
    if (tg) g3.test().shootAt(tg.x, tg.y);
    ok(g3.test().hits === h0 + 1, 'a skinned target still registers a centre hit (hits ' + h0 + ' -> ' + g3.test().hits + ')');
  }
  ok(g.win.gamekit.cosmetics.buy('aim-trainer.target.donut') === true && g.win.gamekit.cosmetics.balance() === 75, 'buy target skin with trophies (75 left)');
}

summary();
