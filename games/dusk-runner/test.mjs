// Headless tests for Dusk Runner — boots via the shared harness, drives window.__test.
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/dusk-runner/index.html';
const runGame = (opts) => bootGame(FILE, opts);
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');

const pb = (store, mode) => {
  try { return ((JSON.parse(store['gamekit_pb'] || '{}')['dusk-runner'] || {})[mode] || {}); }
  catch (e) { return {}; }
};

// ---- Boot ----
section('dusk-runner: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');
ok(g.T().mode === 'endless', 'default mode is endless (got ' + g.T().mode + ')');
ok(g.T().pace === 'normal', 'default pace is normal (got ' + g.T().pace + ')');

// ---- Running scores distance ----
section('dusk-runner: distance scoring');
{
  const gs = runGame({ seed: 7 });
  const T = gs.T;
  T().start();
  ok(T().state === 'playing', 'start() sets state to "playing"');
  ok(T().score === 0, 'score starts at 0');
  T().clearObstacles();
  T().step(240);
  ok(T().score > 0, 'running forward scores metres (got ' + T().score + ')');
  const s1 = T().score;
  T().step(240);
  ok(T().score > s1, 'score keeps climbing (' + s1 + ' → ' + T().score + ')');
  ok(T().speed > 0, 'speed is positive (' + T().speed.toFixed(2) + ')');
}

// ---- Speed ramp ----
section('dusk-runner: pace + speed ramp');
{
  const gs = runGame({ seed: 3 });
  gs.T().startMode('endless', 'normal');
  gs.T().clearObstacles();
  const v0 = gs.T().speed;
  gs.T().setDist(1500);
  gs.T().step(1);
  ok(gs.T().speed > v0, 'speed ramps with distance (' + v0.toFixed(2) + ' → ' + gs.T().speed.toFixed(2) + ')');

  const gg = runGame({ seed: 3 });
  gg.T().startMode('endless', 'gentle');
  gg.T().clearObstacles();
  const gentle = gg.T().speed;
  const gb = runGame({ seed: 3 });
  gb.T().startMode('endless', 'brisk');
  gb.T().clearObstacles();
  ok(gb.T().speed > gentle, 'brisk starts faster than gentle (' + gentle.toFixed(2) + ' < ' + gb.T().speed.toFixed(2) + ')');
}

// ---- Jump / duck ----
section('dusk-runner: jump + duck');
{
  const gs = runGame({ seed: 11 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  ok(T().onGround === true, 'runner starts on the ground');
  T().jump();
  ok(T().onGround === false, 'jump() leaves the ground');
  const airTop = T().layout.runner.y;
  T().step(12);
  ok(T().layout.runner.y < airTop, 'runner rises after the jump');
  T().step(60);
  ok(T().onGround === true, 'runner lands again within a second');

  const hStand = T().layout.runner.h;
  T().setDuck(true);
  ok(T().ducking === true, 'setDuck(true) ducks');
  ok(T().layout.runner.h < hStand, 'ducking shrinks the hitbox (' + Math.round(hStand) + ' → ' + Math.round(T().layout.runner.h) + ')');
  T().setDuck(false);
  ok(T().layout.runner.h === hStand, 'releasing duck restores the hitbox');
}

// ---- Tapping the canvas ALWAYS jumps ----
// Touch used to duck when the tap landed below 62% of the band — an invisible, layout-dependent
// line. Duck now lives on the puck's lower half, so no canvas tap may ever duck.
section('dusk-runner: canvas tap always jumps');
{
  const gs = runGame({ seed: 3 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  const cv = gs.el('game');
  for (const frac of [0.1, 0.5, 0.95]) {
    T().setDuck(false);
    while (!T().onGround) T().step(1);
    cv.fire('pointerdown', { clientY: T().layout.H * frac, clientX: 100 });
    ok(T().onGround === false, 'tap at ' + Math.round(frac * 100) + '% height jumps');
    ok(T().ducking === false, 'tap at ' + Math.round(frac * 100) + '% height never ducks');
  }
}

// ---- The touch puck drives the same actions as the keys ----
section('dusk-runner: touch puck');
{
  const gs = runGame({ seed: 7 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  const down = gs.el('puckDown'), up = gs.el('puckUp'), body = gs.doc.body;

  down.fire('pointerdown', {});
  ok(T().ducking === true, 'the lower half ducks while held');
  down.fire('pointerup', {});
  ok(T().ducking === false, 'releasing it stands back up');

  while (!T().onGround) T().step(1);
  up.fire('pointerdown', {});
  ok(T().onGround === false, 'the upper half jumps');

  // a half left held when the run ends must not leave the next run crouching
  down.fire('pointerdown', {});
  T().setDist(10);
  T().start();
  ok(T().ducking === false, 'a held half is released when the run ends');
  ok(body.classList.contains('dr-run'), 'the puck is shown for a live run');
}

// ---- The puck stays on screen and each half stays thumb-sized ----
section('dusk-runner: puck size + placement');
{
  const gs = runGame({ seed: 8 });
  const T = gs.T;
  T().start();
  for (const [w, h] of [[360, 640], [640, 360], [480, 360], [1280, 800], [2560, 1440]]) {
    gs.resize(w, h);
    const p = T().puck;
    ok(p.x >= 0 && p.x + p.size <= w, `${w}×${h}: puck fits horizontally (x ${Math.round(p.x)} + ${p.size} ≤ ${w})`);
    ok(p.y >= 0 && p.y + p.size <= h, `${w}×${h}: puck fits vertically (y ${Math.round(p.y)} + ${p.size} ≤ ${h})`);
    // each half must stay a target you can hit WITHOUT looking — the 44px version failed on this
    ok(p.size / 2 >= 60, `${w}×${h}: each half is thumb-sized (${Math.round(p.size / 2)}px ≥ 60)`);
  }
  gs.resize(360, 640);
  ok(T().puck.x > 180, 'defaults to the right side for a right thumb (x ' + Math.round(T().puck.x) + ')');
}

// ---- Placement mode: the ONLY way to move the puck, and never mid-run ----
// The previous build let you drag a 14px grip during play. Chrome's touch adjustment snapped every
// such touch onto the flanking buttons, so the grip received zero events and the puck could not be
// moved at all. Here the whole puck is the handle and the halves are inert.
section('dusk-runner: puck placement mode');
{
  const gs = runGame({ seed: 8, w: 360, h: 640 });
  const T = gs.T;
  const puck = gs.el('puck'), body = gs.doc.body;

  T().start();
  const home = T().puck.x;
  puck.fire('pointerdown', { clientX: home + 40, clientY: 500 });
  puck.fire('pointermove', { clientX: 60, clientY: 300 });
  puck.fire('pointerup', {});
  ok(Math.abs(T().puck.x - home) < 1, 'dragging the puck during a run does nothing');

  T().placePad();
  ok(body.classList.contains('dr-place'), 'placement mode is on');
  puck.fire('pointerdown', { clientX: home + 40, clientY: 500 });
  puck.fire('pointermove', { clientX: 60, clientY: 300 });
  const moved = T().puck;
  ok(moved.x < 120, 'the puck follows the drag to the left (x ' + Math.round(moved.x) + ')');
  ok(T().ducking === false, 'dragging over the lower half never ducks');
  puck.fire('pointerup', {});
  gs.el('puckDone').fire('click', {});
  ok(!body.classList.contains('dr-place'), 'Done leaves placement mode');
  ok(T().puck.moved === true, 'the spot is marked as player-placed');

  const again = runGame({ seed: 8, store: gs.store, w: 360, h: 640 });
  again.T().start();
  ok(again.T().puck.moved === true, 'the placed spot is remembered next session');
  ok(Math.abs(again.T().puck.x - moved.x) <= 2, 'and it comes back where it was left');
  ok(Object.keys(gs.store).filter(k => k.startsWith('dusk-runner_')).length === 1, 'exactly one dusk-runner_ key is persisted');
}

// ---- Collision ends the run ----
section('dusk-runner: collision');
{
  const gs = runGame({ seed: 5 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  const rb = T().layout.runner;
  T().spawnAt('cactus1', 0, rb.x + rb.w * 0.5);   // a cactus right on the runner
  T().step(1);
  ok(T().state === 'over', 'hitting a cactus ends the run (got ' + T().state + ')');
  ok(T().menu() != null, 'end menu shows on game over');
}
{
  // ducking clears a high bird that would otherwise hit
  const gs = runGame({ seed: 5 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  T().setDuck(true);
  const rb = T().layout.runner;
  T().spawnAt('bird', 40, rb.x + rb.w * 0.5);
  T().step(1);
  ok(T().state === 'playing', 'ducking survives a high bird (got ' + T().state + ')');
}

// ---- Best persistence (endless: score) ----
section('dusk-runner: best persistence');
{
  const gs = runGame({ seed: 9 });
  const T = gs.T;
  T().startMode('endless', 'normal');
  T().clearObstacles();
  T().step(600);
  const sc = T().score;
  const rb = T().layout.runner;
  T().spawnAt('cactus1', 0, rb.x + rb.w * 0.5);
  T().step(1);
  ok(T().state === 'over', 'run ended for the best-save check');
  ok(pb(gs.store, 'Endless · Normal').score >= sc, 'best persisted under the mode label (' + JSON.stringify(pb(gs.store, 'Endless · Normal')) + ' vs ' + sc + ')');
  ok(!(pb(gs.store, 'Endless · Normal').time > 0), 'endless run stores no time');
}

// ---- Sprint: time is MILLISECONDS and only on a clear ----
section('dusk-runner: sprint time unit');
{
  const gs = runGame({ seed: 4 });
  const T = gs.T;
  T().startMode('sprint', 'normal');
  T().clearObstacles();
  T().step(119);                                  // 119 frames of running…
  T().setDist(999.9);                             // …then jump the odometer to the line
  T().step(1);                                    // frame 120 crosses it → elapsed = 2000 ms exactly
  ok(T().state === 'over', 'sprint ends when 1000 m is reached (got ' + T().state + ')');
  ok(T().won === true, 'sprint clear sets won');
  const rec = pb(gs.store, 'Sprint · Normal');
  ok(rec.time === 2000, 'clear time stored in MILLISECONDS (got ' + rec.time + ', expected 2000)');
}
{
  // Sprint is a TIME TRIAL: a clip is a stumble that costs time, not an instant loss
  const gs = runGame({ seed: 4 });
  const T = gs.T;
  T().startMode('sprint', 'normal');
  T().clearObstacles();
  T().step(30);
  const clip = () => { const rb = T().layout.runner; T().spawnAt('cactus1', 0, rb.x + rb.w * 0.5); T().step(1); };
  clip();
  ok(T().state === 'playing', 'a clip in Sprint stumbles instead of ending the run (got ' + T().state + ')');
  ok(T().stumbles === 1, 'the stumble is counted (got ' + T().stumbles + ')');
  const distBefore = T().dist, msBefore = T().elapsedMs;
  T().step(40);
  ok(T().dist === distBefore, 'the runner is frozen while stumbling (no distance gained)');
  ok(T().elapsedMs > msBefore, 'but the clock keeps running — a stumble costs TIME');
  for (let i = 0; i < 4; i++) { T().clearObstacles(); T().step(60); clip(); }
  ok(T().state === 'over' && T().won === false, 'the fifth stumble ends the Sprint as a loss (got ' + T().state + '/' + T().stumbles + ')');
  ok(!(pb(gs.store, 'Sprint · Normal').time > 0), 'a failed sprint stores time 0 (got ' + pb(gs.store, 'Sprint · Normal').time + ')');
}

// ---- Slipstream: a near miss surges your speed (so Sprint times differ by skill) ----
section('dusk-runner: slipstream surge');
{
  const gs = runGame({ seed: 12 });
  const T = gs.T;
  T().startMode('sprint', 'normal');
  T().clearObstacles();
  T().step(20);
  ok(T().surge === 0, 'no surge to begin with');
  // a bird skimming just over the standing runner's head: a genuine close call, no timing needed
  T().spawnAt('bird', 52, T().layout.runner.x + 6);
  for (let i = 0; i < 40 && T().surge === 0 && T().state === 'playing'; i++) T().step(1);
  ok(T().surge > 0, 'squeezing past an obstacle grants a slipstream surge (surge=' + T().surge + ')');
  T().step(1);   // the surge is granted after speed is computed, so it applies from the next step
  ok(T().speed > T().speedBase * 1.05, 'the surge actually speeds the runner up (chain x1) (' + T().speed.toFixed(2) + ' vs base ' + T().speedBase.toFixed(2) + ')');
  for (let i = 0; i < 120; i++) T().step(1);   // outlast the surge
  ok(T().surge === 0, 'the surge expires');
  ok(Math.abs(T().speed - T().speedBase) < 0.01, 'speed returns to the ramp baseline afterwards');
}

// ---- The gantry can ONLY be ducked (otherwise ducking is pointless) ----
section('dusk-runner: gantry forces a duck');
{
  const gs = runGame({ seed: 14 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  T().setDuck(true);
  T().spawnGantry(T().layout.runner.x + 4);
  T().step(1);
  ok(T().state === 'playing', 'ducking clears the gantry (got ' + T().state + ')');

  const gj = runGame({ seed: 14 });
  gj.T().start();
  gj.T().clearObstacles();
  gj.T().jump();
  gj.T().step(10);
  gj.T().spawnGantry(gj.T().layout.runner.x + 4);
  gj.T().step(1);
  ok(gj.T().state === 'over', 'jumping into the gantry is a crash — it cannot be jumped (got ' + gj.T().state + ')');

  const gr = runGame({ seed: 14 });
  gr.T().start();
  gr.T().clearObstacles();
  gr.T().spawnGantry(gr.T().layout.runner.x + 4);
  gr.T().step(1);
  ok(gr.T().state === 'over', 'running into the gantry upright is a crash');
}

// ---- Sprint's BEST is a TIME, not a distance ----
section('dusk-runner: sprint best reads as a clock');
{
  const gs = runGame({ seed: 4, store: { gamekit_pb: JSON.stringify({
    'dusk-runner': { 'Sprint · Normal': { score: 1000, time: 21500 }, 'Endless · Normal': { score: 640 } } }) } });
  const T = gs.T;
  T().startMode('sprint', 'normal');
  const hud = gs.doc.getElementById('bestEl').textContent;
  ok(/^\d+:\d\d\.\d$/.test(hud), 'sprint HUD best is mm:ss.c, not metres (got "' + hud + '")');
  ok(!/m$/.test(hud), 'sprint HUD best has no metre suffix');
  const ge = runGame({ seed: 4, store: { gamekit_pb: JSON.stringify({
    'dusk-runner': { 'Endless · Normal': { score: 640 } } }) } });
  ge.T().startMode('endless', 'normal');
  ok(/ m$/.test(ge.doc.getElementById('bestEl').textContent), 'endless HUD best still reads in metres');
}

// ---- End menu flow ----
section('dusk-runner: end menu');
{
  const gs = runGame({ seed: 2 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  T().step(300);
  const rb = T().layout.runner;
  T().spawnAt('cactus1', 0, rb.x + rb.w * 0.5);
  T().step(1);
  ok(T().menu() != null, 'kit end menu is shown');
  T().menu().activate('again');
  ok(T().state === 'playing', 'RUN AGAIN starts a new run');
  ok(T().score === 0, 'RUN AGAIN resets the score');
}

// ---- Day/night cycle ----
section('dusk-runner: day cycle');
{
  const gs = runGame({ seed: 6 });
  const T = gs.T;
  T().start();
  T().clearObstacles();
  const p0 = T().phase;
  T().setDist(1200);
  T().step(1);
  ok(T().phase > p0, 'the sky phase advances with distance (' + p0.toFixed(2) + ' → ' + T().phase.toFixed(2) + ')');
  T().setDist(2400);
  T().step(1);
  ok(T().phase < 0.1, 'the cycle wraps back to day after 2400 m (got ' + T().phase.toFixed(2) + ')');
}

// ---- Deep link ----
section('dusk-runner: deep-linked mode');
{
  const gd = runGame({ search: '?mode=sprint&pace=brisk' });
  ok(gd.T().mode === 'sprint', '?mode=sprint preselects sprint (got ' + gd.T().mode + ')');
  ok(gd.T().pace === 'brisk', '?pace=brisk preselects brisk (got ' + gd.T().pace + ')');
}

// ---- Cosmetics render ----
section('dusk-runner: cosmetics');
{
  const gc = runGame({ seed: 8, preCode: [CHALLENGES, COSMETICS], store: {
    gamekit_owned: JSON.stringify({ 'dusk-runner.runner.fox': { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'dusk-runner.runner': 'dusk-runner.runner.fox' }),
  } });
  gc.T().start();
  gc.step(5);
  ok(gc.errors.length === 0, 'fox runner skin renders without errors: ' + gc.errors.join(' | '));
}

// ---- Whole-look skins ----
section('dusk-runner: look skins');
{
  const gc = runGame({ seed: 8, preCode: [CHALLENGES, COSMETICS] });
  gc.T().start(); gc.step(3);
  ok(gc.T().look === 'chrome', 'chrome is the default look (got ' + gc.T().look + ')');
  ok(gc.errors.length === 0, 'chrome look renders without errors: ' + gc.errors.join(' | '));

  const gp = runGame({ seed: 8, preCode: [CHALLENGES, COSMETICS], store: {
    gamekit_owned: JSON.stringify({ 'dusk-runner.style.paper': { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'dusk-runner.style': 'dusk-runner.style.paper' }),
  } });
  gp.T().start(); gp.step(3);
  ok(gp.T().look === 'paper', 'buying + selecting the paper look switches the whole palette (got ' + gp.T().look + ')');
  ok(gp.errors.length === 0, 'paper look renders without errors: ' + gp.errors.join(' | '));
  ok(gp.T().sky !== gc.T().sky, 'the two looks have different skies (' + gc.T().sky + ' vs ' + gp.T().sky + ')');
}

// ---- Comic look: impact words fire on events, and only in that skin ----
section('dusk-runner: comic look');
{
  const comicStore = {
    gamekit_owned: JSON.stringify({ 'dusk-runner.style.comic': { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'dusk-runner.style': 'dusk-runner.style.comic' }),
  };
  const gc = runGame({ seed: 8, preCode: [CHALLENGES, COSMETICS], store: comicStore });
  gc.T().start(); gc.T().clearObstacles(); gc.step(4);
  ok(gc.T().look === 'comic', 'comic look selected (got ' + gc.T().look + ')');
  // draw it DIRECTLY: the kit loop catches render exceptions and logs them, so stepping the sim
  // proves nothing about the painters (a missing draw function shipped exactly this way)
  let drewComic = null;
  try { gc.T().render(); } catch (e) { drewComic = e.message; }
  ok(drewComic === null, 'comic look renders with no painter exception: ' + drewComic);
  ok(gc.errors.length === 0, 'comic look renders without errors: ' + gc.errors.join(' | '));
  ok(gc.T().pows.length === 0, 'no impact words before anything happens');
  const rb = gc.T().layout.runner;
  gc.T().spawnAt('cactus1', 0, rb.x + rb.w * 0.5);
  gc.T().step(1);
  ok(gc.T().pows.some(t => /KABOOM/i.test(t)), 'a crash pops KABOOM (' + gc.T().pows.join(',') + ')');

  // the chrome default must stay clean — no comic furniture leaking into the other looks
  const gd = runGame({ seed: 8, preCode: [CHALLENGES, COSMETICS] });
  gd.T().start(); gd.T().clearObstacles();
  const rb2 = gd.T().layout.runner;
  gd.T().spawnAt('cactus1', 0, rb2.x + rb2.w * 0.5);
  gd.T().step(1);
  ok(gd.T().look === 'chrome' && gd.T().pows.length === 0, 'chrome look never shows impact words');
}

// ---- Painters: every look must survive a DIRECT render at every phase ----
section('dusk-runner: every look paints without throwing');
for (const look of ['chrome', 'paper', 'comic']) {
  const st = look === 'chrome' ? {} : {
    gamekit_owned: JSON.stringify({ ['dusk-runner.style.' + look]: { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'dusk-runner.style': 'dusk-runner.style.' + look }),
  };
  const g2 = runGame({ seed: 5, preCode: [CHALLENGES, COSMETICS], store: st });
  g2.T().start(); g2.T().clearObstacles();
  let err = null;
  for (const m of [0, 500, 1100, 1700, 2300]) {           // day → dusk → night → wrap
    g2.T().setDist(m);
    g2.T().spawnGantry(g2.T().layout.W * 0.6);
    g2.T().spawnAt('bird', 40, g2.T().layout.W * 0.8);
    try { g2.T().step(1); g2.T().render(); } catch (e) { err = look + ' @ ' + m + 'm: ' + e.message; break; }
  }
  ok(err === null, look + ': paints at every phase with every obstacle kind — ' + (err || 'clean'));
}

// ---- Contrast: entity tone never crosses the sky tone at ANY phase (the "screen goes blank" bug) ----
section('dusk-runner: contrast holds through the whole cycle');
for (const look of ['chrome', 'paper']) {
  const gk = runGame({ seed: 8, preCode: [CHALLENGES, COSMETICS], store: look === 'paper' ? {
    gamekit_owned: JSON.stringify({ 'dusk-runner.style.paper': { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'dusk-runner.style': 'dusk-runner.style.paper' }),
  } : {} });
  gk.T().start(); gk.T().clearObstacles();
  const lum = c => { const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c); return m ? (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 : null; };
  let worst = 1, worstAt = 0;
  for (let m = 0; m <= 2400; m += 40) {
    gk.T().setDist(m); gk.T().step(1);
    const d = Math.abs(lum(gk.T().sky) - lum(gk.T().ink));
    if (d < worst) { worst = d; worstAt = m; }
  }
  ok(worst > 0.35, look + ': sky/entity luminance gap stays > 0.35 all cycle (worst ' + worst.toFixed(2) + ' at ' + worstAt + ' m)');
}

// ---- Layout: play band, runner and obstacles stay inside playRect ----
section('dusk-runner: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame({ seed: 21 }); gl.T().start(); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    ok(L.board.y >= L.topReserve - 1, v.name + ': play band starts below the HUD (' + Math.round(L.board.y) + ' >= ' + Math.round(L.topReserve) + ')');
    ok(L.board.x >= 0 && L.board.x + L.board.w <= L.W + 0.5, v.name + ': play band within width');
    ok(L.board.y + L.board.h <= L.H + 0.5, v.name + ': play band within height');
    ok(L.groundY > L.board.y && L.groundY <= L.H, v.name + ': ground line inside the viewport (' + Math.round(L.groundY) + ' in ' + Math.round(L.board.y) + '..' + L.H + ')');
    ok(L.runner.y >= L.topReserve - 1, v.name + ': standing runner clears the HUD (' + Math.round(L.runner.y) + ')');
    ok(L.runner.y + L.runner.h <= L.H, v.name + ': runner stands on-screen');
    ok(L.runner.x > 0 && L.runner.x + L.runner.w < L.W, v.name + ': runner within width');
    ok(L.S >= 0.62 && L.S <= 1.5, v.name + ': scale factor clamped (' + L.S.toFixed(2) + ')');
    // model fairness: an obstacle at the moment it spawns must sit just off the RIGHT edge, never
    // deep off-screen (the frog-bonk class of bug)
    gl.T().clearObstacles();
    gl.T().step(400);
    const obs = gl.T().layout.obstacles;
    ok(obs.every(o => o.x < L.W + 60 * L.S), v.name + ': obstacles spawn just past the edge, not far off-screen');
    ok(obs.every(o => o.y + o.h <= L.groundY + 1), v.name + ': obstacles sit on or above the ground line');
    ok(obs.every(o => o.y >= L.board.y - 1), v.name + ': obstacles stay below the HUD band');
  }
);

// ---- Jump reachability at every viewport: the tallest obstacle must be clearable ----
section('dusk-runner: tallest obstacle is jumpable at every size');
for (const v of [{ w: 360, h: 640 }, { w: 640, h: 360 }, { w: 1280, h: 800 }, { w: 2560, h: 1440 }]) {
  const gj = runGame({ w: v.w, h: v.h, seed: 13 });
  const T = gj.T;
  T().start();
  T().clearObstacles();
  T().jump();
  let apex = 0;
  for (let i = 0; i < 60; i++) { T().step(1); const L = T().layout; apex = Math.max(apex, L.groundY - L.runner.y - L.runner.h); }
  const tallest = 46 * T().layout.S;   // cactus3
  ok(apex > tallest * 1.35, v.w + 'x' + v.h + ': jump apex ' + Math.round(apex) + 'px clears the tallest ' + Math.round(tallest) + 'px obstacle');
}

// Sprint's RECORD is the clock, but "new best" compared METRES against the metres best. Metres cap
// at 1,000 on a clear, so once one clear had banked the cap, no later clear — however much faster —
// could ever read as a best (1000 > 1000 is false).
section('dusk-runner: sprint new-best is decided by the CLOCK, not the metres');
{
  const clear = (store) => {
    const g = runGame({ seed: 4, store });
    const T = g.T;
    T().startMode('sprint', 'normal');
    T().clearObstacles();
    T().step(119); T().setDist(999.9); T().step(1);       // clear at exactly 2000 ms
    return T();
  };
  const slowStore = { gamekit_pb: JSON.stringify({ 'dusk-runner': { 'Sprint · Normal': { score: 1000, time: 9000, plays: 1, stats: {} } } }) };
  const t1 = clear(slowStore);
  ok(t1.state === 'over' && t1.won === true, 'cleared the sprint (2000 ms)');
  ok(t1.menu() && t1.menu().cfg.newBest === true, 'beating a 9,000 ms record with metres already capped IS a new best');
  const fastStore = { gamekit_pb: JSON.stringify({ 'dusk-runner': { 'Sprint · Normal': { score: 1000, time: 1500, plays: 1, stats: {} } } }) };
  const t2 = clear(fastStore);
  ok(t2.menu() && !t2.menu().cfg.newBest, 'a SLOWER clear (2000 vs 1500 ms) is not a new best');
}

summary();
