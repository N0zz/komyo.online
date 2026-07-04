/* komyo i18n message catalogue. English (en) is the reference.
   Plural entries are objects: { one, few, many, other } — see game-kit t(). */
window.KOMYO_I18N = {
  en: {
    // --- shared plural keys (defined once; reused by the catalogue + games in later sessions) ---
    'cat.trophies': { one: '{count} trophy', other: '{count} trophies' },
    'cat.goodRuns': { one: '{count} good run', other: '{count} good runs' },
    'cat.plays': { one: '{count} play', other: '{count} plays' },
    'cat.showMore': 'Show {n} more…',

    // --- nav / chrome bar ---
    'nav.menu': '‹ Menu',
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
    'kit.reset': '↺ Reset game data',
    'kit.resetTitle': 'Reset this game’s saved scores',
    'kit.gameMenu': 'Game menu',
    'kit.rotate': 'Rotate your phone to play',
    'kit.tapToPlay': 'TAP TO PLAY',

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
    'challenges.goodRunGeneric': 'A good run beats a game’s mark.',
    'challenges.trophies': '{count} trophies',
    'challenges.cosmeticsBtn': '🎨 COSMETICS · 🏆 {bal}',
    'challenges.note': 'Any mode counts — your best today is what matters. Full list &amp; history on the home page.',
    'challenges.playToday': 'Play {game} today',
    'challenges.playWeek': 'Play {game} this week',
    'challenges.aGame': 'a game',

    // --- good-run bonus line + end-menu receipts ---
    'grb.line': '⚡ Good-run bonus: {count}/{cap} today · +{per} 🏆 each',
    'grb.receipt': '✓ Good run · +{per} 🏆 ({count}/{cap} today)',
    'grb.maxed': '✓ Good run · daily 🏆 bonus maxed {cap}/{cap}',
    'grb.counts': '✓ Good run — counts toward today’s challenge',

    // --- cosmetics store (shopPanel) ---
    'shop.title': 'Cosmetics',
    'shop.titleGame': '{game} cosmetics',
    'shop.searchPh': '🔍 Search cosmetics…',
    'shop.searchAria': 'Search cosmetics',
    'shop.filterAria': 'Filter by game',
    'shop.allGamesOpt': 'All games',
    'shop.allGamesLink': 'All games →',
    'shop.siteWide': 'Site-wide',
    'shop.titlesLine': '🏆 Titles unlock automatically as you earn trophies.',
    'shop.seeTitles': 'See titles',
    'shop.progress': '{owned} / {total} unlocked · {pct}%',
    'shop.equipped': '✓ EQUIPPED',
    'shop.equip': 'EQUIP {name}',
    'shop.buy': 'BUY {name} · 🏆 {price}',
    'shop.on': '✓ On',
    'shop.owned': '✓ Owned',
    'shop.default': '✓ Default',
    'shop.free': 'Free',
    'shop.noMatch': 'No cosmetics match “{q}”.',
    'shop.cosmeticsTitle': 'Cosmetics — skins for this game',
    'shop.styleGroup': 'STYLE',

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
    'card.copied': '✓ Copied!'
  },
  pl: {},
  es: {},
  pt: {},
  fr: {},
  it: {}
};
