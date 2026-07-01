// Daily & weekly challenge catalogue (window.CHALLENGES). Same-for-everyone selection is
// UTC-date-driven (see index.html). Targets are PROVISIONAL — tune once real results flow.
//   goal: { id, title, slug?, metric, op?, target, scope?:'cross', range?:'day'|'week' }
//   - single-game goal: checked vs gamekit.lastResult(slug) — metric 'score'|'time'|<stats key>
//   - scope:'cross' goal: checked vs the per-day activity log (range 'day') or this week's
//     aggregate (range 'week') — metric 'distinctGames'|'totalGames'|'totalScore'|'distinctGenres'
window.CHALLENGES = {
  goals: {
    // ---- single game (no mode required → any mode counts) ----
    'snake-20':   { slug: 'snake',         title: 'Score 100 in Neon Snake',       metric: 'score', target: 100 },
    'snake-50':   { slug: 'snake',         title: 'Score 250 in Neon Snake',       metric: 'score', target: 250 },
    'bub-1k':     { slug: 'bubbles',       title: 'Score 1,000 in Bubble Pop',     metric: 'score', target: 1000 },
    'bub-3k':     { slug: 'bubbles',       title: 'Score 3,000 in Bubble Pop',     metric: 'score', target: 3000 },
    'brk-500':    { slug: 'breakout',      title: 'Score 500 in Brick Breaker',    metric: 'score', target: 500 },
    'brk-1500':   { slug: 'breakout',      title: 'Score 1,500 in Brick Breaker',  metric: 'score', target: 1500 },
    'stk-10':     { slug: 'stacker',       title: 'Stack 12 high in Stack',        metric: 'score', target: 12 },
    'stk-20':     { slug: 'stacker',       title: 'Stack 25 high in Stack',        metric: 'score', target: 25 },
    'fly-5':      { slug: 'flappy',        title: 'Pass 8 in Meadow Flyer',        metric: 'score', target: 8 },
    'fly-15':     { slug: 'flappy',        title: 'Pass 20 in Meadow Flyer',       metric: 'score', target: 20 },
    'aim-250':    { slug: 'aim-trainer',   title: 'Score 250 in Range',            metric: 'score', target: 250 },
    'aim-600':    { slug: 'aim-trainer',   title: 'Score 600 in Range',            metric: 'score', target: 600 },
    'td-wave5':   { slug: 'tower-defense', title: 'Reach wave 5 in Keep Defender', metric: 'wave',  target: 5 },
    'td-700':     { slug: 'tower-defense', title: 'Score 700 in Keep Defender',    metric: 'score', target: 700 },
    'ast-4k':     { slug: 'asteroids',      title: 'Score 4,000 in Asteroids',      metric: 'score', target: 4000 },
    'astp-50k':   { slug: 'asteroids-plus', title: 'Score 50,000 in Asteroids+',    metric: 'score', target: 50000 },
    'astp-150k':  { slug: 'asteroids-plus', title: 'Score 150,000 in Asteroids+',   metric: 'score', target: 150000 },
    // ---- cross-game / meta (today) ----
    'play2':      { title: 'Play 2 different games today',  scope: 'cross', range: 'day', metric: 'distinctGames',  target: 2 },
    'play3':      { title: 'Play 3 different games today',  scope: 'cross', range: 'day', metric: 'distinctGames',  target: 3 },
    'genres2':    { title: 'Play 2 different genres today', scope: 'cross', range: 'day', metric: 'distinctGenres', target: 2 },
    'good3':      { title: 'Have 3 good runs today',         scope: 'cross', range: 'day', metric: 'goodRuns',       target: 3 },
    // ---- weekly = more WORK, not harder (volume / variety over the week) ----
    'wk-distinct5': { title: 'Play 5 different games this week', scope: 'cross', range: 'week', metric: 'distinctGames',  target: 5 },
    'wk-play12':    { title: 'Play 12 games this week',          scope: 'cross', range: 'week', metric: 'totalGames',     target: 12 },
    'wk-genres3':   { title: 'Play 3 different genres this week', scope: 'cross', range: 'week', metric: 'distinctGenres', target: 3 },
    'wk-good10':    { title: 'Have 10 good runs this week',       scope: 'cross', range: 'week', metric: 'goodRuns',       target: 10 },
  },
  // curated daily rotation — mixes single-game + cross-game and avoids repeating the same game back-to-back
  daily: [
    'snake-20', 'play2', 'bub-1k', 'td-wave5', 'fly-5', 'good3', 'aim-250', 'brk-500',
    'play3', 'stk-10', 'astp-50k', 'genres2', 'snake-50', 'bub-3k', 'aim-600', 'brk-1500',
    'fly-15', 'stk-20', 'td-700', 'astp-150k', 'ast-4k',
  ],
  weekly: ['wk-distinct5', 'wk-play12', 'wk-genres3', 'wk-good10'],
};
