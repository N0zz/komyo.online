// Headless tests for Glow Says — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/glow-says/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 3, ...opts });

// ---- Boot ----
section('glow-says: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready"');

// ---- Start + playback ----
section('glow-says: start + sequence playback');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  ok(T().state === 'playing', 'start → playing');
  ok(T().seq.length === 1, 'round 1 has a 1-note sequence');
  ok(T().padCount === 4, 'classic uses 4 pads');
  ok(T().phase === 'show', 'playback starts in the show phase');
  T().step(300);
  ok(T().phase === 'input', 'playback hands over to input (got ' + T().phase + ')');
}

// ---- Correct repeat grows the tune ----
section('glow-says: repeating correctly advances the round');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().forceSeq([0, 1, 2]);
  T().toInput();
  ok(T().tap(0) === true, 'first correct tap accepted');
  ok(T().tap(1) === true, 'second correct tap accepted');
  ok(T().tap(2) === true, 'third correct tap accepted');
  ok(T().round === 3, 'full repeat banks round 3 (got ' + T().round + ')');
  ok(T().phase === 'yay', 'celebration phase after a full repeat');
  T().step(60);
  ok(T().seq.length === 4, 'next round adds one note (got ' + T().seq.length + ')');
  ok(T().phase === 'show' || T().phase === 'input', 'the longer tune plays back again');
}

// ---- Wrong tap: classic ends, chill forgives ----
section('glow-says: mistakes');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().forceSeq([0, 1]);
  T().toInput();
  T().tap(3);
  ok(T().state === 'over', 'classic: one wrong tap ends the run');

  const gc = runGame();
  const C = gc.T;
  C().startMode('chill');
  C().forceSeq([0, 1]);
  C().toInput();
  C().tap(3);
  ok(C().state === 'playing', 'chill: wrong tap keeps playing (no fail)');
  ok(C().phase === 'oops', 'chill: wrong tap replays the tune');
  C().step(120);
  ok(C().phase === 'input' || C().phase === 'show', 'chill: recovers back into the loop');
}

// ---- Input gating ----
section('glow-says: taps ignored outside the input phase');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  ok(T().phase === 'show', 'in show phase right after start');
  ok(T().tap(0) === false, 'taps during playback are ignored');
}

// ---- Hard + Expert ----
section('glow-says: hard and expert modes');
{
  const gs = runGame();
  const T = gs.T;
  T().startMode('hard');
  ok(T().padCount === 6, 'hard uses 6 pads');
  T().startMode('expert');
  ok(T().padCount === 9, 'expert uses 9 pads (3×3)');
  T().forceSeq([7, 8]);
  T().toInput();
  ok(T().tap(7) === true && T().tap(8) === true, 'pads 8 and 9 are tappable');
  ok(T().round === 2, 'expert banks the round');
}

// ---- Score = longest full repeat ----
section('glow-says: scoring');
{
  const gs = runGame();
  const T = gs.T;
  T().start();
  T().forceSeq([1]);
  T().toInput();
  T().tap(1);
  ok(T().score === 1, 'one full repeat = score 1');
  T().step(60);            // into round 2 playback
  T().toInput();
  T().tap(9);              // out-of-range = no-op, then a real wrong tap
  T().tap((T().seq[0] + 1) % 4 === T().seq[0] ? 3 : (T().seq[0] + 1) % 4);
  ok(T().state === 'over', 'failing round 2 ends the run');
  ok(T().score === 1, 'score keeps the last COMPLETED round (got ' + T().score + ')');
}

// ---- Layout ----
section('glow-says: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().startMode('expert'); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    ok(L.board.y >= L.topReserve, v.name + ': pads clear the HUD');
    ok(L.board.x >= 0 && L.board.x + L.board.w <= L.W, v.name + ': pads within width');
    ok(L.board.y + L.board.h <= L.H, v.name + ': pads within height');
    ok(L.pads.length === 9, v.name + ': nine pads laid out');
    ok(L.pads.every(p => p.w >= 60), v.name + ': pads stay kid-big (min ' + Math.round(Math.min(...L.pads.map(p => p.w))) + 'px)');
  }
);

summary();
