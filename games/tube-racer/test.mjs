// Headless tests for Tube Racer — boots via the shared harness, drives window.__test.
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/tube-racer/index.html';
const runGame = (opts) => bootGame(FILE, opts);
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');

const pb = (store, mode) => {
  try { return (JSON.parse(store['gamekit_pb'] || '{}')['tube-racer'] || {})[mode] || {}; }
  catch (e) { return {}; }
};

// a track with nothing on it — every mechanic test controls its own hazards
function clean(opts) {
  const g = runGame(opts);
  g.T().start();
  g.T().clearTrack();
  return g;
}

// Drive the run into an unavoidable wall repeatedly until it's over. Each wall is placed far
// enough ahead that the post-hit invulnerability (0.9s) has expired before it arrives —
// otherwise only the FIRST wall ever lands and the run never ends.
function killWithWalls(g, guardMax) {
  let guard = 0;
  while (g.T().state === 'playing' && guard < (guardMax || 12)) {
    const before = g.T().hull;
    g.T().addFeat({ k: 'wall', z: g.T().dist + 26, len: 1.5, a: 0, w: Math.PI * 2 - 0.1 });
    let k = 0;
    while (g.T().state === 'playing' && k < 900 && g.T().hull === before) { g.T().step(1); k++; }
    guard++;
  }
}

section('Tube Racer: boot');
{
  const g = runGame();
  ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
  ok(g.T() != null, 'exposes window.__test');
  ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');
  ok(g.T().mode === 'classic', 'default mode is classic');
  ok(g.errors.length === 0, 'no render errors on the start screen');
}

section('Tube Racer: deep-link preselects the mode');
{
  const g = runGame({ search: '?mode=redline' });
  ok(g.T().mode === 'redline', '?mode=redline preselects the mode');
}

section('Tube Racer: rolling + steering direction');
{
  const g = clean();
  const a0 = g.T().ang;
  g.T().hold('ArrowRight', true);
  g.T().step(20);
  g.T().hold('ArrowRight', false);
  // bike is pinned at screen-bottom, so rolling RIGHT must sweep the world's angle DOWN
  let d = g.T().ang - a0; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  ok(d < -0.3, 'holding → rolls the world the other way (delta ' + d.toFixed(2) + ')');
  // released roll coasts down (there IS momentum by design) — assert it decays, not that
  // it stops dead: the rate over the second 20 frames must be a fraction of the first 20
  const av0 = Math.abs(g.T().av);
  g.T().step(20); const av1 = Math.abs(g.T().av);
  g.T().step(20); const av2 = Math.abs(g.T().av);
  ok(av1 < av0 * 0.2, 'roll rate decays fast once released (' + av0.toFixed(2) + ' → ' + av1.toFixed(2) + ')');
  ok(av2 < 0.05, 'roll comes to a rest (' + av2.toFixed(3) + ')');
}

section('Tube Racer: boost heats, cooling strips shed heat');
{
  const g = clean();
  g.T().hold('Space', true);
  g.T().step(60);
  const hot = g.T().heat;
  ok(hot > 0.12, 'one second of boost raises heat (' + hot.toFixed(2) + ')');
  ok(g.T().spd > 20, 'boost accelerates well past cruise (' + g.T().spd.toFixed(1) + ')');
  g.T().addFeat({ k: 'cool', z: g.T().dist, len: 400, a: g.T().ang - 0.4, w: 0.8 });
  g.T().step(30);
  ok(g.T().heat < hot - 0.1, 'riding a cooling strip sheds heat (' + g.T().heat.toFixed(2) + ')');
  g.T().hold('Space', false);
}

section('Tube Racer: sustained boost overheats and ends the run');
{
  const g = clean();
  g.T().hold('Space', true);
  let n = 0; while (g.T().state === 'playing' && n < 600) { g.T().step(1); n++; }
  g.T().hold('Space', false);
  ok(g.T().state === 'over', 'overheating ends the run');
  ok(n > 300 && n < 700, 'it takes 5–11.6s of solid boost to melt (' + (n / 60).toFixed(2) + 's)');
}

section('Tube Racer: obstacle gaps are passable, walls cost hull');
{
  const g = clean();
  const T = g.T;
  const gap = 2.4;
  T().addFeat({ k: 'wall', z: T().dist + 30, len: 1.5, a: T().ang + gap / 2, w: Math.PI * 2 - gap });
  let n = 0; while (T().dist < 40 && n < 600) { T().step(1); n++; }
  ok(T().hull === 3, 'flying through the gap costs no hull');
  ok(T().state === 'playing', 'still alive after a passable wall');

  const g2 = clean();
  g2.T().addFeat({ k: 'beam', z: g2.T().dist + 20, len: 1.5, a: g2.T().ang - 0.5, w: 1.0 });
  let m = 0; while (g2.T().dist < 30 && m < 600) { g2.T().step(1); m++; }
  ok(g2.T().hull === 2, 'clipping a beam costs exactly one hull (got ' + g2.T().hull + ')');
}

section('Tube Racer: a scrape can never kill you by overheating');
{
  // the bug: hit heat was a flat +0.2, so a scrape at 80% heat hit 100% and the overheat check
  // (which runs BEFORE collisions in the frame) killed the run on the next tick — with hull left
  for (const start of [0.72, 0.8, 0.95]) {
    const g = clean();
    g.T().setHeat(start);
    g.T().addFeat({ k: 'beam', z: g.T().dist + 20, len: 1.5, a: g.T().ang - 0.5, w: 1.0 });
    let n = 0; while (g.T().hull === 3 && n < 600) { g.T().step(1); n++; }
    ok(g.T().hull === 2, 'heat ' + start + ': the scrape costs a hull');
    g.T().step(3);
    ok(g.T().state === 'playing', 'heat ' + start + ': still alive after the scrape (2 hull left)');
    ok(g.T().heat <= Math.max(start, 0.85) + 1e-6, 'heat ' + start + ': a scrape cannot push heat past 85% (' + g.T().heat.toFixed(2) + ')');
  }
  // it must still COST something — compare against the frame BEFORE impact, not the value at
  // setup (heat passively vents while you coast toward the obstacle)
  const g2 = clean();
  g2.T().setHeat(0.2);
  g2.T().addFeat({ k: 'beam', z: g2.T().dist + 20, len: 1.5, a: g2.T().ang - 0.5, w: 1.0 });
  let m = 0, prev = g2.T().heat;
  while (g2.T().hull === 3 && m < 600) { prev = g2.T().heat; g2.T().step(1); m++; }
  ok(g2.T().heat > prev + 0.05, 'a scrape still costs real thermal headroom (' + prev.toFixed(2) + ' → ' + g2.T().heat.toFixed(2) + ')');
  // and losing the LAST hull is still a crash, not an overheat
  const g3 = clean();
  g3.T().setHeat(0.84);
  killWithWalls(g3);
  ok(g3.T().state === 'over', 'running out of hull ends the run');
}

section('Tube Racer: shear plates break the magnetic lock');
{
  const g = clean();
  const T = g.T;
  T().addFeat({ k: 'shear', z: T().dist + 10, len: 1.2, a: 0, w: Math.PI * 2 });
  let n = 0; while (T().lock <= 0 && n < 400) { T().step(1); n++; }
  ok(T().lock > 0, 'passing a shear plate breaks the lock');
  ok(T().hull === 3, 'a shear plate costs no hull — it costs control');
  const before = T().ang;
  T().hold('ArrowRight', true); T().step(10); T().hold('ArrowRight', false);
  ok(Math.abs(T().ang - before) < 0.02, 'steering is dead while the lock is broken');
}

section('Tube Racer: score rate rises with Mach');
{
  const slow = clean();
  slow.T().step(60);
  const slowGain = slow.T().score;

  const fast = clean();
  fast.T().hold('Space', true);
  fast.T().step(90);
  const mid = fast.T().score;
  fast.T().step(60);
  const fastGain = fast.T().score - mid;
  fast.T().hold('Space', false);
  ok(fastGain > slowGain * 2, 'a boosted second scores 2x+ a cruising one (' + Math.round(fastGain) + ' vs ' + Math.round(slowGain) + ')');
  ok(fast.T().mach > 1, 'full boost breaks Mach 1 (' + fast.T().mach.toFixed(2) + ')');
}

section('Tube Racer: modes');
{
  const cr = runGame(); cr.T().startMode('cruise'); cr.T().clearTrack();
  ok(cr.T().hull === 5, 'Cruise gives five hulls');
  cr.T().setHeat(0.99);
  cr.T().step(30);
  ok(cr.T().state === 'playing', 'Cruise never explodes from heat');

  const rl = runGame(); rl.T().startMode('redline'); rl.T().clearTrack();
  rl.T().step(90);
  ok(rl.T().mach > 1, 'Redline boosts without input (' + rl.T().mach.toFixed(2) + ')');
  ok(rl.T().hull === 2, 'Redline gives two hulls');

  const one = runGame(); one.T().startMode('classic'); one.T().clearTrack();
  ok(one.T().mode === 'classic', 'there is a single Classic curve — no difficulty variants');
}

section('Tube Racer: Sprint records a TIME in milliseconds, only on a clear');
{
  const g = runGame(); g.T().startMode('sprint'); g.T().clearTrack();
  let n = 0; while (g.T().state === 'playing' && n < 60 * 60 * 5) { g.T().step(1); n++; }
  ok(g.T().cleared === true, 'reaching 3000 m clears the sprint');
  const rec = pb(g.store, 'Sprint');
  ok(rec.time > 0, 'a cleared sprint stores a time (' + rec.time + 'ms)');
  ok(rec.time === Math.round(n / 60 * 1000), 'stored time is MILLISECONDS, exact (' + rec.time + ' vs ' + Math.round(n / 60 * 1000) + ')');

  // a failed sprint must NOT store a time — the store keeps the MIN, so a fast death
  // would beat a real clear forever
  const g2 = runGame(); g2.T().startMode('sprint'); g2.T().clearTrack();
  g2.T().step(60);
  killWithWalls(g2);
  ok(g2.T().state === 'over', 'three walls end the sprint');
  ok(g2.T().cleared === false, 'a dead sprint is not a clear');
  const rec2 = pb(g2.store, 'Sprint');
  ok(!rec2.time, 'a failed sprint records time 0 (got ' + rec2.time + ')');

  // ...and the START MENU has to show that time. The Sprint card was hardcoded to a best of 0, so
  // it read "BEST 0" forever — a stored record the player could never see.
  const fresh = runGame();
  ok(fresh.T().cardBest('sprint') === '—', 'with no sprint record the card shows a dash, not 0');
  ok(typeof fresh.T().cardBest('classic') === 'number', 'score modes still show a number');
  const withPb = runGame({ store: { gamekit_pb: JSON.stringify({ 'tube-racer': {
    Sprint: { score: 2204, time: 83450, plays: 2 }, Classic: { score: 14238, plays: 9 } } }) } });
  ok(withPb.T().cardBest('sprint') === '01:23.45', 'the sprint card shows the best TIME as mm:ss.cs (got ' + withPb.T().cardBest('sprint') + ')');
  ok(withPb.T().cardBest('classic') === 14238, 'the classic card still shows the best score');
}

section('Tube Racer: best score persists + end menu flow');
{
  const g = clean();
  g.T().step(240);
  const sc = g.T().score;
  ok(sc > 0, 'cruising accumulates score');
  killWithWalls(g);
  ok(g.T().state === 'over', 'losing all hull ends the run');
  ok(pb(g.store, 'Classic').score >= Math.floor(sc), 'best persisted >= score at death');
  ok(g.T().menu() != null, 'kit end menu is shown on game over');
  g.T().menu().activate('again');
  ok(g.T().state === 'playing', 'Play Again starts a new run');
  ok(g.T().score === 0, 'Play Again resets the score');
  ok(g.T().hull === 3, 'Play Again restores hull');
}

section('Tube Racer: seeded track generation is reproducible');
{
  const a = runGame({ search: '?seed=4242' }); a.T().start();
  const b = runGame({ search: '?seed=4242' }); b.T().start();
  a.T().step(200); b.T().step(200);
  ok(a.T().feats === b.T().feats, 'same seed generates the same feature count (' + a.T().feats + ')');
  ok(Math.abs(a.T().dist - b.T().dist) < 1e-9, 'same seed runs identically');
}

section('Tube Racer: pause freezes the run');
{
  const g = clean();
  g.T().step(30);
  const d = g.T().dist;
  g.T().pause();
  ok(g.T().state === 'paused', 'pause enters the paused state');
  g.T().step(60);
  ok(g.T().dist === d, 'no travel while paused');
  g.T().resume();
  ok(g.T().state === 'playing', 'resume returns to play');
}

section('Tube Racer: cosmetic skins render');
{
  const g = runGame({ preCode: [CHALLENGES, COSMETICS], store: {
    gamekit_owned: JSON.stringify({ 'tube-racer.tube.vapor': { c: 0, t: 0 }, 'tube-racer.bike.fox': { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'tube-racer.tube': 'tube-racer.tube.vapor', 'tube-racer.bike': 'tube-racer.bike.fox' }),
  } });
  g.T().start();
  g.step(5);
  ok(g.errors.length === 0, 'vapor tube + fox bike render without errors: ' + g.errors[0]);
}

section('Tube Racer: Mach 2 is reachable — but only boost + an acceleration lane');
{
  // boost alone must NOT reach Mach 2 (that was the old bug: the HUD promised a speed the
  // physics capped at Mach 1.68)
  // hold heat at zero with a cooling strip so this measures SPEED, not survival
  const g = clean();
  g.T().addFeat({ k: 'cool', z: g.T().dist, len: 4000, a: g.T().ang - 0.5, w: 1.0 });
  g.T().hold('Space', true); g.T().step(180);
  const boostOnly = g.T().mach;
  ok(boostOnly > 1.6 && boostOnly < 1.8, 'boost alone tops out just under Mach 1.7 (' + boostOnly.toFixed(2) + ')');

  // an acceleration lane STACKS with boost
  g.T().addFeat({ k: 'acc', z: g.T().dist, len: 4000, a: g.T().ang - 0.3, w: 0.7 });
  g.T().step(180);
  ok(g.T().mach > 2, 'boost + acceleration lane breaks Mach 2 (' + g.T().mach.toFixed(2) + ')');
  g.T().hold('Space', false);
}

section('Tube Racer: overheat warning gives a real ~2s, not two red flashes');
{
  const g = clean();
  g.T().hold('Space', true);
  let firstAlarm = -1, n = 0;
  while (g.T().state === 'playing' && n < 600) {
    g.T().step(1); n++;
    if (firstAlarm < 0 && g.T().alarm > 0) firstAlarm = n;
  }
  g.T().hold('Space', false);
  const warned = (n - firstAlarm) / 60;
  ok(firstAlarm > 0, 'the alarm fires before death');
  // amber at 68% heat → (1-0.68)/0.15 = 2.13s of runway at the halved boost rate
  ok(warned > 1.7 && warned < 2.7, 'first warning lands ~2.1s before death (' + warned.toFixed(2) + 's)');

  // the alarm holds for as long as you are IN the zone — not only while the needle climbs
  const g2 = clean();
  // ~5.3s of boost to reach the alarm band at the halved heat rate (heat ≈ 0.80)
  g2.T().hold('Space', true); g2.T().step(320);
  ok(g2.T().alarm > 0 && g2.T().rising, 'alarm is live while heat climbs (heat ' + g2.T().heat.toFixed(2) + ')');
  g2.T().hold('Space', false); g2.T().step(4);
  ok(!g2.T().rising, 'heat is no longer rising once boost is released');
  ok(g2.T().alarm > 0, 'the alarm KEEPS sounding while still in the danger zone');
  // it clears only by actually leaving the zone
  g2.T().setHeat(0.3); g2.T().step(2);
  ok(g2.T().alarm === 0, 'alarm clears once heat drops out of the zone');

  // THE BUG THIS REPLACED: severity was projected from the INSTANTANEOUS heat rate, so the
  // same heat gave a different warning depending on how you got there — coast to 95% (rate
  // negative → silent), then commit to boost, and the projection collapsed to ~0.17s. The tier
  // must depend on the heat LEVEL alone.
  const tierAt = (h, boosting) => {
    const g = clean();
    g.T().setHeat(h);
    if (boosting) g.T().hold('Space', true);
    g.T().step(1);
    const t = g.T().alarm;
    if (boosting) g.T().hold('Space', false);
    return t;
  };
  for (const h of [0.70, 0.82, 0.92]) {
    ok(tierAt(h, true) === tierAt(h, false),
       'heat ' + h + ' reports the same tier whether boosting or coasting (' + tierAt(h, true) + ')');
  }
  // the klaxon must ACCELERATE, not step from one blip straight to max tempo: the interval is
  // recomputed live from heat, so it has to fall monotonically as heat climbs
  {
    const g = clean();
    const ivs = [0.68, 0.74, 0.80, 0.86, 0.92, 0.98].map(h => { g.T().setHeat(h); g.T().step(1); return g.T().warnInterval; });
    let mono = true;
    for (let i = 1; i < ivs.length; i++) if (ivs[i] > ivs[i - 1] + 1e-9) mono = false;
    ok(mono, 'klaxon interval falls monotonically with heat (' + ivs.map(v => v.toFixed(2)).join(' → ') + ')');
    ok(ivs[0] > ivs[3] * 1.5, 'the slow end is clearly slower than the fast end');
    ok(Math.abs(ivs[4] - ivs[5]) < 1e-6, 'interval is pinned at its floor past the critical threshold');
    // and the slowest gap must fit inside the zone several times over, or there is no ramp to hear
    ok(ivs[0] < (1 - 0.68) / 0.15 / 3, 'slowest gap fits 3+ times in the danger window (' + ivs[0].toFixed(2) + 's)');
  }
  ok(tierAt(0.60, true) === 0, 'silent through ordinary boosting, below 68% heat');
  ok(tierAt(0.70, true) === 1, 'tier 1 (amber) at 68% heat');
  ok(tierAt(0.82, true) === 2, 'tier 2 (red) at 80% heat');
  ok(tierAt(0.90, true) === 3, 'tier 3 (critical) at 88% heat');
}

section('Tube Racer: friction bands heat you, and the pipe never shrinks');
{
  const g = clean();
  const r0 = g.T().layout.wallR;
  g.T().addFeat({ k: 'friction', z: g.T().dist, len: 300, a: 0, w: Math.PI * 2 });
  const h0 = g.T().heat;
  g.T().step(60);
  ok(g.T().heat > h0, 'a friction band raises heat with no boost (' + g.T().heat.toFixed(3) + ')');
  ok(Math.abs(g.T().layout.wallR - r0) < 0.01, 'the pipe radius is unchanged — no shrink effect');
}

section('Tube Racer: mechanics unlock by score, and Cruise caps them');
{
  const g = clean();
  ok(g.T().tier === 0, 'a fresh run starts at tier 0 (walls and beams only)');
  g.T().setScore(3600); g.T().step(2);
  ok(g.T().tier >= 2, 'crossing 3.5k unlocks through the shear tier (tier ' + g.T().tier + ')');
  g.T().setScore(10100); g.T().step(2);
  ok(g.T().tier === 6, '10k unlocks the final tier');

  // The X-cross quarters the pipe: 25% blocked · 25% open · 25% blocked · 25% open, one rigid
  // assembly so both gaps stay 90° however it sits. It arrives STATIC and only spins past 12k.
  // `x` carries the hub-spoke tell that separates it from a rotor (same magenta, same bars).
  const TAU2 = Math.PI * 2;
  const crossSurvey = (score, seed) => {
    const t = runGame({ seed });
    t.T().startMode('classic'); t.T().setScore(score); t.T().step(2);
    const out = { cross: 0, spinning: 0, rotor: 0, mistagged: 0, badSplit: 0 };
    for (let f = 0; f < 60 * 90 && t.T().state === 'playing'; f++) {
      t.T().setHeat(0.1); if (t.T().score < score - 300) t.T().setScore(score);
      t.T().step(1);
      const byZ = new Map();
      for (let i = 0; i < t.T().feats; i++) {
        const ft = t.T().featAt(i); if (!ft || ft.k !== 'beam') continue;
        const k = ft.z.toFixed(2); if (!byZ.has(k)) byZ.set(k, []);
        const arr = byZ.get(k); if (!arr.some(v => v.x === ft.x && Math.abs(v.a - ft.a) < 1e-9)) arr.push(ft);
      }
      for (const arr of byZ.values()) {
        if (arr.some(v => v.x)) {
          out.cross++;
          if (!arr.every(v => v.x)) out.mistagged++;
          // exactly two 90° blocks, 180° apart → the 25/25/25/25 split
          const blocks = arr.filter(v => v.x);
          const wOk = blocks.length === 2 && blocks.every(v => Math.abs(v.w - Math.PI / 2) < 1e-6);
          const gap = Math.abs(((blocks[1] ? blocks[1].a - blocks[0].a : 0) + TAU2 * 2) % TAU2 - Math.PI);
          if (!wOk || gap > 1e-6) out.badSplit++;
          if (blocks.some(v => v.av)) out.spinning++;
        } else if (arr.some(v => v.av != null)) out.rotor++;
      }
    }
    return out;
  };
  {
    const lo = crossSurvey(10500, 4);
    ok(lo.cross > 0, 'the x-cross spawns at the final tier (' + lo.cross + ' sightings)');
    ok(lo.badSplit === 0, 'it quarters the pipe: two 90° blocks, 180° apart (25/25/25/25)');
    ok(lo.mistagged === 0, 'the hub-spoke tell is on the x-cross and ONLY the x-cross (rotors seen: ' + lo.rotor + ')');
    ok(lo.spinning === 0, 'below 12k it arrives STATIC (' + lo.spinning + ' spinning of ' + lo.cross + ')');
    const hi = crossSurvey(12500, 4);
    ok(hi.spinning > 0, 'past 12k it starts turning (' + hi.spinning + ' spinning of ' + hi.cross + ')');
    ok(hi.badSplit === 0, 'and it still keeps the 25/25/25/25 split while spinning');
  }

  const cr = runGame(); cr.T().startMode('cruise'); cr.T().clearTrack();
  cr.T().setScore(12000); cr.T().step(2);
  ok(cr.T().tier === 6, 'Cruise still counts tiers');
  cr.step(4);
  ok(cr.errors.length === 0, 'Cruise renders fine at max tier (it caps which hazards spawn)');
}

section('Tube Racer: moving hazards actually move');
{
  const g = clean();
  g.T().addFeat({ k: 'beam', z: g.T().dist + 40, len: 1.5, a: 1.0, w: 0.7, av: 0.8 });
  const f0 = 1.0;
  g.T().step(30);
  const spun = g.T().featAt(0);
  ok(spun && Math.abs(spun.a - f0) > 0.2, 'a rotating bar changes angle over time');

  const gi = clean();
  gi.T().addFeat({ k: 'wall', z: gi.T().dist + 40, len: 1.5, a: 0, w: 4.0, w0: 4.0, wAmp: 0.55, wPh: 0, wSp: 2 });
  const widths = [];
  for (let i = 0; i < 60; i++) { gi.T().step(1); widths.push(gi.T().featAt(0).w); }
  ok(Math.max(...widths) - Math.min(...widths) > 0.2, 'an iris shutter breathes open and shut');

  const gs = clean();
  gs.T().setAngle(0);
  gs.T().addFeat({ k: 'beam', z: gs.T().dist + 60, len: 1.6, a: 2.5, w: 0.62, homes: 1.0 });
  gs.T().step(60);
  const sent = gs.T().featAt(0);
  ok(Math.abs(sent.a) < 2.5, 'a sentinel homes toward the player angle (' + sent.a.toFixed(2) + ')');

  const gp = clean();
  gp.T().addFeat({ k: 'plug', z: gp.T().dist + 60, len: 3.2, a: 0, w: 4.8, av: 0.4, drift: 8 });
  const z0 = gp.T().featAt(0).z;
  gp.T().step(60);
  ok(gp.T().featAt(0).z > z0 + 5, 'the Plug grinds forward so you have to overtake it');
}

section('Tube Racer: the engine note is an equippable cosmetic');
{
  const equip = k => runGame({ preCode: [CHALLENGES, COSMETICS], store: {
    gamekit_owned: JSON.stringify({ ['tube-racer.engine.' + k]: { c: 0, t: 0 } }),
    gamekit_cos_sel: JSON.stringify({ 'tube-racer.engine': 'tube-racer.engine.' + k }),
  } });
  const def = runGame({ preCode: [CHALLENGES, COSMETICS] });
  ok(def.T().engine === 'reactor', 'Reactor Pulse is the free default');
  for (const k of ['maglev', 'twostroke']) {
    const g = equip(k);
    g.T().start(); g.step(4);
    ok(g.T().engine === k, 'equipping ' + k + ' switches the engine (' + g.T().engine + ')');
    ok(g.errors.length === 0, k + ' engine runs clean: ' + (g.errors[0] || ''));
  }
  // a Collection change is picked up on the NEXT run — hearing one before you equip it is the
  // kit shop's ▶ job now (the graphs live on the cosmetics items, so the catalogue can rev them)
  {
    // owning it is a precondition — cosmetics.select() refuses an unowned item, as it should
    const g = runGame({ preCode: [CHALLENGES, COSMETICS], store: {
      gamekit_owned: JSON.stringify({ 'tube-racer.engine.maglev': { c: 0, t: 0 } }) } });
    g.step(3);
    ok(g.T().engine === 'reactor', 'the default engine is live before anything is picked');
    g.win.gamekit.cosmetics.select('tube-racer.engine', 'tube-racer.engine.maglev');   // what the shop calls
    g.step(3);
    ok(g.T().engine === 'maglev', 'a Collection change swaps the engine without a reload');
    ok(g.errors.length === 0, 'the swapped engine runs clean');
  }
  // …including mid-run: the 🎨 drawer opens over a live game, so equipping there must land at once
  {
    const g = runGame({ preCode: [CHALLENGES, COSMETICS], store: {
      gamekit_owned: JSON.stringify({ 'tube-racer.engine.twostroke': { c: 0, t: 0 } }) } });
    g.T().start(); g.step(3);
    g.win.gamekit.cosmetics.select('tube-racer.engine', 'tube-racer.engine.twostroke');
    g.step(3);
    ok(g.T().engine === 'twostroke' && g.errors.length === 0, 'a mid-run change swaps the engine too');
  }

  // every id in the cosmetics registry resolves to a real builder — ?engine= is only honoured for
  // keys ENGINES actually has, so this fails loudly if an item loses its `audio`
  for (const k of ['reactor', 'maglev', 'twostroke']) {
    const g = runGame({ preCode: [CHALLENGES, COSMETICS], search: '?engine=' + k });
    ok(g.T().engine === k, '?engine=' + k + ' resolves from the registry');
  }
  const bogus = runGame({ preCode: [CHALLENGES, COSMETICS], search: '?engine=nope' });
  ok(bogus.T().engine === 'reactor', 'an unknown ?engine= falls back to the default');

  // with no cosmetics registry at all there is simply no drone — never a throw
  {
    const g = runGame({ preCode: [CHALLENGES], search: '?engine=maglev' });
    g.T().start(); g.step(30);
    ok(g.T().engine === 'reactor', 'without cosmetics.js the engine falls back to the default');
    ok(g.errors.length === 0, 'and the game runs clean with no engine graph: ' + (g.errors[0] || ''));
  }
}

section('Tube Racer: camera + invert preferences');
{
  const g = clean();
  ok(g.T().cam === 'world', 'default camera spins the world');
  g.T().setCam('craft'); g.step(4);
  ok(g.T().cam === 'craft' && g.errors.length === 0, 'craft-orbit camera renders without errors');

  const gi = clean();
  gi.T().setInvert(true);
  const a0 = gi.T().ang;
  gi.T().hold('ArrowRight', true); gi.T().step(20); gi.T().hold('ArrowRight', false);
  let d = gi.T().ang - a0; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  ok(d > 0.3, 'invert steering reverses the roll direction (delta ' + d.toFixed(2) + ')');

  const gp = runGame({ store: { 'tube-racer_cam': 'craft', 'tube-racer_inv': '1' } });
  ok(gp.T().cam === 'craft', 'camera preference is restored from storage');
}

// render() must survive the mocked canvas in every mode + screen shape — this is what
// catches things the mock returns nothing for (text metrics, gradients).
section('Tube Racer: renders headlessly in every mode and orientation');
for (const m of ['classic', 'sprint', 'redline', 'cruise']) {
  for (const v of [{ w: 360, h: 640 }, { w: 640, h: 360 }, { w: 1280, h: 800 }]) {
    const g = runGame({ w: v.w, h: v.h });
    g.T().startMode(m);
    g.step(6);                     // real display frames → render()
    g.T().pause(); g.step(2); g.T().resume();
    ok(g.errors.length === 0, m + ' @ ' + v.w + 'x' + v.h + ': renders clean (' + (g.errors[0] || '') + ')');
  }
}

// the menu backdrop runs the REAL tunnel painter (never a hand-drawn copy), so it has to survive
// the same mocked canvas — and it must not disturb the run's seeded track
// A reward and a hazard that read the same colour is the worst bug this game can have — it happened
// twice (friction bands started amber like the accel lane; so did the homing sentinel). The palette
// is one map now, and no two entries may be the same value.
section('Tube Racer: no two gameplay components share a colour');
{
  const P = clean().T().palette;
  const seen = new Map(), dupes = [];
  for (const [k, v] of Object.entries(P)) { if (seen.has(v)) dupes.push(seen.get(v) + ' = ' + k + ' (' + v + ')'); else seen.set(v, k); }
  ok(dupes.length === 0, 'every palette entry is distinct' + (dupes.length ? ': ' + dupes.join(', ') : ''));
  ok(Object.keys(P).length >= 16, 'the palette covers every component (' + Object.keys(P).length + ' entries)');
  // the two clashes that actually shipped, pinned so they can't come back
  ok(P.sentFace !== P.accFill && P.sentEdge !== P.accRim, 'the homing sentinel is not the accel lane\'s yellow');
  ok(P.fricFill !== P.accFill, 'friction bands are not the accel lane\'s yellow');
  ok(P.plugFace !== P.shearFill && P.plugEdge !== P.shearEdge, 'the Plug and the shear plate are different metals');
}

section('Tube Racer: the menu backdrop is the real tunnel, and stays out of the way');
{
  const g = runGame({ w: 360, h: 640 });
  const d0 = g.T().menuBg();
  ok(typeof d0 === 'number' && g.errors.length === 0, 'the backdrop paints headlessly: ' + (g.errors[0] || ''));
  g.step(40);                        // advances the harness clock, which the backdrop reads
  ok(g.T().menuBg() > d0, 'and it flies forward over time');
  // its own track is seeded too, so it must hand the run's RNG back exactly as it found it —
  // otherwise a pause-menu repaint would silently reroll the track (and any future daily seed)
  g.T().setSeed(4242); g.T().start(); g.step(10);
  const rng = g.T().rngState;
  g.T().menuBg(); g.T().menuBg();
  ok(g.T().rngState === rng, 'painting the backdrop leaves the run RNG untouched');
  ok(g.errors.length === 0, 'no backdrop render errors: ' + (g.errors[0] || ''));
}

section('Tube Racer: balance telemetry — end cause and per-run rates');
{
  // overheating and being destroyed must be told apart, and by WHICH hazard
  const heat = clean();
  heat.T().hold('Space', true);
  let n = 0; while (heat.T().state === 'playing' && n++ < 900) heat.T().step(1);
  heat.T().hold('Space', false);
  const hRec = JSON.parse(heat.store['gamekit_result_tube-racer'] || '{}');
  ok(hRec.stats && typeof hRec.stats.rates === 'object', 'rates are reported on the record');
  ok(hRec.stats.rates.boost_share > 0.5, 'boost_share reflects a full-throttle run (' + (hRec.stats.rates.boost_share || 0).toFixed(2) + ')');
  ok(hRec.stats.rates.boost_share <= 1, 'boost_share is a real share, never above 1 (' + hRec.stats.rates.boost_share + ')');

  const wall = clean();
  killWithWalls(wall);
  const wRec = JSON.parse(wall.store['gamekit_result_tube-racer'] || '{}');
  ok(wall.T().state === 'over', 'the wall run ended');
  ok(['wall', 'rotor', 'xcross', 'sentinel', 'plug'].indexOf(wall.T().hitBy) >= 0,
    'the killing hazard is recorded from the closed set (' + wall.T().hitBy + ')');
  ok(wRec.stats.rates.boost_share < 0.5, 'a coasting run reports a low boost share');

  // cooling-strip entries are counted as a RATE, and only on entry (not per frame)
  const cool = clean();
  cool.T().addFeat({ k: 'cool', z: cool.T().dist + 4, len: 8, a: cool.T().ang - 0.4, w: 0.8 });
  let k = 0; while (k++ < 240) cool.T().step(1);
  ok(cool.T().coolsTaken >= 1, 'entering a cooling strip counts once (' + cool.T().coolsTaken + ')');
  ok(cool.T().coolsTaken < 20, 'it is not counted per frame');
}

section('Tube Racer: passing your old best is celebrated mid-run, once');
{
  // arm with a beatable bar, then fly until the score crosses it
  const g = clean({ store: { gamekit_pb: JSON.stringify({ 'tube-racer': { Classic: { score: 40 } } }) } });
  g.T().start();                              // re-arm now that the bar is in the store
  g.T().clearTrack();
  ok(g.T().score < 40, 'starts below the old best');
  let flashes = 0, guard = 0;
  while (g.T().score < 60 && guard++ < 4000) {
    const before = g.T().state;
    g.T().step(1);
    // the flash decays once more inside the same update (S.flash *= 0.88), so 0.55 reads as 0.484
    if (before === 'playing' && g.T().flash > 0.4) flashes++;
  }
  ok(g.T().score >= 60, 'the run passed the old best');
  ok(flashes >= 1, 'the in-engine flash fired when the bar was passed');
  // a second crossing must NOT re-fire: one celebration per run
  const flashAt = g.T().flash;
  g.T().step(600);
  ok(g.T().score > 60, 'the run kept scoring past it');
  ok(g.T().flash <= flashAt, 'it does not fire again in the same run');
  ok(g.errors.length === 0, 'no errors');
}

section('Tube Racer: a first-ever run has no best to beat, so nothing fires');
{
  const g = clean();                          // empty store: no previous best
  g.T().start(); g.T().clearTrack();
  let flashes = 0, guard = 0;
  while (g.T().score < 120 && guard++ < 6000) { g.T().step(1); if (g.T().flash > 0.4) flashes++; }
  ok(flashes === 0, 'no celebration on a first run (there is no record to break)');
}

section('Tube Racer: the shared score card carries a TRANSLATED mode name');
{
  // `mode` must stay the English store key (saveBest keys on it) while `modeText` is what the player
  // reads on the score card and in the profile. Shipping without modeText meant Polish players shared
  // a card subtitled "Redline".
  const g = clean({ search: '?lang=pl' });
  killWithWalls(g);
  const rec = JSON.parse(g.store['gamekit_result_tube-racer'] || '{}');
  ok(rec.mode === 'Classic', 'the stored mode key stays English (' + rec.mode + ')');
  ok(typeof rec.modeText === 'string' && rec.modeText.length > 0, 'a modeText is recorded for the card');
  const pl = fs.readFileSync(path.join(ROOT, 'i18n.pl.js'), 'utf8');
  const wanted = (pl.match(/'game\.tube-racer\.modeClassic':\s*'([^']+)'/) || [])[1];
  ok(!!wanted, 'the Polish Classic name exists in i18n.pl.js');
  ok(rec.modeText === wanted, 'modeText is the Polish name, not the English key (got "' + rec.modeText + '", want "' + wanted + '")');
}

section('Tube Racer: steering keys never eat typing in a kit overlay');
{
  // The 🎨 Collection search box and the profile name editor are reachable MID-RUN via the side
  // stack, so the game must ignore keydowns aimed at a text field. Asserted through behaviour, not
  // through preventDefault: the kit's tap-to-play splash also swallows keys, so a preventDefault
  // probe would be measuring the splash rather than the game.
  const speedAfter = (target) => {
    const g = clean();
    g.T().setCam('world');
    const before = g.T().spd;
    g.key('keydown', ' ', { code: 'Space', target });
    g.T().step(40);
    return { rose: g.T().spd > before + 0.5, errs: g.errors.length };
  };
  const field = speedAfter({ tagName: 'INPUT' });
  ok(field.rose === false, 'a Space typed into a text field does not boost');
  const editable = speedAfter({ tagName: 'DIV', isContentEditable: true });
  ok(editable.rose === false, 'a Space typed into a contenteditable does not boost');
  const play = speedAfter({ tagName: 'CANVAS' });
  ok(play.rose === true, 'Space still boosts during play');
  ok(field.errs === 0 && play.errs === 0, 'no handler threw');
}

section('Tube Racer: layout fits every viewport (tunnel never touches kit chrome)');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().start(); return gl; },
  (gl, v) => {
    gl.T().step(1);
    const L = gl.T().layout;
    const pr = gl.win.gamekit.layout.playRect();
    ok(L.board.w > 40 && L.board.h > 40, v.name + ': tunnel has a usable size (' + Math.round(L.board.w) + 'px)');
    ok(Math.abs(L.board.w - L.board.h) < 1.5, v.name + ': tunnel board is square');
    ok(L.board.y >= L.topReserve - 0.5, v.name + ': tunnel clears the HUD headroom');
    ok(L.board.x >= pr.x - 0.5 && L.board.x + L.board.w <= pr.x + pr.w + 0.5, v.name + ': board within the play rect width');
    ok(L.board.y >= pr.y - 0.5 && L.board.y + L.board.h <= pr.y + pr.h + 0.5, v.name + ': board within the play rect height');
    ok(L.wallR <= L.board.w / 2 + 0.5, v.name + ': the drawn pipe wall stays inside the board');
    ok(['side', 'bottom', 'inset'].indexOf(L.gutter) >= 0, v.name + ': cockpit gutter resolved (' + L.gutter + ')');
    // the bottom-strip layout put its second row's baseline at H+1, so MACH and HEAT were drawn
    // off the canvas on every portrait phone — both rows must sit inside the viewport
    const cp = L.cockpit;
    ok(cp && cp.row1 > 0 && cp.row1 <= L.H, v.name + ': cockpit row 1 baseline is on-canvas (' + Math.round(cp.row1) + ' of ' + L.H + ')');
    ok(cp && cp.row2 > 0 && cp.row2 <= L.H, v.name + ': cockpit row 2 baseline is on-canvas (' + Math.round(cp.row2) + ' of ' + L.H + ')');
  }
);

summary();
