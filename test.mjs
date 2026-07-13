// Headless tests for the arcade: catalogue wiring + Tower Defense logic + every live game's
// boot + the shared game-kit — all through the shared harness (test-harness.mjs).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bootGame, makeSandbox, ok, section, summary, KIT, I18N, ROOT } from './test-harness.mjs';

const DIR = ROOT;

// ---------------- Catalogue ----------------
function testCatalogue() {
  section('index.html (catalogue)');
  const games = fs.readFileSync(path.join(DIR, 'games.js'), 'utf8');
  const challenges = fs.readFileSync(path.join(DIR, 'challenges.js'), 'utf8');
  const g = bootGame('index.html', { preCode: [games, challenges] });
  ok(g.bootErr === null, 'catalogue boots: ' + g.bootErr);
  ok(typeof g.win.__renderChallenges === 'function', 'challenges panel render is wired');
  let cerr = null; try { g.win.__renderChallenges(); } catch (e) { cerr = e.message; }
  ok(cerr === null, 'rendering challenges does not throw: ' + cerr);
  const eb = g.getEl('embedBtn'); let ebErr = null; try { eb.fire('click'); } catch (e) { ebErr = e.message; }
  ok(ebErr === null, 'Embed-a-game menu opens without throwing: ' + ebErr);
  // Settings → Version row: update button wired to gamekit.updates, greyed when current, headless-safe
  ok(g.getEl('setVersion').textContent === 'dev', 'Settings shows the running version (dev locally, got "' + g.getEl('setVersion').textContent + '")');
  ok(String(g.getEl('setUpdate').textContent).indexOf('Up to date') >= 0 && g.getEl('setUpdate').disabled === true,
    'Settings update button is greyed "✓ Up to date" when no update is known (got "' + g.getEl('setUpdate').textContent + '")');
  let drErr = null; try { g.getEl('setUpdate').fire('click'); } catch (e) { drErr = e.message; }
  ok(drErr === null, 'Settings update button runs headless without throwing: ' + drErr);
  // the top-bar ⚙️ Settings button (it hosts "Update now") lights the 'tb-notify' dot, driven by
  // gamekit.updates — catches "update ready but the home page shows nothing" regressions.
  {
    const mb = g.getEl('settingsBtn');
    ok(!mb.classList.contains('tb-notify'), '⚙️ has no dot with no update pending (got classes: ' + mb.className + ')');
    ok(typeof g.win.__syncTitleNotify === 'function', '__syncTitleNotify is exposed for the update-dot render path');
    g.win.gamekit.updates.state().available = true;
    g.win.__syncTitleNotify(); // renderMenuDot() reads updates.state() live — no need to go through upEmit()
    ok(mb.classList.contains('tb-notify'), '⚙️ gets the dot once gamekit.updates reports an update available');
    g.win.gamekit.updates.state().available = false;
    g.win.__syncTitleNotify();
    ok(!mb.classList.contains('tb-notify'), '⚙️ drops the dot once the update state clears');
  }
  // density toggle: cozy ⇄ compact
  const db = g.getEl('densityBtn'); db.fire('click');
  ok(g.getEl('grid').classList.contains('compact'), 'density toggle → compact');
  db.fire('click');
  ok(!g.getEl('grid').classList.contains('compact'), 'density toggle → back to cozy');
  const GAMES = g.win.GAMES;
  ok(Array.isArray(GAMES) && GAMES.length >= 2, 'games.js exposes games (got ' + (GAMES && GAMES.length) + ')');
  // tile identity must be unique — duplicate slugs break storage/URLs, duplicate icons confuse the shelf
  {
    const bySlug = {}, byIcon = {};
    GAMES.forEach(gm => { (bySlug[gm.slug] ||= []).push(gm.slug); (byIcon[gm.icon] ||= []).push(gm.slug); });
    const dupSlugs = Object.keys(bySlug).filter(k => bySlug[k].length > 1);
    const dupIcons = Object.keys(byIcon).filter(k => byIcon[k].length > 1).map(k => k + ' (' + byIcon[k].join(', ') + ')');
    ok(dupSlugs.length === 0, 'no duplicate slugs in games.js' + (dupSlugs.length ? ': ' + dupSlugs.join(', ') : ''));
    ok(dupIcons.length === 0, 'no duplicate tile icons in games.js' + (dupIcons.length ? ': ' + dupIcons.join('; ') : ''));
    // blurbs are TILE copy — one glanceable sentence, not a paragraph (longest today: 94)
    const BLURB_MAX = 95;
    const longBlurbs = GAMES.filter(gm => String(gm.blurb || '').length > BLURB_MAX)
      .map(gm => gm.slug + ' (' + String(gm.blurb).length + ')');
    ok(longBlurbs.length === 0, 'every games.js blurb is ≤ ' + BLURB_MAX + ' chars' + (longBlurbs.length ? ' — TOO LONG: ' + longBlurbs.join(', ') : ''));
  }
  const grid = g.getEl('grid');
  // #grid now also holds full-width section dividers, so count only the tiles.
  const tiles = () => grid.children.filter(c => c.className && String(c.className).includes('tile'));
  ok(tiles().length === GAMES.length, 'one tile per game (got ' + tiles().length + ')');
  ok(tiles()[0] && tiles()[0].href === 'games/' + GAMES[0].slug + '/', 'first tile links to games/<slug>/ (got ' + (tiles()[0] && tiles()[0].href) + ')');
  // favorites: starring the 2nd playable game sorts it to the top of its section
  const star = tiles()[1] && tiles()[1].children[0]; // 2nd tile's ★ button
  ok(star, 'playable tile has a favorite star');
  if (star) {
    star.fire('click');
    ok(tiles()[0].href === 'games/' + GAMES[1].slug + '/', 'favoriting sorts that game first (got ' + tiles()[0].href + ')');
    // unfavorite restores original order
    tiles()[0].children[0].fire('click');
    ok(tiles()[0].href === 'games/' + GAMES[0].slug + '/', 'unfavoriting restores order');
  }

  // section structure: All games (single + multi merged) then Coming soon as its own shelf —
  // heads are .section-head grid children; tiles partition exactly across the sections
  {
    const heads = grid.children.filter(c => c.className && String(c.className).includes('section-head'));
    const headLabel = h => { const h2 = h.children.find(c => c.id === 'new-h2' || String(c.innerHTML || '').length); return h2 ? String(h2.innerHTML) : ''; };
    const labels = heads.map(headLabel);
    ok(labels.some(l => l.includes('All games')), 'has an "All games" section head (got ' + JSON.stringify(labels) + ')');
    ok(labels.some(l => l.includes('Coming soon')), 'has a "Coming soon" section head');
    ok(!labels.some(l => l.includes('Single player') || l.includes('Multiplayer')), 'Single player / Multiplayer sections are gone (merged into All games)');
    const soonCount = GAMES.filter(gm => gm.soon).length;
    ok(tiles().filter(t => String(t.className).includes('soon')).length === soonCount, 'every coming-soon game renders exactly once (' + soonCount + ')');
  }

  // manual favorites reorder — favorites tiles are ALWAYS drag handles (mouse drag-threshold /
  // touch long-press; no edit mode). The drag itself needs real geometry (headless rects are all
  // identical), so the reorder LOGIC is exercised via the same window.__favReorder path the drag
  // persists through.
  {
    const playable = GAMES.filter(gm => !gm.soon);
    ok(playable.length >= 3, 'catalogue has ≥3 playable games to exercise reordering');
    if (playable.length >= 3) {
      const [ga, gb, gc] = playable;
      for (const slug of [ga.slug, gb.slug, gc.slug]) {
        const t = tiles().find(el => el.href === 'games/' + slug + '/');
        t.children[0].fire('click'); // ★
      }
      ok(tiles()[0].href === 'games/' + ga.slug + '/' && tiles()[1].href === 'games/' + gb.slug + '/' && tiles()[2].href === 'games/' + gc.slug + '/',
        'favorites render in the order they were starred (got ' + tiles().slice(0, 3).map(t => t.href).join(', ') + ')');
      const favTiles = () => tiles().filter(t => String(t.className).includes('fav-tile'));
      ok(favTiles().length === 3, 'all favorite tiles are drag handles, no edit mode needed (got ' + favTiles().length + ')');
      ok(typeof g.win.__favReorder === 'function', 'reorder hook exposed');
      g.win.__favReorder(1, 2); // move gb below gc — same persistence path the drag uses
      ok(JSON.stringify(JSON.parse(g.store['arcade_favs'])) === JSON.stringify([ga.slug, gc.slug, gb.slug]),
        'reorder persists to localStorage in the new order (got ' + g.store['arcade_favs'] + ')');
      ok(tiles()[1].href === 'games/' + gc.slug + '/' && tiles()[2].href === 'games/' + gb.slug + '/',
        'reorder re-renders the strip in the new order');
      g.win.__favReorder(0, 5); // out of bounds → no-op
      ok(JSON.parse(g.store['arcade_favs'])[0] === ga.slug, 'out-of-range reorder is a no-op');
      // the DROP path persists through __commitFavOrder(visible DOM order) — merged back into the
      // FULL list, so favorites hidden by an active filter must survive a filtered reorder
      ok(typeof g.win.__commitFavOrder === 'function', 'drop-commit hook exposed');
      g.win.__commitFavOrder([gb.slug, ga.slug]); // as if gc were filtered out of view
      ok(JSON.stringify(JSON.parse(g.store['arcade_favs'])) === JSON.stringify([gb.slug, gc.slug, ga.slug]),
        'filtered drop reorders the visible favorites in place and KEEPS the hidden one (got ' + g.store['arcade_favs'] + ')');
      g.win.__commitFavOrder([ga.slug, gc.slug, gb.slug]); // full-view drop still works
      ok(JSON.stringify(JSON.parse(g.store['arcade_favs'])) === JSON.stringify([ga.slug, gc.slug, gb.slug]),
        'unfiltered drop persists the plain DOM order (got ' + g.store['arcade_favs'] + ')');
      for (const slug of [ga.slug, gb.slug, gc.slug]) {
        const t = tiles().find(el => el.href === 'games/' + slug + '/');
        t.children[0].fire('click');
      }
      ok(tiles()[0].href === 'games/' + GAMES[0].slug + '/', 'unfavoriting all three restores original order');
    }
  }

  // "Recently played" rail: absent with nothing recorded; renders FULL game cards (tileEl tiles)
  // inside a horizontal .recent-row (in a .recent-wrap with a » paddle), in recency order,
  // skipping unknown/soon slugs — favorited games DO appear (duplicate beats a hole in history).
  const railOf = gg => {
    const wrap = gg.getEl('grid').children.find(c => String(c.className).includes('recent-wrap'));
    return wrap ? wrap.children.find(c => String(c.className).includes('recent-row')) : null;
  };
  {
    ok(!grid.children.some(c => String(c.className).includes('recent-wrap')), 'no Recently-played rail with nothing recorded');
    const playable = GAMES.filter(gm => !gm.soon);
    const soonSlug = (GAMES.find(gm => gm.soon) || {}).slug;
    const seeded = [{ slug: playable[1].slug, at: 2 }, { slug: 'not-a-real-game', at: 1.5 }, { slug: playable[0].slug, at: 1 }];
    if (soonSlug) seeded.splice(1, 0, { slug: soonSlug, at: 1.7 });
    const g2 = bootGame('index.html', { preCode: [games, challenges], store: { gamekit_recent: JSON.stringify(seeded) } });
    ok(g2.bootErr === null, 'catalogue boots fine with recently-played data seeded: ' + g2.bootErr);
    const row = railOf(g2);
    ok(!!row, 'Recently-played rail renders once something valid is recorded');
    const cards = row ? row.children.filter(c => String(c.className).includes('tile')) : [];
    ok(cards.length === 2, 'unknown-slug and soon-game entries are skipped (got ' + cards.length + ')');
    ok(cards[0] && cards[0].href === 'games/' + playable[1].slug + '/' && cards[1] && cards[1].href === 'games/' + playable[0].slug + '/',
      'full game cards render in recency order (got ' + cards.map(c => c.href).join(', ') + ')');
    ok(cards[0] && String(cards[0].innerHTML).includes('class="play"'), 'rail cards are the full tile (art + meta + PLAY), not mini chips');
    // the » paddle exists and firing it headless doesn't throw (scrollBy is guarded)
    const wrap2 = g2.getEl('grid').children.find(c => String(c.className).includes('recent-wrap'));
    const paddle = wrap2 && wrap2.children.find(c => String(c.className).includes('recent-next'));
    ok(!!paddle, 'rail has the » paddle');
    let perr = null; try { paddle.fire('click'); } catch (e) { perr = e.message; }
    ok(perr === null, '» paddle fires headless without throwing: ' + perr);
    // a favorited game shows BOTH in Favorites and in the rail (recency history stays complete)
    const g3 = bootGame('index.html', { preCode: [games, challenges], store: { gamekit_recent: JSON.stringify(seeded), arcade_favs: JSON.stringify([playable[1].slug]) } });
    const row3 = railOf(g3);
    const cards3 = row3 ? row3.children.filter(c => String(c.className).includes('tile')) : [];
    ok(cards3.length === 2 && cards3[0].href === 'games/' + playable[1].slug + '/',
      'favorited games still appear in the rail (got ' + cards3.map(c => c.href).join(', ') + ')');
  }

  // side stack (Profile / Challenges / Collection) + top-right row: wired, headless-safe
  {
    ok(!!g.getEl('sideStack') && !!g.getEl('sidePanel'), 'side stack markup present');
    let err = null;
    try { g.getEl('profileQuick').fire('click'); g.getEl('collectionQuick').fire('click'); g.getEl('sideTab').fire('click'); } catch (e) { err = e.message; }
    ok(err === null, 'side-stack buttons + tab fire headless without throwing: ' + err);
    ok(g.getEl('fsBtn').hidden !== false, 'fullscreen button is never un-hidden where the API is unsupported (mock)');
    ok(typeof g.win.__wornTitle === 'function' && typeof g.win.__wornTitle().tier === 'number', '__wornTitle exposes {tier, emoji, name} for the Profile button');
    // notification dots: a stack button can carry one; the ‹‹ tab bubbles it ONLY while hidden
    ok(typeof g.win.__setStackDot === 'function', '__setStackDot exposed');
    g.win.__setStackDot('profileQuick', true);
    ok(g.getEl('profileQuick').classList.contains('has-dot'), 'a stack button shows its dot');
    ok(!g.getEl('sideTab').classList.contains('has-dot'), 'no tab bubble while the drawer is OPEN (the earlier tab click left it shown)');
    g.getEl('sideTab').fire('click'); // hide the drawer
    ok(g.getEl('sideTab').classList.contains('has-dot'), 'the hidden drawer bubbles the dot to the ‹‹ tab');
    g.win.__setStackDot('profileQuick', false);
    ok(!g.getEl('profileQuick').classList.contains('has-dot'), 'clearing the source clears the button dot');
    // load-time: an unseen EARNED title must dot the Profile button at boot, with NO manual
    // re-sync — mountProfilePanels' sync runs before __setStackDot exists, so sideStack has to
    // re-sync once its dot plumbing is wired (regression: the dot was silently never applied in games)
    {
      const gT = bootGame('index.html', { preCode: [games, challenges], store: { gamekit_done: JSON.stringify({ x: 100 }) } });
      ok(gT.getEl('profileQuick').classList.contains('has-dot'), 'an unseen earned title dots the Profile button at load (no manual sync)');
    }
    // Challenges dot: an unseen rotation lights it from boot (it's why the tab is still dotted)
    ok(g.getEl('chalBtn').classList.contains('has-dot'), 'a never-seen challenge rotation lights the Challenges dot');
    ok(g.getEl('sideTab').classList.contains('has-dot'), 'tab still bubbles the remaining challenges dot');
    g.getEl('chalBtn').fire('click');
    ok(!g.getEl('chalBtn').classList.contains('has-dot'), 'opening the challenges drawer clears the dot');
    ok(!g.getEl('sideTab').classList.contains('has-dot'), 'with every source clear, the tab dot goes too');
    ok(!!g.store['arcade_chal_seen'], 'the seen rotation pair persists (got ' + g.store['arcade_chal_seen'] + ')');
    // the drawer POINTS at what was new: the unseen rotation's card is badged on that first open…
    ok(g.getEl('chalToday').classList.contains('ch-new') && g.getEl('chalWeek').classList.contains('ch-new'),
      'first open badges the never-seen daily + weekly cards as NEW');
    // …and a second open (nothing new anymore) clears the badges
    g.getEl('chalBtn').fire('click');
    ok(!g.getEl('chalToday').classList.contains('ch-new') && !g.getEl('chalWeek').classList.contains('ch-new'),
      'reopening with nothing new shows no NEW badges');
  }

  // 🐣 Easy picks lifts KIDS-tagged games to the top of the All-games shelf
  {
    const ge = bootGame('index.html', { preCode: [games, challenges], store: { gamekit_easy: '1' } });
    const tiles = [];
    (function walk(el) { if (!el) return; if (String(el.className || '').split(/\s+/).indexOf('tile') >= 0 && el.href) tiles.push(el.href); (el.children || []).forEach(walk); })(ge.getEl('grid'));
    const kids = (ge.win.GAMES || []).filter(x => !x.soon && (x.tags || []).indexOf('KIDS') >= 0).map(x => 'games/' + x.slug + '/');
    ok(kids.length >= 3 && tiles.slice(0, kids.length).join(',') === kids.join(','),
      'easy picks: KIDS games lead All games (got ' + tiles.slice(0, kids.length + 1).join(', ') + ')');
  }

  // challenge history back-fill: a completion is recorded even when detected on a later catalogue
  // load (the old code only awarded "today's" goal lazily, so in-game completions were lost).
  {
    const K = g.win.gamekit, C = g.win.CHALLENGES;
    if (K && C && C.daily && C.daily.length) {
      const day = K.utcDayNumber(), dStr = K.utcDateStr();
      // today's goal via the kit's hashed challengePick — the ONE pick math (drawer + panel + badges)
      const p = K.challengePick('daily'), id = p && p.id, goal = p && p.goal;
      if (goal && goal.scope === 'cross') {
        const slugs = GAMES.filter(x => !x.soon).slice(0, 5).map(x => x.slug);
        g.store['gamekit_played_' + dStr] = JSON.stringify({ slugs, totalScore: 1e9, count: 99, goodRuns: 99 });
      } else if (goal && goal.scope === 'random') {
        // mirror the evaluator's playableSince freeze — a game whose go-live date is after today
        // is NOT in today's pool (ISO date strings compare lexically)
        const playable = GAMES.filter(x => x && x.slug && !x.soon
          && (!(C.playableSince || {})[x.slug] || C.playableSince[x.slug] <= dStr)).map(x => x.slug);
        const slug = C.randomSlug(day, playable); // today's deterministic pick
        g.store['gamekit_played_' + dStr] = JSON.stringify({ slugs: [slug], totalScore: 1, count: 1 });
      } else if (goal) {
        const best = {}; best[goal.slug] = { score: 1e9, time: 1e9, stats: { wave: 9999, accuracy: 100 } };
        g.store['gamekit_daybest_' + dStr] = JSON.stringify(best);
      }
      g.win.__renderChallenges();
      let hist = []; try { hist = JSON.parse(g.store['gamekit_history'] || '[]'); } catch (e) {}
      ok(hist.some(r => r && r.id === id), 'completing the daily challenge records it in history (back-fill, goal=' + id + ')');
    }
  }

  // weekly back-fill: a weekly finished LAST week (e.g. in an installed game PWA, catalogue never
  // opened) is still awarded on the next catalogue open — the previous week's Mon–Sun window is
  // re-evaluated from the retained played-logs, not just the current week
  {
    const K = g.win.gamekit, C = g.win.CHALLENGES;
    if (K && C && C.weekly && C.weekly.length) {
      const today = K.utcDayNumber();
      const w = K.challengePick('weekly', today - 7); // LAST week's pick + period key
      if (w && w.goal) {
        const playable = GAMES.filter(x => x && x.slug && !x.soon).map(x => x.slug);
        // blanket logs for every day of last week — enough to satisfy ANY weekly goal (cross or random)
        const lastMon = today - 7 - (((today - 7 - K.utcDayNumber(Date.UTC(2026, 5, 22))) % 7) + 7) % 7;
        for (let d = lastMon; d < lastMon + 7; d++) {
          g.store['gamekit_played_' + K.utcDateStr(d * 86400000)] =
            JSON.stringify({ slugs: playable, totalScore: 1e9, count: 99, goodRuns: 99 });
        }
        delete g.store['gamekit_done']; delete g.store['gamekit_history'];
        g.win.__renderChallenges();
        let done = {}; try { done = JSON.parse(g.store['gamekit_done'] || '{}'); } catch (e) {}
        ok((w.period + '#' + w.id) in done,
          'last week\'s weekly is awarded by back-fill on catalogue open (want key ' + w.period + '#' + w.id + ', got ' + Object.keys(done).join(',') + ')');
      }
    }
  }

  // goodRuns unification: the catalogue awards a "good runs" daily via the kit's evaluator
  // (the old duplicate catalogue evaluator had no goodRuns metric, so these could never complete)
  {
    const K = g.win.gamekit, C = g.win.CHALLENGES;
    if (K && C && C.goals && C.goals.good3) {
      const dStr = K.utcDateStr(), dailyBak = C.daily;
      C.daily = ['good3']; // force today's daily to the goodRuns goal
      g.store['gamekit_played_' + dStr] = JSON.stringify({ slugs: ['snake'], totalScore: 500, count: 3, goodRuns: 3 });
      delete g.store['gamekit_done']; delete g.store['gamekit_history'];
      g.win.__renderChallenges();
      let done = {}; try { done = JSON.parse(g.store['gamekit_done'] || '{}'); } catch (e) {}
      ok((dStr + '#good3') in done, 'a goodRuns daily completes + awards points on the catalogue (kit evaluator)');
      let hist = []; try { hist = JSON.parse(g.store['gamekit_history'] || '[]'); } catch (e) {}
      ok(hist.some(r => r && r.id === 'good3'), 'the goodRuns completion lands in history');
      C.daily = dailyBak;
    }
  }

  // ---- 🎲 random game: button pool + deterministic challenge pick ----
  {
    const C = g.win.CHALLENGES;
    const all = GAMES.filter(x => x && x.slug && !x.soon);
    // button pool: unplayed-first, all-games fallback
    if (typeof g.win.__randomPool === 'function' && all.length >= 2) {
      const played = new Set([all[0].slug]);
      const pool = g.win.__randomPool(all, played);
      ok(pool.length === all.length - 1 && !pool.some(x => x.slug === all[0].slug), 'random button prefers unplayed games (excludes the one played)');
      const allPlayed = new Set(all.map(x => x.slug));
      const fb = g.win.__randomPool(all, allPlayed);
      ok(fb.length === all.length, 'random button falls back to all games when nothing is unplayed');
    }
    // challenge pick: deterministic + always a real playable slug + differs across days
    if (C && typeof C.randomSlug === 'function' && all.length >= 2) {
      const playable = all.map(x => x.slug);
      const a = C.randomSlug(100, playable), b = C.randomSlug(100, playable);
      ok(a === b && playable.indexOf(a) >= 0, 'randomSlug is deterministic and returns a real playable slug (' + a + ')');
      let distinct = new Set(); for (let d = 0; d < playable.length; d++) distinct.add(C.randomSlug(d, playable));
      ok(distinct.size > 1, 'randomSlug varies across days (got ' + distinct.size + ' distinct over ' + playable.length + ' days)');
      ok(C.randomSlug(5, []) === '', 'randomSlug is safe with an empty pool');
    }
  }

  // ---- profile card: big numbers format + dedup + pluralization ----
  if (typeof g.win.__renderProfile === 'function') {
    const body = g.getEl('profileBody');
    // (1) huge values: comma grouping, merged "Your games" block, ×N only when >1
    for (const k of Object.keys(g.store)) if (k.indexOf('gamekit_') === 0) delete g.store[k];
    g.store['gamekit_pb'] = JSON.stringify({
      asteroids: { 'Classic': { score: 300000, time: 0, plays: 90000, stats: {} }, 'Classic+': { score: 240000, time: 0, plays: 30000, stats: {} }, 'Classic Speedrun': { score: 2500, time: 92000, plays: 500, stats: {} } }, // Speedrun = time-primary

      bubbles: { 'Endless': { score: 30000, time: 0, plays: 5, stats: {} }, 'Arcade': { score: 22000, time: 0, plays: 3, stats: {} } },          // multi → ×5 shown
      'tower-defense': { 'Ice · Hard': { score: 90000, time: 0, plays: 120000, stats: {} } }, // single → header 120,000 plays, no ×
      snake: { 'Fast · Walls': { score: 300, time: 0, plays: 7, stats: {} } },                // single, 7 plays → ×7 hidden (redundant with header)
      'aim-trainer': { 'Timed · 30s': { score: 10000, time: 0, plays: 1, stats: {} } },        // single, 1 play → no ×
    });
    g.store['gamekit_stats'] = JSON.stringify({ first: Date.UTC(2024, 0, 1), days: 920, lastDay: '2026-07-01', goodRuns: 80000 });
    g.store['gamekit_history'] = JSON.stringify(Array.from({ length: 1800 }, (_, i) => ({ id: 'x' + i, day: i })));
    let perr = null; try { g.win.__renderProfile(); } catch (e) { perr = e.message; }
    ok(perr === null, 'profile renders with huge numbers without error: ' + perr);
    const h = body.innerHTML || '';
    const grp = n => Number(n).toLocaleString(); // same runtime → locale-agnostic (matches the render's fmt)
    ok(h.includes(grp(300000)), 'big record uses fmt grouping (' + grp(300000) + ')');
    ok(h.includes(grp(120000) + '</b> play'), 'huge play total is grouped in the header (' + grp(120000) + ')');
    ok(h.includes(grp(80000)), 'good runs uses fmt grouping (' + grp(80000) + ')');
    ok(h.includes('Your games') && !h.includes('Most played') && !h.includes('Records by game'), 'sections merged into one "Your games" block');
    ok(h.includes('pf-rhead') && h.includes('>Best<'), 'each card labels its value column "Best"');
    ok(h.includes('×' + grp(5) + '</i>'), 'a multi-mode game shows per-mode ×5');
    ok(h.includes('×' + grp(90000) + '</i>'), 'a high per-mode play count is grouped too (×' + grp(90000) + ')');
    ok(h.includes('×' + grp(7)), 'a single-mode game still shows its per-mode ×N (consistency)');
    ok(!h.includes('×' + grp(1) + '</i>'), 'no ×1 noise anywhere');
    ok(h.includes('01:32.00'), 'a Speedrun mode shows its record as time (mm:ss.cs), not points');
    ok(h.includes('📅 Since'), 'playing-since is surfaced in the highlights');
    ok(h.includes('pf-titlebar'), 'the identity box is the top element (no separate header)');
    // (2) singular labels — the "1 DAYS" bug
    for (const k of Object.keys(g.store)) if (k.indexOf('gamekit_') === 0) delete g.store[k];
    g.store['gamekit_pb'] = JSON.stringify({ snake: { 'Classic': { score: 5, time: 0, plays: 1, stats: {} } } });
    g.store['gamekit_stats'] = JSON.stringify({ first: Date.UTC(2026, 6, 1), days: 1, lastDay: '2026-07-01', goodRuns: 0 });
    g.store['gamekit_history'] = '[]';
    g.win.__renderProfile();
    const h2 = body.innerHTML || '';
    ok(h2.includes('<span>Day</span>') && !h2.includes('<span>Days</span>'), 'stat label is "Day" (singular) at count 1, not "Days"');
    ok(h2.includes('<span>Game</span>') && h2.includes('<span>Play</span>'), 'Game / Play labels also singular at count 1');
  }

  // ---- earned titles: challenge points → title + tier shine ----
  {
    const C = g.win.CHALLENGES;
    if (C && typeof C.titleFor === 'function') {
      ok(C.titleFor(0).title === 'Goblin of the Gutter' && C.titleFor(0).tier === 0, 'titleFor(0) → Goblin (tier 0)');
      ok(C.titleFor(99).tier === 0 && C.titleFor(100).tier === 1, 'crossing 100 pts promotes Goblin → Peasant');
      ok(C.titleFor(2500).title === 'Archmage of the Arcane', 'titleFor(2500) → Archmage (highest ≤ 2500)');
      ok(C.titleFor(1e9).title === 'Emperor of Eternity', 'huge points → Emperor (top title)');
    }
    if (typeof g.win.__renderProfile === 'function') {
      for (const k of Object.keys(g.store)) if (k.indexOf('gamekit_') === 0) delete g.store[k];
      g.store['gamekit_pb'] = JSON.stringify({ snake: { 'Classic': { score: 50, time: 0, plays: 3, stats: {} } } });
      g.store['gamekit_done'] = JSON.stringify({ a: 50, b: 50, c: 50, d: 50, e: 50, f: 50, gg: 50, h: 50, i: 50, j: 50 }); // 500 pts → Knight (tier 3)
      g.win.__renderProfile();
      const bh = g.getEl('profileBody').innerHTML || '';
      ok(bh.includes('Knight of the Realm') && bh.includes('pf-t3'), 'profile shows the earned title (Knight, tier 3) at 50 pts');
      ok(bh.includes('🏆 500 <span>'), 'title box surfaces the challenge-points total (🏆 500)');
      ok(bh.includes('pf-pfx'), 'a premium tier (3+) gets a particle canvas');
      ok(bh.includes('pf-tb-name') && bh.includes('pf-t3'), 'title + username share one full-width box, shined to the tier');
      ok(bh.includes('pf-name-btn') && bh.includes('Click to change your name'), 'profile name is a rename button with an instant tooltip');
      ok(!bh.includes('pf-tb-info'), 'no (i) button in the title box (ladder opens from the challenges points pill)');
      // the ☰ drawer carries NO identity card anymore — profile lives on the side stack; the
      // title-unlock notify dots the stack's Profile button and opening the profile marks it seen
      if (typeof g.win.__syncTitleNotify === 'function') {
        delete g.store['gamekit_title_seen'];
        g.win.__syncTitleNotify();
        const pq = g.getEl('profileQuick');
        ok(pq.classList.contains('has-dot'), 'unseen title tier dots the side stack\'s Profile button');
        pq.fire('click'); // opens the profile → counts as seen
        ok(g.store['gamekit_title_seen'] === '3', 'opening the profile persists the seen tier');
        g.win.__syncTitleNotify();
        ok(!pq.classList.contains('has-dot'), 'the Profile dot clears once the title was seen');
      }
    }
  }
}

// ---------------- Tower Defense ----------------
function freeCell(T) { // find a buildable cell
  for (let c = 0; c < T.cols; c++) for (let r = 0; r < T.rows; r++) if (!T.roadAt(c, r)) return { c, r };
  return null;
}
function testTD() {
  section('games/tower-defense (logic)');
  const g = bootGame('games/tower-defense/index.html', { seed: 0x7D5EED });
  ok(g.bootErr === null, 'TD boots: ' + g.bootErr);
  const T = () => g.test();
  ok(T() != null, 'TD exposes __test');
  T().start();
  ok(T().state === 'build' && T().gold === 80 && T().hp === 30, 'start → build, 80 gold (medium default), 30 keep HP (got ' + T().state + '/' + T().gold + '/' + T().hp + ')');

  const cell = freeCell(T());
  const before = T().gold;
  const placed = T().place('archer', cell.c, cell.r);
  ok(placed && T().towers === 1 && T().gold === before - 18, 'place archer: built + 18 gold spent (got ' + T().towers + '/' + T().gold + ')');
  ok(!T().place('cannon', cell.c, cell.r), 'cannot build on an occupied cell');

  T().startWave();
  ok(T().state === 'wave' && T().wave === 1, 'startWave → wave 1');
  T().step(60);
  ok(T().enemies > 0, 'enemies spawn during the wave (got ' + T().enemies + ')');

  const goldBeforeKills = T().gold;
  T().killAll();
  ok(T().gold > goldBeforeKills, 'killing enemies awards gold (' + goldBeforeKills + ' -> ' + T().gold + ')');

  // upgrade the tower
  T().addGold(500);
  const gBefore = T().gold;
  T().upgradeAt(cell.c, cell.r);
  ok(T().gold < gBefore, 'upgrade spends gold');

  // leaks reduce keep HP -> game over after enough undefended waves
  const g2 = bootGame('games/tower-defense/index.html', { seed: 0x7D5EED }); const U = () => g2.test();
  U().start();
  let guard = 0; while (U().hp > 0 && guard++ < 60000) { if (U().state === 'build') U().startWave(); U().step(1); }
  ok(U().hp <= 0 && U().state === 'over', 'undefended waves drain the keep and end the run (hp=' + U().hp + ', state=' + U().state + ')');
}

// ---------------- Live games smoke test ----------------
// Every catalogue game (except the asteroids launcher, which loads external
// level files) must boot headless and expose a window.__test hook.
function liveSlugs() {
  const src = fs.readFileSync(path.join(DIR, 'games.js'), 'utf8');
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(src, sb);
  return (sb.window.GAMES || []).filter(g => !g.soon && g.slug !== 'asteroids').map(g => g.slug);
}
function testLiveGames() {
  section('live games (boot + __test)');
  for (const slug of liveSlugs()) {
    const g = bootGame('games/' + slug + '/index.html');
    ok(g.bootErr === null, slug + ' boots headless: ' + g.bootErr);
    ok(g.test() != null, slug + ' exposes window.__test');
    // rotation: relayout to landscape then portrait must not throw (kit fires the game's resize)
    let rerr = null;
    try { g.win.gamekit.layout.__emit(900, 500); g.win.gamekit.layout.__emit(420, 840); } catch (e) { rerr = e.message; }
    ok(rerr === null, slug + ' relayouts on rotation without throwing: ' + rerr);
  }
}

// ---------------- game-kit (shared shell) ----------------
async function testKit() {
  section('game-kit (shared shell)');
  const g = makeSandbox({});
  g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js');
  const store = g.store, doc = g.doc, els = g.elCache;
  ok(g.bootErr === null, 'kit loads: ' + g.bootErr);
  const F = g.sandbox.gamekit;
  ok(F && F.sound && F.music && F.nav && F.audioMenu && F.resetScores && F.shareRow && F.shareUrls && F.pwa,
    'kit exposes sound/music/nav/audioMenu/resetScores/shareRow/shareUrls/pwa');
  if (!F) return;
  const u = F.shareUrls('https://komyo.online/games/snake/', 'I scored 42 in Neon Snake 🐍');
  ok(u.x.indexOf('twitter.com/intent/tweet') >= 0 && u.x.indexOf('&url=') >= 0, 'shareUrls.x is an X intent with url');
  ok(u.reddit.indexOf('reddit.com/submit') >= 0, 'shareUrls.reddit is a reddit submit');
  ok(u.copy.indexOf('I scored 42') === 0 && u.copy.indexOf('komyo.online/games/snake') >= 0, 'shareUrls.copy = message + newline + url');
  // SFX channel
  ok(F.sound.isMuted() === false, 'SFX starts unmuted');
  F.sound.toggle();
  ok(F.sound.isMuted() === true && store['gamekit_sfx_muted'] === '1', 'SFX toggle mutes + persists');
  F.sound.play('anything'); // muted + no AudioContext → must not throw
  F.sound.toggle();
  F.sound.volume(0.5);
  ok(store['gamekit_sfx_vol'] === '0.5', 'SFX volume persists (' + store['gamekit_sfx_vol'] + ')');
  // Music channel
  let musState = null; F.music.subscribe(s => { musState = s; });
  ok(musState && musState.muted === false, 'music.subscribe fires with initial state');
  F.music.setMuted(true);
  ok(F.music.isMuted() === true && store['gamekit_music_muted'] === '1' && F.music.gain() === 0, 'music mute persists + gain 0 when muted');
  F.music.setMuted(false); F.music.volume(0.4);
  ok(F.music.gain() === 0.4 && store['gamekit_music_vol'] === '0.4', 'music volume = gain when unmuted');
  // layout: orientation + hudTop + on()/__emit relayout
  ok(F.layout && typeof F.layout.on === 'function' && typeof F.layout.hudTop === 'function', 'kit exposes layout (on/hudTop)');
  let lay = null; F.layout.on(s => { lay = s; });
  F.layout.__emit(900, 500);
  ok(lay && lay.landscape === true && lay.hudTop === 48, 'landscape → hudTop 48 (' + (lay && lay.hudTop) + ')');
  F.layout.__emit(420, 840);
  ok(lay && lay.portrait === true && lay.narrow === true && lay.hudTop === 92, 'portrait → narrow, hudTop 92 (' + (lay && lay.hudTop) + ')');
  ok(F.layout.requireOrientation('') === true, 'requireOrientation falsy → satisfied (no lock)');
  // ---- fixed-timestep loop: 60 steps/sec of game-time at any frame rate ----
  {
    let steps = 0, renders = 0;
    F.loop(() => { steps++; }, () => { renders++; });
    ok(g.rafPending > 0, 'gamekit.loop schedules a rAF tick');
    const fire = t => g.fireRaf(t);
    fire(0);
    ok(steps === 0 && renders === 1, 'first frame initialises without stepping');
    fire(99); // 99ms → 5 full steps of 1000/60 (~16.67ms), remainder accumulates
    ok(steps === 5, '99ms of real time drains 5 fixed steps (got ' + steps + ')');
    fire(1099); // 1s stall → clamped to MAX_FRAME (100ms) → 6 steps, not 60
    ok(steps === 11, 'a tab stall is clamped — no catch-up spiral (got ' + steps + ')');
    F.setPaused(true);
    fire(1150);
    ok(steps === 11 && renders === 4, 'paused → renders only, no steps');
    F.setPaused(false);
    fire(1200); // dt = 50 since the paused frame kept lastT fresh → 3 steps (a stale lastT would clamp-drain 6)
    ok(steps === 14, 'resume has no dt jump (3 steps for 50ms, got ' + (steps - 11) + ')');
    let fast = 0, polled = 0;
    F.loop(() => { fast++; }, null, { mult: () => 2, frame: () => { polled++; } });
    fire(0); fire(49.5); // 49.5ms × mult 2 = 99ms of game-time = 5 steps
    ok(fast === 5, 'opts.mult scales game-time (2× → 5 steps for 49.5ms, got ' + fast + ')');
    ok(polled === 2, 'opts.frame runs once per display frame (got ' + polled + ')');
  }

  // results + per-day activity log (powers challenges)
  F.recordResult('snake', { mode: 'classic', score: 42, stats: { length: 5 } });
  const rr = F.lastResult('snake');
  ok(rr && rr.score === 42 && rr.mode === 'classic' && rr.stats.length === 5, 'recordResult/lastResult round-trips');
  F.recordResult('bubbles', { score: 100 });
  const pt = F.playedToday();
  ok(pt.slugs.indexOf('snake') >= 0 && pt.slugs.indexOf('bubbles') >= 0 && pt.count === 2 && pt.totalScore === 142, 'activity log tracks distinct games + totals');
  { // recordResult must resync the side-stack title dot too — a run can cross a titles-ladder tier
    // live, and the kit already resyncs the challenge dot here; the title dot must not be left stale.
    let titleSyncs = 0; const prevTS = g.win.__syncTitleNotify;
    g.win.__syncTitleNotify = () => { titleSyncs++; };
    F.recordResult('snake', { mode: 'classic', score: 3 });
    g.win.__syncTitleNotify = prevTS;
    ok(titleSyncs >= 1, 'recordResult resyncs the title-unlock dot (not just the challenge dot)');
  }
  // score card (Level 2): headless has no canvas.toBlob → resolves null without throwing
  let cardOk = false; F.scoreCard({ title: 'Neon Snake', score: 42 }).then(b => { cardOk = (b === null); }).catch(() => {});
  ok(typeof F.scoreCard === 'function', 'kit exposes scoreCard builder');
  // embed modal (single + picker)
  let embErr = null; try { F.embedModal({ slug: 'snake', title: 'Neon Snake' }); F.embedModal({ games: [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }] }); } catch (e) { embErr = e.message; }
  ok(embErr === null && typeof F.embedModal === 'function', 'embedModal builds (single + picker) headless: ' + embErr);
  // headless-safe (incl. the audio menu + reset + music flag)
  let threw = null; const sr = doc.getElementById('sr');
  try { F.nav({ music: true, reset: 'snake_' }); F.shareRow(sr, { slug: 'snake', message: () => 'x' }); F.pwa(); F.resetScores('snake_'); } catch (e) { threw = e.message; }
  ok(threw === null, 'nav/audioMenu/shareRow/pwa/resetScores run headless without throwing: ' + threw);
  // endgame share is score-card-first: one Share button (opens the image menu), no X/Reddit/copy-link
  ok(String(sr.innerHTML).indexOf('data-act="card"') >= 0 && !/data-act="(x|reddit|native|copy)"/.test(String(sr.innerHTML)),
    'endgame share row is card-only — single Share button, no link/social buttons');
  // version tag (bottom-left build stamp): renders the SHA when present, no-op on dev
  g.win.KOMYO_VERSION = { sha: 'abc1234', url: 'https://github.com/N0zz/komyo.online/commit/abc1234' };
  F.versionTag();
  ok(els['gamekitVersion'] && els['gamekitVersion'].textContent === 'abc1234', 'versionTag shows the commit SHA');
  g.win.KOMYO_VERSION = { sha: 'dev' };
  delete els['gamekitVersion'];
  F.versionTag();
  ok(!els['gamekitVersion'], 'versionTag is a no-op on dev (nothing rendered)');
  // ---- build info + update engine (gamekit.updates) ----
  ok(F.updates && typeof F.updates.check === 'function' && typeof F.updates.apply === 'function' && typeof F.updates.onChange === 'function' && typeof F.buildInfo === 'function',
    'kit exposes updates (check/apply/onChange/state) + buildInfo');
  g.win.KOMYO_VERSION = { sha: 'abc1234', url: 'https://x', built: '2026-07-02T16:45:00Z' };
  {
    const p2 = n => (n < 10 ? '0' : '') + n;
    const d = new Date('2026-07-02T16:45:00Z'); // buildInfo renders the stamp in local time — mirror it
    const when = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    const bi = F.buildInfo();
    ok(bi.when === when && bi.label === 'abc1234 · ' + when, 'buildInfo formats the deploy stamp as sha · local date+time (' + bi.label + ')');
    F.versionTag();
    ok(els['gamekitVersion'] && els['gamekitVersion'].textContent === 'abc1234 · ' + when, 'versionTag shows sha · built date+time');
  }
  g.win.KOMYO_VERSION = { sha: 'dev' };
  ok(F.buildInfo().label === 'dev', 'buildInfo label is plain "dev" locally');
  ok(typeof F.updates.state().available === 'boolean' && F.updates.state().available === false, 'updates.state() readable headless, no false "update available"');
  // ---- update policy: hand-over ignored / pre-interaction silent reload / in-use badge only ----
  {
    const mk = () => {
      const s = makeSandbox({});
      let reloads = 0;
      s.sandbox.location.reload = () => { reloads++; };
      const swL = {};
      s.sandbox.navigator.serviceWorker = {
        controller: { scriptURL: 'https://k/sw.js' },
        addEventListener: (t, fn) => { (swL[t] ||= []).push(fn); },
        register: () => Promise.resolve({ update() {} }),
        getRegistrations: () => Promise.resolve([]),
      };
      s.run(KIT, 'game-kit.js'); s.run(I18N, 'i18n.js');
      return { s, F2: s.sandbox.gamekit, reloads: () => reloads,
        setCtl(url) { s.sandbox.navigator.serviceWorker.controller = url ? { scriptURL: url } : null; },
        fire() { (swL.controllerchange || []).forEach(fn => fn()); } };
    };
    // a new build NEVER auto-reloads the visible page — it only lights the badge (no silent launch
    // reload; that raced the tap-to-play splash and forced a second tap)
    const a = mk();
    a.F2.pwa();
    a.setCtl('https://k/sw.js'); a.fire(); // same worker URL = genuinely new build, page in view
    ok(a.reloads() === 0 && a.F2.updates.state().available === true, 'new build (page visible) → badge only, no auto-reload');
    // scope hand-over is not an update; an in-use page only gets the badge
    const b = mk();
    b.F2.pwa();
    b.setCtl('https://k/games/x/sw.js'); b.fire(); // different worker URL = legacy game-scope → root hand-over
    ok(b.reloads() === 0 && b.F2.updates.state().available === false, 'scope hand-over (different worker URL) is ignored');
    b.s.key('pointerdown'); // the player touches the page
    b.fire();               // same-URL new build lands mid-session
    ok(b.reloads() === 0 && b.F2.updates.state().available === true, 'in-use page: update lights the badge, never reloads');
    b.F2.updates.apply();
    ok(b.F2.updates.state().status === 'refreshing', 'apply() enters the refreshing state');
    await Promise.resolve(); await Promise.resolve(); // flush the check→reload microtasks
    ok(b.reloads() === 1, 'apply() with the new worker already in control reloads straight away');
  }
  // ---- menu engine (gamekit.menu.show) ----
  ok(F.menu && typeof F.menu.show === 'function' && typeof F.menu.hide === 'function' && typeof F.stampUrl === 'function',
    'kit exposes menu.show/hide + stampUrl');
  let played = null;
  const hm = F.menu.show({
    kind: 'start', title: 'Asteroids',
    groups: [
      { id: 'run', label: '1 · RUN', default: 'normal', choices: [{ id: 'normal', label: 'Normal' }, { id: 'speedrun', label: 'Speedrun' }] },
      { id: 'mode', label: '2 · MODE', default: 'classic', choices: [{ id: 'classic', label: 'Classic' }, { id: 'enh', label: 'Classic+' }] },
    ],
    hint: s => s.run === 'speedrun' ? 'fast' : 'endless',
    actions: [{ id: 'play', label: 'Play ▶', primary: true }],
    onPlay: s => { played = s; },
    theme: { accent: '#ff7ab6' },
  });
  ok(hm && hm.selection().run === 'normal' && hm.selection().mode === 'classic', 'menu start defaults applied');
  ok(F.menu.current() === hm, 'menu.current() returns the active handle');
  hm.select('mode', 'enh'); hm.select('run', 'speedrun');
  ok(hm.selection().mode === 'enh' && hm.selection().run === 'speedrun', 'menu.select changes the selection');
  hm.activate('play');
  ok(played && played.mode === 'enh' && played.run === 'speedrun', 'menu Play fires onPlay with the live selection');
  hm.hide();
  ok(F.menu.current() === null, 'menu.hide clears current');
  // a choice-row group with a reactive `disabled` evaluator grays out + refuses selection (the
  // pattern Bubble Pop / Frog Bonk use to switch a knob off in a mode where it does nothing)
  {
    const collect = (el, cls, out = []) => { if (!el) return out; if (String(el.className || '').split(/\s+/).indexOf(cls) >= 0) out.push(el); (el.children || []).forEach(c => collect(c, cls, out)); return out; };
    const hd = F.menu.show({ kind: 'start', groups: [
      { id: 'mode', label: 'MODE', choices: [{ id: 'run', label: 'Run' }, { id: 'zen', label: 'Zen' }] },
      { id: 'diff', label: 'DIFF', default: 'med', disabled: st => st.mode === 'zen', choices: [{ id: 'easy', label: 'Easy' }, { id: 'med', label: 'Med' }, { id: 'hard', label: 'Hard' }] },
    ], actions: [{ id: 'play', label: 'Play', primary: true }] });
    const diffCells = () => collect(hd.el, 'gkm-choice').filter(b => /Easy|Med|Hard/.test(String(b.innerHTML || '')));
    ok(diffCells().length === 3 && diffCells().every(b => !b.classList.contains('gkm-disabled')), 'diff group enabled while mode ≠ zen');
    ok(hd.select('diff', 'hard') && hd.selection().diff === 'hard', 'diff selectable while enabled');
    hd.select('mode', 'zen');
    ok(diffCells().every(b => b.classList.contains('gkm-disabled')), 'diff group grays out (gkm-disabled) once disabled fn is true');
    hd.select('diff', 'easy');
    ok(hd.selection().diff === 'hard', 'selecting a disabled choice is a no-op (kept hard)');
    hd.select('mode', 'run');
    ok(diffCells().every(b => !b.classList.contains('gkm-disabled')) && hd.select('diff', 'easy') && hd.selection().diff === 'easy', 're-enables + selectable when disabled fn goes false');
    hd.hide();
  }
  // 🐣 Easy picks: kid-flagged choices/toggles become the menu DEFAULTS + carry the marker
  {
    const collect = (el, cls, out = []) => { if (!el) return out; if (String(el.className || '').split(/\s+/).indexOf(cls) >= 0) out.push(el); (el.children || []).forEach(c => collect(c, cls, out)); return out; };
    F.setEasyPicks(true);
    ok(F.easyPicks() === true, 'setEasyPicks(true) persists and easyPicks() reads it back');
    const he = F.menu.show({ kind: 'start', groups: [
      { id: 'mode', label: 'MODE', default: 'run', choices: [{ id: 'run', label: 'Run' }, { id: 'zen', label: 'Zen', kid: true }] },
      { id: 'diff', label: 'DIFF', default: 'hard', choices: [{ id: 'easy', label: 'Easy', kid: true }, { id: 'hard', label: 'Hard' }] },
    ], toggles: [{ id: 'relaxed', label: 'Relaxed', default: false, kid: true }, { id: 'turbo', label: 'Turbo', default: true, kid: false }],
    actions: [{ id: 'play', label: 'Play', primary: true }] });
    ok(he.selection().mode === 'zen' && he.selection().diff === 'easy', 'easy picks preselects kid choices over the defaults (got ' + JSON.stringify(he.selection()) + ')');
    ok(he.selection().relaxed === true && he.selection().turbo === false, 'toggles default to their kid state (relaxed on, turbo off)');
    ok(collect(he.el, 'gkm-choice').some(b => String(b.innerHTML || '').includes('🐣')), 'kid choices carry the 🐣 marker');
    he.hide();
    F.setEasyPicks(false);
    const hn = F.menu.show({ kind: 'start', groups: [
      { id: 'mode', label: 'MODE', default: 'run', choices: [{ id: 'run', label: 'Run' }, { id: 'zen', label: 'Zen', kid: true }] }],
    toggles: [{ id: 'turbo', label: 'Turbo', default: true, kid: false }], actions: [{ id: 'play', label: 'Play', primary: true }] });
    ok(hn.selection().mode === 'run' && hn.selection().turbo === true, 'easy picks OFF: normal defaults win');
    ok(!collect(hn.el, 'gkm-choice').some(b => String(b.innerHTML || '').includes('🐣')), 'easy picks OFF: no 🐣 markers');
    hn.hide();
  }
  // pause: onAction fires by id
  let acted = null;
  const hp = F.menu.show({ kind: 'pause', title: 'Paused', lines: ['score 10'], actions: [{ id: 'resume', label: 'Resume', primary: true }, { id: 'quit', label: 'Quit', danger: true }], onAction: id => { acted = id; } });
  hp.activate('resume');
  ok(acted === 'resume', 'pause action fires onAction(id)');
  hp.hide();
  // end: records the result (so card + day-best work) and is headless-safe with a share row
  let endErr = null;
  try {
    F.menu.show({ kind: 'end', title: 'Game Over', score: 1234, best: 1000, newBest: true, lines: ['reached wave 7'],
      share: { slug: 'asteroids', title: 'Asteroids', message: () => 'I scored 1234' },
      record: { slug: 'asteroids', mode: 'classic', score: 1234, stats: { wave: 7 } },
      actions: [{ id: 'again', label: 'Play again', primary: true }], onAction: () => {} });
  } catch (e) { endErr = e.message; }
  ok(endErr === null, 'end-screen menu builds headless (share row + record): ' + endErr);
  const er = F.lastResult('asteroids');
  ok(er && er.score === 1234 && er.stats.wave === 7, 'end-screen menu records the result via recordResult');
  // record idempotency: rebuilding the same end screen (no new run) must not double-count
  const cnt0 = F.playedToday().count;
  F.menu.show({ kind: 'end', title: 'Game Over', record: { slug: 'asteroids', mode: 'classic', score: 1234, stats: { wave: 7 } }, actions: [] });
  ok(F.playedToday().count === cnt0, 're-shown end menu (same run) does not record again');
  F.menu.hide(); // a new run starts (game dismisses the menu)
  F.menu.show({ kind: 'end', title: 'Game Over', record: { slug: 'asteroids', mode: 'classic', score: 999 }, actions: [] });
  ok(F.playedToday().count === cnt0 + 1, 'after menu.hide (new run) the next end menu records once');
  F.menu.hide();
  // confirm dialog back-compat + new args are headless-safe
  let cfErr = null;
  try { F.confirm('Leave?', () => {}, 'Leave', () => {}); } catch (e) { cfErr = e.message; }
  ok(cfErr === null, 'confirm(msg,onYes,yesLabel,onCancel) runs headless: ' + cfErr);
  // controls board: nav exposes a controls button + the modal builds headless
  let ctlErr = null;
  try { F.controls({ title: 'Controls', keyboard: [['Space', 'Shoot'], ['Esc', 'Pause']], touch: [['Tap', 'Shoot']] }); } catch (e) { ctlErr = e.message; }
  ok(ctlErr === null && typeof F.controls === 'function', 'controls board builds headless: ' + ctlErr);
  // challenges: activeChallenge(slug) + the in-game panel (reads window.CHALLENGES + kit storage)
  g.win.CHALLENGES = { goals: { tg: { slug: 'testgame', title: 'Score 10 in Test', metric: 'score', target: 10 } }, daily: ['tg'], weekly: [], goodRun: { snake: 100, breakout: 500 } };
  ok(F.activeChallenge('testgame') === true, 'activeChallenge true when this game is today’s pick');
  ok(F.activeChallenge('other') === false, 'activeChallenge false for a game with no active challenge');
  let chpErr = null; try { F.challengesPanel({ slug: 'testgame' }); } catch (e) { chpErr = e.message; }
  ok(chpErr === null && typeof F.challengesPanel === 'function', 'challenges panel builds headless: ' + chpErr);
  // challengeEval — the ONE evaluator (catalogue routes through it): goodRuns day/week + random picks
  ok(typeof F.challengeEval === 'function', 'kit exposes challengeEval');
  const gr0 = F.challengeEval({ title: 'g', scope: 'cross', range: 'day', metric: 'goodRuns', target: 2 }, {});
  ok(gr0 && gr0.done === false, 'challengeEval: goodRuns daily incomplete before par-clearing runs');
  F.recordResult('snake', { mode: 'classic', score: 150 });   // ≥ snake's good-run bar (100)
  F.recordResult('breakout', { score: 600 });                 // ≥ breakout's bar (500)
  const gr1 = F.challengeEval({ title: 'g', scope: 'cross', range: 'day', metric: 'goodRuns', target: 2 }, {});
  ok(gr1 && gr1.val === 2 && gr1.done === true, 'challengeEval: two par-clearing runs complete a goodRuns daily (got ' + (gr1 && gr1.val) + ')');
  const grw = F.challengeEval({ title: 'g', scope: 'cross', range: 'week', metric: 'goodRuns', target: 2 }, {});
  ok(grw && grw.done === true, 'challengeEval: weekly goodRuns aggregates the week');
  g.win.CHALLENGES.randomSlug = (idx, pl) => pl[0] || '';
  const rnd = F.challengeEval({ scope: 'random', range: 'day', title: 'x' }, { playable: ['snake'], titles: { snake: 'Neon Snake' } });
  ok(rnd && rnd.done === true && rnd.slug === 'snake' && rnd.title === 'Play Neon Snake today', 'challengeEval resolves a random pick (title + played)');
  const rnd2 = F.challengeEval({ scope: 'random', range: 'day', title: 'Mystery pick' }, {});
  ok(rnd2 && rnd2.done === false && rnd2.target === 1 && rnd2.title === 'Mystery pick', 'random goal without ANY playable list reports honestly (no false Done)');
  // the in-game 🏆 panel passes no playable list — chEval falls back to CHALLENGES.playable, so
  // random goals resolve (and can complete) inside games, not only on the catalogue
  g.win.CHALLENGES.playable = ['snake', 'breakout'];
  const rnd3 = F.challengeEval({ scope: 'random', range: 'day', title: 'x' }, {});
  ok(rnd3 && rnd3.slug === 'snake' && rnd3.done === true, 'random goal resolves via CHALLENGES.playable when the caller binds none (in-game panel path)');
  // playableSince freezes a period's pool to the games live at its start — a game that shipped
  // AFTER the period began is excluded, so a mid-period launch can't re-resolve the pick
  g.win.CHALLENGES.playableSince = { snake: '2020-01-01', breakout: '2999-01-01' };
  g.win.CHALLENGES.randomSlug = (idx, pl) => pl[pl.length - 1] || ''; // would pick breakout if present
  const rnd4 = F.challengeEval({ scope: 'random', range: 'day', title: 'x' }, {});
  ok(rnd4 && rnd4.slug === 'snake', 'a game added after the period start is excluded from the random pool (got ' + (rnd4 && rnd4.slug) + ')');
  delete g.win.CHALLENGES.playableSince; delete g.win.CHALLENGES.playable;
  g.win.CHALLENGES.randomSlug = (idx, pl) => pl[0] || '';
  // Discord auto-post gate: no consent → off; consent → anonymous; Settings opt-in → named
  delete store['gamekit_consent']; delete store['gamekit_discord_name'];
  ok(F.discordTier() === 'off', 'discordTier: no cookie consent → off (nothing is sent)');
  store['gamekit_consent'] = 'denied';
  ok(F.discordTier() === 'off', 'discordTier: declined consent → off');
  store['gamekit_consent'] = 'granted';
  ok(F.discordTier() === 'anon', 'discordTier: consent alone → anonymous posts');
  store['gamekit_discord_name'] = '1';
  ok(F.discordTier() === 'named', 'discordTier: consent + Settings opt-in → named posts');
  store['gamekit_discord_name'] = '0';
  ok(F.discordTier() === 'anon', 'discordTier: opt-in toggled back off → anonymous again');
  delete store['gamekit_consent']; delete store['gamekit_discord_name'];
  // ---- cards group + boolean toggle: state merges selection + toggles; dynamic best/mech are fns ----
  let played2 = null, cardErr = null, hc = null;
  try {
    hc = F.menu.show({
      kind: 'start', title: 'A',
      groups: [{ id: 'mode', label: 'MODE', style: 'cards', default: 'classic', choices: [
        { id: 'classic', label: 'CLASSIC', preview: function () {}, desc: st => st.speedrun ? 'race' : 'endless',
          mech: st => ['1 weapon', st.speedrun ? { label: 'Goal 2,000', hot: true } : null], best: st => st.speedrun ? '01:00.0' : 12340 },
        { id: 'enh', label: 'CLASSIC+', tag: 'UPGRADES', preview: function () {}, desc: 'tiers', mech: ['weapon tiers'], best: 9 },
      ] }],
      toggles: [{ id: 'speedrun', label: 'SPEEDRUN', caption: '— race', default: false, disabled: s => s.mode === 'enh' }],
      actions: [{ id: 'play', label: 'Play', primary: true }],
      onPlay: s => { played2 = s; },
    });
  } catch (e) { cardErr = e.message; }
  ok(cardErr === null && hc, 'cards+toggle menu builds headless: ' + cardErr);
  ok(hc && hc.selection().mode === 'classic' && hc.selection().speedrun === false, 'cards+toggle initial state (selection + bool)');
  if (hc) { hc.toggle('speedrun'); ok(hc.selection().speedrun === true, 'toggle() flips the boolean'); }
  if (hc) { hc.select('mode', 'enh'); hc.activate('play'); }
  ok(played2 && played2.mode === 'enh' && played2.speedrun === true, 'onPlay gets the merged selection + toggle state');
  if (hc) hc.hide();
}

// ---------------- Challenges ↔ games coverage ----------------
// Kit "chrome" (top nav / audio splash / analytics) — a REGRESSION GUARD, not a pixel test. The harness
// mocks getBoundingClientRect (fixed 800×600), so real top-bar overlap can't be measured headlessly (see
// bug backlog). This just asserts the responsive safeguards + hooks are present so they can't be silently
// deleted; visual overlap must still be checked on a real device.
function testKitChrome() {
  section('game-kit (responsive nav safeguards + tap-to-play + game_start)');
  const css = fs.readFileSync(path.join(DIR, 'game-kit.css'), 'utf8');
  const js = KIT;
  // nav fit: measured label-collapse + narrow-width shrink + force-collapse ≤400px (covers 360px Android)
  ok(css.includes('.gamekit-nav-tight .gamekit-home-label'), 'nav has the measured label-collapse rule');
  ok(css.includes('@media (max-width: 560px)') && /max-width: 560px[\s\S]*\.gamekit-au-btn[^}]*width:/.test(css), 'right-cluster buttons shrink at ≤560px');
  ok(css.includes('@media (max-width: 400px)') && /max-width: 400px[\s\S]*\.gamekit-home-label\s*\{\s*display:\s*none/.test(css), 'brand label force-collapses at ≤400px (fits 360px)');
  // tap-to-play audio splash
  ok(css.includes('.gamekit-tap'), 'tap-to-play splash style present');
  ok(js.includes('function tapToStart') && js.includes('tapToStart();'), 'tapToStart is defined and called from nav()');
  ok(/if \(_tapShown\) return;/.test(js) && !/if \(musMuted\) return;/.test(js), 'splash is always-on, shown once per page load (not gated on the music toggle)');
  // game_start analytics event
  ok(js.includes("'game_start'") && js.includes('function currentSlug'), 'game_start event fires with the URL slug');
  // SW update: manual button when visible (no surprise reload that re-triggered the splash)
  ok(css.includes('.gamekit-more-panel') && css.includes('.gamekit-au-morebtn'), '☰ menu panel styles present');
  ok(js.includes('ctl.scriptURL !== prevCtl.scriptURL'), 'update vs scope-hand-over told apart by worker script URL (not timing)');
  ok(!js.includes('if (!interacted)') && !js.includes('showUpdateButton'), 'new build never auto-reloads the visible page — it lights the ☰ badge (no launch fast-path reload)');
}

function testRecentlyPlayed() {
  section('recently played (for the catalogue\'s "pick up where you left off" strip)');
  const h = bootGame('games/breakout/index.html', {});
  h.sandbox.location.pathname = '/games/breakout/'; // the mock harness has no real pathname — currentSlug() needs one
  const K = h.win.gamekit;
  ok(typeof K.recentlyPlayed === 'function', 'gamekit.recentlyPlayed is exposed');
  ok(K.recentlyPlayed().length === 0, 'nothing recorded before any Play');
  // pressing Play (a mode was actually chosen) records it — not just opening the game's page
  const menu = K.menu.current();
  ok(menu && typeof menu.activate === 'function', 'start menu exposes activate()');
  menu.activate('play');
  let recent = K.recentlyPlayed();
  ok(recent.length === 1 && recent[0].slug === 'breakout', 'Play records this game as recently played (got ' + JSON.stringify(recent) + ')');
  ok(typeof recent[0].at === 'number' && recent[0].at > 0, 'entry carries a timestamp');
  // replaying (end menu's "again") re-touches it — bumped to the front, not duplicated
  K.menu.show({ kind: 'end', actions: [{ id: 'again', label: 'Again' }], onAction: () => {} });
  K.menu.current().activate('again');
  recent = K.recentlyPlayed();
  ok(recent.length === 1, 'replaying the SAME game de-dupes rather than adding a second entry (got ' + recent.length + ')');
  // a different game (different currentSlug()) bumps to the front, oldest one still present
  h.sandbox.location.pathname = '/games/snake/';
  K.menu.show({ kind: 'start', actions: [{ id: 'play', label: 'Play' }] });
  K.menu.current().activate('play');
  recent = K.recentlyPlayed();
  ok(recent.length === 2 && recent[0].slug === 'snake' && recent[1].slug === 'breakout', 'a different game is added to the front, the older one kept (got ' + JSON.stringify(recent) + ')');
  // cap: seed a full list, then touch a fresh slug — total never exceeds the cap, newest first
  h.store['gamekit_recent'] = JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ slug: 'game' + i, at: i })));
  h.sandbox.location.pathname = '/games/new-one/';
  K.menu.show({ kind: 'start', actions: [{ id: 'play', label: 'Play' }] });
  K.menu.current().activate('play');
  recent = K.recentlyPlayed();
  ok(recent.length === 12, 'the list never grows past the cap (got ' + recent.length + ')');
  ok(recent[0].slug === 'new-one', 'the newest touch is always first (got ' + recent[0].slug + ')');
}

function testFullscreen() {
  section('fullscreen (Fullscreen API wrapper)');
  const h = bootGame('games/breakout/index.html', {});
  const K = h.win.gamekit;
  ok(K.fullscreen && typeof K.fullscreen.supported === 'function' && typeof K.fullscreen.active === 'function'
    && typeof K.fullscreen.toggle === 'function' && typeof K.fullscreen.onChange === 'function', 'gamekit.fullscreen exposes supported/active/toggle/onChange');
  // the mock DOM has no document.documentElement.requestFullscreen — must degrade to "unsupported",
  // never throw, and the ☰ button must not render (no clutter on platforms without the API)
  ok(K.fullscreen.supported() === false, 'supported() is false headless (no requestFullscreen on the mock)');
  ok(K.fullscreen.active() === false, 'active() is false with no fullscreenElement');
  let err = null; try { K.fullscreen.toggle(); } catch (e) { err = e.message; }
  ok(err === null, 'toggle() on an unsupported platform is a no-op, never throws: ' + err);
}

function testI18n() {
  section('i18n engine');
  const h = bootGame('games/breakout/index.html', {});
  const K = h.win.gamekit;
  // seed a tiny catalogue
  h.win.KOMYO_I18N = {
    en: { hi: 'Hello', bye: 'Bye {name}', apples: { one: '{count} apple', other: '{count} apples' } },
    pl: { hi: 'Cześć', apples: { one: '{count} jabłko', few: '{count} jabłka', many: '{count} jabłek', other: '{count} jabłka' } },
    es: {}, pt: {}, fr: {}
  };
  K.setLang('en');
  ok(K.t('hi') === 'Hello', 'basic lookup');
  ok(K.t('bye', { name: 'Fox' }) === 'Bye Fox', 'interpolation');
  ok(K.t('apples', { count: 1 }) === '1 apple', 'plural one (en)');
  ok(K.t('apples', { count: 3 }) === '3 apples', 'plural other (en)');
  ok(K.t('missing', { def: 'D' }) === 'D', 'def fallback');
  ok(K.t('nope') === 'nope', 'key fallback');
  K.setLang('pl');
  ok(K.t('hi') === 'Cześć', 'pl lookup');
  ok(K.t('bye', { name: 'Fox' }) === 'Bye Fox', 'pl falls back to en for missing key');
  ok(K.t('apples', { count: 5 }) === '5 jabłek', 'pl plural many');
  ok(K.t('apples', { count: 2 }) === '2 jabłka', 'pl plural few');
  ok(K.lang() === 'pl', 'lang() reflects setLang');
  ok(typeof K.langs === 'function' && K.langs().length === 8, 'langs() lists 8');
  ok(K.langs()[0].code === 'en', 'en first');
  K.setLang('en');

  // ?lang= deep link: consumed at head-script eval — persisted to gamekit_lang so it survives the
  // catalogue's query-string rewrite AND can't override the picker on later reloads
  const h2 = bootGame('games/breakout/index.html', { search: '?lang=pl' });
  ok(h2.win.gamekit.lang() === 'pl', '?lang=pl activates Polish');
  ok(h2.store['gamekit_lang'] === 'pl', '?lang= choice is PERSISTED at load (picker can\'t be reverted by a stale param)');
  const h3 = bootGame('games/breakout/index.html', { search: '?lang=xx' });
  ok(h3.win.gamekit.lang() !== 'xx' && h3.store['gamekit_lang'] === undefined, 'an unknown ?lang= is ignored, nothing persisted');
}

function testI18nCoverage() {
  section('i18n coverage (every locale: empty or complete)');
  const evalData = (code, fname) => { const sb = { window: {}, console, Math, Date, JSON }; sb.globalThis = sb; try { vm.runInContext(code, vm.createContext(sb), { filename: fname }); } catch (e) { return { __err: e.message }; } return sb.window; };
  const dict = evalData(I18N, 'i18n.js').KOMYO_I18N || {};
  ok(dict.en && dict.pl, 'i18n.js parses with en + pl blocks');
  const GAMES = evalData(fs.readFileSync(path.join(DIR, 'games.js'), 'utf8'), 'games.js').GAMES || [];
  const COS = evalData(fs.readFileSync(path.join(DIR, 'cosmetics.js'), 'utf8'), 'cosmetics.js').COSMETICS || {};
  const CH = evalData(fs.readFileSync(path.join(DIR, 'changelog.js'), 'utf8'), 'changelog.js').CHANGELOG || [];

  // 1) collect the LITERAL i18n keys referenced in code (data-t* attrs + t('…')/T('…') calls).
  // Concatenated/dynamic keys (t('pre'+x)) are skipped — they can't be verified statically.
  const files = ['index.html', 'tos.html', 'privacy.html', 'game-kit.js'];
  fs.readdirSync(path.join(DIR, 'games')).forEach(s => { const p = 'games/' + s + '/index.html'; if (fs.existsSync(path.join(DIR, p))) files.push(p); });
  const KEY_RE = /^[a-z][\w-]*(?:\.[\w-]+)+$/;   // namespaced key like game.x.y / shop.buy
  const used = new Set();
  const add = k => { if (KEY_RE.test(k)) used.add(k); };
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8'); let m;
    const attr = /\bdata-t[hpat]?="([^"]+)"/g; while ((m = attr.exec(src))) add(m[1]);
    const call = /(?:[^\w$]|^)[tT]\(\s*'([^']+)'\s*[,)]/g; while ((m = call.exec(src))) add(m[1]);
  }
  // 2) data-driven keys that are dynamic in code but MUST be translated. The static scan above
  // can't see t('pre.' + var) — every such family is derived from its registry here instead,
  // so a new goal/genre/badge/title can't ship silent English in 7 locales with a green suite.
  GAMES.forEach(g => { if (g && g.slug) { add('game.' + g.slug + '.title'); add('game.' + g.slug + '.blurb'); } });
  (COS.items || []).forEach(it => { if (it && it.id) { add('cos.' + it.id + '.name'); add('cos.' + it.id + '.desc'); } });
  Object.keys(COS.sets || {}).forEach(sid => add('cos.set.' + sid));
  const CHAL = evalData(fs.readFileSync(path.join(DIR, 'challenges.js'), 'utf8'), 'challenges.js').CHALLENGES || {};
  Object.keys(CHAL.goals || {}).forEach(id => add('challenge.goal.' + id));            // t('challenge.goal.'+id)
  (CHAL.titles || []).forEach((_, i) => add('title.t' + i));                           // t('title.t'+tier)
  GAMES.forEach(g => (g.tags || []).forEach(tg => add('tag.' + String(tg).toLowerCase()))); // T('tag.'+t.toLowerCase())
  { // badge kinds from the catalogue's BADGES map — T('badge.'+k)
    const idx = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
    const bm = idx.match(/const BADGES = \{([\s\S]*?)\n    \};/);
    const badgeKeys = bm ? [...bm[1].matchAll(/^\s*(\w+):\s*\{/gm)].map(x => x[1]) : [];
    ok(badgeKeys.length >= 4, 'BADGES map parsed from index.html (got ' + badgeKeys.join(',') + ')');
    badgeKeys.forEach(k => add('badge.' + k));
  }
  // changelog entries — keyed by a REVERSE index (distance from the array's end), stable across
  // prepends; see index.html's changelog renderer for the matching computation.
  CH.forEach((r, i) => {
    const ei = CH.length - 1 - i;
    add('changelog.e' + ei + '.title');
    r.items.forEach((_, j) => add('changelog.e' + ei + '.b' + j));
  });
  // PREPEND-ONLY guard: the reverse-index keying (and the Discord poster's diff) both assume
  // shipped entries are never edited, reordered or deleted — any of those silently attaches every
  // older entry's translations to the WRONG entry. Diff against HEAD: the tail must be identical.
  {
    let headCh = null;
    try {
      const src = execFileSync('git', ['show', 'HEAD:changelog.js'], { cwd: DIR, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      headCh = evalData(src, 'changelog.js@HEAD').CHANGELOG || null;
    } catch (e) { /* no git (fresh archive?) → skip, CI always has it */ }
    if (headCh) {
      const sig = r => JSON.stringify([r.date, r.title, r.items]);
      const tail = CH.slice(CH.length - headCh.length);
      const changed = headCh.map((r, i) => sig(r) !== sig(tail[i]) ? ('e' + (headCh.length - 1 - i)) : null).filter(Boolean);
      ok(CH.length >= headCh.length && changed.length === 0,
        'changelog is prepend-only vs HEAD — shipped entries untouched' + (changed.length ? ' — EDITED/SHIFTED: ' + changed.join(',') + ' (add a NEW entry instead of editing a shipped one)' : ''));
    } else ok(true, 'changelog prepend-guard skipped (no git history available)');
  }

  // 3) pl (the reference locale) must contain EVERY referenced key — else PL users silently see English
  const plMiss = [...used].filter(k => !(k in (dict.pl || {}))).sort();
  ok(plMiss.length === 0, 'pl has every referenced key' + (plMiss.length ? ` — MISSING ${plMiss.length}: ${plMiss.slice(0, 25).join(', ')}` : ''));

  // 4) each other locale is EMPTY (not started) or its key set EQUALS pl's exactly — no
  // half-translated locale (missing keys) and no stale leftovers (extra keys a code cleanup removed
  // from pl but not here; 6 dead sudoku keys once hid in every non-pl locale this way). The list is
  // DISCOVERED from i18n.js so a new language is enforced without a test edit.
  const OTHER_LOCALES = Object.keys(dict).filter(L => L !== 'en' && L !== 'pl');
  ok(OTHER_LOCALES.length >= 6, 'discovered non-en/pl locales from i18n.js: ' + OTHER_LOCALES.join(','));
  const plKeys = Object.keys(dict.pl || {});
  for (const L of OTHER_LOCALES) {
    const d = dict[L] || {}, n = Object.keys(d).length;
    if (n === 0) { ok(true, `${L}: not started (empty) — ok`); continue; }
    const miss = plKeys.filter(k => !(k in d)).sort();
    const extra = Object.keys(d).filter(k => !(k in (dict.pl || {}))).sort();
    ok(miss.length === 0 && extra.length === 0, `${L}: complete (key set === pl)`
      + (miss.length ? ` — MISSING ${miss.length}: ${miss.slice(0, 25).join(', ')}` : '')
      + (extra.length ? ` — STALE/EXTRA ${extra.length}: ${extra.slice(0, 25).join(', ')}` : ''));
  }
  // 5) plural keys must exist in en too — def: can't express plural forms
  const plural = v => v && typeof v === 'object';
  const enPluralMiss = [...used].filter(k => plural((dict.pl || {})[k]) && !plural((dict.en || {})[k])).sort();
  ok(enPluralMiss.length === 0, 'plural keys exist in en (def can\'t pluralize)' + (enPluralMiss.length ? ` — MISSING: ${enPluralMiss.join(', ')}` : ''));

  // 6) every {param} token in pl must also appear (same set) in every other populated locale for
  // that key — a locale missing a token silently drops a value (or an unclosed tag) at render time.
  // Caught a real bug once: several keys got truncated exactly where a def: concatenation started.
  const tokensOf = v => { const set = new Set(); const scan = s => { const m = String(s).match(/\{\w+\}/g); if (m) m.forEach(t => set.add(t)); }; if (v == null) return set; if (typeof v === 'object') Object.values(v).forEach(scan); else scan(v); return set; };
  const sameTokens = (a, b) => a.size === b.size && [...a].every(t => b.has(t));
  const tokenMiss = [];
  for (const key of Object.keys(dict.pl || {})) {
    const ref = tokensOf(dict.pl[key]);
    for (const L of OTHER_LOCALES) {
      const d = dict[L] || {};
      if (!(key in d)) continue;
      if (!sameTokens(ref, tokensOf(d[key]))) tokenMiss.push(`${L}:${key}`);
    }
  }
  ok(tokenMiss.length === 0, 'every locale has the same {param} tokens as pl, per key' + (tokenMiss.length ? ` — MISMATCH ${tokenMiss.length}: ${tokenMiss.slice(0, 25).join(', ')}` : ''));

  // 7) a def-less t('key') call has NO fallback for English users (en carries only ~120 keys —
  // everything else lives in inline def:s), so its key must exist in the en dict or English
  // players see the raw key string on screen.
  const defless = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8'); let m;
    const bare = /(?:[^\w$]|^)[tT]\(\s*'([^']+)'\s*\)/g;                       // t('key') — no params at all
    while ((m = bare.exec(src))) { if (KEY_RE.test(m[1])) defless.add(m[1]); }
    const noDef = /(?:[^\w$]|^)[tT]\(\s*'([^']+)'\s*,\s*\{([^{}]*)\}\s*\)/g;   // t('key', {…}) without def:
    while ((m = noDef.exec(src))) { if (KEY_RE.test(m[1]) && !/\bdef\s*:/.test(m[2])) defless.add(m[1]); }
  }
  const enMiss = [...defless].filter(k => !(k in (dict.en || {}))).sort();
  ok(enMiss.length === 0, 'every def-less t() key exists in en (English users would see raw keys)' + (enMiss.length ? ` — MISSING ${enMiss.length}: ${enMiss.slice(0, 25).join(', ')}` : ''));

  // 8) translated tile blurbs stay tile-sized — translations run ~25% longer than the en source
  // (source cap 95, tested against games.js), so the locale cap gets matching headroom (longest today: 119)
  const TR_BLURB_MAX = 120;
  const longTr = [];
  for (const L of Object.keys(dict)) {
    for (const k of Object.keys(dict[L] || {})) {
      if (/^game\.[\w-]+\.blurb$/.test(k) && String(dict[L][k]).length > TR_BLURB_MAX) longTr.push(`${L}:${k} (${String(dict[L][k]).length})`);
    }
  }
  ok(longTr.length === 0, 'every translated game blurb is ≤ ' + TR_BLURB_MAX + ' chars' + (longTr.length ? ' — TOO LONG: ' + longTr.join(', ') : ''));
}

function testChallenges() {
  section('challenges.js (coverage vs games.js)');
  const games = fs.readFileSync(path.join(DIR, 'games.js'), 'utf8');
  const challenges = fs.readFileSync(path.join(DIR, 'challenges.js'), 'utf8');
  const sb = { window: {}, console }; sb.globalThis = sb;
  let derr = null;
  try { vm.runInContext(games + '\n' + challenges, vm.createContext(sb), { filename: 'catalogue-data.js' }); } catch (e) { derr = e.message; }
  ok(derr === null, 'games.js + challenges.js load: ' + derr);
  const GAMES = sb.window.GAMES || [], C = sb.window.CHALLENGES || {};
  const goals = C.goals || {};
  const activeSlugs = new Set(GAMES.filter(g => !g.soon).map(g => g.slug));
  const allSlugs = new Set(GAMES.map(g => g.slug));
  const goalEntries = Object.entries(goals);
  const singleGoals = goalEntries.filter(([, gl]) => gl.slug);          // single-game goals carry a slug
  const crossGoals = goalEntries.filter(([, gl]) => gl.scope === 'cross');
  const slugsWithChallenge = new Set(singleGoals.map(([, gl]) => gl.slug));

  // A) every ACTIVE (playable, non-soon) game has at least one challenge
  for (const slug of activeSlugs) ok(slugsWithChallenge.has(slug), 'active game "' + slug + '" has ≥1 challenge defined');
  // B) every single-game challenge points at an existing + active game (none orphaned to a soon/removed game)
  for (const [id, gl] of singleGoals) {
    ok(allSlugs.has(gl.slug), 'challenge "' + id + '" → game "' + gl.slug + '" exists in games.js');
    ok(activeSlugs.has(gl.slug), 'challenge "' + id + '" → game "' + gl.slug + '" is active (not soon)');
  }
  // C) cross goals are well-formed (no stray slug; a recognized metric)
  const crossMetrics = new Set(['distinctGames', 'totalGames', 'totalScore', 'distinctGenres', 'goodRuns']);
  for (const [id, gl] of crossGoals) {
    ok(!gl.slug, 'cross goal "' + id + '" carries no game slug');
    ok(crossMetrics.has(gl.metric), 'cross goal "' + id + '" uses a known metric (' + gl.metric + ')');
  }
  // D) referential integrity: every id in the daily/weekly rotations resolves to a defined goal
  for (const id of (C.daily || [])) ok(!!goals[id], 'daily rotation id "' + id + '" is a defined goal');
  for (const id of (C.weekly || [])) ok(!!goals[id], 'weekly rotation id "' + id + '" is a defined goal');
  // E) CHALLENGES.playable mirrors games.js non-soon slugs IN ORDER — games resolve scope:'random'
  // picks from this copy (they never load games.js); any drift = a different pick in-game vs drawer
  const liveOrder = GAMES.filter(g => !g.soon).map(g => g.slug);
  ok(JSON.stringify(C.playable || []) === JSON.stringify(liveOrder),
    'CHALLENGES.playable matches games.js non-soon order (got ' + JSON.stringify(C.playable) + ', want ' + JSON.stringify(liveOrder) + ')');
  // F) playableSince mirrors each live game's added date — freezes a period's random pool to the
  // games live at its start, so a mid-period launch can't re-resolve an already-seen pick
  for (const g of GAMES.filter(x => !x.soon)) {
    ok((C.playableSince || {})[g.slug] === g.added,
      'CHALLENGES.playableSince["' + g.slug + '"] matches its games.js added date (' + (C.playableSince || {})[g.slug] + ' vs ' + g.added + ')');
  }
}

// ---------------- cosmetics (registry + trophies economy + store) ----------------
function testCosmetics() {
  section('cosmetics (registry + trophies economy + store)');
  const cosmetics = fs.readFileSync(path.join(DIR, 'cosmetics.js'), 'utf8');
  const challenges = fs.readFileSync(path.join(DIR, 'challenges.js'), 'utf8');

  // A) registry integrity — unique ids, one free default per set, band prices, meta coverage
  {
    const sb = { window: {}, console }; sb.globalThis = sb;
    let err = null;
    try { vm.runInContext(cosmetics, vm.createContext(sb), { filename: 'cosmetics.js' }); } catch (e) { err = e.message; }
    ok(err === null, 'cosmetics.js loads: ' + err);
    const R = sb.window.COSMETICS || {};
    ok(R.version === 1, 'registry carries a version field (day one)');
    const items = R.items || [];
    ok(items.length >= 60, 'launch catalogue present (' + items.length + ' items)');
    const seen = new Set(), dups = [], bad = [], sets = {};
    const BANDS = new Set([0, 10, 25, 50, 75, 100, 150, 200, 250, 500]); // >100 = the premium tier (flagged sets only)
    const OVER100_OK = new Set(['flappy.bird', 'site.fx', 'trap-the-cat.cat', 'tower-defense.castle']); // sets allowed a premium (>🏆100) item
    for (const it of items) {
      if (seen.has(it.id)) dups.push(it.id); seen.add(it.id);
      if (!it.name || !it.desc || typeof it.painter !== 'function') bad.push(it.id + ' (name/desc/painter)');
      if (!BANDS.has(+it.price)) bad.push(it.id + ' (price ' + it.price + ' outside bands)');
      if (+it.price > 100 && !OVER100_OK.has(it.set)) bad.push(it.id + ' (only the bird tail + site CRT may exceed 🏆100)');
      if (+it.price > 500) bad.push(it.id + ' (above the 🏆500 hard ceiling)');
      if (!R.games || !(it.game in R.games)) bad.push(it.id + ' (no games meta for "' + it.game + '")');
      if (!R.sets || !R.sets[it.set]) bad.push(it.id + ' (no sets meta for "' + it.set + '")');
      (sets[it.set] ||= []).push(it);
    }
    ok(dups.length === 0, 'item ids unique' + (dups.length ? ' (dups: ' + dups.join(', ') + ')' : ''));
    ok(bad.length === 0, 'items well-formed + priced in bands' + (bad.length ? ': ' + bad.join('; ') : ''));
    const noDefault = Object.keys(sets).filter(s => sets[s].filter(i => !(+i.price)).length !== 1);
    ok(noDefault.length === 0, 'every set has exactly ONE free default' + (noDefault.length ? ': ' + noDefault.join(', ') : ''));
  }

  // A2) cosmetics.js ships everywhere: cached once by the single root SW, loaded by every game's <head>
  {
    const rootSw = fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8');
    ok(rootSw.includes('cosmetics.js'), 'cosmetics.js is in the root SW SHELL');
    const gamesDirs = fs.readdirSync(path.join(DIR, 'games')).filter(d => fs.existsSync(path.join(DIR, 'games', d, 'index.html')));
    const off = gamesDirs.filter(d => !fs.readFileSync(path.join(DIR, 'games', d, 'index.html'), 'utf8').includes('cosmetics.js'));
    ok(off.length === 0, 'every game loads cosmetics.js in <head>' + (off.length ? ': ' + off.join(', ') : ''));
  }

  // B) economy: lifetime/balance derivation, buy validation + idempotency, select, progress
  {
    const g = makeSandbox({ store: { gamekit_done: JSON.stringify({ a: 100 }), gamekit_flappy_migrated: '1' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(cosmetics, 'cosmetics.js');
    const cos = g.sandbox.gamekit.cosmetics;
    ok(cos.lifetime() === 100 && cos.balance() === 100, 'lifetime = Σ gamekit_done; balance starts = lifetime (got ' + cos.lifetime() + '/' + cos.balance() + ')');
    ok(cos.owned('snake.food.apple') === true, 'free default is pre-owned');
    ok(cos.owned('snake.food.golden') === false, 'paid item starts locked');
    ok(cos.buy('flappy.bird.phoenix') === false && cos.balance() === 100, 'cannot buy above balance (no charge)');
    ok(cos.buy('snake.food.golden') === true && cos.balance() === 75, 'buy deducts the price (75 left)');
    ok(cos.buy('snake.food.golden') === true && cos.balance() === 75, 're-buy is idempotent (no double charge)');
    const owned = JSON.parse(g.store.gamekit_owned);
    ok(owned['snake.food.golden'] && owned['snake.food.golden'].c === 25, 'purchase stored as { c: cost }');
    ok(cos.selected('snake.food') === 'snake.food.apple', 'selection defaults to the free item');
    ok(cos.select('snake.food', 'snake.food.star') === false, 'cannot select an unowned item');
    ok(cos.select('snake.food', 'snake.food.golden') === true && cos.selected('snake.food') === 'snake.food.golden', 'select an owned item persists');
    const pr = cos.progress('snake');
    ok(pr.owned === 3 && pr.total === 8, 'progress(game) counts defaults + purchases (got ' + pr.owned + '/' + pr.total + ')');
    const all = cos.progress();
    ok(all.total >= 60 && all.owned >= 14, 'progress() spans the whole catalogue incl. free defaults (got ' + all.owned + '/' + all.total + ')');
  }

  // B2) free play (a reversible LENS — never a purchase) + the one-time welcome gift
  {
    const g = makeSandbox({ store: { gamekit_done: JSON.stringify({ a: 100 }), gamekit_flappy_migrated: '1' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(cosmetics, 'cosmetics.js');
    const cos = g.sandbox.gamekit.cosmetics;
    ok(cos.freePlay() === false, 'free play starts off');
    ok(cos.owned('flappy.bird.phoenix') === false, 'premium item locked before free play');
    cos.setFreePlay(true);
    ok(cos.freePlay() === true && cos.owned('flappy.bird.phoenix') === true, 'free play unlocks everything');
    ok(cos.ownedReal('flappy.bird.phoenix') === false, 'ownedReal() still reports the real collection');
    ok(cos.balance() === 100 && g.store.gamekit_owned === undefined, 'free play never spends and never writes gamekit_owned');
    ok(cos.select('flappy.bird', 'flappy.bird.phoenix') === true && cos.selected('flappy.bird') === 'flappy.bird.phoenix', 'a free-play item is wearable');
    const fpr = cos.progress('flappy');
    ok(fpr.owned < fpr.total, 'collection progress counts REAL ownership only (got ' + fpr.owned + '/' + fpr.total + ')');
    ok(cos.buy('flappy.bird.phoenix') === true && cos.balance() === 100, 'buy under free play is a no-op (no charge)');
    cos.setFreePlay(false);
    ok(cos.owned('flappy.bird.phoenix') === false, 'toggling off restores the real collection');
    ok(cos.selected('flappy.bird') !== 'flappy.bird.phoenix', 'selection falls back off an unowned free-play pick');
    ok(cos.gift().claimed === false && cos.gift().amount === 100, 'welcome gift starts unclaimed');
    ok(cos.claimGift() === true && cos.balance() === 200 && cos.lifetime() === 200, 'claiming adds 100 🏆 to lifetime AND balance');
    ok(JSON.parse(g.store.gamekit_done)['gift#welcome'] === 100, "gift lands as one 'gift#welcome' entry in gamekit_done");
    ok(cos.claimGift() === false && cos.balance() === 200, 'the gift is strictly one-time');
  }

  // C) good-run trophy trickle: +2 each, capped 3/day, lands in gamekit_done (= spendable)
  {
    const g = makeSandbox({ store: { gamekit_flappy_migrated: '1' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(challenges, 'challenges.js'); g.run(cosmetics, 'cosmetics.js');
    const F = g.sandbox.gamekit;
    F.recordResult('snake', { score: 10 }); // below the bar (300) → no bonus
    ok(F.goodRunBonus().count === 0, 'a below-bar run earns no trickle');
    for (let i = 0; i < 5; i++) F.recordResult('snake', { score: 9999 });
    const done = JSON.parse(g.store.gamekit_done || '{}');
    ok(done['gr#' + F.utcDateStr()] === 15, 'trickle caps at 3 good runs/day (+5 each = 15 🏆, got ' + done['gr#' + F.utcDateStr()] + ')');
    ok(F.goodRunBonus().count === 3 && F.goodRunBonus().cap === 3 && F.goodRunBonus().per === 5, 'goodRunBonus() reports 3/3 · +5');
    ok(F.cosmetics.balance() === 15, 'trickle trophies are spendable (balance 15)');
  }

  // C2) end-menu good-run line is the trickle RECEIPT
  {
    const g = makeSandbox({ store: { gamekit_flappy_migrated: '1' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(challenges, 'challenges.js'); g.run(cosmetics, 'cosmetics.js');
    const F = g.sandbox.gamekit;
    const findByCls = (el, cls, out = []) => { if (!el) return out; if (String(el.className || '').includes(cls)) out.push(el); (el.children || []).forEach(c => findByCls(c, cls, out)); return out; };
    const h = F.menu.show({ kind: 'end', score: 9999, record: { slug: 'snake', mode: '', score: 9999 }, actions: [{ id: 'again', label: 'AGAIN', primary: true }] });
    let line = findByCls(h.el, 'gkm-goodrun')[0];
    ok(line && String(line.innerHTML).includes('+5 🏆 (1/3 today)'), 'end menu shows the +5 🏆 receipt (got "' + (line && line.innerHTML) + '")');
    F.menu.hide();
    for (let i = 0; i < 3; i++) { F.menu.show({ kind: 'end', score: 9999, record: { slug: 'snake', mode: '', score: 9999 }, actions: [{ id: 'again', label: 'A', primary: true }] }); F.menu.hide(); }
    const h2 = F.menu.show({ kind: 'end', score: 9999, record: { slug: 'snake', mode: '', score: 9999 }, actions: [{ id: 'again', label: 'A', primary: true }] });
    line = findByCls(h2.el, 'gkm-goodrun')[0];
    ok(line && String(line.innerHTML).includes('maxed 3/3'), 'past the cap the receipt says the daily bonus is maxed (got "' + (line && line.innerHTML) + '")');
  }

  // D) Meadow Flyer migration: banked cash → trophies 1:1, unlocked birds stay owned at cost 0
  {
    const g = makeSandbox({ store: { flappy_cash: '320', flappy_bird: 'owl' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(cosmetics, 'cosmetics.js');
    const F = g.sandbox.gamekit;
    const owned = JSON.parse(g.store.gamekit_owned || '{}');
    ok(owned['flappy.bird.robin'] && owned['flappy.bird.owl'] && owned['flappy.bird.owl'].c === 0, 'old-threshold birds owned at cost 0');
    ok(!owned['flappy.bird.bielik'], 'birds above the old banked total stay locked');
    const done = JSON.parse(g.store.gamekit_done || '{}');
    ok(done['flappy-migrate'] === 320, 'banked cash converts 1:1 into trophies');
    ok(g.store.flappy_cash === undefined && g.store.flappy_bird === undefined, 'old flappy keys removed');
    ok(g.store.gamekit_flappy_migrated === '1', 'migration flagged (runs once)');
    ok(F.cosmetics.balance() === 320, 'migrated trophies are fully spendable (owned birds cost nothing)');
    ok(F.cosmetics.selected('flappy.bird') === 'flappy.bird.owl', 'selected bird carries over');
  }

  // E) the Cosmetics store modal: builds headless, buys + equips, updates balance
  {
    const g = makeSandbox({ store: { gamekit_done: JSON.stringify({ a: 50 }), gamekit_flappy_migrated: '1' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(challenges, 'challenges.js'); g.run(cosmetics, 'cosmetics.js');
    const F = g.sandbox.gamekit;
    let err = null, h = null;
    try { h = F.shopPanel(); } catch (e) { err = e.message; }
    ok(err === null && h && h.el, 'shopPanel builds headless: ' + err);
    if (h) {
      h.buy('snake.food.golden');
      ok(F.cosmetics.owned('snake.food.golden') && F.cosmetics.balance() === 25, 'store buy deducts + owns (balance 25)');
      ok(F.cosmetics.selected('snake.food') === 'snake.food.golden', 'store buy equips the item');
      h.buy('snake.food.rainbow'); // 100 — can't afford
      ok(!F.cosmetics.owned('snake.food.rainbow') && F.cosmetics.balance() === 25, 'store refuses an unaffordable buy');
      let cerr = null; try { h.close(); } catch (e) { cerr = e.message; }
      ok(cerr === null, 'shopPanel closes cleanly: ' + cerr);
      ok(F.isPaused() === false, 'closing the store releases the modal pause');
    }
  }

  // E2) premium purchases (≥🏆100) go through a confirm step — no refunds exist, so a single
  // mis-tap must never drain the wallet; cheap items still buy in one go
  {
    const g = makeSandbox({ store: { gamekit_done: JSON.stringify({ a: 500 }), gamekit_flappy_migrated: '1' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(challenges, 'challenges.js'); g.run(cosmetics, 'cosmetics.js');
    const F = g.sandbox.gamekit;
    const h = F.shopPanel();
    if (h) {
      h.buy('snake.food.golden'); // 25 — under the confirm threshold
      ok(F.cosmetics.owned('snake.food.golden'), 'a cheap item still buys in one tap');
      h.buy('snake.food.rainbow'); // 100, affordable — must WAIT for the confirm
      ok(!F.cosmetics.owned('snake.food.rainbow') && F.cosmetics.balance() === 475,
        'a ≥🏆100 buy is gated behind a confirm — nothing spent on the first tap (balance ' + F.cosmetics.balance() + ')');
    }
  }

  // F) hashed challengePick export: deterministic, defined goal, never yesterday's pick
  {
    const g = makeSandbox({});
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(challenges, 'challenges.js');
    const F = g.sandbox.gamekit;
    const p1 = F.challengePick('daily'), p1b = F.challengePick('daily'), p0 = F.challengePick('daily', F.utcDayNumber() - 1);
    ok(p1 && p1.goal && p1.id === p1b.id, 'challengePick(daily) is deterministic + resolves a goal');
    ok(p0 && p0.id !== p1.id, 'never the same daily two days in a row (' + p0.id + ' vs ' + p1.id + ')');
    const w = F.challengePick('weekly');
    ok(w && w.goal && /^W\d+/.test(w.period), 'challengePick(weekly) resolves with a week period key');
  }

  // G) menu-group wiring: defaults to the free item, locked until bought, buy unlocks + selects
  {
    const g = makeSandbox({ store: { gamekit_done: JSON.stringify({ a: 40 }), gamekit_flappy_migrated: '1' } });
    g.run(KIT, 'game-kit.js'); g.run(I18N, 'i18n.js'); g.run(cosmetics, 'cosmetics.js');
    const F = g.sandbox.gamekit;
    const grp = F.cosmetics.menuGroup('snake.food');
    ok(grp && grp.style === 'grid' && grp.choices.length === 6, 'menuGroup builds a 6-cell grid');
    const h = F.menu.show({ kind: 'start', groups: [grp], actions: [{ id: 'play', label: 'GO', primary: true }] });
    ok(h.selection()['snake.food'] === 'snake.food.apple', 'menu defaults to the free item');
    h.select('snake.food', 'snake.food.golden');
    ok(h.selection()['snake.food'] === 'snake.food.apple', 'a locked cell cannot be selected');
    const golden = grp.choices.find(c => c.id === 'snake.food.golden');
    ok(golden.buy() === true, 'grid buy() purchases with trophies');
    ok(F.cosmetics.owned('snake.food.golden') && F.cosmetics.selected('snake.food') === 'snake.food.golden', 'buying equips the skin');
    ok(F.cosmetics.balance() === 15, 'balance after the buy (15)');
    F.menu.hide();
  }
}

// ---------------- service worker (ONE root scope for the whole site) ----------------
function testServiceWorkers() {
  section('service worker (single root scope)');
  const core = fs.readFileSync(path.join(DIR, 'sw-core.js'), 'utf8');
  const src = fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8');
  const listeners = {}; let opened = null;
  const sb = {
    location: { origin: 'https://komyo.online' },
    addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting: () => {}, clients: { claim: () => {} },
    caches: { open: n => { opened = n; return Promise.resolve({ add: () => Promise.resolve(), match: () => Promise.resolve(null), put: () => {} }); }, keys: () => Promise.resolve([]), delete: () => Promise.resolve() },
    fetch: () => Promise.reject(new Error('offline')), Response: { error: () => ({}) }, Promise, console, URL,
  };
  sb.self = sb; sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  sb.importScripts = rel => vm.runInContext(rel.indexOf('sw-core') >= 0 ? core : '', ctx, { filename: rel });
  let err = null;
  try { vm.runInContext(src, ctx, { filename: 'sw.js' }); } catch (e) { err = e.message; }
  ok(err === null, 'sw.js loads + imports sw-core: ' + err);
  ok(typeof listeners.install === 'function' && typeof listeners.activate === 'function' && typeof listeners.fetch === 'function',
    'sw.js registers install/activate/fetch');
  try { if (listeners.install) listeners.install({ waitUntil() {} }); } catch (e) {}
  ok(opened === 'komyo-root-dev', 'sw.js precaches the root-keyed cache (got ' + opened + ')');

  // ONE worker for the whole site — a leftover per-game sw.js would shadow the root scope on that game
  const strays = fs.readdirSync(path.join(DIR, 'games')).filter(d => fs.existsSync(path.join(DIR, 'games', d, 'sw.js')));
  ok(strays.length === 0, 'no per-game sw.js remains' + (strays.length ? ': ' + strays.join(', ') : ''));

  const SHELL = Array.isArray(sb.SHELL) ? sb.SHELL : [];
  const gw = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DIR, 'games.js'), 'utf8'), gw);
  const live = (gw.window.GAMES || []).filter(x => x && x.slug && !x.soon).map(x => x.slug);
  // SHELL ⇄ games.js lockstep: every live game's FULL shell is precached (offline after one visit)
  const missing = [];
  for (const s of live) for (const f of ['', 'index.html', 'manifest.json', 'favicon.svg', 'icon-192.png', 'icon-512.png']) {
    if (!SHELL.includes('./games/' + s + '/' + f)) missing.push(s + '/' + (f || '(dir)'));
  }
  ok(missing.length === 0, 'SHELL covers every live game in games.js' + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
  const stale = [...new Set(SHELL.filter(u => u.startsWith('./games/')).map(u => u.split('/')[2]).filter(s => !live.includes(s)))];
  ok(stale.length === 0, 'SHELL lists no soon/removed game' + (stale.length ? ': ' + stale.join(', ') : ''));
  // SHELL ⇄ locale lockstep: every i18n.<code>.js in the repo is precached (a missing one silently
  // kills that language offline)
  const locales = fs.readdirSync(DIR).filter(f => /^i18n\.[a-z-]+\.js$/.test(f));
  const missLoc = locales.filter(f => !SHELL.includes('./' + f));
  ok(missLoc.length === 0, 'SHELL lists every locale file' + (missLoc.length ? ' — missing: ' + missLoc.join(', ') : ''));
  // every SHELL entry resolves on disk (a typo would silently 404 out of the precache)
  const gone = SHELL.filter(u => !fs.existsSync(path.join(DIR, u.slice(2))));
  ok(gone.length === 0, 'every SHELL entry exists on disk' + (gone.length ? ' — missing: ' + gone.join(', ') : ''));
  // every live game registers the ONE root worker (a bare pwa() would re-register a dead per-game scope)
  const badReg = live.filter(s => !fs.readFileSync(path.join(DIR, 'games', s, 'index.html'), 'utf8').includes("pwa('../../sw.js')"));
  ok(badReg.length === 0, "every live game calls pwa('../../sw.js')" + (badReg.length ? ' — off: ' + badReg.join(', ') : ''));
}

// ---------------- per-game SEO head + crawlable about section ----------------
// Every live game page ships the discoverability unit: keyworded <title>, meta description,
// canonical, hreflang alternates (one per locale file on disk), VideoGame JSON-LD, OG/Twitter
// tags, and the static #gk-about section (kit ☰ "How to play" + what crawlers actually read).
function testSEO() {
  section('per-game SEO (head unit + #gk-about section)');
  const gw = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DIR, 'games.js'), 'utf8'), gw);
  const live = (gw.window.GAMES || []).filter(x => x && x.slug && !x.soon).map(x => x.slug);
  const locales = fs.readdirSync(DIR).filter(f => /^i18n\.[a-z-]+\.js$/.test(f)).map(f => f.split('.')[1]);
  const bad = (label, list) => ok(list.length === 0, label + (list.length ? ' — off: ' + list.join(', ') : ''));
  const pages = live.map(s => [s, fs.readFileSync(path.join(DIR, 'games', s, 'index.html'), 'utf8')]);
  bad('every live game has a keyworded <title> ending in "| Komyo Games"',
    pages.filter(([, h]) => !/<title>[^<]+\| Komyo Games<\/title>/.test(h)).map(([s]) => s));
  bad('every live game has a meta description',
    pages.filter(([, h]) => !h.includes('<meta name="description"')).map(([s]) => s));
  bad('every live game has its canonical URL',
    pages.filter(([s, h]) => !h.includes('<link rel="canonical" href="https://komyo.online/games/' + s + '/">')).map(([s]) => s));
  bad('every live game has hreflang alternates for every locale + x-default',
    pages.filter(([s, h]) => !locales.concat(['x-default']).every(l => h.includes('hreflang="' + l + '"'))
      || !h.includes('hreflang="en"')).map(([s]) => s));
  bad('every live game has OG + Twitter card tags',
    pages.filter(([, h]) => !(h.includes('property="og:title"') && h.includes('property="og:image"') && h.includes('name="twitter:card"'))).map(([s]) => s));
  const badLD = [];
  for (const [s, h] of pages) {
    const m = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    try {
      const ld = JSON.parse(m[1]);
      if (ld['@type'] !== 'VideoGame' || !ld.name || !ld.description || !ld.url.includes(s) || ld.isAccessibleForFree !== true) badLD.push(s);
    } catch (e) { badLD.push(s); }
  }
  bad('every live game has valid VideoGame JSON-LD', badLD);
  bad('every live game ships the crawlable #gk-about section (howto key + catalogue link)',
    pages.filter(([s, h]) => !(h.includes('id="gk-about"') && h.includes('data-t="seo.' + s + '.howto"') && h.includes('href="../../"'))).map(([s]) => s));
  // homepage: the static no-JS game list + the ItemList JSON-LD (what LLM fetchers / no-JS
  // crawlers see instead of the JS-rendered tiles) must stay in lockstep with games.js
  {
    const idx = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
    const nav = (idx.match(/<nav class="nojs-games"[\s\S]*?<\/nav>/) || [''])[0];
    const navSlugs = [...nav.matchAll(/href="games\/([^/]+)\//g)].map(m => m[1]);
    ok(JSON.stringify(navSlugs) === JSON.stringify(live),
      'homepage static game list matches games.js live games in order (got: ' + navSlugs.join(', ') + ')');
    let graph = null;
    try { graph = JSON.parse((idx.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1])['@graph']; } catch (e) {}
    ok(Array.isArray(graph) && graph.some(n => n['@type'] === 'WebSite'), 'homepage JSON-LD has a WebSite node');
    const il = (graph || []).find(n => n['@type'] === 'ItemList');
    const ilSlugs = ((il && il.itemListElement) || []).map(e => ((e.url || '').match(/games\/([^/]+)\//) || [])[1]);
    ok(JSON.stringify(ilSlugs) === JSON.stringify(live),
      'homepage ItemList JSON-LD matches games.js live games in order (got: ' + ilSlugs.join(', ') + ')');
  }
}

// ---------------- qr.js (reusable QR encoder) ----------------
function testQR() {
  section('qr.js (QR encoder)');
  const src = fs.readFileSync(path.join(DIR, 'qr.js'), 'utf8');
  const sb = { window: {} }; sb.globalThis = sb;
  vm.runInNewContext(src, sb, { filename: 'qr.js' });
  const QR = sb.window.KOMYO_QR;
  ok(QR && typeof QR.encode === 'function', 'qr.js exposes KOMYO_QR.encode');
  const url = 'https://komyo.online/games/forcefield/?mode=lives&diff=hard';
  const r = QR.encode(url);
  ok(r && r.size === 33 && r.version === 4, 'encodes a ~59-char URL as version 4 / 33×33 (got ' + (r && r.size) + ')');
  const finder = (R, C) => { for (let dr = 0; dr < 7; dr++) for (let dc = 0; dc < 7; dc++) { const dark = (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)); if (r.modules[R + dr][C + dc] !== (dark ? 1 : 0)) return false; } return true; };
  ok(finder(0, 0) && finder(0, r.size - 7) && finder(r.size - 7, 0), 'all three finder patterns are correct');
  let tim = true; for (let c = 8; c < r.size - 8; c++) if (r.modules[6][c] !== (c % 2 === 0 ? 1 : 0)) tim = false;
  ok(tim, 'horizontal timing pattern alternates');
  let dark = 0; for (let R = 0; R < r.size; R++) for (let C = 0; C < r.size; C++) dark += r.modules[R][C];
  const pct = dark * 100 / (r.size * r.size);
  ok(pct > 40 && pct < 60, 'dark-module ratio in the healthy 40–60% band (got ' + pct.toFixed(1) + '%)');
  ok(JSON.stringify(QR.encode(url).modules) === JSON.stringify(r.modules), 'encoding is deterministic');
  ok((QR.encode('x') || {}).version === 1, 'a tiny string uses version 1');
  ok(QR.encode('x'.repeat(400)) === null, 'over-long input returns null (no throw)');
}

console.log('Running arcade tests…');
testCatalogue();
testTD();
testLiveGames();
await testKit();
testKitChrome();
testFullscreen();
testRecentlyPlayed();
testI18n();
testI18nCoverage();
testChallenges();
testCosmetics();
testServiceWorkers();
testSEO();
testQR();
summary();
