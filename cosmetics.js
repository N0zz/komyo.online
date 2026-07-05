// Cosmetics registry (window.COSMETICS) — the launch catalogue for the Cosmetics store.
// Data only: the kit (gamekit.cosmetics) owns storage, the economy (trophies = challenge
// points) and the store modal; games apply a selected item in their own render.
//   item: { id: '<game>.<set>.<key>', game ('' = site-wide), set, name, desc, price, painter }
// Rules the tests enforce: ids unique, every set has exactly one FREE default (price 0),
// prices stay in the bands (10/25 cheap · 50 mid · 100 premium) except flagged exceptions
// (Meadow Flyer's progressive bird tail, capped at the 🏆 500 hard ceiling).
// The painter draws a small swatch preview (any square canvas) — it must not touch the DOM.
(function () {
  'use strict';

  // ---- swatch painter helpers (w×h canvas, drawing only) ----
  function fill(c) { return function (g, w, h) { g.fillStyle = c; g.fillRect(0, 0, w, h); }; }
  function grad(stops, ang) { // ang: 0 = horizontal, 1 = diagonal, 2 = vertical
    return function (g, w, h) {
      var lg = g.createLinearGradient(0, 0, ang === 2 ? 0 : w, ang === 0 ? 0 : h);
      for (var i = 0; i < stops.length; i++) lg.addColorStop(i / (stops.length - 1), stops[i]);
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
    };
  }
  function orb(col, glow, bg) {
    return function (g, w, h) {
      g.fillStyle = bg || '#0a1018'; g.fillRect(0, 0, w, h);
      var r = Math.min(w, h) * 0.3;
      if (glow) { g.shadowColor = glow; g.shadowBlur = r * 0.9; }
      g.fillStyle = col; g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(w / 2 - r * 0.3, h / 2 - r * 0.3, r * 0.28, 0, 7); g.fill();
    };
  }
  function rainbowOrb(g, w, h) {
    g.fillStyle = '#0a1018'; g.fillRect(0, 0, w, h);
    var r = Math.min(w, h) * 0.32, cx = w / 2, cy = h / 2;
    var cols = ['#ff5b5b', '#ffd166', '#7fe0a0', '#7fd0ff', '#b98cff'];
    for (var i = 0; i < cols.length; i++) {
      g.fillStyle = cols[i];
      g.beginPath(); g.moveTo(cx, cy);
      g.arc(cx, cy, r, (i / cols.length) * 6.283 - 1.57, ((i + 1) / cols.length) * 6.283 - 1.57);
      g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.3, r * 0.25, 0, 7); g.fill();
  }
  function star(col, glow, bg) {
    return function (g, w, h) {
      g.fillStyle = bg || '#0a1018'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36, r2 = R * 0.45;
      if (glow) { g.shadowColor = glow; g.shadowBlur = R * 0.6; }
      g.fillStyle = col; g.beginPath();
      for (var i = 0; i < 10; i++) { var rr = i % 2 ? r2 : R, a = -1.57 + i * 0.6283; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.shadowBlur = 0;
    };
  }
  function gem(g, w, h) {
    g.fillStyle = '#0a1018'; g.fillRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.34;
    var lg = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    lg.addColorStop(0, '#b98cff'); lg.addColorStop(1, '#7fd0ff');
    g.shadowColor = '#9f8cff'; g.shadowBlur = r * 0.7; g.fillStyle = lg;
    g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - r * 0.5, cy - r * 0.5); g.lineTo(cx + r * 0.5, cy + r * 0.5); g.stroke();
  }
  function cherry(g, w, h) {
    g.fillStyle = '#0a1018'; g.fillRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.19;
    g.strokeStyle = '#7fe0a0'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - r * 0.7, cy); g.quadraticCurveTo(cx, cy - r * 2.2, cx + r * 0.9, cy - r * 0.4); g.stroke();
    g.shadowColor = '#ff5b5b'; g.shadowBlur = r;
    g.fillStyle = '#ff4b4b'; g.beginPath(); g.arc(cx - r * 0.7, cy + r * 0.5, r, 0, 7); g.fill();
    g.fillStyle = '#ff6b6b'; g.beginPath(); g.arc(cx + r * 0.9, cy + r * 0.2, r, 0, 7); g.fill();
    g.shadowBlur = 0;
  }
  function ball(body, halo, core) {
    return function (g, w, h) {
      g.fillStyle = '#0a1018'; g.fillRect(0, 0, w, h);
      var r = Math.min(w, h) * 0.26, cx = w / 2, cy = h / 2;
      g.globalAlpha = 0.35; g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, r * 1.8, 0, 7); g.fill();
      g.globalAlpha = 1; g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = core; g.beginPath(); g.arc(cx - r * 0.25, cy - r * 0.25, r * 0.45, 0, 7); g.fill();
    };
  }
  function eightBall(g, w, h) {
    g.fillStyle = '#0a1018'; g.fillRect(0, 0, w, h);
    var r = Math.min(w, h) * 0.3, cx = w / 2, cy = h / 2;
    g.fillStyle = '#15161c'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = '#3a4050'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r * 0.45, 0, 7); g.fill();
    g.fillStyle = '#15161c'; g.font = 'bold ' + Math.round(r * 0.62) + 'px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', cx, cy + r * 0.03);
  }
  function paddle(colsOrPainter, glow) {
    return function (g, w, h) {
      g.fillStyle = '#0a1018'; g.fillRect(0, 0, w, h);
      var pw = w * 0.72, ph = Math.max(5, h * 0.2), px = (w - pw) / 2, py = (h - ph) / 2;
      if (glow) { g.shadowColor = glow; g.shadowBlur = ph; }
      if (typeof colsOrPainter === 'string') g.fillStyle = colsOrPainter;
      else { var lg = g.createLinearGradient(px, py, px + pw, py + ph); for (var i = 0; i < colsOrPainter.length; i++) lg.addColorStop(i / (colsOrPainter.length - 1), colsOrPainter[i]); g.fillStyle = lg; }
      if (g.roundRect) { g.beginPath(); g.roundRect(px, py, pw, ph, ph / 2); g.fill(); } else g.fillRect(px, py, pw, ph);
      g.shadowBlur = 0;
    };
  }
  function castle(wall, roof, bg) {
    return function (g, w, h) {
      g.fillStyle = bg || '#12202e'; g.fillRect(0, 0, w, h);
      var bw = w * 0.56, bh = h * 0.42, bx = (w - bw) / 2, by = h * 0.42;
      g.fillStyle = wall; g.fillRect(bx, by, bw, bh);
      var mw = bw / 5;
      for (var i = 0; i < 3; i++) g.fillRect(bx + i * 2 * mw, by - mw, mw, mw); // battlements
      g.fillStyle = roof; g.fillRect(bx + bw * 0.38, by + bh * 0.4, bw * 0.24, bh * 0.6); // gate
    };
  }
  function target(rings, bg) {
    return function (g, w, h) {
      g.fillStyle = bg || '#101820'; g.fillRect(0, 0, w, h);
      var r = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2;
      for (var i = 0; i < rings.length; i++) { g.fillStyle = rings[i]; g.beginPath(); g.arc(cx, cy, r * (1 - i / rings.length), 0, 7); g.fill(); }
    };
  }
  function burst(cols, bg) {
    return function (g, w, h) {
      g.fillStyle = bg || '#0a1420'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
      for (var i = 0; i < 8; i++) {
        var a = i * 0.785;
        g.strokeStyle = cols[i % cols.length]; g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3);
        g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
      }
    };
  }
  function palette(cols) {
    return function (g, w, h) {
      var n = cols.length, bw = w / n;
      for (var i = 0; i < n; i++) { g.fillStyle = cols[i]; g.fillRect(i * bw, 0, bw + 1, h); }
    };
  }
  function ship(col, bg) {
    return function (g, w, h) {
      g.fillStyle = bg || '#05070d'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32;
      g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = r * 0.5;
      g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.75, cy + r * 0.8); g.lineTo(cx, cy + r * 0.35); g.lineTo(cx - r * 0.75, cy + r * 0.8); g.closePath(); g.stroke();
      g.shadowBlur = 0;
    };
  }
  function trail(cols, bg) {
    return function (g, w, h) {
      g.fillStyle = bg || '#05070d'; g.fillRect(0, 0, w, h);
      var n = 6;
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        g.globalAlpha = 0.25 + 0.75 * t;
        g.fillStyle = cols[Math.min(cols.length - 1, Math.floor(t * cols.length))];
        var r = 2 + t * Math.min(w, h) * 0.11;
        g.beginPath(); g.arc(w * (0.15 + 0.7 * t), h / 2 + Math.sin(t * 5) * h * 0.08, r, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    };
  }
  function bird(body, wing, glow) {
    return function (g, w, h) {
      g.fillStyle = '#0e1622'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.26;
      if (glow) { g.shadowColor = glow; g.shadowBlur = r; }
      g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = wing; g.beginPath(); g.ellipse(cx - r * 0.35, cy + r * 0.1, r * 0.62, r * 0.4, -0.5, 0, 7); g.fill();
      g.fillStyle = '#ffb03a'; g.beginPath(); g.moveTo(cx + r, cy - r * 0.15); g.lineTo(cx + r * 1.55, cy); g.lineTo(cx + r, cy + r * 0.2); g.closePath(); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(cx + r * 0.4, cy - r * 0.3, r * 0.14, 0, 7); g.fill();
    };
  }
  // rot matches the in-use cursor's NW tilt (game-kit CURSOR_TWEAK) so the swatch previews the real thing
  function cursorSwatch(draw, rot) {
    return function (g, w, h) { g.fillStyle = '#131a27'; g.fillRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); if (rot) g.rotate(rot); g.scale(Math.min(w, h) / 34, Math.min(w, h) / 34); draw(g); g.restore(); };
  }
  // cursor glyph painters draw in a 34×34 box centered on 0,0 — shared by the swatch AND the
  // kit's live cursor renderer (gamekit reads COSMETICS.cursors[key] to build the cursor image)
  var CURSORS = {
    classic: function (g) { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-6, -10); g.lineTo(-6, 8); g.lineTo(-1.5, 4); g.lineTo(1.5, 10); g.lineTo(4.5, 8.6); g.lineTo(1.6, 2.8); g.lineTo(7, 2); g.closePath(); g.fill(); g.stroke(); },
    crosshair: function (g) { g.strokeStyle = '#7fe0a0'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -13); g.lineTo(0, -4); g.moveTo(0, 4); g.lineTo(0, 13); g.moveTo(-13, 0); g.lineTo(-4, 0); g.moveTo(4, 0); g.lineTo(13, 0); g.stroke(); g.fillStyle = '#7fe0a0'; g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fill(); },
    paw: function (g) { g.fillStyle = '#f0a6c8'; g.beginPath(); g.ellipse(0, 4, 6.4, 5.4, 0, 0, 7); g.fill(); [[-7, -3], [-2.6, -7], [2.6, -7], [7, -3]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 2.6, 0, 7); g.fill(); }); },
    sword: function (g) { g.save(); g.rotate(-0.785); g.fillStyle = '#cfe0f0'; g.fillRect(-1.7, -12, 3.4, 15); g.fillStyle = '#8a97ad'; g.beginPath(); g.moveTo(-1.7, -12); g.lineTo(0, -15); g.lineTo(1.7, -12); g.closePath(); g.fill(); g.fillStyle = '#c8894a'; g.fillRect(-5.5, 3, 11, 3); g.fillRect(-1.7, 6, 3.4, 6); g.restore(); },
    comet: function (g) { var lg = g.createLinearGradient(-12, 12, 8, -8); lg.addColorStop(0, 'rgba(159,232,255,0)'); lg.addColorStop(1, '#9fe8ff'); g.strokeStyle = lg; g.lineWidth = 4; g.beginPath(); g.moveTo(-12, 12); g.lineTo(6, -6); g.stroke(); g.fillStyle = '#e8fbff'; g.shadowColor = '#9fe8ff'; g.shadowBlur = 8; g.beginPath(); g.arc(7, -7, 4, 0, 7); g.fill(); g.shadowBlur = 0; },
    rainbow: function (g) { var cols = ['#ff5b5b', '#ffd166', '#7fe0a0', '#7fd0ff', '#b98cff']; for (var i = 0; i < cols.length; i++) { g.strokeStyle = cols[i]; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-12 + i * 1.4, 12 - i * 1.4); g.lineTo(5 + i * 0.4, -5 - i * 0.4); g.stroke(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(7, -7, 3.4, 0, 7); g.fill(); },
    // terminal: a phosphor block (the live cursor is a blinking follower — see gamekit startTermCursor)
    terminal: function (g) { g.fillStyle = '#33ff88'; g.shadowColor = '#33ff88'; g.shadowBlur = 5; g.fillRect(-4, -9, 8, 17); g.shadowBlur = 0; },
  };

  // forcefield marker swatch — a glowing needle + triangle head over a faint track
  function forcefieldMarker(color) {
    return function (g, w, h) {
      g.fillStyle = '#0e1420'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2;
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(w * 0.15, cy - 3, w * 0.7, 6);
      g.save(); g.shadowBlur = 8; g.shadowColor = color; g.fillStyle = color;
      g.fillRect(cx - 2, cy - h * 0.28, 4, h * 0.56);
      g.beginPath(); g.moveTo(cx, cy - h * 0.30); g.lineTo(cx - 7, cy - h * 0.30 - 9); g.lineTo(cx + 7, cy - h * 0.30 - 9); g.closePath(); g.fill();
      g.restore();
    };
  }

  // forcefield planet swatch — a small gradient world
  function planetSwatch(c0, c1) {
    return function (g, w, h) {
      g.fillStyle = '#0a1020'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.34;
      var grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
      grd.addColorStop(0, c0); grd.addColorStop(1, c1);
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    };
  }

  var items = [];
  function add(game, set, key, name, price, desc, painter) {
    items.push({ id: (game || 'site') + '.' + set + '.' + key, game: game, set: (game || 'site') + '.' + set, name: name, desc: desc, price: price, painter: painter });
  }

  // ---- Site-wide — cursor skins (desktop only; the kit applies the selected one) ----
  add('', 'cursor', 'classic',   'Classic',       0,   'The trusty arrow, as nature intended.', cursorSwatch(CURSORS.classic));
  add('', 'cursor', 'crosshair', 'Crosshair',     25,  'Pinpoint green crosshair — everything is a target.', cursorSwatch(CURSORS.crosshair));
  add('', 'cursor', 'paw',       'Paw',           25,  'A soft pink paw pads across your screen.', cursorSwatch(CURSORS.paw, -0.7854));
  add('', 'cursor', 'sword',     'Pixel Sword',   50,  'Point with a tiny hero’s blade.', cursorSwatch(CURSORS.sword));
  add('', 'cursor', 'comet',     'Neon Comet',    50,  'A glowing comet head with a neon tail.', cursorSwatch(CURSORS.comet, -1.5708));
  add('', 'cursor', 'rainbow',   'Rainbow Trail', 100, 'Leaves a shimmering rainbow wake as you move.', cursorSwatch(CURSORS.rainbow, -1.5708));
  add('', 'cursor', 'terminal',  'Terminal',      75,  'A blinking block cursor, like an old terminal prompt. Glows in your CRT colour when CRT mode is on.', cursorSwatch(CURSORS.terminal));

  // ---- Site-wide — CRT display mode (ONE unlock; on/off + colour are free preferences after that) ----
  add('', 'fx', 'off', 'Standard', 0, 'No screen filter — the plain look.', function (g, w, h) {
    g.fillStyle = '#0e1420'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.5; g.strokeRect(w * 0.22, h * 0.3, w * 0.56, h * 0.4);
  });
  add('', 'fx', 'crt', 'CRT Mode', 500, 'Retro phosphor glow over the whole site — tap ▾ to pick a colour.', function (g, w, h) {
    g.fillStyle = '#00160a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#39ff9b'; for (var y = 2; y < h; y += 3) { g.globalAlpha = 0.85; g.fillRect(3, y, w - 6, 1); }
    g.globalAlpha = 1;
  });

  // ---- 🐍 Neon Snake — food skins ----
  add('snake', 'food', 'apple',   'Apple',        0,   'The classic neon pip.', orb('#f0f', '#f0f'));
  add('snake', 'food', 'cherry',  'Cherry',       10,  'A juicy pair on one stem.', cherry);
  add('snake', 'food', 'golden',  'Golden Apple', 25,  'Neon Snake’s food gleams gold.', orb('#ffd166', '#ffb03a'));
  add('snake', 'food', 'gem',     'Gem',          25,  'A cut jewel worth chasing.', gem);
  add('snake', 'food', 'star',    'Star Fruit',   50,  'A five-pointed snack from space.', star('#ffe066', '#ffd166'));
  add('snake', 'food', 'rainbow', 'Rainbow Orb',  100, 'Cycles through every neon colour.', rainbowOrb);

  // ---- 🧱 Brick Breaker — paddle + ball skins ----
  add('breakout', 'paddle', 'synthwave', 'Synthwave',    0,   'The original cyan glow.', paddle(['#00ffff', '#0088aa'], '#00ffff'));
  add('breakout', 'paddle', 'wood',      'Wood Classic', 10,  'Warm varnished wood, arcade-cabinet style.', paddle(['#d09a5c', '#8a5a30']));
  add('breakout', 'paddle', 'ice',       'Neon Ice',     25,  'Frosted glass with a cold blue shine.', paddle(['#e8fbff', '#9fd8f0'], '#bfeaff'));
  add('breakout', 'paddle', 'lava',      'Lava Core',    50,  'Molten rock, glowing from within.', paddle(['#ffd166', '#ff5a2a'], '#ff7a3c'));
  add('breakout', 'paddle', 'chrome',    'Chrome',       100, 'Mirror-polished and untouchable.', paddle(['#f4f8ff', '#8a97ad', '#e8eef8'], '#cfd8e8'));
  add('breakout', 'ball', 'neon',   'Neon',   0,   'The classic cyan streak.', ball('#00ffff', '#00e6ff', '#eaffff'));
  add('breakout', 'ball', 'eight',  '8-Ball', 25,  'Rack ’em up. Break ’em down.', eightBall);
  add('breakout', 'ball', 'comet',  'Comet',  50,  'A fireball with a blazing tail.', ball('#ffb03a', '#ff7a3c', '#fff2d0'));
  add('breakout', 'ball', 'disco',  'Disco',  50,  'Shifts colour with every bounce.', ball('#ff7ab6', '#b98cff', '#fff'));
  add('breakout', 'ball', 'plasma', 'Plasma', 100, 'Crackling violet energy.', ball('#b98cff', '#7a4dff', '#f0e8ff'));

  // ---- 🏰 Keep Defender — castle skins ----
  add('tower-defense', 'castle', 'stone',    'Stone Keep',        0,   'The keep as the masons built it.', castle('#9aa2ae', '#4a4f58'));
  add('tower-defense', 'castle', 'oak',      'Oak Fort',          25,  'Timber walls, frontier spirit.', castle('#a87848', '#6a4a28'));
  add('tower-defense', 'castle', 'sand',     'Sandcastle',        50,  'Bucket-built, surprisingly sturdy.', castle('#e8cc8a', '#c8a45c', '#2a4a66'));
  add('tower-defense', 'castle', 'ice',      'Ice Keep',          50,  'Carved from a glacier, cold to the core.', castle('#cfeaff', '#8ac0e8', '#0e2233'));
  add('tower-defense', 'castle', 'obsidian', 'Obsidian Citadel',  100, 'Black glass walls that drink the light.', castle('#22242e', '#0e0f16', '#1a1230'));

  // ---- 🫧 Bubble Pop — pop effects + shooter bases ----
  add('bubbles', 'pop', 'classic',   'Classic',   0,   'A clean, satisfying pop.', burst(['#9fe8ff', '#fff']));
  add('bubbles', 'pop', 'confetti',  'Confetti',  25,  'Every pop throws a tiny party.', burst(['#ff7ab6', '#ffd166', '#7fe0a0', '#7fd0ff']));
  add('bubbles', 'pop', 'stars',     'Stars',     50,  'Bubbles burst into twinkling stars.', star('#ffe066', '#ffd166', '#0a1420'));
  add('bubbles', 'pop', 'fireworks', 'Fireworks', 100, 'Full skyrocket finale on every match.', burst(['#ff5b5b', '#ffd166', '#fff', '#7fd0ff']));
  add('bubbles', 'base', 'aqua',  'Aqua',       0,  'The standard-issue aqua launcher.', grad(['#2ee8c8', '#1a8a9a'], 1));
  add('bubbles', 'base', 'candy', 'Candy',      25, 'Sugar-striped and sweet.', grad(['#ff9ad1', '#fff', '#ff9ad1'], 0));
  add('bubbles', 'base', 'gold',  'Royal Gold', 50, 'A launcher fit for bubble royalty.', grad(['#ffe08a', '#c89a2a'], 1));

  // ---- 🎯 Range — target skins + hit markers ----
  add('aim-trainer', 'target', 'rings',    'Rings',      0,   'Regulation rings, no excuses.', target(['#e8eef4', '#ff4b4b', '#e8eef4', '#ff4b4b']));
  add('aim-trainer', 'target', 'donut',    'Neon Donut', 25,  'A glazed ring of pure neon.', target(['#ff7ab6', '#2a1420', '#ff7ab6']));
  add('aim-trainer', 'target', 'fruit',    'Fruit',      50,  'Watermelon slices. Juicy hits.', target(['#7fe05a', '#fff', '#ff5b6b']));
  add('aim-trainer', 'target', 'alien',    'Alien Blob', 50,  'It wobbles. It stares. Shoot it.', target(['#7fe07a', '#3aa858', '#0e2a14']));
  add('aim-trainer', 'target', 'goldstar', 'Gold Star',  100, 'Every hit feels like a gold medal.', star('#ffd166', '#ffb03a', '#141c28'));
  add('aim-trainer', 'marker', 'classic', 'Classic', 0,  'A crisp white hitmarker.', burst(['#fff'], '#101820'));
  add('aim-trainer', 'marker', 'spark',   'Spark',   25, 'Hits throw electric sparks.', burst(['#ffe066', '#fff'], '#101820'));
  add('aim-trainer', 'marker', 'boom',    'Boom',    50, 'Tiny comic-book explosions.', burst(['#ff7a3c', '#ffd166', '#ff4b4b'], '#101820'));

  // ---- 🧊 Stack — block palettes ----
  add('stacker', 'palette', 'pastel',    'Pastel',      0,   'Soft sunset pastels.', palette(['#ff9aa2', '#ffd3b6', '#c7ceea', '#b5ead7']));
  add('stacker', 'palette', 'synthwave', 'Synthwave',   25,  'Neon pinks over midnight blue.', palette(['#ff5cc8', '#b94dff', '#4d5bff', '#00e6ff']));
  add('stacker', 'palette', 'forest',    'Forest',      25,  'Mossy greens and warm bark.', palette(['#7fb069', '#5a8a4a', '#a87848', '#3a5a30']));
  add('stacker', 'palette', 'candy',     'Candy',       50,  'Bubblegum, mint and lemon drops.', palette(['#ff9ad1', '#7fe0d0', '#ffe08a', '#b0a0ff']));
  add('stacker', 'palette', 'gilded',    'Gilded Mono', 100, 'Black marble with gold veins.', palette(['#16181e', '#ffd166', '#22242e', '#e8b93a']));

  // ---- 🛸 Asteroids — ship colours (+ one whole-game retro tint) ----
  add('asteroids', 'ship', 'cyan',    'Cyan',      0,   'The classic wireframe.', ship('#9fe8ff'));
  add('asteroids', 'ship', 'emerald', 'Emerald',   10,  'Green-lit and ready.', ship('#5fe07a'));
  add('asteroids', 'ship', 'crimson', 'Crimson',   25,  'Red shift, full thrust.', ship('#ff5b5b'));
  add('asteroids', 'ship', 'violet',  'Violet',    25,  'Deep-space purple.', ship('#b98cff'));
  add('asteroids', 'ship', 'crt',     'CRT Green', 50,  'The whole game in green phosphor, like 1979.', ship('#3aff5a', '#041008'));
  add('asteroids', 'ship', 'gold',    'Gold',      100, 'A gilded hull for a legend.', ship('#ffd166'));

  // ---- ☄️ Asteroids+ — hull colours + engine trails ----
  add('asteroids-plus', 'hull', 'violet', 'Violet',    0,   'The roguelite’s signature hull.', ship('#b98cff'));
  add('asteroids-plus', 'hull', 'teal',   'Teal',      25,  'Cool-headed under fire.', ship('#2ee8c8'));
  add('asteroids-plus', 'hull', 'blood',  'Blood Red', 50,  'For pilots who never brake.', ship('#e0304a'));
  add('asteroids-plus', 'hull', 'crt',    'CRT Green', 50,  'The whole run in green phosphor, like 1979.', ship('#3aff5a', '#041008'));
  add('asteroids-plus', 'hull', 'gold',   'Gold',      100, 'Won, not bought. Well… bought.', ship('#ffd166'));
  add('asteroids-plus', 'trail', 'ion',     'Ion',     0,   'A steady blue ion stream.', trail(['#4d9aff', '#9fe8ff']));
  add('asteroids-plus', 'trail', 'ember',   'Ember',   50,  'Sparks and embers in your wake.', trail(['#ff5a2a', '#ffd166']));
  add('asteroids-plus', 'trail', 'rainbow', 'Rainbow', 100, 'Full spectrum afterburn.', trail(['#ff5b5b', '#ffd166', '#7fe0a0', '#7fd0ff', '#b98cff']));

  // ---- 🐤 Meadow Flyer — birds (migrated from banked cash; progressive tail is the one
  //      approved band exception, Phoenix = the 🏆 500 aspirational ceiling) ----
  add('flappy', 'bird', 'bee',      'Bee',      0,   'Not technically a bird. Flies anyway.', bird('#f9e040', '#f0c828'));
  add('flappy', 'bird', 'robin',    'Robin',    10,  'A cheerful meadow regular.', bird('#a86a48', '#7a4e34'));
  add('flappy', 'bird', 'bluebird', 'Bluebird', 25,  'Swift, sleek and sky-coloured.', bird('#5fa8e8', '#3f86c8'));
  add('flappy', 'bird', 'parrot',   'Parrot',   50,  'Loud in colour and in spirit.', bird('#5fd07a', '#3aa858'));
  add('flappy', 'bird', 'owl',      'Owl',      75,  'Silent night hunter with slow, heavy flaps.', bird('#b08a5a', '#8a6a40'));
  add('flappy', 'bird', 'bielik',   'Bielik',   100, 'The white-tailed eagle, king of Polish skies.', bird('#a8875c', '#7a6038'));
  add('flappy', 'bird', 'rarog',    'Raróg', 150, 'A fiery falcon spirit from Slavic legend.', bird('#c8232e', '#8a1a22', 'rgba(255,120,40,0.7)'));
  add('flappy', 'bird', 'raven',    'Raven',    250, 'Midnight feathers, ancient secrets.', bird('#17181d', '#0c0d11', 'rgba(170,200,255,0.55)'));
  add('flappy', 'bird', 'phoenix',  'Phoenix',  500, 'The aspirational one. Rises from every game over.', bird('#ff8a3a', '#e85a1a', 'rgba(255,140,40,0.85)'));

  // ---- 🌐 Forcefield — bolt colours + planet skins ----
  add('forcefield', 'marker', 'default', 'Classic', 0,  'A clean white bolt.', forcefieldMarker('#eafcff'));
  add('forcefield', 'marker', 'magma',   'Magma',   25, 'A molten-orange bolt.', forcefieldMarker('#ff8a3d'));
  add('forcefield', 'marker', 'lime',    'Lime',    50, 'A zesty green bolt.', forcefieldMarker('#b6ff5c'));
  add('forcefield', 'planet', 'azure',   'Azure',   0,  'A deep blue ocean world.', planetSwatch('#2f57a0', '#0a1530'));
  add('forcefield', 'planet', 'verdant', 'Verdant', 25, 'A lush green world.', planetSwatch('#2f8a5a', '#08210f'));
  add('forcefield', 'planet', 'amber',   'Amber',   50, 'A golden desert world.', planetSwatch('#c39433', '#241706'));
  add('forcefield', 'planet', 'violet',  'Violet',  75, 'A violet gas giant.', planetSwatch('#7a46b8', '#180a2e'));

  window.COSMETICS = {
    version: 1,
    items: items,
    cursors: CURSORS,
    // set labels for the store modal + in-game groups
    sets: {
      'site.cursor':          { label: 'Cursor skins', note: 'desktop only' },
      'site.fx':              { label: 'Display mode', note: 'site-wide' },
      'snake.food':           { label: 'Food skins' },
      'breakout.paddle':      { label: 'Paddle skins' },
      'breakout.ball':        { label: 'Ball skins' },
      'tower-defense.castle': { label: 'Castle skins' },
      'bubbles.pop':          { label: 'Pop effects' },
      'bubbles.base':         { label: 'Shooter bases' },
      'aim-trainer.target':   { label: 'Target skins' },
      'aim-trainer.marker':   { label: 'Hit markers' },
      'stacker.palette':      { label: 'Block palettes' },
      'asteroids.ship':       { label: 'Ship colours' },
      'asteroids-plus.hull':  { label: 'Hull colours' },
      'asteroids-plus.trail': { label: 'Engine trails' },
      'flappy.bird':          { label: 'Birds' },
      'forcefield.marker':         { label: 'Bolt colours' },
      'forcefield.planet':         { label: 'Planet skins' },
    },
    // game meta for the store modal (games don't load games.js; '' = site-wide sets)
    games: {
      '':               { title: 'Site-wide', icon: '🖱️', accent: '#9fe8ff' },
      'snake':          { title: 'Neon Snake', icon: '🐍', accent: '#7fffb0' },
      'breakout':       { title: 'Brick Breaker', icon: '🧱', accent: '#ff5cc8' },
      'tower-defense':  { title: 'Keep Defender', icon: '🏰', accent: '#e0b25a' },
      'bubbles':        { title: 'Bubble Pop', icon: '🫧', accent: '#2ee8c8' },
      'aim-trainer':    { title: 'Range', icon: '🎯', accent: '#ff7a3c' },
      'stacker':        { title: 'Stack', icon: '🗼', accent: '#ff9aa2' },
      'asteroids':      { title: 'Asteroids', icon: '🛸', accent: '#9fe8ff' },
      'asteroids-plus': { title: 'Asteroids+', icon: '☄️', accent: '#b98cff' },
      'flappy':         { title: 'Meadow Flyer', icon: '🐤', accent: '#8fd3a6' },
      'forcefield':          { title: 'Forcefield', icon: '🌐', accent: '#38bdf8' },
    },
  };
})();
