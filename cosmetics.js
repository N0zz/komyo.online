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
  // Range's regulation target, exactly as drawTarget renders it (dark disc + orange outline rings)
  function ringsTarget(g, w, h) {
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32;
    g.fillStyle = '#1a2030'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = '#ff7a3c'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,122,60,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r * 0.65, 0, 7); g.stroke();
    g.strokeStyle = '#ff7a3c'; g.beginPath(); g.arc(cx, cy, r * 0.35, 0, 7); g.stroke();
    g.fillStyle = '#ff7a3c'; g.beginPath(); g.arc(cx, cy, r * 0.12, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,122,60,0.53)'; g.lineWidth = 1;
    var tk = r * 1.15;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      g.beginPath(); g.moveTo(cx + d[0] * tk * 0.7, cy + d[1] * tk * 0.7); g.lineTo(cx + d[0] * tk, cy + d[1] * tk); g.stroke();
    });
  }
  // Range's classic hit marker — the crisp orange X drawHitMarker draws
  function markerX(g, w, h) {
    g.fillStyle = '#101820'; g.fillRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.2;
    g.strokeStyle = '#ff7a3c'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy + s); g.stroke();
    g.beginPath(); g.moveTo(cx + s, cy - s); g.lineTo(cx - s, cy + s); g.stroke();
  }
  function popDots(col, bg) { // Bubble Pop's classic pop — round particles, not rays
    return function (g, w, h) {
      g.fillStyle = bg || '#0a1420'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3;
      for (var i = 0; i < 8; i++) {
        var a = i * 0.785 + 0.39, d = R * (0.55 + (i % 3) * 0.22);
        g.fillStyle = col;
        g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + (i % 3) * 1.2, 0, 7); g.fill();
      }
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
  // Meadow Flyer's bee, ported from the game's drawBirdModel (model space R=14, mid-flap)
  function beeBird(g, w, h) {
    g.fillStyle = '#0e1622'; g.fillRect(0, 0, w, h);
    var s = Math.min(w, h) / 46;
    g.save(); g.translate(w / 2, h / 2 + s * 6); g.scale(s, s);
    var R = 14, flap = 2;
    g.fillStyle = '#f9e040'; g.beginPath(); g.ellipse(0, 0, R, R * 0.8, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(0, 0, R, R * 0.8, 0, 0, 7); g.clip(); // brown stripes
    g.fillStyle = '#6a4a18'; g.fillRect(-10, -R, 5, R * 2); g.fillRect(-1, -R, 5, R * 2);
    g.restore();
    g.fillStyle = '#6a4a18'; // stinger
    g.beginPath(); g.moveTo(-R + 1, -2); g.lineTo(-R - 5, 0); g.lineTo(-R + 1, 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; // gauzy wings above the back
    g.beginPath(); g.ellipse(-2, -flap - 9, 9, 5, -0.5, 0, 7); g.fill();
    g.beginPath(); g.ellipse(3, -flap - 8, 7, 4, -0.3, 0, 7); g.fill();
    g.strokeStyle = '#8a6020'; g.lineWidth = 1.5; // antennae + pom-poms
    g.beginPath(); g.moveTo(-2, -R * 0.7); g.quadraticCurveTo(-8, -R * 1.3, -12, -R * 1.5); g.stroke();
    g.beginPath(); g.moveTo(4, -R * 0.7); g.quadraticCurveTo(8, -R * 1.3, 11, -R * 1.5); g.stroke();
    g.fillStyle = '#f9c080';
    g.beginPath(); g.arc(-12, -R * 1.5, 2.5, 0, 7); g.fill();
    g.beginPath(); g.arc(11, -R * 1.5, 2.5, 0, 7); g.fill();
    g.fillStyle = '#3a2a17'; g.beginPath(); g.arc(R * 0.55, -2, 3, 0, 7); g.fill(); // eye
    g.fillStyle = '#fff'; g.beginPath(); g.arc(R * 0.55 + 1.05, -3.2, 1.2, 0, 7); g.fill();
    g.restore();
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

  // frog-bonk hammer swatch — handle + a head that previews the skin's shape
  function hammerSwatch(c0, c1, shape) {
    return function (g, w, h) {
      g.fillStyle = '#12240f'; g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, hw = w * 0.52, hh = h * 0.3;
      g.save(); g.translate(cx, cy); g.rotate(-0.5);
      g.strokeStyle = '#8a5c30'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, h * 0.34); g.lineTo(0, -h * 0.05); g.stroke();
      var lg = g.createLinearGradient(-hw / 2, -h * 0.05 - hh, hw / 2, -h * 0.05);
      lg.addColorStop(0, c0); lg.addColorStop(1, c1);
      g.fillStyle = lg;
      if (shape === 'fluff') {
        for (var i = 0; i < 6; i++) { var a = i * 1.05; g.beginPath(); g.arc(Math.cos(a) * hw * 0.26, -h * 0.05 - hh / 2 + Math.sin(a) * hh * 0.3, hh * 0.36, 0, 7); g.fill(); }
        g.beginPath(); g.ellipse(0, -h * 0.05 - hh / 2, hw / 2, hh / 2 + 1, 0, 0, 7); g.fill();
      } else if (shape === 'balloon') {
        g.globalAlpha = 0.9;
        g.beginPath(); g.ellipse(0, -h * 0.05 - hh / 2, hw / 2 + 2, hh / 2 + 3, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-hw * 0.16, -h * 0.1 - hh / 2, 4, 2.4, -0.5, 0, 7); g.fill();
      } else {
        if (g.roundRect) { g.beginPath(); g.roundRect(-hw / 2, -h * 0.05 - hh, hw, hh, 5); g.fill(); }
        else g.fillRect(-hw / 2, -h * 0.05 - hh, hw, hh);
        if (shape === 'stripe') {
          g.fillStyle = '#fff';
          for (var s = -1; s <= 1; s++) g.fillRect(s * hw * 0.3 - 2, -h * 0.05 - hh, 4, hh);
        }
        if (shape === 'gold') { g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-hw * 0.2, -h * 0.08 - hh * 0.7, 4, 2, -0.5, 0, 7); g.fill(); }
      }
      g.restore();
    };
  }
  // frog-bonk meadow swatch — grass gradient + a season mark
  function meadowSwatch(stops, mark) {
    return function (g, w, h) {
      var lg = g.createLinearGradient(0, 0, 0, h);
      for (var i = 0; i < stops.length; i++) lg.addColorStop(i / (stops.length - 1), stops[i]);
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      if (mark === 'rain') { g.strokeStyle = 'rgba(190,225,255,0.7)'; g.lineWidth = 1.5; for (var r = 0; r < 5; r++) { g.beginPath(); g.moveTo(w * (0.15 + r * 0.17), h * 0.2); g.lineTo(w * (0.12 + r * 0.17), h * 0.45); g.stroke(); } }
      else if (mark === 'snow') { g.fillStyle = 'rgba(255,255,255,0.9)'; for (var s = 0; s < 6; s++) { g.beginPath(); g.arc(w * ((s * 0.31 + 0.13) % 1), h * ((s * 0.23 + 0.14) % 0.6), 2, 0, 7); g.fill(); } }
      else if (mark === 'leaf') { g.fillStyle = '#c85a28'; for (var l = 0; l < 4; l++) { g.beginPath(); g.ellipse(w * (0.2 + l * 0.2), h * (0.2 + (l % 2) * 0.18), 3.4, 2, l, 0, 7); g.fill(); } }
      else { g.fillStyle = '#ffd7e6'; for (var f = 0; f < 4; f++) { g.beginPath(); g.arc(w * (0.18 + f * 0.21), h * (0.62 + (f % 2) * 0.16), 2.4, 0, 7); g.fill(); } g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(w * 0.75, h * 0.2, 5, 0, 7); g.fill(); }
    };
  }

  // waveform swatch for music tracks
  function wavePainter(col) {
    return function (g, w, h) {
      g.fillStyle = '#0a1018'; g.fillRect(0, 0, w, h);
      g.strokeStyle = col; g.lineWidth = Math.max(1.5, w * 0.03); g.lineJoin = 'round';
      g.shadowColor = col; g.shadowBlur = w * 0.08;
      g.beginPath();
      for (var i = 0; i <= 32; i++) { var x = (i / 32) * w, y = h / 2 + Math.sin(i * 0.9) * h * 0.28 * (0.4 + 0.6 * Math.abs(Math.sin(i * 0.35))); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke(); g.shadowBlur = 0;
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

  // ---- 🐍 Neon Snake — music tracks (preview + unlock in the shop; `music` = kit track id) ----
  items.push({ id: 'snake.track.remaster', game: 'snake', set: 'snake.track', name: 'Neon', desc: 'The classic neon track — punchy drums, sub bass and stereo.', price: 0, painter: wavePainter('#7fffb0'), music: 'snake' });
  items.push({ id: 'snake.track.banger', game: 'snake', set: 'snake.track', name: 'Neon Banger', desc: 'A pumped-up electro remix — rolling bassline and a catchy square-wave hook.', price: 100, painter: wavePainter('#39ff14'), music: 'snakebanger' });

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
  add('tower-defense', 'castle', 'stone',    'Stone Keep',        0,   'The keep as the masons built it.', castle('#78788a', '#3a2a17'));
  add('tower-defense', 'castle', 'oak',      'Oak Fort',          25,  'Timber walls, frontier spirit.', castle('#a87848', '#6a4a28'));
  add('tower-defense', 'castle', 'sand',     'Sandcastle',        50,  'Bucket-built, surprisingly sturdy.', castle('#e8cc8a', '#c8a45c', '#2a4a66'));
  add('tower-defense', 'castle', 'ice',      'Ice Keep',          50,  'Carved from a glacier, cold to the core.', castle('#cfeaff', '#8ac0e8', '#0e2233'));
  add('tower-defense', 'castle', 'obsidian', 'Obsidian Citadel',  100, 'Black glass walls that drink the light.', castle('#22242e', '#0e0f16', '#1a1230'));

  // ---- 🫧 Bubble Pop — pop effects + shooter bases ----
  add('bubbles', 'pop', 'classic',   'Classic',   0,   'A clean, satisfying pop.', popDots('#9fe8ff'));
  add('bubbles', 'pop', 'confetti',  'Confetti',  25,  'Every pop throws a tiny party.', burst(['#ff7ab6', '#ffd166', '#7fe0a0', '#7fd0ff']));
  add('bubbles', 'pop', 'stars',     'Stars',     50,  'Bubbles burst into twinkling stars.', star('#ffe066', '#ffd166', '#0a1420'));
  add('bubbles', 'pop', 'fireworks', 'Fireworks', 100, 'Full skyrocket finale on every match.', burst(['#ff5b5b', '#ffd166', '#fff', '#7fd0ff']));
  add('bubbles', 'base', 'aqua',  'Aqua',       0,  'The standard-issue aqua launcher.', grad(['#2ee8c8', '#1a8a9a'], 1));
  add('bubbles', 'base', 'candy', 'Candy',      25, 'Sugar-striped and sweet.', grad(['#ff9ad1', '#fff', '#ff9ad1'], 0));
  add('bubbles', 'base', 'gold',  'Royal Gold', 50, 'A launcher fit for bubble royalty.', grad(['#ffe08a', '#c89a2a'], 1));

  // ---- 🎯 Range — target skins + hit markers ----
  add('aim-trainer', 'target', 'rings',    'Rings',      0,   'Regulation rings, no excuses.', ringsTarget);
  add('aim-trainer', 'target', 'donut',    'Neon Donut', 25,  'A glazed ring of pure neon.', target(['#ff7ab6', '#2a1420', '#ff7ab6']));
  add('aim-trainer', 'target', 'fruit',    'Fruit',      50,  'Watermelon slices. Juicy hits.', target(['#7fe05a', '#fff', '#ff5b6b']));
  add('aim-trainer', 'target', 'alien',    'Alien Blob', 50,  'It wobbles. It stares. Shoot it.', target(['#7fe07a', '#3aa858', '#0e2a14']));
  add('aim-trainer', 'target', 'goldstar', 'Gold Star',  100, 'Every hit feels like a gold medal.', star('#ffd166', '#ffb03a', '#141c28'));
  add('aim-trainer', 'marker', 'classic', 'Classic', 0,  'A crisp white hitmarker.', markerX);
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
  add('flappy', 'bird', 'bee',      'Bee',      0,   'Not technically a bird. Flies anyway.', beeBird);
  add('flappy', 'bird', 'robin',    'Robin',    10,  'A cheerful meadow regular.', bird('#a86a48', '#7a4e34'));
  add('flappy', 'bird', 'bluebird', 'Bluebird', 25,  'Swift, sleek and sky-coloured.', bird('#5fa8e8', '#3f86c8'));
  add('flappy', 'bird', 'parrot',   'Parrot',   50,  'Loud in colour and in spirit.', bird('#5fd07a', '#3aa858'));
  add('flappy', 'bird', 'owl',      'Owl',      75,  'Silent night hunter with slow, heavy flaps.', bird('#b08a5a', '#8a6a40'));
  add('flappy', 'bird', 'bielik',   'Bielik',   100, 'The white-tailed eagle, king of Polish skies.', bird('#a8875c', '#7a6038'));
  add('flappy', 'bird', 'rarog',    'Raróg', 150, 'A fiery falcon spirit from Slavic legend.', bird('#c8232e', '#8a1a22', 'rgba(255,120,40,0.7)'));
  add('flappy', 'bird', 'raven',    'Raven',    250, 'Midnight feathers, ancient secrets.', bird('#17181d', '#0c0d11', 'rgba(170,200,255,0.55)'));
  add('flappy', 'bird', 'phoenix',  'Phoenix',  500, 'The aspirational one. Rises from every game over.', bird('#ff8a3a', '#e85a1a', 'rgba(255,140,40,0.85)'));

  // ---- 🐸 Frog Bonk — hammer skins + meadow seasons ----
  add('frog-bonk', 'hammer', 'wood',    'Wooden',     0,   'The royal bonker, carved from oak.', hammerSwatch('#b0793f', '#7a4e28', 'block'));
  add('frog-bonk', 'hammer', 'fluffy',  'Fluffy',     25,  'A plush pink mallet. Maximum softness.', hammerSwatch('#ffb6d9', '#f08ab8', 'fluff'));
  add('frog-bonk', 'hammer', 'candy',   'Candy Cane', 50,  'Peppermint-striped and perfectly bonkable.', hammerSwatch('#ff5b6b', '#ff8a94', 'stripe'));
  add('frog-bonk', 'hammer', 'balloon', 'Inflatable', 50,  'Squeaky, bouncy, surprisingly effective.', hammerSwatch('#9fd8ff', '#4d9ae0', 'balloon'));
  add('frog-bonk', 'hammer', 'gold',    'Royal Gold', 100, 'Solid gold. The frogs feel honoured.', hammerSwatch('#ffe08a', '#c89a2a', 'gold'));
  add('frog-bonk', 'meadow', 'sunny',   'Sunny',      0,   'The meadow on its best day.', meadowSwatch(['#8fce5e', '#5da741', '#3f8a33'], 'sun'));
  add('frog-bonk', 'meadow', 'autumn',  'Autumn',     25,  'Golden grass and drifting leaves.', meadowSwatch(['#d8b25a', '#b08a3e', '#8a6a30'], 'leaf'));
  add('frog-bonk', 'meadow', 'rain',    'Rainy Day',  50,  'Soft rain over deep green grass.', meadowSwatch(['#6aa84f', '#457a38', '#2f5e2c'], 'rain'));
  add('frog-bonk', 'meadow', 'snow',    'Winter',     100, 'A quiet snowfall over the frozen meadow.', meadowSwatch(['#dfe8ea', '#b8ccd0', '#9ab4bc'], 'snow'));

  // ---- 🔢 Sudoku — board themes + numeral styles ----
  function sudokuBoard(card, line, given, entry) {
    return function (g, w, h) {
      g.fillStyle = card; g.fillRect(0, 0, w, h);
      g.strokeStyle = line; g.lineWidth = Math.max(1, w * 0.02);
      for (let k = 1; k < 3; k++) {
        g.beginPath(); g.moveTo((w / 3) * k, w * 0.08); g.lineTo((w / 3) * k, h - w * 0.08); g.stroke();
        g.beginPath(); g.moveTo(w * 0.08, (h / 3) * k); g.lineTo(w - w * 0.08, (h / 3) * k); g.stroke();
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 ' + (w * 0.24) + 'px Georgia, serif';
      g.fillStyle = given; g.fillText('5', w / 6, h / 6 + h * 0.02);
      g.fillStyle = entry; g.fillText('3', w / 2, h / 2 + h * 0.02);
      g.fillStyle = given; g.fillText('9', w * 5 / 6, h * 5 / 6 + h * 0.02);
    };
  }
  function sudokuDigits(family, weight) {
    // truthful preview: the classic set is numerals in the board's real ink/entry colors
    return function (g, w, h) {
      g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#b9b3a4'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(w / 2, h * 0.1); g.lineTo(w / 2, h * 0.9); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = weight + ' ' + (w * 0.5) + 'px ' + family;
      g.fillStyle = '#23272e'; g.fillText('7', w * 0.27, h / 2 + h * 0.03);
      g.fillStyle = '#1d6fb8'; g.fillText('3', w * 0.73, h / 2 + h * 0.03);
    };
  }
  function sudokuAnimals(g, w, h) {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9b3a4'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(w / 2, h * 0.1); g.lineTo(w / 2, h * 0.9); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = (w * 0.42) + 'px system-ui, sans-serif';
    g.fillText('🦊', w * 0.27, h / 2 + h * 0.03);
    g.fillText('🐸', w * 0.73, h / 2 + h * 0.03);
  }
  function sudokuShapes(g, w, h) {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    var r = w * 0.16;
    g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(w * 0.26, h * 0.32, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3498db'; g.beginPath();
    for (var k = 0; k < 10; k++) { var rr = k % 2 ? r * 0.45 : r; var a = -Math.PI / 2 + k * Math.PI / 5; g[k ? 'lineTo' : 'moveTo'](w * 0.72 + rr * Math.cos(a), h * 0.36 + rr * Math.sin(a)); }
    g.closePath(); g.fill();
    g.fillStyle = '#2ecc71'; g.beginPath();
    g.moveTo(w * 0.5, h * 0.72 - r); g.lineTo(w * 0.5 + r, h * 0.72); g.lineTo(w * 0.5, h * 0.72 + r); g.lineTo(w * 0.5 - r, h * 0.72);
    g.closePath(); g.fill();
  }
  add('sudoku', 'board', 'paper',     'Paper',     0,   'Clean off-white paper and warm ink.', sudokuBoard('#f2efe8', '#3a3f47', '#2b2f36', '#1d6fb8'));
  add('sudoku', 'board', 'slate',     'Slate',     25,  'A dark board for late-night solving.', sudokuBoard('#2b323c', '#97a3b4', '#e8e2d4', '#6ad6ff'));
  add('sudoku', 'board', 'blueprint', 'Blueprint', 50,  'Cyan grid lines on drafting blue.', sudokuBoard('#0e2a42', '#7fd8ff', '#eaf6ff', '#ffd24d'));
  add('sudoku', 'board', 'pastel',    'Pastel',    100, 'Soft rose paper and plum ink.', sudokuBoard('#fdf2f8', '#b07aa0', '#5a4a58', '#7a5fd0'));
  add('sudoku', 'digits', 'ink',     'Ink Serif', 0,  'Classic newspaper numerals.', sudokuDigits('Georgia, serif', 700));
  add('sudoku', 'digits', 'animals', 'Animals',   50, 'Nine little critters instead of numbers.', sudokuAnimals);
  add('sudoku', 'digits', 'shapes',  'Shapes',    50, 'Nine colorful shapes instead of numbers.', sudokuShapes);

  // ---- 💣 Minesweeper — board themes (mini 2×2 tile swatch: raised tiles + one open number) ----
  function msBoard(tile, hi, open, numC) {
    return function (g, w, h) {
      const s = Math.floor(Math.min(w, h) / 2);
      const ox = (w - s * 2) / 2, oy = (h - s * 2) / 2;
      for (let k = 0; k < 4; k++) {
        const x = ox + (k % 2) * s, y = oy + Math.floor(k / 2) * s;
        if (k === 3) {
          g.fillStyle = open; g.fillRect(x, y, s - 1, s - 1);
          g.fillStyle = numC; g.font = '700 ' + Math.round(s * 0.6) + 'px system-ui';
          g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', x + s / 2, y + s / 2);
        } else {
          g.fillStyle = tile; g.fillRect(x, y, s - 1, s - 1);
          g.fillStyle = hi; g.fillRect(x, y, s - 1, 2); g.fillRect(x, y, 2, s - 1);
        }
      }
    };
  }
  add('minesweeper', 'board', 'sonar',  'Sonar',  0,   'Deep-sea charts and glowing cyan pings.', msBoard('#0d2a40', '#1e4a68', '#061420', '#4fd8ff'));
  add('minesweeper', 'board', 'retro',  'Retro',  50,  'The beige office classic, pixel bevels and all.', msBoard('#c0c7cf', '#eef2f6', '#b3bac2', '#1c46c8'));
  add('minesweeper', 'board', 'meadow', 'Meadow', 100, 'Dig a sunny field — daisies mark the moles.', msBoard('#3f8a3c', '#63b45a', '#8a6b42', '#ffe066'));

  // ---- 🧮 2048 — tile themes (mini 2×2 swatch of graded value tiles) ----
  function tiles2048(cols) {
    return function (g, w, h) {
      const s = Math.floor(Math.min(w, h) / 2), ox = (w - s * 2) / 2, oy = (h - s * 2) / 2;
      const vals = ['2', '8', '64', '512'];
      for (let k = 0; k < 4; k++) {
        const x = ox + (k % 2) * s, y = oy + Math.floor(k / 2) * s;
        const grd = g.createLinearGradient(x, y, x, y + s);
        grd.addColorStop(0, cols[k][0]); grd.addColorStop(1, cols[k][1]);
        g.fillStyle = grd; g.fillRect(x + 1, y + 1, s - 2, s - 2);
        g.fillStyle = cols[k][2]; g.font = '800 ' + Math.round(s * 0.42) + 'px system-ui';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(vals[k], x + s / 2, y + s / 2);
      }
    };
  }
  add('2048', 'tiles', 'honey', 'Honey', 0,  'Warm cream to amber — the cozy classic.',
    tiles2048([['#efe4d2', '#e2d3ba', '#5a4632'], ['#f6b568', '#ee9d4d', '#fff7ec'], ['#f7623c', '#ea4423', '#fff7ec'], ['#f2c73f', '#e8ab18', '#fff7ec']]));
  add('2048', 'tiles', 'neon',  'Neon',  50, 'Glassy glow tiles on midnight blue.',
    tiles2048([['hsl(200,85%,62%)', 'hsl(200,90%,45%)', '#eafcff'], ['hsl(260,85%,62%)', 'hsl(260,90%,45%)', '#eafcff'], ['hsl(345,85%,62%)', 'hsl(345,90%,45%)', '#eafcff'], ['hsl(65,85%,62%)', 'hsl(65,90%,45%)', '#eafcff']]));
  add('2048', 'tiles', 'kraft', 'Kraft', 100, 'Stamped cardboard and moss-green inks.',
    tiles2048([['#e8dcc4', '#d9c9a8', '#4a3a26'], ['#c9a06a', '#b98a50', '#fff8ea'], ['#a05a2e', '#87461e', '#fff8ea'], ['#6b9439', '#527a22', '#fff8ea']]));

  // ---- 🐱 Trap the Cat — cat colours (simple cat-face swatch) ----
  function catFace(body, belly, nose) {
    return function (g, w, h) {
      const s = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2 + s * 0.08;
      g.fillStyle = body;
      g.beginPath(); g.moveTo(cx - s * 0.9, cy - s * 0.4); g.lineTo(cx - s * 0.65, cy - s * 1.25); g.lineTo(cx - s * 0.2, cy - s * 0.7); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + s * 0.9, cy - s * 0.4); g.lineTo(cx + s * 0.65, cy - s * 1.25); g.lineTo(cx + s * 0.2, cy - s * 0.7); g.closePath(); g.fill();
      const grd = g.createRadialGradient(cx - s * 0.3, cy - s * 0.4, s * 0.2, cx, cy, s * 1.2);
      grd.addColorStop(0, belly); grd.addColorStop(1, body);
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, s, 0, 7); g.fill();
      g.fillStyle = '#1a141c';
      g.beginPath(); g.arc(cx - s * 0.35, cy - s * 0.12, s * 0.2, 0, 7); g.arc(cx + s * 0.35, cy - s * 0.12, s * 0.2, 0, 7); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(cx - s * 0.42, cy - s * 0.2, s * 0.07, 0, 7); g.arc(cx + s * 0.28, cy - s * 0.2, s * 0.07, 0, 7); g.fill();
      g.fillStyle = nose; g.beginPath(); g.arc(cx, cy + s * 0.18, s * 0.11, 0, 7); g.fill();
    };
  }
  add('trap-the-cat', 'cat', 'noir',   'Noir',   0,   'The classic midnight escape artist.', catFace('#2b2530', '#3a3342', '#f0a6c8'));
  add('trap-the-cat', 'cat', 'ginger', 'Ginger', 50,  'A marmalade menace on the run.',      catFace('#e08b3d', '#f2b571', '#e06a6a'));
  add('trap-the-cat', 'cat', 'snow',   'Snow',   100, 'Fluffy, elegant, and slippery.',       catFace('#e8e4ea', '#f7f4f8', '#f08aae'));

  // ---- 🏮 Glow Says — pad shapes ----
  function glowPad(shape) {
    return function (g, w, h) {
      const cx = w / 2, cy = h / 2, rr = Math.min(w, h) * 0.32;
      g.fillStyle = '#0a2a20'; g.fillRect(0, 0, w, h);
      g.shadowColor = '#7ee787'; g.shadowBlur = rr * 0.6;
      const grd = g.createRadialGradient(cx - rr * 0.2, cy - rr * 0.2, rr * 0.1, cx, cy, rr * 1.1);
      grd.addColorStop(0, '#d8ffdf'); grd.addColorStop(1, '#3fae5a');
      g.fillStyle = grd;
      if (shape === 'star') {
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? rr * 0.5 : rr;
          const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
          k ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath();
      } else if (shape === 'heart') {
        g.beginPath();
        g.moveTo(cx, cy + rr * 0.85);
        g.bezierCurveTo(cx - rr * 1.3, cy - rr * 0.15, cx - rr * 0.6, cy - rr, cx, cy - rr * 0.35);
        g.bezierCurveTo(cx + rr * 0.6, cy - rr, cx + rr * 1.3, cy - rr * 0.15, cx, cy + rr * 0.85);
        g.closePath();
      } else {
        g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2);
      }
      g.fill(); g.shadowBlur = 0;
    };
  }
  add('glow-says', 'pads', 'orbs',   'Lantern Orbs', 0,   'Round glowing lanterns.',      glowPad('orb'));
  add('glow-says', 'pads', 'stars',  'Stars',        50,  'Twinkly star lanterns.',       glowPad('star'));
  add('glow-says', 'pads', 'hearts', 'Hearts',       100, 'Warm heart-shaped lanterns.',  glowPad('heart'));

  // ---- 🎈 Balloon Pop — balloon styles ----
  function balloonSwatch(kind) {
    return function (g, w, h) {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#9adcff'); bg.addColorStop(1, '#e2f6e8');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.3;
      const grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
      grd.addColorStop(0, '#fff'); grd.addColorStop(0.3, '#ff6b8a'); grd.addColorStop(1, '#c23a5a');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(cx, cy, r * 0.92, r, 0, 0, Math.PI * 2); g.fill();
      if (kind === 'critter') {
        g.fillStyle = '#c23a5a';
        g.beginPath(); g.ellipse(cx - r * 0.55, cy - r * 0.8, r * 0.26, r * 0.34, -0.4, 0, 7); g.fill();
        g.beginPath(); g.ellipse(cx + r * 0.55, cy - r * 0.8, r * 0.26, r * 0.34, 0.4, 0, 7); g.fill();
        g.fillStyle = '#2b2030';
        g.beginPath(); g.arc(cx - r * 0.28, cy - r * 0.1, r * 0.09, 0, 7); g.arc(cx + r * 0.28, cy - r * 0.1, r * 0.09, 0, 7); g.fill();
      } else if (kind === 'planet') {
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = Math.max(2, r * 0.1);
        g.beginPath(); g.ellipse(cx, cy, r * 1.25, r * 0.32, -0.28, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.ellipse(cx - r * 0.3, cy - r * 0.4, r * 0.2, r * 0.12, -0.6, 0, 7); g.fill();
    };
  }
  add('balloon-pop', 'balloons', 'classic',  'Classic',  0,   'Bright party balloons.',            balloonSwatch('classic'));
  add('balloon-pop', 'balloons', 'critters', 'Critters', 50,  'Balloons with little animal ears.', balloonSwatch('critter'));
  add('balloon-pop', 'balloons', 'planets',  'Planets',  100, 'Ringed balloon planets in the sky.', balloonSwatch('planet'));

  // ---- 🐾 Critter Match — critter card sets ----
  function critterCard(emoji) {
    return function (g, w, h) {
      g.fillStyle = '#3a2415'; g.fillRect(0, 0, w, h);
      const cw2 = w * 0.52, ch2 = h * 0.68, px = (w - cw2) / 2, py = (h - ch2) / 2;
      g.fillStyle = '#fff8ec';
      g.beginPath();
      if (g.roundRect) g.roundRect(px, py, cw2, ch2, w * 0.08); else g.rect(px, py, cw2, ch2);
      g.fill();
      g.strokeStyle = '#d9b98a'; g.lineWidth = 2; g.stroke();
      g.font = Math.round(w * 0.34) + 'px system-ui';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(emoji, w / 2, h / 2 + w * 0.02);
    };
  }
  add('critter-match', 'critters', 'farm',   'Farm Friends',  0,   'Cows, chicks and fluffy sheep.', critterCard('🐮'));
  add('critter-match', 'critters', 'jungle', 'Jungle Crew',   50,  'Lions, monkeys and parrots.',    critterCard('🦁'));
  add('critter-match', 'critters', 'ocean',  'Ocean Pals',    100, 'Fish, octopuses and whales.',    critterCard('🐙'));

  // ---- 🌐 Forcefield — bolt colours + planet skins ----
  add('forcefield', 'marker', 'default', 'Classic', 0,  'A clean golden bolt.', forcefieldMarker('#ffd36b'));
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
      'snake.track':          { label: 'Music' },
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
      'frog-bonk.hammer':    { label: 'Hammer skins' },
      'frog-bonk.meadow':    { label: 'Meadow seasons' },
      'sudoku.board':        { label: 'Board themes' },
      'sudoku.digits':       { label: 'Numeral styles' },
      'minesweeper.board':   { label: 'Board themes' },
      '2048.tiles':          { label: 'Tile themes' },
      'trap-the-cat.cat':    { label: 'Cat colours' },
      'glow-says.pads':      { label: 'Lantern shapes' },
      'balloon-pop.balloons': { label: 'Balloon styles' },
      'critter-match.critters': { label: 'Critter sets' },
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
      'frog-bonk':     { title: 'Frog Bonk', icon: '🐸', accent: '#7ed957' },
      'sudoku':        { title: 'Sudoku', icon: '🔢', accent: '#f0b429' },
      'minesweeper':   { title: 'Minesweeper', icon: '💣', accent: '#35e0ff' },
      '2048':          { title: '2048', icon: '🧮', accent: '#f2b179' },
      'trap-the-cat':  { title: 'Trap the Cat', icon: '🐱', accent: '#f0a6c8' },
      'glow-says':     { title: 'Glow Says', icon: '🟢', accent: '#7ee787' },
      'balloon-pop':   { title: 'Balloon Pop', icon: '🎈', accent: '#ff9ec2' },
      'critter-match': { title: 'Critter Match', icon: '🐾', accent: '#ffb86b' },
    },
  };
})();
