// Headless tests for Classic Asteroids (games/asteroids/index.html — Classic + Classic-Enhanced
// behind the ?v= flag, plus ?speedrun=1) — boots via the shared harness, drives window.__test
// and the rAF loop (bespoke engine, not on gamekit.loop). (The roguelite variant is a separate
// game — see games/asteroids-plus/test.mjs.)
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

// seeded RNG: spawn positions/rock shapes are random — a fixed seed makes runs reproducible
const runGame = (file, opts = {}) => bootGame('games/asteroids/' + file, { seed: 0xA57E401D, ...opts });
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');

// ---------------- Classic / Enhanced smoke tests ----------------
function smokeClassic(file, { enhanced = false } = {}) {
  section(file + ' (smoke)');
  const g = runGame(file);
  ok(g.errors.length === 0, file + ' boots without error: ' + g.errors[0]);
  g.step(10);
  // start via the kit start menu (Enter activates the focused Play button)
  ok(g.test().menu() != null, file + ' opens the kit start menu on boot');
  g.down('Enter');
  g.step(2);
  ok(g.el('game') != null, file + ' has canvas');
  ok(g.test().state === 'playing' && g.test().menu() == null, file + ' Play starts the game (menu closes)');
  // simulate play: rotate, thrust, shoot for a while
  g.down('ArrowUp'); g.down(' ');
  g.step(120);
  g.up(' '); g.down('ArrowLeft'); g.step(60); g.up('ArrowLeft');
  g.down('ArrowRight'); g.step(60);
  ok(g.errors.length === 0, file + ' runs 240 frames of input without error: ' + g.errors[0]);
  const score = parseInt(g.el('score').textContent, 10);
  ok(Number.isFinite(score), file + ' score is numeric (' + g.el('score').textContent + ')');
  // weapon tiers are Enhanced-only: bare Classic hides the weapon HUD and never upgrades
  ok(enhanced ? (g.el('weapon').style.display !== 'none') : (g.el('weapon').style.display === 'none'),
    file + (enhanced ? ' shows weapon HUD' : ' hides weapon HUD (no tiers)'));
  if (enhanced) {
    // pause via Esc → kit pause menu; Resume closes it and resumes play
    g.down('Escape'); g.step(1);
    ok(g.test().menu() != null && g.test().state === 'paused', file + ' ESC opens the kit pause menu');
    g.test().menu().activate('resume'); g.step(1);
    ok(g.test().state === 'playing' && g.test().menu() == null, file + ' Resume closes the pause menu and resumes');
  }
}

function smokeSpeedrun(file) {
  section(file + ' (speedrun smoke)');
  const g = runGame(file, { search: '?speedrun=1' });
  ok(g.errors.length === 0, file + ' speedrun boots: ' + g.errors[0]);
  ok(g.el('timer').style.display === 'block', file + ' speedrun shows timer');
  g.down('Enter'); g.step(60);
  const t = g.el('timerVal').textContent;
  ok(/^\d\d:\d\d\.\d\d$/.test(t), file + ' timer formats mm:ss.cs (got ' + t + ')');
  ok(t !== '00:00.00', file + ' timer advances during play (got ' + t + ')');
  // in speedrun the share/Discord result is the TIME, not score/level → mode-aware message, never the Classic one
  const sm = g.test().shareMsg();
  ok(/Speedrun/.test(sm) && !/Classic|level /.test(sm) && /\d\d:\d\d\.\d\d/.test(sm),
    file + ' speedrun share leads with time, not score/level (got "' + sm + '")');
}

// ---------------- Core mechanics: shoot → score, collision → lives, death → end screen ----------------
function mechanics(file) {
  section(file + ' (mechanics: shoot/score, collision/lives, game over)');
  const g = runGame(file);
  const T = () => g.test();
  g.step(10);
  g.down('Enter'); g.step(2); // start via the kit menu
  ok(T().state === 'playing', file + ' game is playing');

  // shooting an asteroid raises the score: park one rock far away (so the field never empties
  // into an auto wave-respawn) + a big rock dead ahead of a pinned ship, then hold fire
  // (small rocks drift 2-3px/frame and can dodge the bullet line — a size-3 rock, r=56, can't)
  T().clearRocks();
  T().spawnRockAt(1200, 40, 1);   // parked survivor, far from the action
  T().setShip(400, 400, 0);       // aim east
  T().spawnRockAt(460, 400, 3);   // size-3 target right in front (first bullet can't miss)
  ok(T().rocks === 2, file + ' field staged with 2 rocks (got ' + T().rocks + ')');
  const s0 = T().score;
  g.down(' ');
  let fg = 0;
  while (T().score === s0 && fg++ < 60) { T().setShip(400, 400, 0); T().step(1); }
  g.up(' ');
  ok(T().score >= s0 + 20, file + ' shooting an asteroid raises the score (' + s0 + ' -> ' + T().score + ' in ' + fg + ' frames)');
  ok(T().rocks >= 2, file + ' the hit big rock split into fragments (got ' + T().rocks + ')');

  // ship–asteroid collision costs a life (invuln forced off; killShip respawns at center)
  const l0 = T().lives;
  T().setInvuln(0);
  T().setShip(300, 300, 0);
  T().spawnRockAt(300, 300, 2);   // rock on top of the ship
  T().step(1);
  ok(T().lives === l0 - 1, file + ' collision costs exactly 1 life (' + l0 + ' -> ' + T().lives + ')');
  ok(T().state === 'playing', file + ' run continues with lives remaining');

  // draining all lives reaches the end screen (kit menu + share message)
  let dg = 0;
  while (T().lives > 0 && T().state === 'playing' && dg++ < 10) {
    T().setInvuln(0);
    T().setShip(300, 300, 0);
    T().spawnRockAt(300, 300, 2);
    T().step(1);
  }
  ok(T().lives === 0, file + ' all lives drained (got ' + T().lives + ')');
  ok(T().state === 'dead', file + ' lives→0 ends the run (state=' + T().state + ')');
  ok(T().menu() != null, file + ' end screen (kit menu with share row) is shown');
  ok(typeof T().shareMsg() === 'string' && T().shareMsg().length > 0, file + ' share message is ready (' + T().shareMsg() + ')');
}

// ---------------- Run ----------------
// Asteroids = Classic + Enhanced (one engine, index.html, variant via ?v=classic|enh). The
// roguelite progressions moved to their own game — see games/asteroids-plus/test.mjs.
console.log('Running Asteroids headless tests…');

smokeClassic('index.html?v=classic');
smokeSpeedrun('index.html?v=classic');
smokeClassic('index.html?v=enh', { enhanced: true });
smokeSpeedrun('index.html?v=enh');
mechanics('index.html?v=classic');
mechanics('index.html?v=enh');

// ---------------- Layout regression: fits the screen, clears the top HUD ----------------
section('index.html?v=classic: layout fits the screen (no off-screen / HUD overlap)');
runLayoutSuite(
  () => { const g = runGame('index.html?v=classic'); g.test().start(); return g; },
  (g, v) => {
    g.step(1); // one frame so positions settle to the new viewport, as happens live
    ok(g.errors.length === 0, '[' + v.name + '] no error on resize: ' + (g.errors[0] || ''));
    const L = g.test().layout;
    // canvas is scaled (S) on small screens, so it won't equal the viewport — assert the scale model instead
    const m = Math.min(v.w, v.h), S = m < 640 ? Math.min(2.6, 900 / m) : 1;
    ok(L.W === Math.round(v.w * S) && L.H === Math.round(v.h * S),
      '[' + v.name + '] canvas matches scaled viewport (W=' + L.W + ' H=' + L.H + ' S=' + L.S.toFixed(2) + ')');
    ok(L.W > 0 && L.H > 0, '[' + v.name + '] canvas has positive size');
    // the ship (the only JS-positioned on-canvas actor) must be fully within 0..W / 0..H
    ok(L.shipLeft >= 0 && L.shipRight <= L.W, '[' + v.name + '] ship within horizontal bounds (' + L.shipLeft.toFixed(0) + '..' + L.shipRight.toFixed(0) + ' / ' + L.W + ')');
    ok(L.shipTop >= 0 && L.shipBottom <= L.H, '[' + v.name + '] ship within vertical bounds (' + L.shipTop.toFixed(0) + '..' + L.shipBottom.toFixed(0) + ' / ' + L.H + ')');
    // the ship must not sit under the top score HUD (its reserved headroom, in canvas px)
    ok(L.topReserve > 0, '[' + v.name + '] HUD reserves top headroom (' + L.topReserve.toFixed(0) + 'px canvas)');
    ok(L.shipTop >= L.topReserve, '[' + v.name + '] ship clears the top HUD (top=' + L.shipTop.toFixed(0) + ' >= reserve=' + L.topReserve.toFixed(0) + ')');
  },
  { size: false } // scaled-world canvas — the scale-model assert above replaces the raw W/H match
);

// ---------------- cosmetics: ship colours + CRT tint ----------------
section('cosmetics — ship skins');
{
  const runCos = (store) => bootGame('games/asteroids/index.html?v=classic', {
    seed: 0xA57E401D, preCode: [CHALLENGES, COSMETICS],
    store: { gamekit_pts_x10: '1', gamekit_flappy_migrated: '1', gamekit_done: JSON.stringify({ a: 100 }), ...(store || {}) },
  });
  const g = runCos();
  ok(g.errors.length === 0, 'boots with cosmetics loaded: ' + g.errors[0]);
  ok(g.win.gamekit.cosmetics.selected('asteroids.ship') === 'asteroids.ship.cyan', 'cosmetics ship defaults to cyan in-game (picked via the 🎨 modal)');
  // each ship colour (incl. the whole-game CRT tint) renders a run without error
  for (const key of ['cyan', 'emerald', 'crimson', 'violet', 'crt', 'gold']) {
    const id = 'asteroids.ship.' + key;
    const owned = {}; owned[id] = { c: 0, t: 0 };
    const g2 = runCos({ gamekit_owned: JSON.stringify(owned), gamekit_cos_sel: JSON.stringify({ 'asteroids.ship': id }) });
    ok(g2.win.gamekit.cosmetics.selected('asteroids.ship') === id, key + ': selection honoured');
    g2.down('Enter'); g2.down('ArrowUp'); g2.down(' '); g2.step(60);
    ok(g2.errors.length === 0, key + ': renders a run without errors' + (g2.errors.length ? ' — ' + g2.errors[0] : ''));
  }
  // buy with trophies: emerald costs 10, balance starts 100
  ok(g.win.gamekit.cosmetics.buy('asteroids.ship.emerald') === true && g.win.gamekit.cosmetics.balance() === 90, 'buy ship skin with trophies (90 left)');
}

summary();
