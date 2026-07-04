// Catalogue — installable PWA + offline via the shared sw-core (stale-while-revalidate, versioned cache).
self.SCOPE = 'root';
self.VERSION = 'dev'; // stamped with the commit SHA at deploy
self.SHELL = ['./','./index.html','./games.js','./changelog.js','./challenges.js','./cosmetics.js','./i18n.js','./analytics.js','./game-kit.js','./game-kit.css','./version.js','./favicon.svg','./manifest.json'];
importScripts('./sw-core.js');
