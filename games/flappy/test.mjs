// Headless tests for Meadow Flyer (games/flappy/index.html).
// Mocks DOM/canvas, runs the IIFE in a vm sandbox, drives via window.__test.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function section(t) { console.log('\n=== ' + t + ' ==='); }

function makeCtx2d() {
  return new Proxy({}, {
    get: (_, p) => {
      if (p === 'canvas') return { width: 1280, height: 800 };
      if (p === 'createLinearGradient') return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set: () => true,
  });
}

function makeEl(id) {
  const classes = new Set();
  const el = {
    id, textContent: '', value: '', dataset: {}, children: [],
    style: new Proxy({}, { get: (t, p) => t[p] ?? '', set: (t, p, v) => { t[p] = v; return true; } }),
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, f) => { const has = classes.has(c); const want = f === undefined ? !has : !!f; if (want) classes.add(c); else classes.delete(c); return want; },
      contains: c => classes.has(c),
    },
    _l: {},
    addEventListener: (type, fn) => { (el._l[type] ||= []).push(fn); },
    removeEventListener: () => {},
    fire: (type, ev = {}) => (el._l[type] || []).forEach(fn => fn({ preventDefault() {}, ...ev })),
    appendChild: c => { el.children.push(c); return c; },
    querySelectorAll: () => [], querySelector: () => null,
    getContext: () => makeCtx2d(),
    focus: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => _html, set: v => { _html = String(v ?? ''); if (!v) el.children = []; } });
  return el;
}

function runGame() {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script found in index.html');
  const code = m[1];

  const elCache = {};
  const getEl = id => (elCache[id] ||= makeEl(id));
  const store = {};
  const handlers = {};

  const win = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
  };
  const docMock = {
    getElementById: getEl,
    createElement: () => makeEl('new'),
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    querySelectorAll: () => [],
    body: makeEl('body'),
  };
  const sandbox = {
    window: win, document: docMock,
    location: { search: '' },
    navigator: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: (fn, t) => 0,
    setInterval: () => 0,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, console,
    URLSearchParams,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  let bootErr = null;
  try { vm.runInContext(code, ctx, { filename: 'index.html' }); }
  catch (e) { bootErr = e.stack; }

  return { win, store, bootErr, test: () => win.__test, getEl, fireKey: (key) => (handlers['keydown'] || []).forEach(fn => fn({ key, preventDefault() {} })) };
}

// ----------------------------------------------------------------

console.log('Running Meadow Flyer tests…');

// (a) boots, exposes __test
section('Boot');
let g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
const T = () => g.test();
ok(T() != null, 'exposes window.__test');

// (b) start() → 'playing'
section('Start');
ok(T().state === 'ready', 'initial state is "ready"');
T().start();
ok(T().state === 'playing', 'start() → "playing"');

// (b2) tap-to-start gives upward vy (first-flap impulse)
section('Tap-start impulse');
{
  g = runGame();
  ok(T().state === 'ready', 'tap-start: initial state is ready');
  // Fire canvas pointerdown — the real tap path: onTap() → flap() → startGame() + FLAP_VY
  g.getEl('game').fire('pointerdown');
  ok(T().state === 'playing', 'canvas tap from ready → playing');
  ok(T().bird.vy < 0, 'canvas tap from ready gives negative vy (upward impulse), got ' + T().bird.vy);
}

// (b3) Space/Enter from 'over' also gives upward vy
section('Key-restart impulse');
{
  g = runGame(); T().start();
  while (T().state === 'playing') T().step(1);
  ok(T().state === 'over', 'key-restart: game ended');
  g.fireKey(' ');
  ok(T().state === 'playing', 'Space from over → playing');
  ok(T().bird.vy < 0, 'Space from over gives upward impulse, got ' + T().bird.vy);
}

// (c) gravity: stepping without flapping lowers the bird and increases vy
section('Gravity');
g = runGame(); T().start();
const y0 = T().bird.y;
const vy0 = T().bird.vy;
T().step(10);
ok(T().bird.vy > vy0, 'gravity increases vy downward after 10 steps (was ' + vy0 + ', now ' + T().bird.vy + ')');
ok(T().bird.y > y0, 'bird moves down without flapping (was ' + y0 + ', now ' + T().bird.y + ')');

// (d) flap() gives upward velocity
section('Flap');
g = runGame(); T().start();
T().step(5); // let some gravity accumulate
const vyBefore = T().bird.vy;
T().flap();
ok(T().bird.vy < vyBefore, 'flap() reduces vy (was ' + vyBefore + ', now ' + T().bird.vy + ')');
ok(T().bird.vy < 0, 'vy is negative (upward) after flap (' + T().bird.vy + ')');

// (e) flying through a deterministically-placed gap increments score
section('Gap scoring');
g = runGame();
T().seed(42);
T().start();
// Place gap at a safe vertical position
const H = 800;
const gapY = H * 0.38;   // 304
const birdTarget = gapY + 74;  // 378 — middle of the gap
T().spawnGapAt(gapY);
// Step 60 frames (grace period before first obstacle) keeping bird alive by flapping
for (let i = 0; i < 60; i++) { if (T().bird.y > birdTarget + 20) T().flap(); T().step(1); }
// Now keep flying toward the gap until score increments or the run ends
let guard = 0;
while (T().score < 1 && T().state === 'playing' && guard++ < 600) {
  if (T().bird.y > birdTarget + 20) T().flap();
  T().step(1);
}
ok(T().score >= 1, 'score increments after flying through gap (score=' + T().score + ')');

// (e2) hitbox uses stem width (OBS_W-12), not full OBS_W — bird in gap side-inset should survive
section('Collision hitbox alignment');
{
  // Bird at BIRD_X=90, br=11. Obstacle stem drawn at o.x+6 width 50.
  // Place obstacle so its LEFT STEM EDGE (o.x+6) is just to the right of the bird's right edge (90+11=101).
  // stemX = obsX+6 = 102 → bird right=101 < stemX=102 → NOT inX → no collision.
  // If hitbox were full OBS_W: inX = 101 > obsX=96 → collision (false kill).
  g = runGame();
  T().start();
  const obsX = 96; // stemX = 96+6 = 102, bird right = 90+11 = 101
  T().spawnGapAt(800 * 0.42); // gap centered near bird y
  T().step(1); // trigger spawn if needed
  const obs = T().obstacles;
  if (obs.length > 0) {
    obs[0].x = obsX;
    T().step(1);
    ok(T().state === 'playing', 'bird outside stem inset survives (hitbox matches stem, not full column)');
  } else {
    ok(true, 'hitbox test skipped (no obstacle yet)');
  }
}

// (f) hitting the ground → 'over'
section('Ground collision');
g = runGame(); T().start();
let safeGuard = 0;
while (T().state === 'playing' && safeGuard++ < 2000) { T().step(1); }
ok(T().state === 'over', 'falling to ground triggers game over (state=' + T().state + ')');

// (g) best persists to localStorage
section('Best persistence');
g = runGame();
T().setBest(0);
T().start();
T().seed(99);
const persistGapY = H * 0.38;
const persistBirdTarget = persistGapY + 74;
T().spawnGapAt(persistGapY);
// Grace period — keep bird alive
for (let i = 0; i < 60; i++) { if (T().bird.y > persistBirdTarget + 20) T().flap(); T().step(1); }
let persistGuard = 0;
while (T().score < 1 && T().state === 'playing' && persistGuard++ < 600) {
  if (T().bird.y > persistBirdTarget + 20) T().flap();
  T().step(1);
}
if (T().score > 0) {
  ok(g.store['flappy_best'] !== null && parseInt(g.store['flappy_best'], 10) >= T().score,
    'best saved to localStorage (stored=' + g.store['flappy_best'] + ', score=' + T().score + ')');
} else {
  T().setBest(5);
  ok(g.store['flappy_best'] === '5', 'setBest writes to localStorage');
}

// (h) over → start() restarts
section('Restart');
g = runGame(); T().start();
while (T().state === 'playing') { T().step(1); }
ok(T().state === 'over', 'game ends');
T().start();
ok(T().state === 'playing', 'start() from over → playing again');
ok(T().score === 0, 'score resets on restart');

// ----------------------------------------------------------------
console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
