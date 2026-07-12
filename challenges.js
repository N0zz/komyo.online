// Daily & weekly challenge catalogue (window.CHALLENGES). Same-for-everyone selection is
// UTC-date-driven (see index.html). Targets are PROVISIONAL — tune once real results flow.
//   goal: { id, title, slug?, metric, op?, target, scope?:'cross'|'random', range?:'day'|'week' }
//   - single-game goal: checked vs the kit's per-day best (gamekit_daybest) — metric 'score'|'time'|<stats key>
//   - scope:'cross' goal: checked vs the per-day activity log (range 'day') or this week's
//     aggregate (range 'week') — metric 'distinctGames'|'totalGames'|'totalScore'|'distinctGenres'
//   - scope:'random' goal: "play today's / this-week's pick" — the slug + title are resolved at
//     render time from ALL playable games via CHALLENGES.randomSlug(idx, playable) (same for
//     everyone, day/week-driven); done = that game was played in the period. Based on ALL games
//     (never "unplayed", which would be impossible for a player who's tried everything).
window.CHALLENGES = {
  goals: {
    // ---- single game (two tiers per game — an "easy day" + a "hard day" in the rotation; any
    // mode counts. Retuned 2026-07-03 from the plans/cosmetics-shop.html review) ----
    'snake-1':    { slug: 'snake',         title: 'Score 150 in Neon Snake',       metric: 'score', target: 150 },
    'snake-2':    { slug: 'snake',         title: 'Score 300 in Neon Snake',       metric: 'score', target: 300 },
    'bub-1':      { slug: 'bubbles',       title: 'Score 3,000 in Bubble Pop',     metric: 'score', target: 3000 },
    'bub-2':      { slug: 'bubbles',       title: 'Score 5,000 in Bubble Pop',     metric: 'score', target: 5000 },
    'brk-1':      { slug: 'breakout',      title: 'Score 500 in Brick Breaker',    metric: 'score', target: 500 },
    'brk-2':      { slug: 'breakout',      title: 'Score 1,500 in Brick Breaker',  metric: 'score', target: 1500 },
    'stk-1':      { slug: 'stacker',       title: 'Stack 25 high in Stack',        metric: 'score', target: 25 },
    'stk-2':      { slug: 'stacker',       title: 'Stack 50 high in Stack',        metric: 'score', target: 50 },
    'fly-1':      { slug: 'flappy',        title: 'Score 25 in Meadow Flyer',      metric: 'score', target: 25 },
    'fly-2':      { slug: 'flappy',        title: 'Score 50 in Meadow Flyer',      metric: 'score', target: 50 },
    'aim-1':      { slug: 'aim-trainer',   title: 'Score 250 in Range',            metric: 'score', target: 250 },
    'aim-2':      { slug: 'aim-trainer',   title: 'Score 600 in Range',            metric: 'score', target: 600 },
    'td-wave5':   { slug: 'tower-defense', title: 'Reach wave 5 in Keep Defender', metric: 'wave',  target: 5 },
    'td-wave10':  { slug: 'tower-defense', title: 'Reach wave 10 in Keep Defender', metric: 'wave', target: 10 },
    'ast-1':      { slug: 'asteroids',      title: 'Score 4,000 in Asteroids',      metric: 'score', target: 4000 },
    'ast-2':      { slug: 'asteroids',      title: 'Score 8,000 in Asteroids',      metric: 'score', target: 8000 },
    'astp-1':     { slug: 'asteroids-plus', title: 'Score 15,000 in Asteroids+',    metric: 'score', target: 15000 },
    'astp-2':     { slug: 'asteroids-plus', title: 'Score 30,000 in Asteroids+',    metric: 'score', target: 30000 },
    'forcefield-1':    { slug: 'forcefield',          title: 'Score 250 in Forcefield',       metric: 'score', target: 250 },
    'forcefield-2':    { slug: 'forcefield',          title: 'Score 500 in Forcefield',       metric: 'score', target: 500 },
    'frog-1':     { slug: 'frog-bonk',    title: 'Score 800 in Frog Bonk',       metric: 'score', target: 800 },
    'frog-2':     { slug: 'frog-bonk',    title: 'Score 2,000 in Frog Bonk',     metric: 'score', target: 2000 },
    'sudoku-1':   { slug: 'sudoku',       title: 'Solve a Sudoku puzzle',        metric: 'score', target: 100 },
    'sudoku-2':   { slug: 'sudoku',       title: 'Score 1,500 in Sudoku',        metric: 'score', target: 1500 },
    'mines-1':    { slug: 'minesweeper',  title: 'Clear an Easy Minesweeper board',           metric: 'score', target: 71 },
    'mines-2':    { slug: 'minesweeper',  title: 'Uncover 118 tiles in one Minesweeper run',  metric: 'score', target: 118 },
    '2048-1':     { slug: '2048',         title: 'Build a 256 tile in 2048',     metric: 'maxTile', target: 256 },
    '2048-2':     { slug: '2048',         title: 'Score 4,500 in one 2048 run',  metric: 'score',   target: 4500 },
    'cat-1':      { slug: 'trap-the-cat', title: 'Trap the cat',                 metric: 'score', target: 30 },
    'cat-2':      { slug: 'trap-the-cat', title: 'Score 90 in Trap the Cat',     metric: 'score', target: 90 },
    'glow-1':     { slug: 'glow-says',    title: 'Remember a 5-note tune in Glow Says', metric: 'score', target: 5 },
    'glow-2':     { slug: 'glow-says',    title: 'Remember 8 notes in Glow Says',       metric: 'score', target: 8 },
    'bal-pop-1':  { slug: 'balloon-pop',  title: 'Pop 30 in one Balloon Pop party',     metric: 'score', target: 30 },
    'bal-pop-2':  { slug: 'balloon-pop',  title: 'Pop 60 in one Balloon Pop run',       metric: 'score', target: 60 },
    'critter-1':  { slug: 'critter-match', title: 'Match every critter on a board',      metric: 'score', target: 60 },
    'critter-2':  { slug: 'critter-match', title: 'Score 160 in Critter Match',          metric: 'score', target: 160 },
    // ---- cross-game / meta (today) ----
    'play2':      { title: 'Play 2 different games today',  scope: 'cross', range: 'day', metric: 'distinctGames',  target: 2 },
    'play3':      { title: 'Play 3 different games today',  scope: 'cross', range: 'day', metric: 'distinctGames',  target: 3 },
    'genres2':    { title: 'Play 2 different genres today', scope: 'cross', range: 'day', metric: 'distinctGenres', target: 2 },
    'good3':      { title: 'Have 3 good runs today',         scope: 'cross', range: 'day', metric: 'goodRuns',       target: 3 },
    // ---- random pick (slug + title resolved at render time; drives discovery) ----
    'rand-daily':  { scope: 'random', range: 'day',  title: "Play today's random pick" },
    'rand-weekly': { scope: 'random', range: 'week', title: "Play this week's random pick" },
    // ---- weekly = more WORK, not harder (volume / variety over the week) ----
    'wk-distinct5': { title: 'Play 5 different games this week', scope: 'cross', range: 'week', metric: 'distinctGames',  target: 5 },
    'wk-play12':    { title: 'Play 12 games this week',          scope: 'cross', range: 'week', metric: 'totalGames',     target: 12 },
    'wk-genres3':   { title: 'Play 3 different genres this week', scope: 'cross', range: 'week', metric: 'distinctGenres', target: 3 },
    'wk-good10':    { title: 'Have 10 good runs this week',       scope: 'cross', range: 'week', metric: 'goodRuns',       target: 10 },
  },
  // daily POOL — the kit picks a SHUFFLED (hashed, same-for-everyone) entry per day, so list
  // order carries no meaning and easy/hard days interleave naturally (no back-to-back repeat
  // of the same goal — the kit nudges off yesterday's pick).
  daily: [
    'snake-1', 'play2', 'bub-1', 'td-wave5', 'fly-1', 'good3', 'aim-1', 'brk-1',
    'play3', 'stk-1', 'astp-1', 'genres2', 'rand-daily', 'snake-2', 'bub-2', 'aim-2',
    'brk-2', 'fly-2', 'stk-2', 'td-wave10', 'astp-2', 'ast-1', 'ast-2', 'forcefield-1', 'forcefield-2',
    'frog-1', 'frog-2', 'sudoku-1', 'sudoku-2', 'mines-1', 'mines-2', '2048-1', '2048-2',
    'cat-1', 'cat-2', 'glow-1', 'glow-2', 'bal-pop-1', 'bal-pop-2', 'critter-1', 'critter-2',
  ],
  weekly: ['wk-distinct5', 'wk-play12', 'rand-weekly', 'wk-genres3', 'wk-good10'],
};

// "Good run" bar per game — a run scoring at least this counts toward the goodRuns challenge
// metric (kit increments it when a result is recorded; the challenge panel hint reads it too).
// EVERY live game needs an entry — a missing slug silently never earns good runs.
// RULE (2026-07-03): the bar = the game's HARD daily target. Keep them in lockstep when
// retuning. tower-defense is the exception (its hard daily is wave-based) — its bar is the
// ESTIMATED wave-10 score on medium; confirm in playtest.
window.CHALLENGES.goodRun = {
  snake: 300, bubbles: 5000, breakout: 1500, stacker: 50, flappy: 50,
  'aim-trainer': 600, 'tower-defense': 2000, asteroids: 8000, 'asteroids-plus': 30000,
  forcefield: 500, 'frog-bonk': 2000, sudoku: 1500, minesweeper: 118, '2048': 4500, 'trap-the-cat': 90,
  'glow-says': 8, 'balloon-pop': 60, 'critter-match': 160,
};

// THE canonical pool for scope:'random' picks — window.GAMES non-soon slugs in games.js order,
// mirrored here because games never load games.js but their 🏆 panel must resolve the SAME pick
// as the catalogue (test.mjs enforces the lockstep). playableSince = each game's go-live date:
// the evaluator freezes a period's pool to the games live at its START, so a game shipping
// mid-week/mid-day never re-resolves an already-seen pick to a different target.
window.CHALLENGES.playable = [
  'asteroids', 'asteroids-plus', 'tower-defense', 'forcefield', 'bubbles', 'frog-bonk',
  'breakout', 'sudoku', 'stacker', 'trap-the-cat', 'flappy', 'aim-trainer', 'snake', '2048', 'minesweeper',
  'balloon-pop', 'critter-match', 'glow-says',
];
window.CHALLENGES.playableSince = {
  asteroids: '2026-06-26', 'asteroids-plus': '2026-06-28', 'tower-defense': '2026-06-26',
  forcefield: '2026-07-04', bubbles: '2026-06-26', 'frog-bonk': '2026-07-06', breakout: '2026-06-26',
  sudoku: '2026-07-10',
  stacker: '2026-06-26', flappy: '2026-06-26', 'aim-trainer': '2026-06-26', snake: '2026-06-26',
  minesweeper: '2026-07-12', '2048': '2026-07-12', 'trap-the-cat': '2026-07-12', 'glow-says': '2026-07-12',
  'balloon-pop': '2026-07-12', 'critter-match': '2026-07-12',
};
// ^ playableSince = the PUBLIC go-live (push) date, never a local build date. The kit admits a
// game's goals + random-pick slot only from the period AFTER this date, so a mid-day push can't
// re-roll a daily/weekly pick players have already seen.

// Deterministic, same-for-everyone pick for scope:'random' goals — chosen from ALL playable
// slugs by the day (daily) or week index. Pure so the catalogue's evalGoal and the tile-badge
// resolver agree. `playable` = window.GAMES filtered to non-soon, in catalogue order.
window.CHALLENGES.randomSlug = function (idx, playable) {
  if (!playable || !playable.length) return '';
  var n = playable.length;
  return playable[((((idx | 0) * 5 + 2) % n) + n) % n];
};

// Cosmetic titles earned by LIFETIME challenge points (points never reset). The profile picks the
// highest title whose `min` you've passed and renders it with an escalating shine (tier 0→8): plain →
// bronze → steel blade → arcane glow → gradient → shimmer → holographic → gold + sparkles. Client-only
// cosmetic (forgeable, but only shown on your own profile → zero stakes). Times ≈ ~40 pts/week casual.
// Economy scale: daily 10 / weekly 50 (since 2026-07-03).
window.CHALLENGES.titles = [
  { min: 0,     tier: 0, emoji: '👺', title: 'Goblin of the Gutter' },
  { min: 100,   tier: 1, emoji: '🌾', title: 'Peasant of the Fields' },
  { min: 250,   tier: 2, emoji: '🛡️', title: 'Squire of the Keep' },
  { min: 500,   tier: 3, emoji: '⚔️', title: 'Knight of the Realm' },
  { min: 1000,  tier: 4, emoji: '🔮', title: 'Sorcerer of the Spire' },
  { min: 2000,  tier: 5, emoji: '🧙', title: 'Archmage of the Arcane' },
  { min: 4000,  tier: 6, emoji: '👁️', title: 'Oracle of the Grid' },
  { min: 6500,  tier: 7, emoji: '🌟', title: 'Ascendant of the Stars' },
  { min: 10000, tier: 8, emoji: '👑', title: 'Emperor of Eternity' },
];
// highest title earned at `pts` lifetime challenge points
window.CHALLENGES.titleFor = function (pts) {
  var list = this.titles, out = list[0];
  for (var i = 0; i < list.length; i++) if ((pts | 0) >= list[i].min) out = list[i];
  return out;
};
