// Headless tests for Frog Bonk — boots via the shared harness, drives window.__test.
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/frog-bonk/index.html';
const runGame = (opts) => bootGame(FILE, opts);
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');

const WIND = 9; // hammer wind-up steps (impact applies then) — mirrors the game const

// ---- Boot ----
section('frog-bonk: boot');
{
  const g = runGame();
  ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
  ok(g.T() != null, 'exposes window.__test');
  ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');
}

// ---- Whack mechanics ----
section('frog-bonk: hammer bonks frogs');
{
  const g = runGame({ seed: 7 });
  const T = g.T;
  T().startMode('waves', 'medium');
  ok(T().state === 'playing', 'startMode → playing');
  ok(T().wave === 1 && T().castleHp === 15 && T().score === 0, 'fresh run: wave 1, 15 HP, score 0');
  T().clearFrogs();
  const L = T().layout;
  T().spawnAt('scout', L.castle.x + 200, L.castle.y);
  ok(T().frogCount === 1, 'spawnAt adds a frog');
  T().whack(L.castle.x + 200, L.castle.y);
  ok(T().hammer.st === 'swing', 'whack starts the swing');
  T().step(WIND);
  ok(T().frogCount === 0, 'scout (1 HP) is launched at impact');
  ok(T().kills === 1, 'kill counted');
  ok(T().score === 10, 'scout scores 10 (got ' + T().score + ')');
  ok(T().combo === 1, 'combo chain starts');
  ok(T().hammer.st === 'recover', 'hammer recovers after the hit');
  // cooldown: a second whack during recover is ignored
  T().spawnAt('scout', L.castle.x - 200, L.castle.y);
  T().whack(L.castle.x - 200, L.castle.y);
  ok(T().hammer.st === 'recover', 'whack during cooldown is ignored');
}

section('frog-bonk: multi-HP frogs + combo scoring');
{
  const g = runGame({ seed: 7 });
  const T = g.T;
  T().startMode('waves', 'medium');
  T().clearFrogs();
  const L = T().layout;
  T().spawnAt('knight', L.castle.x + 220, L.castle.y);
  T().whack(L.castle.x + 220, L.castle.y); T().step(WIND);
  ok(T().frogCount === 1, 'knight survives the first bonk (2 HP)');
  ok(T().frogs[0].hp === 1, 'knight is at 1 HP');
  T().step(30); // recover
  const f = T().frogs[0];
  T().whack(f.x, f.y); T().step(WIND);
  ok(T().frogCount === 0, 'second bonk launches the knight');
  // combo: kill lands as the 2nd chain hit → 25 * 1.1 = 27.5 → 28
  ok(T().score === 28, 'combo multiplies the kill score (got ' + T().score + ')');
  ok(T().flies >= 2, 'kills drop flies in waves mode (got ' + T().flies + ')');
}

section('frog-bonk: whiff penalty resets the combo');
{
  const g = runGame({ seed: 7 });
  const T = g.T;
  T().startMode('waves', 'medium');
  T().clearFrogs();
  const L = T().layout;
  T().spawnAt('scout', L.castle.x + 200, L.castle.y);
  T().whack(L.castle.x + 200, L.castle.y); T().step(WIND);
  ok(T().combo === 1, 'combo 1 after a hit');
  T().step(30);
  T().whack(L.castle.x - 300, L.castle.y - 100); // empty grass
  T().step(WIND);
  ok(T().combo === 0, 'whiff resets the combo');
  ok(T().hammer.st === 'recover' && T().hammer.t > 20, 'whiff recovery is longer than a hit');
}

// ---- Castle damage / game over ----
section('frog-bonk: frogs chomp the castle; game over at 0');
{
  const g = runGame({ seed: 3 });
  const T = g.T;
  T().startMode('waves', 'medium');
  T().clearFrogs();
  const L = T().layout;
  T().spawnAt('scout', L.castle.x + L.castle.r + 5, L.castle.y); // already at the wall
  T().step(40 + 90); // sit expires → latch → first bite
  ok(T().castleHp < 15, 'latched frog damages the castle (hp ' + T().castleHp + ')');
  T().setCastleHp(1);
  T().step(200); // next bite finishes it
  ok(T().state === 'over', 'castle at 0 → game over (state ' + T().state + ')');
  ok(T().menu() != null, 'end menu is shown');
  T().menu().activate('again');
  ok(T().state === 'playing' && T().score === 0, 'Play Again restarts cleanly');
}

section('frog-bonk: mage casts a telegraphed bolt from range');
{
  const g = runGame({ seed: 5 });
  const T = g.T;
  T().startMode('waves', 'hard');
  T().clearFrogs();
  const L = T().layout;
  T().spawnAt('mage', L.castle.x + L.castle.r + 118, L.castle.y); // at casting range
  const hp0 = T().castleHp;
  T().step(40 + 130 + 30 + 5); // sit → cast telegraph → bolt flight
  ok(T().castleHp === hp0 - 1, 'mage bolt deals 1 castle damage (hp ' + T().castleHp + ')');
}

// ---- Waves / shop ----
section('frog-bonk: wave clear opens the shop; upgrades apply');
{
  const g = runGame({ seed: 11 });
  const T = g.T;
  T().startMode('waves', 'medium');
  T().clearFrogs();               // empty queue + no frogs → next update clears the wave
  T().setCastleHp(10);
  T().step(1);
  ok(T().state === 'shop', 'clearing wave 1 opens the shop (state ' + T().state + ')');
  ok(T().score >= 25, 'wave-clear bonus scored');
  ok(T().flies === 5, 'wave clear pays a fly bonus (got ' + T().flies + ')');
  ok(T().castleHp === 12, 'castle regens +2 between waves (hp ' + T().castleHp + ')');
  T().setFlies(200);
  T().buyUpgrade('walls');
  ok(T().castleMax === 20, 'Stone Walls raise max HP (got ' + T().castleMax + ')');
  T().buyUpgrade('moat');
  T().buyUpgrade('ballista');
  ok(T().upgrades.moat === 1 && T().upgrades.ballista === 1, 'moat + ballista bought');
  ok(T().flies === 200 - 12 - 15 - 20, 'flies spent (got ' + T().flies + ')');
  T().setCastleHp(T().castleMax); // top up, then a repair must be refused
  T().buyUpgrade('repair');
  ok(T().flies === 153, 'repair refused at full HP (flies ' + T().flies + ')');
  T().buyUpgrade('walls'); T().buyUpgrade('walls'); T().buyUpgrade('walls'); // hits the max-3 cap
  ok(T().upgrades.walls === 3, 'walls cap at 3');
  T().closeShop();
  ok(T().state === 'playing' && T().wave === 2, 'shop closes into wave 2');
  ok(T().spawnQueueLen > 0, 'wave 2 has a spawn queue');
}

// ---- Endless / zen ----
section('frog-bonk: endless spawns forever');
{
  const g = runGame({ seed: 13 });
  const T = g.T;
  T().startMode('endless', 'medium');
  T().step(400);
  ok(T().frogCount > 0, 'endless keeps spawning frogs (got ' + T().frogCount + ')');
  ok(T().state === 'playing', 'no shop in endless');
}

section('frog-bonk: zen — invulnerable castle, finish & save');
{
  const g = runGame({ seed: 17 });
  const T = g.T;
  T().startMode('zen');
  T().clearFrogs();
  const L = T().layout;
  T().spawnAt('brute', L.castle.x + L.castle.r + 5, L.castle.y);
  T().step(500);
  ok(T().castleHp === T().castleMax, 'zen castle takes no damage');
  for (let i = 0; i < 3 && T().frogCount > 0; i++) {
    const f = T().frogs.find(x => x.type === 'brute' && x.ph !== 'out');
    if (!f) break;
    T().whack(f.x, f.y); T().step(WIND); T().step(30);
  }
  ok(T().kills === 1, 'brute takes 3 bonks in zen too (kills ' + T().kills + ')');
  T().finishZen();
  ok(T().state === 'over', 'Finish & save ends the zen run');
  const pb = JSON.parse(g.store['gamekit_pb'] || '{}');
  ok(((pb['frog-bonk'] || {})['Zen'] || {}).score > 0, 'zen result recorded under the Zen label');
}

// ---- Persistence / deep links ----
section('frog-bonk: best persistence + deep links');
{
  const g = runGame({ seed: 7 });
  const T = g.T;
  T().startMode('waves', 'medium');
  T().clearFrogs();
  const L = T().layout;
  T().spawnAt('scout', L.castle.x + 200, L.castle.y);
  T().whack(L.castle.x + 200, L.castle.y); T().step(WIND);
  const sc = T().score;
  T().setCastleHp(1);
  T().spawnAt('brute', L.castle.x + L.castle.r + 5, L.castle.y);
  T().step(400);
  ok(T().state === 'over', 'run ends');
  const pb = JSON.parse(g.store['gamekit_pb'] || '{}');
  ok(((pb['frog-bonk'] || {})['Waves · Medium'] || {}).score >= sc, 'best persisted under "Waves · Medium"');

  const g2 = runGame({ store: { gamekit_pb: JSON.stringify({ 'frog-bonk': { 'Waves · Hard': { score: 777 } } }) } });
  ok(g2.T().best_('waves', 'hard') === 777, 'seeded best read back');

  const g3 = runGame({ search: '?mode=endless&diff=hard' });
  ok(g3.T().mode === 'endless' && g3.T().diff === 'hard', 'deep link preselects mode + difficulty');
}

// ---- Cosmetics render without errors ----
section('frog-bonk: hammer + meadow skins render');
{
  const g = runGame({ seed: 7, preCode: [CHALLENGES, COSMETICS], store: {
    gamekit_owned: JSON.stringify({ 'frog-bonk.hammer.candy': { c: 0, t: 0 }, 'frog-bonk.meadow.snow': { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'frog-bonk.hammer': 'frog-bonk.hammer.candy', 'frog-bonk.meadow': 'frog-bonk.meadow.snow' }),
  } });
  g.T().startMode('waves', 'medium');
  const L = g.T().layout;
  g.T().spawnAt('scout', L.castle.x + 200, L.castle.y);
  g.T().whack(L.castle.x + 200, L.castle.y);
  g.T().step(20);
  g.step(5); // a few display frames so render() runs with the skins applied
  ok(g.errors.length === 0, 'candy hammer + snowy meadow render without errors: ' + (g.errors[0] || ''));
}

// ---- Layout: on-screen + HUD headroom in portrait / landscape / desktop ----
section('frog-bonk: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame({ seed: 7 }); gl.T().startMode('waves', 'medium'); return gl; },
  (gl, v, L) => {
    gl.T().step(1);
    const l = gl.T().layout;
    ok(l.castleTop >= l.topReserve, v.name + ': castle tower clears the HUD (top ' + Math.round(l.castleTop) + ' >= ' + l.topReserve + ')');
    ok(l.castle.x - l.castle.r >= 0 && l.castle.x + l.castle.r <= l.W, v.name + ': castle within width');
    ok(l.castleBottom <= l.H, v.name + ': castle within height');
  }
);

summary();
