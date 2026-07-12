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
  // profile stat-chip + word plurals (catalogue profile panel)
  'profile.statGames': { one: 'Game', other: 'Games' },
  'profile.statModes': { one: 'Mode', other: 'Modes' },
  'profile.statPlays': { one: 'Play', other: 'Plays' },
  'profile.statDays': { one: 'Day', other: 'Days' },
  'profile.goodRunsWord': { one: 'good run', other: 'good runs' },
  'profile.playsWord': { one: 'play', other: 'plays' },

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
  'kit.fullscreen': 'Fullscreen',
  'kit.exitFullscreen': 'Exit fullscreen',
  'kit.fullscreenTitle': 'Toggle fullscreen',
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
  'challenges.cosmeticsBtn': '🎨 Collection',
  'chal.lifetime': { one: '🏆 {count} Trophy', other: '🏆 {count} Trophies' },
  'challenges.note': 'Any mode counts — your best today is what matters. Full list &amp; history on the home page.',
  'challenges.playToday': 'Play {game} today',
  'challenges.playWeek': 'Play {game} this week',
  'challenges.aGame': 'a game',

  // --- good-run bonus widget + end-menu receipts ---
  'grb.head': 'Good-run bonus',
  'grb.sub': '+{per} 🏆 each · {count}/{cap} today',
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
  'shop.titlesLine': '🏆 Titles unlock automatically as you earn trophies.',
  'shop.seeTitles': 'See titles',
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
  'shop.freePlayBadge': '✨ free play',
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
  'card.copied': '✓ Copied!'
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
