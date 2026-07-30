/* komyo i18n. English (en, the def: reference) lives here; every other locale ships as its
   own i18n.<code>.js so a visitor only parses the language they actually use. The loader below
   synchronously loads the ACTIVE language (t() must be complete before each page's inline
   script runs — the atomic-<head> contract), then lazy-loads the remaining languages after
   load, so offline switching and the service workers still carry every locale.
   Plural entries are objects: { one, few, many, other } — see game-kit t(). */
window.KOMYO_I18N = window.KOMYO_I18N || {};
// languages that ship a file — keep in lockstep with the i18n.<code>.js files AND every SW
// SHELL; game-kit's langReady treats a listed language as selectable before its file loads.
window.KOMYO_I18N_AVAILABLE = ['pl', 'es', 'pt', 'fr', 'it', 'cs', 'uk'];
window.KOMYO_I18N.en = {
  // --- shared plural keys (defined once; reused by the catalogue + games in later sessions) ---
  'cat.trophies': { one: '{count} trophy', other: '{count} trophies' },
  'cat.goodRuns': { one: '{count} good run', other: '{count} good runs' },
  'cat.plays': { one: '{count} play', other: '{count} plays' },
  'cat.showMore': 'Show {n} more…',
  'cat.more': 'MORE',
  // profile stat-chip + word plurals (catalogue profile panel)
  'profile.statGames': { one: 'Game', other: 'Games' },
  'profile.statModes': { one: 'Mode', other: 'Modes' },
  'profile.statPlays': { one: 'Play', other: 'Plays' },
  'profile.statDays': { one: 'Day', other: 'Days' },
  'profile.goodRunsWord': { one: 'good run', other: 'good runs' },
  'profile.playsWord': { one: 'play', other: 'plays' },

  // --- nav / chrome bar ---
  'nav.menu': '↩ Menu',
  'nav.leave': 'Leave',

  // --- confirm dialog ---
  'confirm.cancel': 'Cancel',
  'confirm.ok': 'OK',
  'confirm.leave': "Leave this run? You'll lose your progress.",
  'confirm.reset': 'Reset your saved scores for this game?',
  'confirm.holdReset': 'Hold to reset',

  // --- pause ---
  'pause.paused': 'Paused',
  'pause.resume': 'Resume',
  'pause.pause': 'Pause',

  // --- sound menu (labels + aria) ---
  'sound.muteSfx': 'Mute sound effects',
  'sound.sfxVol': 'Sound effects volume',
  'sound.muteMusic': 'Mute music',
  'sound.musVol': 'Music volume',
  'sound.settings': 'Sound settings',

  // --- kit ☰ game menu ---
  'kit.embed': '⧉ Embed this game',
  'kit.embedTitle': 'Embed this game on your website or blog',
  'kit.fullscreen': 'Fullscreen',
  'kit.exitFullscreen': 'Exit fullscreen',
  'kit.fullscreenTitle': 'Toggle fullscreen',
  'kit.reset': '↺ Reset game data',
  'kit.resetTitle': 'Reset this game’s saved scores',
  'kit.gameMenu': 'Game menu',
  'kit.rotate': 'Rotate your phone to play',
  'kit.tapToPlay': 'TAP TO PLAY',
  'kit.howto': 'How to play',

  // --- about / how-to sections (the static crawlable #gk-about block in each game page) ---
  'seo.h.faq': 'Common questions',
  'seo.h.more': 'More free games',
  'seo.q.free': 'Is this game free?',
  'seo.a.free': 'Yes — every game on Komyo is completely free to play: no ads, no payments, no accounts.',
  'seo.q.offline': 'Can I play offline?',
  'seo.a.offline': 'Yes — after your first visit the game works without internet, and you can install it as an app straight from your browser.',
  'seo.q.saves': 'Where are my scores saved?',
  'seo.a.saves': 'On your device only — best scores, trophies and cosmetics live in your browser and are never uploaded anywhere.',
  'seo.titleTail': 'free online game, no ads',
  'seo.allGames': 'All free games at Komyo',
  'seo.2048.howto': 'Swipe or use the arrow keys to slide every tile at once — when two matching numbers collide they merge into their sum. Plan ahead: the board gains a tile per move, and no legal move means game over. Reach 2048 to win, then keep going; Mini 3×3 is a quick puzzle, Big 5×5 a long strategic build.',
  'seo.asteroids.howto': 'Rotate your ship, thrust, and shoot the asteroids before they hit you — big rocks split into smaller, faster ones. Clear a wave and the next one grows. Play Classic with arrow keys or touch controls, try the Enhanced variant with power-ups, or race the 10-wave Speedrun for the fastest time.',
  'seo.asteroids-plus.howto': 'Fly with arrow keys or the touch joystick and blast asteroids, hunters and bosses. Every wave grants XP — level up and choose an upgrade, then spend salvage in the wave shop to build your run. Survive all 30 waves of the finale to win; how far you get is your score.',
  'seo.tower-defense.howto': 'Enemies march the path toward your keep — build archer, cannon, frost and mage towers beside it to stop them. Each kill pays gold; place and upgrade between waves, and switch targeting (first, strongest, weakest) to match the threat. Pick a map and difficulty, survive every wave to win.',
  'seo.forcefield.howto': 'The station charges up and fires at your planet — sweep the atmosphere dome over the marked impact point and tap to deflect the bolt. Timed mode scores deflections against the clock, Shields is survival, and Double puts a planet on each side for two players on one screen.',
  'seo.bubbles.howto': 'Aim the cannon, bounce shots off the walls, and match three or more bubbles of a color to pop them — drop whole clusters for big combos. Special shots clear tough spots. Arcade climbs level by level, Endless pushes the ceiling down forever, and Zen just lets you pop.',
  'seo.frog-bonk.howto': 'Tap or click the frogs as they pop up to bonk them before they bite the walls — chain hits for combos, catch flies for coin, and watch for telegraphed ranged attacks. Waves mode is 15 rounds with an upgrade shop, Endless keeps climbing, and Zen visitors just wander through, no castle at risk.',
  'seo.breakout.howto': 'Move the paddle with your mouse, finger or arrow keys and keep the ball in play — every brick scores, and the walls escalate level by level. Catch falling power-ups (multi-ball, wide paddle, lasers) and dodge the bad ones. Lose your last ball and the run ends.',
  'seo.sudoku.howto': 'Fill the 9×9 grid so every row, column and 3×3 box holds the digits 1–9 exactly once. Tap a cell and enter a digit, use pencil marks for candidates, and ask for a hint when stuck — it highlights the reasoning instead of revealing the answer. Daily serves everyone the same puzzle; Zen is untimed practice at any difficulty.',
  'seo.stacker.howto': 'A block slides back and forth above your tower — tap, click or press space to drop it. Whatever hangs over the edge is sliced off, so the tower narrows with every miss; land a perfect drop to keep your width and build a streak. One more block, every time.',
  'seo.trap-the-cat.howto': 'The cat wants out — every turn you plant one rose hedge on the hex garden, then the cat takes a step toward the edge. Cut off every escape route to trap it; the fewer hedges you use, the bigger the score. Kitten mode naps mid-chase for younger players; harder cats think further ahead.',
  'seo.flappy.howto': 'Tap, click or press space to flap and glide between the flower stems — each gap you pass scores a point, and the meadow slowly speeds up. Touch a stem or the ground and the flight ends. Short hops beat long holds; find a rhythm and ride it.',
  'seo.aim-trainer.howto': 'Targets pop up on the range — hit them fast and dead-center for the multiplier; sustained fire spreads your shots, so reset between flicks. Sprint drills race a fixed target count, timed drills score inside the clock. Mouse or touch; accuracy and best times are tracked per mode.',
  'seo.snake.howto': 'Steer the snake with arrow keys, WASD, swipes or the on-screen D-pad — eat the glowing fruit to grow longer and faster. Walls and your own tail end the run. Pick the speed that suits you and chase the length record.',
  'seo.minesweeper.howto': 'Reveal tiles and read the numbers — each one counts the mines touching it. Flag the mines you\'ve deduced (long-press on touch), and chord a satisfied number to clear its neighbors at once. Your first dig is always safe; sweep the whole field without a boom to win. Relaxed mode gives you three hearts.',
  // ---- 🚰 Floodgate ----
  'seo.tube-racer.howto': 'You are magnetically stuck to the inside of a huge pipe, so there is no left or right edge — you roll all the way around the wall to line up with the gap in each barrier. Hold boost to accelerate past Mach 1 and score faster, but boosting heats the engine, and a full heat gauge destroys the bike; steer onto the glowing blue cooling strips to shed that heat. Play endless Classic, race a 30 km Sprint against the clock, survive Redline with the boost jammed on, or take it easy in Cruise.',
  'seo.floodgate.howto': 'Tap or click a pipe to rotate it a quarter turn clockwise; right-click or long-press turns it the other way. Connect every bolted inlet to its matching outlet with an unbroken run of pipe and leave no open end — an open end is a leak, and a leaking line never seals. Later blueprints add a second hot line with crossover cells that carry two utilities through one square, plus an electrical cable that shorts out if it shares a square with water outside an insulated conduit. Campaign works through twelve fixed blueprints, Daily gives everyone the same board each day, and Endless keeps growing the grid until the clock beats you.',
  // ---- ⌨️ Type Siege ----
  'seo.type-siege.howto': 'Sketched soldiers march across the notebook page and lay siege to your keep, each carrying a word. Type its first letter and the game locks onto the nearest matching enemy — finish the word and it falls. They do not charge in and vanish: swordsmen halt at the wall and hammer it, archers hold back and shoot, and trebuchets lob rocks marked with tiny urgent words, so the longer you leave a word unfinished the more attackers pile up. Words come from your choice of eight languages, with accents optional; play eight authored stages, an endless siege, or Rain, where words fall from the top of the page.',
  // ---- 🔆 Mirror Maze ----
  'seo.mirror-maze.howto': 'A laser fires into the grid from one edge. Tap any mirror to flip it between / and \\ and bend the beam ninety degrees — light every target in the exact colour it asks for and the maze is solved. A prism splits white light: red bends left, green carries straight on, blue bends right. Filters only let one colour channel through, and a combiner adds the beams that reach it, so red plus green makes yellow. Beams crossing at right angles simply pass through each other. Play twelve campaign mazes, one shared daily maze, or an endless run of ever bigger grids.',
  // ---- 🦖 Dusk Runner ----
  'seo.dusk-runner.howto': 'Run right and never stop: tap or press Space to jump the cacti, hold Down to duck under the low steel gantries and the birds. Squeezing past an obstacle grants a slipstream surge that speeds you up, the pace climbs the further you get, and the sky rolls from bright day through dusk into a starry night. Endless runs until you clip something; Sprint is a 1000 m time trial where every clip costs you a stumble.',
  'seo.balloon-pop.howto': 'Tap the balloons as they float up — pop several of the same color in a row for streak sparkles, and look out for gusts of wind. There\'s no way to lose: Party mode celebrates for 60 seconds, Zen floats forever with fireworks every 50 pops, and Bees mode dares you not to tap the bee.',
  'seo.critter-match.howto': 'Flip two cards a turn and remember what you saw — match the animal pairs to clear the board in as few flips as you can. Boards grow from a quick 4×3 to a challenge grid, Speedrun races the clock, and Pass & Play deals the turns out to 2–4 players on one screen.',
  'seo.glow-says.howto': 'The lanterns glow in a sequence — repeat it by tapping them in the same order, and each round adds one more step. Chill mode never ends your run on a slip, Classic is the pure test, Hard adds two extra lanterns and Expert packs nine into a grid. Sound on helps: every lantern sings its own note.',

  // --- update states ---
  'update.upToDate': '✓ Up to date',
  'update.updateNow': '🔆 Update now',
  'update.updating': '⟳ Updating…',
  'update.checking': '⟳ Checking…',
  'update.offline': '⚠ Offline — can’t check',

  // --- controls modal ---
  'controls.title': 'Controls',
  'controls.keyboard': 'Keyboard',
  'controls.mouse': 'Mouse',
  'controls.touch': 'Touch',
  'controls.navTitle': 'How to play — controls',

  // --- embed modal ---
  'embed.pick': 'Pick a game',
  'embed.titleGame': 'Embed a game',
  'embed.titleThis': 'Embed this game',
  'embed.body': 'Paste this where you want the game on your site or blog — it runs right there, free, no account, no ads.',
  'embed.copyCode': 'Copy code',
  'embed.copied': 'Copied!',

  // --- challenges panel ---
  'challenges.title': 'Challenges',
  'challenges.todayTitle': 'Today’s challenges',
  'challenges.today': 'Today',
  'challenges.thisWeek': 'This week',
  'challenges.thisGame': 'THIS GAME',
  'challenges.done': '✓ Done',
  'challenges.noneKind': 'No {kind} challenge right now.',
  'challenges.notLoaded': 'Challenges aren’t loaded here.',
  'challenges.goodRunHere': 'A good run here = {n}+',
  'chal.goodRunWhat': 'What’s a good run?',
  'chal.goodRunExplain': 'Score a game’s mark in one run — it counts toward good-run challenges and the daily ⚡ bonus.',
  'chal.resetsIn': 'resets in {t}',
  'time.d': '{n}d',
  'time.h': '{n}h',
  'time.m': '{n}m',
  'challenges.trophies': '{count} trophies',
  'challenges.cosmeticsBtn': '🎨 Collection',
  'chal.lifetime': { one: '🏆 {count} Trophy', other: '🏆 {count} Trophies' },
  'challenges.note': 'Any mode counts — your best today is what matters. Full list &amp; history on the home page.',
  'challenges.playToday': 'Play {game} today',
  'challenges.playWeek': 'Play {game} this week',
  'challenges.aGame': 'a game',

  // --- good-run bonus widget + end-menu receipts ---
  'grb.head': 'Good-run daily bonus',
  'grb.sub': '+{per} 🏆 each',
  'grb.receipt': '✓ Good run · +{per} 🏆 ({count}/{cap} today)',
  'grb.maxed': '✓ Good run · daily 🏆 bonus maxed {cap}/{cap}',
  'grb.counts': '✓ Good run — counts toward today’s challenge',

  // --- cosmetics store (shopPanel) ---
  'shop.title': 'Collection',
  'shop.titleGame': '{game} collection',
  'shop.searchPh': '🔍 Search collection…',
  'shop.searchAria': 'Search collection',
  'shop.filterAria': 'Filter by game',
  'shop.allGamesOpt': 'All games',
  'shop.allGamesLink': 'All games →',
  'shop.siteWide': 'Site-wide',
  'shop.tabShop': 'Shop',
  'shop.tabAch': 'Achievements',
  'shop.tabTitles': 'Titles',
  'shop.balSpend': '🏆 {n} to spend',
  'shop.balAch': '🏅 {done}/{total} · {n} 🏆',
  'shop.balLifetime': '🏆 {n} lifetime',
  'shop.progress': '{owned} / {total} · {pct}%',
  'shop.equipped': '✓ EQUIPPED',
  'shop.equip': 'EQUIP {name}',
  'shop.buy': 'BUY {name} · 🏆 {price}',
  'shop.confirmBuy': 'Spend {price} 🏆 on {name}?',
  'shop.confirmBtn': 'BUY',
  'shop.on': '✓ On',
  'shop.owned': '✓ Owned',
  'shop.default': '✓ Default',
  'shop.free': 'Free',
  'shop.noMatch': 'No cosmetics match “{q}”.',
  'shop.cosmeticsTitle': 'Collection — skins for this game',
  'shop.styleGroup': 'STYLE',
  'shop.gift': '🎁 Welcome gift — a one-time {n} 🏆 head start',
  'shop.giftClaim': 'CLAIM {n} 🏆',
  'shop.giftClaimed': '🎁 +{n} 🏆 claimed — spend them well!',
  'shop.freePlay': '✨ Free play — everything unlocked',
  'shop.freePlaySub': 'Wear any cosmetic without spending trophies. Your balance and collection stay as they are — titles are still earned by playing.',
  'shop.freePlayAria': 'Toggle free play',

  // --- menu framework (start/pause/end built-in text) ---
  'menu.best': 'Best: {score}',
  'menu.newBest': '★ New best!',
  'menu.bestLabel': 'BEST',
  'menu.bestWord': 'Best',
  'menu.choose': 'Choose',
  'menu.pick': 'PICK · {label}',
  'menu.unlock': 'UNLOCK {label}',
  'menu.close': 'Close',

  // --- share row / buttons (aria + sentence builder) ---
  'share.share': 'Share',
  'share.onX': 'Share on X',
  'share.onReddit': 'Share on Reddit',
  'share.copy': 'Copy',
  'share.cardImage': 'Score card image',
  'share.copied': 'Copied!',
  'share.verb': 'I scored',
  'share.line': '{verb} {score}{unit} in {game}{emoji}',

  // --- canvas score / profile / share cards ---
  'card.score': 'SCORE',
  'card.time': 'TIME',
  'card.playOn': 'PLAY ON',
  'card.anonymous': 'anonymous',
  'card.collection': '🎨 COLLECTION',
  'card.shareBtn': '📤 Share…',
  'card.copyImage': '📋 Copy image',
  'card.download': '💾 Download',
  'card.copied': '✓ Copied!',
  // --- achievements (registry: achievements.js) — UI strings, then name/desc per id ---
  'ach.sub': 'One-off goals that never expire. Each pays its trophies once, into your <b>lifetime</b> total — so unlocking them climbs the titles ladder too.',
  'ach.none': 'No achievements loaded.',
  'ach.receipt': '{icon} {name} unlocked · +{n} 🏆',
  'ach.receiptMany': '🏅 {n} achievements unlocked · +{pay} 🏆',
  // site
  'ach.site.first-cosmetic.name': 'First Purchase',
  'ach.site.first-cosmetic.desc': 'Buy your first cosmetic.',
  'ach.site.collector25.name': 'Collector',
  'ach.site.collector25.desc': 'Own a quarter of every cosmetic you can buy.',
  'ach.site.collector50.name': 'Curator',
  'ach.site.collector50.desc': 'Own half of every cosmetic you can buy.',
  'ach.site.collector100.name': 'Completionist',
  'ach.site.collector100.desc': 'Own every cosmetic in the shop.',
  'ach.site.cursors.name': 'Full Set of Hands',
  'ach.site.cursors.desc': 'Own every site-wide cursor.',
  'ach.site.tourist5.name': 'Looking Around',
  'ach.site.tourist5.desc': 'Play 5 different games.',
  'ach.site.tourist15.name': 'Regular Visitor',
  'ach.site.tourist15.desc': 'Play 15 different games.',
  'ach.site.tourist-all.name': 'Every Cabinet',
  'ach.site.tourist-all.desc': 'Play every game in the arcade.',
  'ach.site.genres8.name': 'Wide Taste',
  'ach.site.genres8.desc': 'Play games from 8 different categories.',
  'ach.site.regular.name': 'Regular',
  'ach.site.regular.desc': 'Finish 50 runs across the arcade.',
  'ach.site.veteran.name': 'Veteran',
  'ach.site.veteran.desc': 'Finish 500 runs across the arcade.',
  'ach.site.goodrun1.name': 'Good Run',
  'ach.site.goodrun1.desc': 'Clear one game\'s good-run bar.',
  'ach.site.allrounder.name': 'All-Rounder',
  'ach.site.allrounder.desc': 'Have a good run in 5 different games.',
  'ach.site.titled.name': 'Titled',
  'ach.site.titled.desc': 'Wear an earned rank from the titles ladder.',
  'ach.site.rich.name': 'Trophy Hoard',
  'ach.site.rich.desc': 'Earn 2,500 trophies in total.',
  // asteroids
  'ach.asteroids.wave5.name': 'Field Sweep',
  'ach.asteroids.wave5.desc': 'Reach wave 5.',
  'ach.asteroids.wave10.name': 'Deep Field',
  'ach.asteroids.wave10.desc': 'Reach wave 10.',
  'ach.asteroids.wave15.name': 'Belt Runner',
  'ach.asteroids.wave15.desc': 'Reach wave 15.',
  // asteroids-plus
  'ach.asteroids-plus.wave10.name': 'Upgraded',
  'ach.asteroids-plus.wave10.desc': 'Reach wave 10.',
  'ach.asteroids-plus.wave20.name': 'Outer Rim',
  'ach.asteroids-plus.wave20.desc': 'Reach wave 20.',
  'ach.asteroids-plus.win.name': 'Run Complete',
  'ach.asteroids-plus.win.desc': 'Win a full run.',
  // tower-defense
  'ach.tower-defense.wave10.name': 'The Keep Holds',
  'ach.tower-defense.wave10.desc': 'Survive wave 10.',
  'ach.tower-defense.hard20.name': 'Hard Twenty',
  'ach.tower-defense.hard20.desc': 'Reach wave 20 on Hard.',
  'ach.tower-defense.nosell.name': 'No Regrets',
  'ach.tower-defense.nosell.desc': 'Reach wave 10 without selling a tower.',
  'ach.tower-defense.kills5000.name': 'Siege Breaker',
  'ach.tower-defense.kills5000.desc': 'Defeat 5,000 attackers in total.',
  // forcefield
  'ach.forcefield.min3.name': 'Three Minutes',
  'ach.forcefield.min3.desc': 'Survive three minutes in one run.',
  'ach.forcefield.blocks500.name': 'Deflector',
  'ach.forcefield.blocks500.desc': 'Deflect 500 shots in total.',
  // bubbles
  'ach.bubbles.pops5000.name': 'Pop Machine',
  'ach.bubbles.pops5000.desc': 'Pop 5,000 bubbles in total.',
  'ach.bubbles.clear.name': 'All Five Levels',
  'ach.bubbles.clear.desc': 'Clear all five levels in one run.',
  // frog-bonk
  'ach.frog-bonk.wave10.name': 'Ten Waves',
  'ach.frog-bonk.wave10.desc': 'Reach wave 10.',
  'ach.frog-bonk.bonks300.name': 'Getting the Hang of It',
  'ach.frog-bonk.bonks300.desc': 'Bonk 300 frogs in total.',
  'ach.frog-bonk.bonks1500.name': 'Mage Hunter',
  'ach.frog-bonk.bonks1500.desc': 'Bonk 1,500 frogs in total.',
  // breakout
  'ach.breakout.bricks5k.name': 'Demolition',
  'ach.breakout.bricks5k.desc': 'Break 5,000 bricks in total.',
  'ach.breakout.flawless.name': 'Flawless Level',
  'ach.breakout.flawless.desc': 'Clear a level without losing a ball.',
  // sudoku
  'ach.sudoku.clean.name': 'Clean Sheet',
  'ach.sudoku.clean.desc': 'Solve a puzzle with no mistakes and no hints.',
  'ach.sudoku.expert.name': 'Expert, Unaided',
  'ach.sudoku.expert.desc': 'Solve an Expert puzzle with no hints.',
  'ach.sudoku.solved20.name': 'Puzzle Habit',
  'ach.sudoku.solved20.desc': 'Solve 20 puzzles.',
  // stacker
  'ach.stacker.streak10.name': 'Ten in a Row',
  'ach.stacker.streak10.desc': 'Land 10 perfect drops in a row.',
  'ach.stacker.high75.name': 'Skyline',
  'ach.stacker.high75.desc': 'Reach a score of 75 in one run.',
  // trap-the-cat
  'ach.trap-the-cat.quick.name': 'Cornered Fast',
  'ach.trap-the-cat.quick.desc': 'Trap the cat in 15 clicks or fewer.',
  'ach.trap-the-cat.cats25.name': 'Cat Wrangler',
  'ach.trap-the-cat.cats25.desc': 'Trap 25 cats.',
  // flappy
  'ach.flappy.gates100.name': 'Century Flight',
  'ach.flappy.gates100.desc': 'Pass 100 gates in one run.',
  'ach.flappy.gates1000.name': 'Frequent Flyer',
  'ach.flappy.gates1000.desc': 'Pass 1,000 gates in total.',
  // aim-trainer
  'ach.aim-trainer.acc90.name': 'Steady Hand',
  'ach.aim-trainer.acc90.desc': 'Finish a run at 90% accuracy or better.',
  'ach.aim-trainer.hits2500.name': 'Marksman',
  'ach.aim-trainer.hits2500.desc': 'Hit 2,500 targets in total.',
  // snake
  'ach.snake.len50.name': 'Long Snake',
  'ach.snake.len50.desc': 'Grow to length 50.',
  'ach.snake.len100.name': 'Serpent',
  'ach.snake.len100.desc': 'Grow to length 100.',
  // 2048
  'ach.2048.t1024.name': 'Four Digits',
  'ach.2048.t1024.desc': 'Build a 1024 tile.',
  'ach.2048.t2048.name': '2048',
  'ach.2048.t2048.desc': 'Build a 2048 tile.',
  'ach.2048.t4096.name': 'Beyond',
  'ach.2048.t4096.desc': 'Build a 4096 tile.',
  // type-siege
  'ach.type-siege.wpm40.name': 'Touch Typist',
  'ach.type-siege.wpm40.desc': 'Type at 40 WPM in a run.',
  'ach.type-siege.wpm60.name': 'Fast Fingers',
  'ach.type-siege.wpm60.desc': 'Type at 60 WPM in a run.',
  'ach.type-siege.wpm80.name': 'Blur',
  'ach.type-siege.wpm80.desc': 'Type at 80 WPM in a run.',
  'ach.type-siege.acc100.name': 'Not One Typo',
  'ach.type-siege.acc100.desc': 'Clear wave 3 at 100% accuracy.',
  'ach.type-siege.chars10k.name': 'Ten Thousand Keys',
  'ach.type-siege.chars10k.desc': 'Type 10,000 letters in total.',
  // dusk-runner
  'ach.dusk-runner.m2000.name': 'Two Kilometres',
  'ach.dusk-runner.m2000.desc': 'Run 2,000 m in one run.',
  'ach.dusk-runner.marathon.name': 'Marathon',
  'ach.dusk-runner.marathon.desc': 'Run 42,195 m in total.',
  'ach.dusk-runner.clean500.name': 'Sure-Footed',
  'ach.dusk-runner.clean500.desc': 'Run 500 m without a stumble.',
  // floodgate
  'ach.floodgate.par.name': 'On Par',
  'ach.floodgate.par.desc': 'Seal a board in par moves or fewer.',
  'ach.floodgate.boards25.name': 'Plumber',
  'ach.floodgate.boards25.desc': 'Seal 25 boards in total.',
  'ach.floodgate.boards100.name': 'Waterworks',
  'ach.floodgate.boards100.desc': 'Seal 100 boards in total.',
  // mirror-maze
  'ach.mirror-maze.tier5.name': 'Fifth Tier',
  'ach.mirror-maze.tier5.desc': 'Reach tier 5.',
  'ach.mirror-maze.nohint.name': 'Unaided',
  'ach.mirror-maze.nohint.desc': 'Solve a maze without a hint.',
  'ach.mirror-maze.mazes50.name': 'Light Bender',
  'ach.mirror-maze.mazes50.desc': 'Solve 50 mazes in total.',
  'ach.mirror-maze.mazes250.name': 'Prism Master',
  'ach.mirror-maze.mazes250.desc': 'Solve 250 mazes in total.',
  // minesweeper
  'ach.minesweeper.expert.name': 'Expert Cleared',
  'ach.minesweeper.expert.desc': 'Clear an Expert board.',
  'ach.minesweeper.noflags.name': 'No Flags Needed',
  'ach.minesweeper.noflags.desc': 'Clear a board without planting a flag.',
  'ach.minesweeper.wins25.name': 'Twenty-Five Boards',
  'ach.minesweeper.wins25.desc': 'Clear 25 boards in total.',
  // balloon-pop
  'ach.balloon-pop.combo10.name': 'Ten Combo',
  'ach.balloon-pop.combo10.desc': 'Reach a 10× combo.',
  'ach.balloon-pop.nobees.name': 'Unstung',
  'ach.balloon-pop.nobees.desc': 'Score 20 without a single bee sting.',
  // critter-match
  'ach.critter-match.sharp.name': 'Sharp Memory',
  'ach.critter-match.sharp.desc': 'Clear a board with almost no wasted flips.',
  'ach.critter-match.boards25.name': 'Critter Friend',
  'ach.critter-match.boards25.desc': 'Clear 25 boards in total.',
  // glow-says
  'ach.glow-says.notes12.name': 'Twelve Notes',
  'ach.glow-says.notes12.desc': 'Repeat a 12-note tune.',
  'ach.glow-says.notes250.name': 'Perfect Pitch',
  'ach.glow-says.notes250.desc': 'Add up 250 remembered notes across your runs.',
  // tube-racer
  'ach.tube-racer.mach1.name': 'Mach One',
  'ach.tube-racer.mach1.desc': 'Break the sound barrier.',
  'ach.tube-racer.mach15.name': 'Mach 1.5',
  'ach.tube-racer.mach15.desc': 'Reach Mach 1.5.',
  'ach.tube-racer.mach2.name': 'Redline',
  'ach.tube-racer.mach2.desc': 'Reach Mach 2 — the tube\'s limit.',
  'ach.tube-racer.km1000.name': 'Thousand Klicks',
  'ach.tube-racer.km1000.desc': 'Ride 1,000 km in total.',
  'ach.tube-racer.clean.name': 'Not a Scratch',
  'ach.tube-racer.clean.desc': 'Clear a sprint without taking a hit.',
};
(function () {
  try {
    var AV = window.KOMYO_I18N_AVAILABLE;
    // resolve lang files next to THIS script (works from / and /games/<slug>/ alike)
    var base = '';
    try { var cs = document.currentScript && document.currentScript.src; if (cs) base = cs.slice(0, cs.lastIndexOf('/') + 1); } catch (e) {}
    var srcOf = function (code) { return base + 'i18n.' + code + '.js'; };
    window.KOMYO_I18N_SRC = srcOf; // game-kit's setLang injects a not-yet-loaded language on demand
    // active language — game-kit (loaded just before this) has already consumed ?lang= into
    // gamekit_lang, so storage → ?lang fallback → browser language mirrors its detection
    var pick = null;
    try { pick = localStorage.getItem('gamekit_lang'); } catch (e) {}
    if (!pick) { try { pick = new URLSearchParams(location.search).get('lang'); } catch (e) {} }
    if (!pick) { try { pick = (navigator.languages && navigator.languages[0]) || navigator.language || ''; } catch (e) {} }
    pick = String(pick || '').toLowerCase();
    pick = pick.indexOf('pt') === 0 ? 'pt' : pick.slice(0, 2);
    // document.write keeps the head atomic: the dictionary is complete before inline scripts run
    if (AV.indexOf(pick) >= 0 && typeof document !== 'undefined' && document.write) document.write('<script src="' + srcOf(pick) + '"><' + '/script>');
    var lazy = function () {
      AV.forEach(function (code) {
        if (window.KOMYO_I18N[code]) return;
        try { var s = document.createElement('script'); s.src = srcOf(code); s.async = true; document.head.appendChild(s); } catch (e) {}
      });
    };
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('load', function () { setTimeout(lazy, 2500); });
  } catch (e) {}
})();
