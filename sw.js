// Whole-site service worker — ONE root-scope SW (via the shared sw-core, stale-while-revalidate,
// versioned cache) caches the catalogue + shared head files + EVERY live game, so shared files and
// locales are stored once and "Update now" is a single worker swap. Per-game manifests stay — a
// root SW controlling /games/<slug>/ still satisfies installability.
self.SCOPE = 'root';
self.VERSION = 'dev'; // stamped with the commit SHA at deploy
// Live slugs in games.js order — keep in lockstep with games.js (test-enforced).
var GAME_SLUGS = ['asteroids', 'asteroids-plus', 'tower-defense', 'forcefield', 'bubbles', 'frog-bonk', 'breakout', 'sudoku', 'stacker', 'flappy', 'aim-trainer', 'snake'];
var GAME_FILES = ['', 'index.html', 'manifest.json', 'favicon.svg', 'icon-192.png', 'icon-512.png'];
self.SHELL = ['./', './index.html', './games.js', './changelog.js', './challenges.js', './cosmetics.js', './i18n.js', './i18n.pl.js', './i18n.es.js', './i18n.pt.js', './i18n.fr.js', './i18n.it.js', './i18n.cs.js', './i18n.uk.js', './analytics.js', './game-kit.js', './game-kit.css', './qr.js', './version.js', './favicon.svg', './mascot-head.svg', './manifest.json'].concat(
  GAME_SLUGS.reduce(function (all, slug) {
    return all.concat(GAME_FILES.map(function (f) { return './games/' + slug + '/' + f; }));
  }, [])
);
importScripts('./sw-core.js');
