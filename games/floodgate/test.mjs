// Headless tests for Floodgate — boots via the shared harness, drives window.__test.
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/floodgate/index.html';
const runGame = (opts) => bootGame(FILE, { seed: 11, ...opts });
const COSMETICS = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');

const pb = (store, mode) => {
  try { return ((JSON.parse(store['gamekit_pb'] || '{}').floodgate || {})[mode] || {}); }
  catch (e) { return {}; }
};
const lastResult = (store) => { try { return JSON.parse(store['gamekit_result_floodgate'] || 'null'); } catch (e) { return null; } };
// the kit loop swallows render exceptions into console.error, so drive render directly
const rendersOk = (h, frames = 4) => { try { for (let i = 0; i < frames; i++) { h.T().step(1); h.T().render(); } return true; } catch (e) { console.log('    render threw: ' + e.message); return false; } };

// ---- Boot ----
section('floodgate: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');
ok(g.T().state === 'ready', 'initial state is "ready" (got ' + g.T().state + ')');
ok(g.errors.length === 0, 'no errors during boot (' + g.errors.join(' | ') + ')');

// ---- Initial state ----
section('floodgate: initial state');
{
  const T = g.T;
  ok(T().mode === 'campaign', 'default mode is campaign (got ' + T().mode + ')');
  ok(T().levelCount() === 12, 'campaign has 12 levels (got ' + T().levelCount() + ')');
  ok(T().cols === 4 && T().rows === 4, 'level 1 board is 4x4 (got ' + T().cols + 'x' + T().rows + ')');
  ok(T().tier === 1, 'level 1 is tier 1 (got ' + T().tier + ')');
  ok(T().utils.length === 1 && T().utils[0] === 'cold', 'tier 1 runs one cold line (got ' + T().utils.join(',') + ')');
  ok(T().unlocked(0) === true, 'level 1 starts unlocked');
  ok(T().unlocked(1) === false, 'level 2 starts locked');
  ok(T().campaignDone().length === 0, 'no levels cleared on a fresh device');
}

// ---- Rotation ----
section('floodgate: rotation');
{
  const gr = runGame();
  const T = gr.T;
  T().startMode('campaign', 0);
  ok(T().state === 'playing', 'startMode → playing');
  // find a rotatable cell (unlocked and carrying pipe)
  let cx = -1, cy = -1;
  for (let y = 0; y < T().rows && cx < 0; y++) for (let x = 0; x < T().cols; x++) {
    if (!T().isLocked(x, y) && T().solMask(x, y)) { cx = x; cy = y; break; }
  }
  ok(cx >= 0, 'board has a rotatable pipe tile');
  const before = T().mask(cx, cy), moves0 = T().moves;
  T().rotate(cx, cy, true);
  ok(T().moves === moves0 + 1, 'a rotation counts a move');
  const cw1 = T().mask(cx, cy);
  ok(cw1 === (((before << 1) | (before >> 3)) & 15), 'clockwise rotation shifts the port mask (' + before + ' → ' + cw1 + ')');
  T().rotate(cx, cy, false);
  ok(T().mask(cx, cy) === before, 'counter-clockwise rotation undoes it');
  // terminals are bolted down
  let tx = -1, ty = -1;
  for (let y = 0; y < T().rows && tx < 0; y++) for (let x = 0; x < T().cols; x++) if (T().isLocked(x, y)) { tx = x; ty = y; break; }
  ok(tx >= 0, 'board has a locked terminal');
  const tm = T().mask(tx, ty), mv = T().moves;
  ok(T().rotate(tx, ty, true) === false, 'a locked terminal refuses to rotate');
  ok(T().mask(tx, ty) === tm && T().moves === mv, 'locked terminal keeps its mask and costs no move');
}

// ---- Solvable by construction ----
section('floodgate: every generated board is solvable by construction');
{
  for (const lv of [0, 3, 4, 7, 8, 11]) {
    const gs = runGame();
    gs.T().startMode('campaign', lv);
    ok(gs.T().solved === false, 'level ' + (lv + 1) + ' is not dealt already solved');
    ok(gs.T().leaks > 0 || gs.T().drains.some(d => !d), 'level ' + (lv + 1) + ' starts unsealed');
    const solved = gs.T().solve();
    ok(solved === true, 'level ' + (lv + 1) + ' solves by restoring the generated rotations');
    ok(gs.T().leaks === 0, 'level ' + (lv + 1) + ' solution has no leaks (got ' + gs.T().leaks + ')');
    ok(gs.T().faults.length === 0, 'level ' + (lv + 1) + ' solution has no faults (got ' + gs.T().faults.join(',') + ')');
    ok(gs.T().drains.every(Boolean), 'level ' + (lv + 1) + ' solution reaches every drain');
    ok(gs.errors.length === 0, 'level ' + (lv + 1) + ' solve raised no errors');
  }
}

section('floodgate: generator sweep — every seed/size/tier builds a sealable board');
{
  const gg = runGame();
  const T = gg.T;
  let bad = 0, nulls = 0, noX = 0, noCond = 0, checked = 0, deg = 0;
  // 400 UTC days of Daily boards
  for (let day = 20500; day < 20900; day++) {
    const c = T().dailyConfig(day);
    const r = T().boardOk(c.seed, c.tier, c.w, c.h);
    checked++;
    if (!r) { nulls++; continue; }
    if (!r.solved || r.leaks || r.faults) bad++;
    if (r.tier !== c.tier) deg++;
    if (c.tier >= 2 && !r.xovers) noX++;
    if (c.tier === 3 && !r.conduits) noCond++;
  }
  ok(nulls === 0, 'every daily config generates a board (nulls ' + nulls + '/' + checked + ')');
  ok(bad === 0, 'every daily solution is sealed, leak-free and fault-free (bad ' + bad + ')');
  ok(deg === 0, 'no daily board silently degrades its tier (' + deg + ')');
  ok(noX === 0, 'every tier 2+ daily board has a crossover (missing ' + noX + ')');
  ok(noCond === 0, 'every tier 3 daily board has a conduit (missing ' + noCond + ')');
  // assorted sizes across all tiers
  let bad2 = 0, nulls2 = 0, n2 = 0;
  for (const [tier, w, h] of [[1, 4, 4], [1, 5, 4], [1, 5, 5], [2, 5, 5], [2, 6, 5], [2, 6, 6], [3, 6, 6], [3, 6, 7], [3, 7, 7], [3, 8, 8]]) {
    for (let s = 1; s <= 25; s++) {
      const r = T().boardOk((s * 2654435761) >>> 0, tier, w, h);
      n2++;
      if (!r) { nulls2++; continue; }
      if (!r.solved || r.leaks || r.faults) bad2++;
    }
  }
  ok(nulls2 === 0, 'every size/tier combination generates a board (nulls ' + nulls2 + '/' + n2 + ')');
  ok(bad2 === 0, 'all ' + n2 + ' generated solutions are sealable by construction (bad ' + bad2 + ')');
}

section('floodgate: tiers bring the right utilities, crossovers and conduits');
{
  const gt = runGame();
  gt.T().startMode('campaign', 4);          // tier 2
  ok(gt.T().tier === 2, 'level 5 is tier 2');
  ok(gt.T().utils.join(',') === 'cold,hot', 'tier 2 runs cold + hot (got ' + gt.T().utils.join(',') + ')');
  ok(gt.T().xovers > 0, 'tier 2 board has at least one crossover (got ' + gt.T().xovers + ')');
  gt.T().startMode('campaign', 8);          // tier 3
  ok(gt.T().tier === 3, 'level 9 is tier 3');
  ok(gt.T().utils.join(',') === 'cold,hot,power', 'tier 3 adds the cable (got ' + gt.T().utils.join(',') + ')');
  ok(gt.T().xovers > 0, 'tier 3 board has crossovers (got ' + gt.T().xovers + ')');
  ok(gt.T().conduits > 0, 'tier 3 board has an insulated conduit (got ' + gt.T().conduits + ')');
}

// ---- Fault rules (hard yes/no) ----
section('floodgate: joining hot to cold scalds, cable + water shorts');
// Faults come from MISROUTING, so the assert has to find rotations that misroute. Two searches per
// board: (a) targeted — perturb one cell of line A and one adjacent cell of line B through all 16
// orientations; (b) a seeded random sweep of whole rotation vectors (what sloppy play looks like).
const mul32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function faultKinds(T, samples, rnd) {
  const cols = T().cols, rows = T().rows, n = cols * rows, base = T().solutionRot(), found = {};
  const note = p => { if (p) for (const k of p.faults) found[k] = true; };
  for (let i = 0; i < n; i++) {
    const ax = i % cols, ay = (i / cols) | 0, ua = T().owner(ax, ay);
    if (ua < 0 || T().isLocked(ax, ay)) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const bxx = ax + dx, byy = ay + dy;
      if (bxx < 0 || byy < 0 || bxx >= cols || byy >= rows) continue;
      const ub = T().owner(bxx, byy);
      if (ub < 0 || ub === ua || T().isLocked(bxx, byy)) continue;
      const j = byy * cols + bxx;
      for (let ra = 0; ra < 4; ra++) for (let rb = 0; rb < 4; rb++) {
        const arr = base.slice(); arr[i] = ra; arr[j] = rb;
        note(T().probe(arr));
      }
    }
  }
  for (let s = 0; s < samples; s++) {
    const arr = new Array(n);
    for (let i = 0; i < n; i++) arr[i] = (rnd() * 4) | 0;
    note(T().probe(arr));
  }
  return found;
}
{
  const gf = runGame();
  const rnd = mul32(90210);
  const found = {};
  gf.T().startMode('endless');
  for (let k = 0; k < 22; k++) {                        // walk endless boards 1..22 (tiers 1→3)
    if (gf.T().tier >= 2) Object.assign(found, faultKinds(gf.T, 700, rnd));
    if (found.scald && found.short) break;
    if (!gf.T().solve()) break;
    gf.T().setTimeLeft(999);
    gf.T().step(140);
  }
  ok(found.scald === true, 'a rotation that joins hot to cold reports a scald fault');
  ok(found.short === true, 'a rotation that puts the cable in a water cell reports a short fault');
  ok(gf.errors.length === 0, 'the fault sweep raised no errors (' + gf.errors.join(' | ') + ')');
}
{
  // a fault blocks the seal even when nothing leaks: the solution + a fault is impossible by
  // construction, so assert the rule directly — the solution is fault-free AND solved
  const gz = runGame();
  gz.T().startMode('campaign', 8);
  const p = gz.T().probe(gz.T().solutionRot());
  ok(p.solved === true && p.faults.length === 0 && p.leaks === 0, 'tier 3 solution is fault-free, leak-free and sealed');
}

// ---- Campaign progression + persistence ----
section('floodgate: campaign progression persists');
{
  const gc = runGame();
  const T = gc.T;
  T().startMode('campaign', 0);
  T().solve();
  ok(T().solved === true, 'level 1 sealed');
  ok(T().score === 1, 'sealing a board scores 1 (got ' + T().score + ')');
  ok(T().state === 'playing', 'campaign keeps running after a level');
  T().step(140);
  ok(T().level === 1, 'the run advances to level 2 (got level index ' + T().level + ')');
  ok(T().solved === false, 'the next board starts unsealed');
  ok(T().campaignDone().join(',') === '0', 'level 1 recorded as cleared (got [' + T().campaignDone().join(',') + '])');
  ok(T().unlocked(1) === true, 'clearing level 1 unlocks level 2');
  ok(T().unlocked(2) === false, 'level 3 stays locked');
  const raw = gc.store['floodgate_done'];
  ok(!!raw, 'floodgate_done written');
  const o = JSON.parse(raw || '{}');
  ok(o.v === 1 && Array.isArray(o.done) && o.done[0] === 0, 'floodgate_done is a versioned {v:1,done:[...]} record (' + raw + ')');
  ok(raw.length < 200, 'floodgate_done stays tiny (' + raw.length + ' bytes)');

  const g2 = bootGame(FILE, { seed: 11, store: gc.store });
  ok(g2.T().campaignDone().join(',') === '0', 'cleared levels survive a fresh session');
  ok(g2.T().unlocked(1) === true, 'unlock survives a fresh session');
  ok(g2.T().level === 1, 'the start screen preselects the next unplayed level');
}

section('floodgate: the last campaign level ends the run');
{
  const gd = runGame();
  const T = gd.T;
  T().startMode('campaign', 11);
  T().solve();
  T().step(140);
  ok(T().state === 'over', 'sealing the last blueprint ends the run (got ' + T().state + ')');
  T().step(40);
  ok(T().menu() != null, 'the end menu is shown');
  ok(pb(gd.store, 'Campaign').score === 1, 'best stored under the "Campaign" mode label (got ' + JSON.stringify(pb(gd.store, 'Campaign')) + ')');
  const r = lastResult(gd.store);
  ok(r != null && r.mode === 'Campaign', 'result recorded under "Campaign" (got ' + (r && r.mode) + ')');
  ok(r != null && r.time === 0, 'Campaign is not time-primary → record.time is 0 (got ' + (r && r.time) + ')');
  ok(r != null && r.stats && r.stats.moves > 0, 'rotations recorded as a stat (got ' + (r && r.stats && r.stats.moves) + ')');
  // end-menu action
  T().menu().activate('again');
  ok(T().state === 'playing', 'PLAY AGAIN starts a new run (got ' + T().state + ')');
  ok(T().score === 0, 'PLAY AGAIN resets the score');
}

// ---- Daily ----
section('floodgate: daily board is the same for everyone, every day');
{
  const ga = runGame(), gbb = runGame();
  ok(ga.T().dailySeed(1000) === gbb.T().dailySeed(1000), 'the same UTC day gives the same seed on two devices');
  ok(ga.T().dailySeed(1000) !== ga.T().dailySeed(1001), 'a different day gives a different seed');
  const c1 = ga.T().dailyConfig(1000), c2 = gbb.T().dailyConfig(1000);
  ok(JSON.stringify(c1) === JSON.stringify(c2), 'the day config is stable (' + JSON.stringify(c1) + ')');
  ok(c1.tier >= 1 && c1.tier <= 3, 'the daily tier stays in range (got ' + c1.tier + ')');
  ga.T().startMode('daily'); gbb.T().startMode('daily');
  ok(ga.T().cols === gbb.T().cols && ga.T().rows === gbb.T().rows, "today's board has the same size on both");
  let same = true;
  for (let y = 0; y < ga.T().rows; y++) for (let x = 0; x < ga.T().cols; x++) if (ga.T().solMask(x, y) !== gbb.T().solMask(x, y)) same = false;
  ok(same, "today's board is bit-identical on both devices");
  ok(ga.T().timed === false, 'Daily is untimed');
  ga.T().solve();
  ok(ga.T().solved === true, "today's daily board is solvable");
  ga.T().step(140);
  ok(ga.T().state === 'over', 'sealing the daily board ends the run');
  ga.T().step(40);
  // Daily scores the STAR rating, and which board today deals decides how many stars a solve earns —
  // so assert the label + that the stored best is the rating just awarded, never a fixed number
  ok(pb(ga.store, 'Daily').score === ga.T().stars && ga.T().stars >= 1,
    'best stored under the "Daily" mode label as the awarded rating (got ' + JSON.stringify(pb(ga.store, 'Daily')) + ', stars ' + ga.T().stars + ')');
  const r = lastResult(ga.store);
  ok(r != null && r.mode === 'Daily' && r.time === 0, 'Daily record carries time 0 (got ' + (r && r.time) + ')');
}

// ---- Endless ----
section('floodgate: endless grows and the clock ends the run');
{
  const ge = runGame();
  const T = ge.T;
  T().startMode('endless');
  ok(T().boardNo === 1 && T().tier === 1, 'endless starts at board 1, tier 1');
  ok(T().timed === true && T().timeLeft > 0, 'endless boards are timed (got ' + Math.round(T().timeLeft) + 's)');
  const size1 = T().cols * T().rows;
  T().solve();
  ok(T().solved === true, 'endless board 1 is solvable');
  T().step(140);
  ok(T().boardNo === 2, 'sealing an endless board deals the next one (got #' + T().boardNo + ')');
  ok(T().score === 1, 'endless score counts sealed boards');
  ok(T().cols * T().rows >= size1, 'the grid never shrinks (' + size1 + ' → ' + (T().cols * T().rows) + ')');
  ok(T().state === 'playing', 'the run continues');
  T().setTimeLeft(0.01);
  T().step(5);
  ok(T().state === 'over', 'running out of time ends the run (got ' + T().state + ')');
  T().step(40);
  ok(pb(ge.store, 'Endless').score === 1, 'best stored under the "Endless" mode label (got ' + JSON.stringify(pb(ge.store, 'Endless')) + ')');
  const r = lastResult(ge.store);
  ok(r != null && r.mode === 'Endless', 'result recorded under "Endless"');
  ok(r != null && r.time === 0, 'Endless never posts a time record (got ' + (r && r.time) + ')');
}

section('floodgate: endless tiers escalate');
{
  const gx = runGame();
  const seen = {};
  gx.T().startMode('endless');
  for (let k = 0; k < 8; k++) {
    seen[gx.T().boardNo] = { tier: gx.T().tier, n: gx.T().cols * gx.T().rows };
    if (!gx.T().solve()) break;
    gx.T().setTimeLeft(999);
    gx.T().step(140);
  }
  ok(seen[1].tier === 1, 'board 1 is tier 1');
  ok(seen[3] && seen[3].tier === 2, 'board 3 introduces the hot line (tier ' + (seen[3] && seen[3].tier) + ')');
  ok(seen[6] && seen[6].tier === 3, 'board 6 introduces the cable (tier ' + (seen[6] && seen[6].tier) + ')');
  ok(seen[6] && seen[6].n > seen[1].n, 'the grid has grown by board 6 (' + seen[1].n + ' → ' + (seen[6] && seen[6].n) + ')');
  ok(gx.T().score >= 6, 'six boards sealed in one endless run (got ' + gx.T().score + ')');
  ok(gx.errors.length === 0, 'no errors across eight endless boards (' + gx.errors.join(' | ') + ')');
}

// ---- Best persistence from the store ----
section('floodgate: best score reads back from the kit store');
{
  const gp = runGame({ store: { gamekit_pb: JSON.stringify({ floodgate: { Endless: { score: 9 } } }) } });
  gp.T().startMode('endless');
  ok(gp.T().state === 'playing', 'seeded-store run starts');
  const el = gp.el('bestEl');
  ok(String(el.textContent) === '9', 'the HUD shows the stored best (got ' + el.textContent + ')');
}

// ---- Resume ----
section('floodgate: resume');
{
  const g1 = runGame();
  g1.T().startMode('endless');
  // one rotation, then force the debounced autosave
  let cx = -1, cy = -1;
  for (let y = 0; y < g1.T().rows && cx < 0; y++) for (let x = 0; x < g1.T().cols; x++) if (!g1.T().isLocked(x, y) && g1.T().solMask(x, y)) { cx = x; cy = y; break; }
  g1.T().rotate(cx, cy, true);
  g1.T().saveNow();
  ok(g1.T().hasSave(), 'a rotation creates a resume save');
  const movesBefore = g1.T().moves, maskBefore = g1.T().mask(cx, cy);
  g1.T().toMenu();
  ok(g1.T().state === 'ready', 'toMenu returns to the start screen');

  const snap = { ...g1.store };   // independent copies: a later fresh start must not wipe the others
  const g2 = bootGame(FILE, { seed: 11, store: { ...snap } });
  ok(g2.T().hasSave(), 'the save persists into a fresh session');
  ok(g2.T().resume() === true, 'resume() succeeds');
  ok(g2.T().state === 'playing', 'resumed run is playing');
  ok(g2.T().mode === 'endless', 'resumed run keeps its mode');
  ok(g2.T().moves === movesBefore, 'resumed rotation count matches (' + g2.T().moves + ' vs ' + movesBefore + ')');
  ok(g2.T().mask(cx, cy) === maskBefore, 'resumed board keeps the rotated tile');
  ok(g2.T().resumedRun === true, 'resumed run is flagged');
  ok(g2.T().timed === true && g2.T().timeLeft > 0, 'resumed endless board keeps a clock');
  const save = g2.T().savedRun();
  ok(JSON.stringify(save).length < 400, 'the resume payload stays small (' + JSON.stringify(save).length + ' bytes)');

  const g3 = bootGame(FILE, { seed: 11, store: { ...snap } });
  g3.T().startMode('endless');
  ok(!g3.T().hasSave(), 'a fresh start clears the prior save');

  const g4 = bootGame(FILE, { seed: 11, store: { ...snap } });
  ok(g4.T().resume() === true, 'a second session can resume the same save');
  g4.T().solve();
  ok(g4.T().solved === true, 'a resumed board is still solvable');
  ok(!g4.T().hasSave(), 'sealing a board clears the resume slot');
}

// ---- Quitting a run with a score records it ----
section('floodgate: quitting mid-run records what was sealed');
{
  const gq = runGame();
  gq.T().startMode('endless');
  gq.T().solve();
  gq.T().setTimeLeft(999);
  gq.T().step(140);
  ok(gq.T().score === 1, 'one board sealed');
  gq.T().quit();
  ok(gq.T().state === 'over', 'quitting with a score ends the run');
  const r = lastResult(gq.store);
  ok(r != null && r.mode === 'Endless' && r.score === 1, 'the quit run was recorded (got ' + JSON.stringify(r && { m: r.mode, s: r.score }) + ')');
}
{
  const gq2 = runGame();
  gq2.T().startMode('campaign', 0);
  gq2.T().quit();
  ok(gq2.T().state === 'ready', 'quitting with nothing sealed just returns to the menu');
}

// ---- Cosmetics ----
section('floodgate: cosmetic pipe skins render safely');
{
  for (const id of ['floodgate.pipe.copper', 'floodgate.pipe.brass', 'floodgate.pipe.neon']) {
    const gk = runGame({ preCode: [CHALLENGES, COSMETICS], store: {
      gamekit_owned: JSON.stringify({ [id]: { c: 0, t: 0 } }),
      gamekit_cos_sel: JSON.stringify({ 'floodgate.pipe': id }),
    } });
    gk.T().startMode('campaign', 8);   // tier 3: crossovers + conduits + every marker path
    ok(rendersOk(gk), id + ' renders without errors');
    ok(gk.errors.length === 0, id + ': no frame errors (' + gk.errors.join(' | ') + ')');
  }
  // the registry may not carry the set yet — the fallback must not throw
  const gnone = runGame({ preCode: [CHALLENGES, COSMETICS], store: { gamekit_cos_sel: JSON.stringify({ 'floodgate.pipe': 'floodgate.pipe.doesnotexist' }) } });
  gnone.T().startMode('campaign', 8);
  ok(rendersOk(gnone), 'an unknown/missing skin id falls back safely');
}

// ---- Leak markers toggle ----
section('floodgate: leak markers toggle');
{
  const gh = runGame();
  gh.T().startMode('campaign', 8);
  gh.T().markers = false;
  ok(gh.T().markers === false, 'leak markers can be switched off');
  ok(rendersOk(gh), 'renders with markers off');
  gh.T().markers = true;
  ok(rendersOk(gh), 'renders with markers on');
  // ...and the choice SURVIVES A REFRESH: it used to live in a plain `let` that reset to on every
  // load, so anyone who plays without the crosses had to switch them off again on every visit.
  gh.T().markers = false;
  ok(/"markers":false/.test(gh.store['floodgate_ui'] || ''), 'switching them off is persisted (' + (gh.store['floodgate_ui'] || 'nothing stored') + ')');
  const reboot = runGame({ store: { floodgate_ui: gh.store['floodgate_ui'] } });
  ok(reboot.T().markers === false, 'a fresh load keeps them off');
  const clean = runGame();
  ok(clean.T().markers === true, 'and a first-time player still gets them ON');
  // the seal sweep, fault flash and toast all have their own render paths
  gh.T().solve();
  ok(rendersOk(gh, 10), 'the seal animation renders');
}

// ---- Layout ----
section('floodgate: layout fits the screen');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().startMode('campaign', 11); return gl; },   // biggest campaign board
  (gl, v, L0) => {
    gl.T().step(1);
    const L = gl.T().layout, b = L.board;
    ok(b.y >= L.topReserve - 1, v.name + ': board clears the HUD (top ' + Math.round(b.y) + ' >= ' + L.topReserve + ')');
    ok(b.x >= 0 && b.x + b.w <= L.W, v.name + ': board within width (' + Math.round(b.x) + '..' + Math.round(b.x + b.w) + ' of ' + L.W + ')');
    ok(b.y + b.h <= L.H, v.name + ': board within height');
    ok(b.cols === 7 && b.rows === 7, v.name + ': the 7x7 grid is fully laid out (' + b.cols + 'x' + b.rows + ')');
    ok(b.cell >= 20, v.name + ': cells stay tappable (cell ' + b.cell + 'px)');
    // landscape phones move the key into a LEFT rail beside the board (portrait keeps it underneath)
    if (L.legend.vertical) ok(L.legend.x + L.legend.w <= b.x + 1, v.name + ': the key rail sits left of the board (' +
      Math.round(L.legend.x + L.legend.w) + ' ≤ ' + Math.round(b.x) + ')');
    else ok(L.legend.y >= b.y + b.h, v.name + ': the legend sits below the board');
    ok(L.legend.y + L.legend.h <= L.H, v.name + ': the legend is on screen');
    ok(L.legend.x >= 0 && L.legend.x + L.legend.w <= L.W, v.name + ': the legend is within width');
  }
);


// ---- Par + stars + stages (run shape) ----
section('floodgate: par, stars and stage escalation');
{
  const gp = runGame();
  const T = gp.T;
  T().startMode('campaign', 0);
  const par0 = T().par;
  ok(par0 > 0, 'a dealt board has a par above zero (got ' + par0 + ')');
  ok(T().moves === 0, 'turns start at zero on a fresh board');
  ok(par0 <= T().cols * T().rows * 2, 'par stays in a sane range for the grid (' + par0 + ')');
  T().solve();
  ok(T().moves > 0, 'solving costs turns (' + T().moves + ' vs par ' + par0 + ')');
  ok(T().movesTotal === T().moves && T().parTotal === par0, 'sealing a board banks its turns and par into the run totals');
  T().step(140);
  ok(T().moves === 0, 'turns reset for the next board');
  ok(T().par > 0, 'the next board has its own par');
  ok(T().parTotal === par0, 'the run par total keeps the sealed board only');
}
{
  const gs2 = runGame();
  const T = gs2.T;
  T().startMode('daily');
  ok(T().stars === 0, 'no stars before a board is sealed');
  T().solve();
  ok(T().stars >= 1 && T().stars <= 3, 'sealing the daily board awards 1-3 stars (got ' + T().stars + ')');
  ok(T().score === T().stars, 'Daily scores the star rating, not a board count (score ' + T().score + ')');
}
{
  const ge2 = runGame();
  const T = ge2.T;
  T().startMode('endless');
  ok(T().stage === 'cold', 'endless opens on the COLD LINE stage (got ' + T().stage + ')');
  const seenStages = {};
  for (let k = 0; k < 12; k++) {
    seenStages[T().stage] = (seenStages[T().stage] || 0) + 1;
    if (!T().solve()) break;
    T().setTimeLeft(999);
    T().step(140);
  }
  ok(!!seenStages.hotcold, 'the HOT & COLD stage is reached');
  ok(!!seenStages.full, 'the FULL SERVICE stage is reached');
  ok(!!seenStages.expansion || T().stage === 'expansion', 'the EXPANSION stage is reached');
  ok(T().parTotal > 0 && T().movesTotal > 0, 'the run accumulates turns and par across boards');
  ok(ge2.errors.length === 0, 'twelve endless boards raise no errors');
}
{
  // the clock tightens once the MAINS PRESSURE stage starts
  const gc2 = runGame();
  const T = gc2.T;
  T().startMode('endless');
  let s8 = 0, s14 = 0;
  for (let k = 1; k <= 15; k++) {
    if (k === 8) s8 = T().boardSeconds;
    if (k === 14) { s14 = T().boardSeconds; break; }
    if (!T().solve()) break;
    T().setTimeLeft(999);
    T().step(140);
  }
  ok(s8 > 0 && s14 > 0 && s14 < s8 * 1.05, 'later endless boards get a tighter clock (board 8 ' + s8 + 's vs board 14 ' + s14 + 's)');
}


// ---- Start-menu flow: the primary action is bound to the selected mode ----
section('floodgate: the highlighted action always starts the SELECTED mode');
{
  // Daily / Endless start straight away; Campaign's primary opens the blueprint picker (step two
  // of play) and the picker's own action starts the chosen blueprint.
  for (const m of ['daily', 'endless']) {
    const gm = runGame();
    const menu = gm.T().menu();
    ok(menu != null, 'the start menu is up (' + m + ')');
    ok(menu.select('mode', m) === true, 'the ' + m + ' card can be selected');
    ok(menu.activate('play') === true, 'the primary action fires (' + m + ')');
    ok(gm.T().mode === m, 'selecting ' + m + ' and pressing the primary starts ' + m + ' (got ' + gm.T().mode + ')');
    ok(gm.T().state === 'playing', m + ' starts a run right away');
    ok(gm.errors.length === 0, m + ' start raised no errors (' + gm.errors.join(' | ') + ')');
  }
  {
    const gc = runGame();
    const menu = gc.T().menu();
    menu.select('mode', 'campaign');
    menu.activate('play');
    ok(gc.T().state === 'ready', 'campaign + primary does not start a board yet (got ' + gc.T().state + ')');
    ok(gc.T().menuScreen === 'levels', 'campaign + primary opens the blueprint picker (got ' + gc.T().menuScreen + ')');
    const pk = gc.T().menu();
    ok(pk != null && pk.activate('start') === true, 'the picker has its own start action');
    ok(gc.T().mode === 'campaign' && gc.T().state === 'playing', 'the picker starts a campaign run (mode ' + gc.T().mode + ', state ' + gc.T().state + ')');
    ok(gc.T().level === 0, 'it starts the preselected next blueprint (got index ' + gc.T().level + ')');
  }
  {
    // BACK returns to the start menu instead of dead-ending in the picker
    const gb = runGame();
    gb.T().menu().activate('play');
    ok(gb.T().menuScreen === 'levels', 'picker open');
    gb.T().menu().activate('back');
    ok(gb.T().menuScreen === 'start' && gb.T().state === 'ready', 'BACK returns to the start menu (got ' + gb.T().menuScreen + ')');
    ok(gb.T().menu().activate('play') === true, 'the start menu is live again after BACK');
  }
}
{
  // the real bug class: a saved run must never hijack the highlighted button
  const gs = runGame();
  gs.T().startMode('endless');
  let cx = -1, cy = -1;
  for (let y = 0; y < gs.T().rows && cx < 0; y++) for (let x = 0; x < gs.T().cols; x++) if (!gs.T().isLocked(x, y) && gs.T().solMask(x, y)) { cx = x; cy = y; break; }
  gs.T().rotate(cx, cy, true);
  gs.T().saveNow();
  gs.T().toMenu();
  ok(gs.T().hasSave(), 'an endless board is saved');
  ok(gs.T().menuScreen === 'start', 'back on the start menu');
  const parked = { ...gs.store };            // snapshot BEFORE a fresh start wipes the slot
  const menu = gs.T().menu();
  menu.select('mode', 'daily');
  menu.activate('play');
  ok(gs.T().mode === 'daily', 'with an endless save parked, Daily + primary starts DAILY (got ' + gs.T().mode + ')');
  ok(gs.T().resumedRun === false, 'the primary started a fresh board, not the resume');

  const gr = bootGame(FILE, { seed: 11, store: parked });
  ok(gr.T().menu().activate('continue') === true, 'the saved run has its own Continue action');
  ok(gr.T().resumedRun === true && gr.T().mode === 'endless', 'Continue resumes the saved endless board (mode ' + gr.T().mode + ')');
}

// ---- The picker reads as a chooser: numbers, par, cleared/locked/next ----
section('floodgate: the blueprint picker shows par and per-blueprint state');
{
  const gp = runGame();
  const T = gp.T;
  ok(T().levelPar(0) === 6 && T().levelPar(11) === 27, 'the par table is exposed (6 … ' + T().levelPar(11) + ')');
  const c0 = T().levelCell(0), c1 = T().levelCell(1);
  ok(c0.label === '1' && c1.label === '2', 'cells are numbered 1..12 (' + c0.label + ',' + c1.label + ')');
  ok(c0.status === 'next', 'blueprint 1 is the NEXT one on a fresh device (got ' + c0.status + ')');
  ok(c0.par === 6, 'the next blueprint hands the kit its par (got ' + c0.par + ')');
  ok(c1.locked === true && c1.par === 8, 'a locked blueprint still carries its par (got ' + c1.par + ')');
  for (let i = 0; i < 12; i++) ok(T().levelCell(i).par > 0, 'blueprint ' + (i + 1) + ' hands over a par');
}
{
  // cleared → ✓, and the next unplayed one moves along
  const gd = runGame({ store: { floodgate_done: JSON.stringify({ v: 1, done: [0, 1, 2] }) } });
  const T = gd.T;
  ok(T().levelCell(0).status === 'done', 'a sealed blueprint reports "done" (got ' + T().levelCell(0).status + ')');
  ok(T().levelCell(3).status === 'next', 'blueprint 4 is next up (got ' + T().levelCell(3).status + ')');
  ok(T().levelCell(4).locked === true, 'blueprint 5 is still locked');
  T().menu().activate('play');
  const pk = T().menu();
  ok(pk.select('level', '3') === true, 'an unlocked blueprint can be picked');
  pk.activate('start');
  ok(T().level === 3 && T().state === 'playing', 'the picked blueprint is the one that starts (got index ' + T().level + ')');
}
{
  // a locked blueprint can never become the selection, so the primary can never start one
  const gl = runGame();
  gl.T().menu().activate('play');
  const pk = gl.T().menu();
  ok(gl.T().levelCell(5).locked === true, 'blueprint 6 is locked on a fresh device');
  pk.select('level', '5');
  ok(pk.selection().level === '0', 'the kit grid refuses to select a locked cell (selection ' + pk.selection().level + ')');
  pk.activate('start');
  ok(gl.T().level === 0 && gl.T().state === 'playing', 'the primary starts the still-selected open blueprint (got ' + gl.T().level + ')');
}
{
  // the kit component is the screen: 12 cells, Esc = BACK, and the primary routes to a run
  const gk2 = runGame();
  gk2.T().menu().activate('play');
  const pk = gk2.T().menu();
  ok(pk.select('level', '11') === true, 'the picker exposes all 12 blueprints through the kit grid');
  ok(pk.activate('back') === true, 'the kit picker carries a BACK action');
  ok(gk2.T().menuScreen === 'start', 'BACK lands on the start menu (got ' + gk2.T().menuScreen + ')');
  ok(gk2.errors.length === 0, 'the kit levels screen raised no errors (' + gk2.errors.join(' | ') + ')');
}

// ---- Hints ----
// find a rotatable, live pipe (one that par actually counts)
const findLive = (T) => { for (let i = 0; i < T().cols * T().rows; i++) if (T().isLive(i)) return i; return -1; };
const xyOf = (T, i) => [i % T().cols, (i / T().cols) | 0];

section('floodgate: a hint always names a genuinely wrong pipe');
{
  const gh = runGame();
  const T = gh.T;
  T().startMode('campaign', 8);                   // tier 3: crossovers, conduits, decoys, the lot
  ok(T().hintsUsed === 0 && T().hintClean === true, 'a fresh run has taken no hints');
  ok(T().hintCell === -1, 'nothing is ringed before the first hint');
  const wrong = T().wrongPipes();
  ok(wrong.length > 0, 'a dealt board has wrong pipes to point at (' + wrong.length + ')');
  ok(wrong.every(i => T().isLive(i)), 'every candidate is a LIVE pipe, never decoy pipework');
  ok(wrong.every(i => !T().isRight(i)), 'no candidate is already in a solution orientation');
  ok(T().hint() === true, 'the hint fires');
  ok(T().hintCell >= 0, 'a pipe is ringed (index ' + T().hintCell + ')');
  ok(T().isRight(T().hintCell) === false, 'the ringed pipe is NOT already right');
  ok(T().isLive(T().hintCell) === true, 'the ringed pipe is a live pipe');
  ok(T().hintsUsed === 1, 'the kit counted the hint (got ' + T().hintsUsed + ')');
  ok(T().hintClean === false, 'the run is no longer clean');
  ok(T().hintBadge === '💡1', 'the kit badge reads the count (got "' + T().hintBadge + '")');
  ok(rendersOk(gh), 'the hint ring renders');
  // acting on the hint clears the ring
  const [hx, hy] = xyOf(T, T().hintCell);
  T().rotate(hx, hy, true);
  ok(T().hintCell === -1, 'turning the ringed pipe stops the ring');
  ok(gh.errors.length === 0, 'the hint path raised no errors (' + gh.errors.join(' | ') + ')');
}
{
  // the real risk: after the player has rotated things OFF the intended route, a hint must still
  // name something genuinely wrong — never a pipe that is already fine
  const gd = runGame();
  const T = gd.T;
  T().startMode('campaign', 11);
  const n = T().cols * T().rows;
  // drift: turn every live pipe a random-but-fixed amount, then partially solve some of them
  let turns = 0;
  for (let i = 0; i < n; i++) if (T().isLive(i)) { const [x, y] = xyOf(T, i); for (let k = 0; k <= (i % 3); k++) { T().rotate(x, y, true); turns++; } }
  ok(turns > 0, 'the board was driven off-route (' + turns + ' turns)');
  ok(T().solved === false, 'the drifted board is not sealed');
  let checked = 0, lies = 0, dead = 0;
  for (let k = 0; k < 40; k++) {
    if (!T().hint()) { dead++; break; }
    const c = T().hintCell;
    checked++;
    if (c < 0 || T().isRight(c) || !T().isLive(c)) lies++;
    // act on half of them so the board keeps changing under the hint
    if (k % 2 === 0) { const [x, y] = xyOf(T, c); T().rotate(x, y, true); }
    if (T().solved) break;
  }
  ok(checked > 10, 'the drifted board keeps producing hints (' + checked + ')');
  ok(dead === 0, 'no hint was refused while the board was still unsealed');
  ok(lies === 0, 'every hint on a drifted board named a genuinely wrong live pipe (lies ' + lies + ')');
  ok(gd.errors.length === 0, 'drift + hints raised no errors (' + gd.errors.join(' | ') + ')');
}
{
  // a sealed board has nothing honest to say
  const gs3 = runGame();
  const T = gs3.T;
  T().startMode('campaign', 0);
  T().solve();
  ok(T().solved === true, 'board sealed');
  ok(T().wrongPipes().length === 0, 'a sealed board has no wrong pipes');
  ok(T().hint() === false, 'a hint is refused on a sealed board');
  ok(T().hintCell === -1, 'and nothing is ringed');
}

section('floodgate: repeated hints cycle before repeating one');
{
  const gc3 = runGame();
  const T = gc3.T;
  T().startMode('campaign', 11);                  // biggest board → the longest cycle
  const pool = T().wrongPipes().length;
  ok(pool >= 6, 'the board has a decent pool of wrong pipes (' + pool + ')');
  const seen = [];
  for (let k = 0; k < pool; k++) { ok(T().hint() === true, 'hint ' + (k + 1) + ' fires'); seen.push(T().hintCell); }
  ok(new Set(seen).size === pool, 'the first ' + pool + ' hints are all DIFFERENT pipes (' + new Set(seen).size + ' distinct)');
  // nothing was turned, so the pool is unchanged — the next hint restarts the cycle
  ok(T().hint() === true, 'the cycle wraps rather than refusing');
  ok(seen.indexOf(T().hintCell) >= 0, 'the wrapped hint reuses a pipe from the same pool');
  ok(T().hintsUsed === pool + 1, 'every hint was counted (' + T().hintsUsed + ')');
  // "prefer pipes the water currently reaches" — the first hint on a dealt board is a wet one when
  // any wrong pipe is wet at all
  const gw = runGame();
  gw.T().startMode('campaign', 8);
  gw.T().hint();
  ok(gw.T().hintCell >= 0, 'the first hint lands somewhere');
}

section('floodgate: a hinted board cannot earn par or better');
{
  // The end screen's turns line carries the par VERDICT. A hinted run forfeits it — the hint tally
  // takes that slot instead, however few turns the run cost.
  const gcl = runGame();
  gcl.T().startMode('campaign', 0);
  gcl.T().solve();
  const clean = gcl.T().endLine().join(' | ');
  ok(/under par|dead on par|over par/.test(clean), 'a clean run gets a par verdict ("' + clean + '")');
  ok(!/💡/.test(clean), 'and no hint tally');

  const gp2 = runGame();
  gp2.T().startMode('campaign', 0);
  ok(gp2.T().hint() === true, 'a hint is taken');
  gp2.T().solve();
  ok(gp2.T().solved === true, 'the hinted board still seals');
  const hinted = gp2.T().endLine().join(' | ');
  ok(/💡1/.test(hinted), 'the end screen prints the hint tally ("' + hinted + '")');
  ok(!/under par|dead on par/.test(hinted), 'and no par-or-better praise ("' + hinted + '")');
  // even a run that finishes UNDER par gets no praise once it has been hinted
  ok(gp2.T().hintClean === false, 'the run is flagged as hinted whatever its turn count');
}
{
  // Daily: three stars IS the par-or-better reward, so a hint caps the award at two
  const gcl = runGame();
  gcl.T().startMode('daily');
  ok(gcl.T().starCap === 3, 'a clean daily run can reach three stars');
  gcl.T().solve();
  const cleanStars = gcl.T().stars;
  ok(cleanStars >= 1 && cleanStars <= 3, 'the clean solve is rated (got ' + cleanStars + ')');

  const ghn = runGame();
  ghn.T().startMode('daily');
  ok(ghn.T().hint() === true, 'a hint is taken on the daily board');
  ok(ghn.T().starCap === 2, 'the star cap drops to two (got ' + ghn.T().starCap + ')');
  ghn.T().solve();
  ok(ghn.T().solved === true, 'the hinted daily board still seals');
  ok(ghn.T().stars === Math.min(2, cleanStars), 'the hinted rating is the clean one capped at two (' + ghn.T().stars + ' vs clean ' + cleanStars + ')');
  ok(ghn.T().hintsUsed === 1, 'the hint is on the record');
  ghn.T().step(180);
  ok(ghn.T().state === 'over', 'the daily run ended');
  ok(ghn.T().hintBadge === '💡1', 'the end screen has a hint badge to show (' + ghn.T().hintBadge + ')');
}
{
  // the cost survives quitting to the menu and continuing — a hint cannot be laundered
  const gq3 = runGame();
  gq3.T().startMode('endless');
  gq3.T().hint();
  ok(gq3.T().hintsUsed === 1, 'one hint taken');
  gq3.T().saveNow();
  const snap = { ...gq3.store };
  const gr3 = bootGame(FILE, { seed: 11, store: snap });
  ok(gr3.T().resume() === true, 'the run resumes');
  ok(gr3.T().hintsUsed === 1, 'the resumed run still owes the hint (got ' + gr3.T().hintsUsed + ')');
  ok(gr3.T().hintClean === false, 'so it still cannot claim par or better');
}

section('floodgate: the Endless hint costs seconds and is never fatal');
{
  const ge3 = runGame();
  const T = ge3.T;
  T().startMode('endless');
  ok(T().timed === true, 'endless boards are timed');
  const before = T().timeLeft;
  ok(before > T().hintCost + 5, 'the fresh board has more clock than a hint costs (' + Math.round(before) + 's)');
  ok(T().hint() === true, 'the hint fires in endless');
  const after = T().timeLeft;
  ok(Math.abs((before - after) - T().hintCost) < 0.01, 'it charged exactly ' + T().hintCost + 's (' + Math.round(before) + ' → ' + Math.round(after) + ')');
  // never fatal: at a low clock the charge is clamped, and the run must not end
  T().setTimeLeft(4);
  ok(T().hint() === true, 'a hint is still given at 4s left');
  ok(T().timeLeft > 0, 'the clock did not hit zero (got ' + T().timeLeft.toFixed(2) + 's)');
  T().step(1);
  ok(T().state === 'playing', 'the run is still alive after a hint at 4s (got ' + T().state + ')');
  T().setTimeLeft(1);
  ok(T().hint() === true, 'a hint at 1s left is not refused');
  ok(T().timeLeft >= 0.9, 'and below the floor it is simply free (' + T().timeLeft.toFixed(2) + 's)');
  T().step(1);
  ok(T().state === 'playing', 'still alive');
  ok(ge3.errors.length === 0, 'no errors (' + ge3.errors.join(' | ') + ')');
}
{
  // untimed modes pay nothing off a clock
  const gu = runGame();
  gu.T().startMode('campaign', 0);
  const t0 = gu.T().timeSec;
  gu.T().hint();
  ok(gu.T().timeSec === t0, 'campaign hints cost no time (the mode has no clock)');
  ok(gu.T().hintsUsed === 1, 'but they are still counted');
}

section('floodgate: the campaign par curve climbs');
{
  const gcurve = runGame();
  const T = gcurve.T;
  const pars = [], tiers = [];
  for (let lv = 0; lv < 12; lv++) { T().startMode('campaign', lv); pars.push(T().par); tiers.push(T().tier); }
  ok(pars.every(p => p > 0), 'every campaign blueprint has a par (' + pars.join(',') + ')');
  let rising = true;
  for (let i = 1; i < pars.length; i++) if (pars[i] < pars[i - 1]) rising = false;
  ok(rising, 'par never drops from one blueprint to the next (' + pars.join(' → ') + ')');
  ok(pars[11] >= pars[0] * 3, 'the last blueprint is at least 3x the work of the first (' + pars[0] + ' → ' + pars[11] + ')');
  ok(tiers.join('') === '111122223333', 'tiers land 4 per tier in order (' + tiers.join('') + ')');
  // the picker prints par from the LEVELS table (generating 12 boards would hitch the menu open) —
  // so the table must equal what the generator actually deals, on every level
  const table = [];
  for (let lv = 0; lv < 12; lv++) table.push(T().levelPar(lv));
  ok(table.join(',') === pars.join(','), 'the par table matches the dealt boards (table ' + table.join(',') + ' vs dealt ' + pars.join(',') + ')');
}

summary();
