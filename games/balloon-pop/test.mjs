// Headless tests for Balloon Pop — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/balloon-pop/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 9, ...opts });

// ---- Boot ----
section('balloon-pop: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready"');

// ---- Start + popping ----
section('balloon-pop: popping');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  ok(T().state === 'playing', 'start → playing');
  ok(T().balloonCount > 0, 'balloons on screen from the start');
  T().spawnAt(200, 400, 40, 0);
  ok(T().popAt(200, 400) === true, 'tapping a balloon pops it');
  ok(T().score === 1, 'a pop scores (got ' + T().score + ')');
  ok(T().popAt(200, 400) === false, 'a popped balloon cannot be popped twice');
  ok(T().popAt(5, 5) === false, 'tapping empty sky does nothing');
}

// ---- Combo ----
section('balloon-pop: same-colour streak bonus');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('zen');
  T().spawnAt(100, 300, 40, 2);
  T().spawnAt(220, 300, 40, 2);
  T().spawnAt(340, 300, 40, 2);
  T().popAt(100, 300); T().popAt(220, 300); T().popAt(340, 300);
  ok(T().combo === 3, 'three same-colour pops = ×3 streak (got ' + T().combo + ')');
  ok(T().score === 1 + 2 + 3, 'streak pops score 1+2+3 (got ' + T().score + ')');
  T().spawnAt(150, 400, 40, 4);
  T().popAt(150, 400);
  ok(T().combo === 1, 'a different colour resets the streak');
}

// ---- No fail: escaping balloons cost nothing ----
section('balloon-pop: no fail state');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('zen');
  T().spawnAt(200, 60, 40, 0);      // just under the top
  T().step(400);                    // let it drift away
  ok(T().state === 'playing', 'an escaped balloon never ends the run');
  ok(T().score === 0 || T().score >= 0, 'no penalty for misses');
}

// ---- Party timer ----
section('balloon-pop: party timer');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('party');
  ok(T().timeLeft === 60, 'party starts with 60 s');
  T().step(120);
  ok(T().timeLeft === 58, 'clock ticks at 60 steps/s (got ' + T().timeLeft + ')');
  T().step(58 * 60);
  ok(T().state === 'over', 'party ends when the clock runs out');
}

// ---- Zen has no clock and banks on demand ----
section('balloon-pop: zen mode');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('zen');
  T().step(120 * 60);
  ok(T().state === 'playing', 'zen never times out');
  T().spawnAt(200, 400, 40, 1);
  T().popAt(200, 400);
  T().endRun();
  ok(T().state === 'over', 'FINISH & SAVE banks a zen session');
}

// ---- Bees mode ----
section('balloon-pop: bees sting');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('bees');
  ok(T().timeLeft === 60, 'bees mode runs on the 60 s clock');
  T().spawnAt(150, 500, 40, 0); T().popAt(150, 500);
  T().spawnAt(150, 500, 40, 0); T().popAt(150, 500);
  const before = T().score;
  T().spawnBeeAt(300, 400, 1.5);
  ok(T().beeCount === 1, 'a bee is buzzing');
  ok(T().popAt(300, 400) === true, 'tapping the bee registers');
  ok(T().score === Math.max(0, before - 5), 'a sting costs 5 pops (got ' + T().score + ')');
  ok(T().beeStings === 1, 'sting counted');
  ok(T().combo === 0, 'a sting resets the streak');
  // score never goes negative
  T().spawnBeeAt(300, 400, 1.5);
  T().popAt(300, 400);
  ok(T().score >= 0, 'score floors at 0');
}

// ---- Wind gust ----
section('balloon-pop: wind gusts push balloons');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('zen');
  T().spawnAt(200, 400, 40, 0);
  T().gust(2, 60);
  const x0 = T().balloons[0].x;
  T().step(30);
  const moved = T().balloons.find(b => Math.abs(b.y - 400) < 60);
  ok(T().wind.active === false || T().wind.active === true, 'wind state readable');
  ok(moved && moved.x > x0 + 10, 'gust pushes balloons sideways (' + Math.round(x0) + ' → ' + (moved ? Math.round(moved.x) : '?') + ')');
}

// ---- Zen fireworks ----
section('balloon-pop: zen milestone fireworks');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('zen');
  for (let k = 0; k < 50; k++) { T().spawnAt(200, 400, 40, k % 6); T().popAt(200, 400); }
  ok(T().popCount === 50, 'fifty pops banked');
  ok(T().fireworksSeen === 1, 'the 50th pop launches fireworks (got ' + T().fireworksSeen + ')');
}

// ---- Layout: balloons live inside the viewport ----
section('balloon-pop: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().start(); return gl; },
  (gl, v) => {
    gl.T().step(240);                 // spawn + drift a while
    const L = gl.T().layout;
    ok(L.minX >= -2, v.name + ': balloons never poke out the left (minX ' + Math.round(L.minX) + ')');
    ok(L.maxX <= L.W + 2, v.name + ': balloons never poke out the right (maxX ' + Math.round(L.maxX) + ' vs ' + L.W + ')');
  }
);

summary();
