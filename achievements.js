// Achievements registry (window.ACHIEVEMENTS) — one-off, evergreen goals that pay 🏆 trophies.
// Data only: the kit (gamekit.achievements) owns the stores, the evaluation and the badge wall.
// See plans/achievements-plan.md for the why; this file is the WHAT.
//
//   { id: '<slug>.<key>' | 'site.<key>',   // the ONE identity (storage key included)
//     game: '<slug>' | '',                 // '' = site-wide
//     icon: '🏆', price: 5 | 15 | 50,      // trophies paid ON UNLOCK
//     goal: <number>,                      // the target
//     …exactly ONE shape: }
//
//   max: '<stat>'    best-ever value of a run stat (or 'score'), read from the gamekit_pb MAXes.
//                    Shows a progress bar and BACKFILLS from history the first time it evaluates.
//   sum: '<stat>'    cumulative across runs, from gamekit_tally. Bar; starts at 0 on release
//                    (nothing sums stats today, so there is no history to seed from).
//   site: '<counter>' one of the kit's closed site-wide counter names — see SITE_COUNTERS in
//                    game-kit.js. Bar; backfills.
//   run: fn(run)     a CONDITIONAL predicate, evaluated only on the run that just ended
//                    (`run` = { slug, mode, score, time, outcome, stats }). Returns a number
//                    (≥ goal unlocks). No bar — the wall shows a ✓/locked row instead, because
//                    "zero mistakes" has no meaningful 40%.
//
// Rules the suite enforces: ids unique + '<game>.' prefixed (site-wide = 'site.'), `game` is ''
// or a LIVE games.js slug, exactly one shape per entry, prices in {5,15,50}, and **50 is
// skill-only — a `sum:` entry may never cost 50** (grinding is not difficulty). Names and
// descriptions are NOT here: they are i18n keys (`ach.<id>.name` / `ach.<id>.desc`), like cos.*,
// so the coverage test forces the Polish translation and keeps every locale all-or-nothing.
window.ACHIEVEMENTS = {
  v: 1,
  items: [
    // ---------------- site-wide ----------------
    { id: 'site.first-cosmetic', game: '', icon: '🛍️', price: 5, site: 'cosBought', goal: 1 },
    { id: 'site.collector25', game: '', icon: '🎨', price: 5, site: 'cosPaidPct', goal: 25 },
    { id: 'site.collector50', game: '', icon: '🖌️', price: 5, site: 'cosPaidPct', goal: 50 },
    { id: 'site.collector100', game: '', icon: '🏛️', price: 15, site: 'cosPaidPct', goal: 100 },
    { id: 'site.cursors', game: '', icon: '🖱️', price: 15, site: 'cursorPaidPct', goal: 100 },
    { id: 'site.tourist5', game: '', icon: '🗺️', price: 5, site: 'games', goal: 5 },
    { id: 'site.tourist15', game: '', icon: '🧭', price: 15, site: 'games', goal: 15 },
    { id: 'site.tourist-all', game: '', icon: '🌍', price: 50, site: 'gamesPct', goal: 100 },
    { id: 'site.genres8', game: '', icon: '🎭', price: 15, site: 'genres', goal: 8 },
    { id: 'site.regular', game: '', icon: '🎟️', price: 5, site: 'plays', goal: 50 },
    { id: 'site.veteran', game: '', icon: '🎫', price: 15, site: 'plays', goal: 500 },
    { id: 'site.goodrun1', game: '', icon: '🌟', price: 5, site: 'goodRunGames', goal: 1 },
    { id: 'site.allrounder', game: '', icon: '✨', price: 15, site: 'goodRunGames', goal: 5 },
    { id: 'site.titled', game: '', icon: '🎖️', price: 5, site: 'titleWorn', goal: 1 },
    { id: 'site.rich', game: '', icon: '💰', price: 15, site: 'lifetime', goal: 2500 },

    // ---------------- per game (games.js order) ----------------
    { id: 'asteroids.wave5', game: 'asteroids', icon: '🪨', price: 5, max: 'wave', goal: 5 },
    { id: 'asteroids.wave10', game: 'asteroids', icon: '☄️', price: 15, max: 'wave', goal: 10 },
    { id: 'asteroids.wave15', game: 'asteroids', icon: '🌌', price: 50, max: 'wave', goal: 15 },

    { id: 'asteroids-plus.wave10', game: 'asteroids-plus', icon: '🛸', price: 5, max: 'wave', goal: 10 },
    { id: 'asteroids-plus.wave20', game: 'asteroids-plus', icon: '👽', price: 15, max: 'wave', goal: 20 },
    { id: 'asteroids-plus.win', game: 'asteroids-plus', icon: '🏅', price: 50, max: 'victory', goal: 1 },

    { id: 'tower-defense.wave10', game: 'tower-defense', icon: '🛡️', price: 5, max: 'wave', goal: 10 },
    { id: 'tower-defense.hard20', game: 'tower-defense', icon: '⚔️', price: 50, goal: 1,
      run: function (r) { return (r.stats.difficulty === 'hard' && (+r.stats.wave || 0) >= 20) ? 1 : 0; } },
    { id: 'tower-defense.nosell', game: 'tower-defense', icon: '🧱', price: 15, goal: 1,
      run: function (r) { return (r.stats.noSell && (+r.stats.wave || 0) >= 10) ? 1 : 0; } },
    { id: 'tower-defense.kills5000', game: 'tower-defense', icon: '☠️', price: 15, sum: 'kills', goal: 5000 },

    { id: 'forcefield.min3', game: 'forcefield', icon: '🛡️', price: 15, max: 'dur', goal: 180 },
    { id: 'forcefield.blocks500', game: 'forcefield', icon: '🔷', price: 15, sum: 'blocks', goal: 500 },

    { id: 'bubbles.pops5000', game: 'bubbles', icon: '🫧', price: 15, sum: 'pops', goal: 5000 },
    { id: 'bubbles.clear', game: 'bubbles', icon: '🧼', price: 50, goal: 1,
      run: function (r) { return r.outcome === 'win' ? 1 : 0; } },

    { id: 'frog-bonk.wave10', game: 'frog-bonk', icon: '🐸', price: 5, max: 'wave', goal: 10 },
    { id: 'frog-bonk.bonks300', game: 'frog-bonk', icon: '🔨', price: 5, sum: 'kills', goal: 300 },
    { id: 'frog-bonk.bonks1500', game: 'frog-bonk', icon: '🧙', price: 15, sum: 'kills', goal: 1500 },

    { id: 'breakout.bricks5k', game: 'breakout', icon: '🧱', price: 15, sum: 'bricks', goal: 5000 },
    { id: 'breakout.flawless', game: 'breakout', icon: '🏓', price: 15, goal: 1,
      run: function (r) { return r.stats.noLoss ? 1 : 0; } },

    { id: 'sudoku.clean', game: 'sudoku', icon: '✨', price: 15, goal: 1,
      run: function (r) { return (r.outcome === 'win' && !(+r.stats.mistakes) && !(+r.stats.hints)) ? 1 : 0; } },
    { id: 'sudoku.expert', game: 'sudoku', icon: '🧩', price: 50, goal: 1,
      run: function (r) { return (r.outcome === 'win' && (+r.stats.diff || 0) >= 4 && !(+r.stats.hints)) ? 1 : 0; } },
    { id: 'sudoku.solved20', game: 'sudoku', icon: '📘', price: 15, sum: 'solved', goal: 20 },

    { id: 'stacker.streak10', game: 'stacker', icon: '🎂', price: 15, max: 'streak', goal: 10 },
    { id: 'stacker.high75', game: 'stacker', icon: '🏗️', price: 15, max: 'score', goal: 75 },

    { id: 'trap-the-cat.quick', game: 'trap-the-cat', icon: '🐈', price: 15, goal: 1,
      run: function (r) { return (r.outcome === 'win' && (+r.stats.clicks || 99) <= 15) ? 1 : 0; } },
    { id: 'trap-the-cat.cats25', game: 'trap-the-cat', icon: '🧶', price: 15, sum: 'won', goal: 25 },

    { id: 'flappy.gates100', game: 'flappy', icon: '🪶', price: 50, max: 'score', goal: 100 },
    { id: 'flappy.gates1000', game: 'flappy', icon: '🌾', price: 15, sum: 'score', goal: 1000 },

    { id: 'aim-trainer.acc90', game: 'aim-trainer', icon: '🎯', price: 15, goal: 1,
      run: function (r) { return ((+r.stats.accuracy || 0) >= 90 && (+r.stats.hits || 0) >= 20) ? 1 : 0; } },
    { id: 'aim-trainer.hits2500', game: 'aim-trainer', icon: '🔫', price: 15, sum: 'hits', goal: 2500 },

    { id: 'snake.len50', game: 'snake', icon: '🐍', price: 5, max: 'length', goal: 50 },
    { id: 'snake.len100', game: 'snake', icon: '🐉', price: 15, max: 'length', goal: 100 },

    { id: '2048.t1024', game: '2048', icon: '🔢', price: 5, max: 'maxTile', goal: 1024 },
    { id: '2048.t2048', game: '2048', icon: '🧮', price: 15, max: 'maxTile', goal: 2048 },
    { id: '2048.t4096', game: '2048', icon: '💎', price: 50, max: 'maxTile', goal: 4096 },

    { id: 'type-siege.wpm40', game: 'type-siege', icon: '⌨️', price: 5, max: 'wpm', goal: 40 },
    { id: 'type-siege.wpm60', game: 'type-siege', icon: '📝', price: 15, max: 'wpm', goal: 60 },
    { id: 'type-siege.wpm80', game: 'type-siege', icon: '🖋️', price: 50, max: 'wpm', goal: 80 },
    { id: 'type-siege.acc100', game: 'type-siege', icon: '🎯', price: 15, goal: 1,
      run: function (r) { return ((+r.stats.accuracy || 0) >= 100 && (+r.stats.wave || 0) >= 3) ? 1 : 0; } },
    { id: 'type-siege.chars10k', game: 'type-siege', icon: '📜', price: 15, sum: 'chars', goal: 10000 },

    { id: 'dusk-runner.m2000', game: 'dusk-runner', icon: '🏃', price: 50, max: 'metres', goal: 2000 },
    { id: 'dusk-runner.marathon', game: 'dusk-runner', icon: '🥇', price: 15, sum: 'metres', goal: 42195 },
    { id: 'dusk-runner.clean500', game: 'dusk-runner', icon: '👟', price: 15, goal: 1,
      run: function (r) { return (!(+r.stats.stumbles) && (+r.stats.metres || 0) >= 500) ? 1 : 0; } },

    { id: 'floodgate.par', game: 'floodgate', icon: '🚰', price: 5, goal: 1,
      run: function (r) { return ((+r.stats.par || 0) > 0 && (+r.stats.moves || 0) <= (+r.stats.par)) ? 1 : 0; } },
    { id: 'floodgate.boards25', game: 'floodgate', icon: '💧', price: 5, sum: 'score', goal: 25 },
    { id: 'floodgate.boards100', game: 'floodgate', icon: '🌊', price: 15, sum: 'score', goal: 100 },

    { id: 'mirror-maze.tier5', game: 'mirror-maze', icon: '🔮', price: 15, max: 'tier', goal: 5 },
    { id: 'mirror-maze.nohint', game: 'mirror-maze', icon: '🧠', price: 5, goal: 1,
      run: function (r) { return (!(+r.stats.hints) && (+r.stats.mazes || 0) >= 1) ? 1 : 0; } },
    { id: 'mirror-maze.mazes50', game: 'mirror-maze', icon: '🪞', price: 5, sum: 'solved', goal: 50 },
    { id: 'mirror-maze.mazes250', game: 'mirror-maze', icon: '💠', price: 15, sum: 'solved', goal: 250 },

    { id: 'minesweeper.expert', game: 'minesweeper', icon: '💣', price: 50, goal: 1,
      run: function (r) { return (r.stats.win && !(+r.stats.relaxed) && (+r.stats.diff || 0) >= 4) ? 1 : 0; } },
    { id: 'minesweeper.noflags', game: 'minesweeper', icon: '🚩', price: 15, goal: 1,
      run: function (r) { return (r.stats.win && !(+r.stats.flags)) ? 1 : 0; } },
    { id: 'minesweeper.wins25', game: 'minesweeper', icon: '⛏️', price: 15, sum: 'win', goal: 25 },

    { id: 'balloon-pop.combo10', game: 'balloon-pop', icon: '🎈', price: 5, max: 'bestCombo', goal: 10 },
    { id: 'balloon-pop.nobees', game: 'balloon-pop', icon: '🐝', price: 15, goal: 1,
      run: function (r) { return (!(+r.stats.beeStings) && r.score >= 20) ? 1 : 0; } },

    { id: 'critter-match.sharp', game: 'critter-match', icon: '🐾', price: 50, goal: 1,
      run: function (r) { return (r.stats.cleared && (+r.stats.flips || 0) <= (+r.stats.pairs || 0) * 2 + 4) ? 1 : 0; } },
    { id: 'critter-match.boards25', game: 'critter-match', icon: '🐰', price: 15, sum: 'cleared', goal: 25 },

    { id: 'glow-says.notes12', game: 'glow-says', icon: '🔔', price: 50, max: 'score', goal: 12 },
    { id: 'glow-says.notes250', game: 'glow-says', icon: '🎵', price: 15, sum: 'score', goal: 250 },

    { id: 'tube-racer.mach1', game: 'tube-racer', icon: '🏍️', price: 5, max: 'mach', goal: 1, dec: 1 },
    { id: 'tube-racer.mach15', game: 'tube-racer', icon: '💨', price: 15, max: 'mach', goal: 1.5, dec: 1 },
    { id: 'tube-racer.mach2', game: 'tube-racer', icon: '🚀', price: 50, max: 'mach', goal: 2, dec: 1 },
    { id: 'tube-racer.km1000', game: 'tube-racer', icon: '🛣️', price: 15, sum: 'dist', goal: 1000 },
    { id: 'tube-racer.clean', game: 'tube-racer', icon: '🧊', price: 15, goal: 1,
      run: function (r) { return r.stats.clean ? 1 : 0; } },
  ],
};
