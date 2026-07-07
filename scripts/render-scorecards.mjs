#!/usr/bin/env node
// Render high-quality PNG score cards (one per live game + a grid) in each language, via Chrome
// headless using the real gamekit.scoreCard renderer (opts.png = lossless, opts.target = a canvas the
// page can screenshot reliably). One-shot marketing/print assets — the app itself keeps lightweight WebP.
//   node scripts/render-scorecards.mjs            → en + pl
//   node scripts/render-scorecards.mjs en         → just en
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME)) { console.error('Chrome not found at ' + CHROME); process.exit(1); }
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'pl'];

// subParts: joined with ' · '. {k,d} = translate (key, English default); {lit} = literal (numbers etc.)
const GAMES = [
  { slug: 'asteroids', title: 'Asteroids', icon: '🛸', accent: '#9fe8ff', good: 8000, sub: [{ k: 'game.asteroids.modeClassic', d: 'Classic' }] },
  { slug: 'asteroids-plus', title: 'Asteroids+', icon: '☄️', accent: '#b98cff', good: 30000, sub: [{ k: 'game.asteroids-plus.modeLevelup', d: 'Level-up' }] },
  { slug: 'tower-defense', title: 'Keep Defender', icon: '🏰', accent: '#e0b25a', good: 2000, sub: [{ k: 'game.tower-defense.map.grassland.name', d: 'Grassland' }, { k: 'game.tower-defense.diff.hard', d: 'Hard' }] },
  { slug: 'forcefield', title: 'Forcefield', icon: '🌐', accent: '#38bdf8', good: 500, sub: [{ k: 'game.forcefield.modeLives', d: 'Lives' }, { k: 'game.forcefield.diffHard', d: 'Hard' }] },
  { slug: 'bubbles', title: 'Bubble Pop', icon: '🫧', accent: '#2ee8c8', good: 5000, sub: [{ k: 'game.bubbles.mode.arcade', d: 'Arcade' }] },
  { slug: 'frog-bonk', title: 'Frog Bonk', icon: '🐸', accent: '#7ed957', good: 2000, sub: [{ k: 'game.frog-bonk.modeWaves', d: 'Waves' }, { k: 'game.frog-bonk.diffMedium', d: 'Medium' }] },
  { slug: 'breakout', title: 'Brick Breaker', icon: '🧱', accent: '#ff5cc8', good: 1500, sub: [{ k: 'game.breakout.modeClassic', d: 'Classic' }] },
  { slug: 'stacker', title: 'Stack', icon: '🗼', accent: '#ff9aa2', good: 50, sub: [{ k: 'game.stacker.mode.classic', d: 'Classic' }] },
  { slug: 'flappy', title: 'Meadow Flyer', icon: '🐤', accent: '#8fd3a6', good: 50, sub: [] },
  { slug: 'aim-trainer', title: 'Range', icon: '🎯', accent: '#ff7a3c', good: 600, sub: [{ k: 'game.aim-trainer.modeTimed', d: 'Timed' }, { lit: '30s' }] },
  { slug: 'snake', title: 'Neon Snake', icon: '🐍', accent: '#7fffb0', good: 300, sub: [{ k: 'game.snake.speedNormal', d: 'Normal' }, { k: 'game.snake.wallsShort', d: 'Walls' }] },
];
const NAMES = ['Fiddly Horse', 'Neon Otter', 'Pixel Fox', 'Turbo Snail', 'Groovy Yak', 'Wobbly Crane', 'Jolly Moth', 'Sly Heron', 'Dizzy Lark', 'Cosmic Vole', 'Peppy Newt'];
const scoreFor = (g) => { const b = g * (0.03 + Math.random() * 0.19); const s = g < 100 ? 1 : g < 1000 ? 5 : g < 10000 ? 25 : 100; return Math.round((g + b) / s) * s; };

function shoot(html, out, w, h) {
  const tmp = path.join(ROOT, '_render_' + Math.random().toString(36).slice(2) + '.html');
  fs.writeFileSync(tmp, html);
  try {
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars',
      '--default-background-color=00000000', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000',
      '--window-size=' + w + ',' + h, '--screenshot=' + out, 'file://' + tmp], { stdio: 'ignore' });
  } finally { fs.unlinkSync(tmp); }
}

for (const lang of LANGS) {
  const dir = path.join(ROOT, 'plans', 'scorecards', lang);
  fs.mkdirSync(dir, { recursive: true });
  GAMES.forEach((g, i) => {
    const score = scoreFor(g.good);
    const opts = { title: g.title, slug: g.slug, accent: g.accent, icon: g.icon, score, player: NAMES[i % NAMES.length], png: true,
      qrUrl: 'https://komyo.online/games/' + g.slug + '/?utm_source=sc&utm_medium=qr', mascot: 'mascot-head.svg' };
    const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:transparent}#cv{display:block;width:1200px;height:630px}</style>
<script src="i18n.js"></script><script src="i18n.pl.js"></script><script src="qr.js"></script><script src="game-kit.js"></script><body><canvas id="cv" width="1200" height="630"></canvas><script>
gamekit.setLang(${JSON.stringify(lang)});
var o = ${JSON.stringify(opts)};
o.sub = ${JSON.stringify(g.sub)}.map(function(p){return p.lit || gamekit.t(p.k,{def:p.d})}).join(' \\u00b7 ');
o.scoreText = (${score}).toLocaleString(${JSON.stringify(lang)});
o.target = document.getElementById('cv');
gamekit.scoreCard(o).then(function(){});
</script>`;
    shoot(html, path.join(dir, g.slug + '.png'), 1200, 630);
    console.log('rendered', lang + '/' + g.slug + '.png');
  });
  // grid for this language
  const cw = 460, ch = Math.round(cw * 630 / 1200), gap = 24, pad = 30, cols = 4, rows = Math.ceil(GAMES.length / cols);
  const gw = cols * cw + (cols - 1) * gap + pad * 2, gh = rows * ch + (rows - 1) * gap + pad * 2;
  const gridHtml = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0b0e14}.g{display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:${gap}px;padding:${pad}px}img{width:${cw}px;height:${ch}px;border-radius:6px;display:block}</style><body><div class="g">${GAMES.map(g => `<img src="plans/scorecards/${lang}/${g.slug}.png">`).join('')}</div>`;
  shoot(gridHtml, path.join(dir, '_all-grid.png'), gw, gh);
  console.log('rendered', lang + '/_all-grid.png (' + gw + '×' + gh + ')');
}
console.log('\nDone → plans/scorecards/{' + LANGS.join(',') + '}');
