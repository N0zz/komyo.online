// Catalogue — installable PWA + offline via the shared sw-core (stale-while-revalidate, versioned cache).
self.SCOPE = 'root';
self.VERSION = 'dev'; // stamped with the commit SHA at deploy
self.SHELL = ['./','./index.html','./games.js','./changelog.js','./challenges.js','./cosmetics.js','./i18n.js','./i18n.pl.js','./i18n.es.js','./i18n.pt.js','./i18n.fr.js','./i18n.it.js','./i18n.cs.js','./i18n.uk.js','./analytics.js','./game-kit.js','./game-kit.css','./version.js','./favicon.svg','./manifest.json'];
importScripts('./sw-core.js');
