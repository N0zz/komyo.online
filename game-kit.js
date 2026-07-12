/* game-kit — shared shell for Komyo Games games: audio (SFX + Music channels) with a top-right
   sound menu + per-channel mute & volume, top-left nav (‹ Menu · Komyo Games ›), end-screen share
   row, PWA auto-update, and a standard center-top HUD style (see game-kit.css).
   Loaded via <script src="../../game-kit.js"></script> in <head> (before the game's inline
   script). Exposes window.gamekit / global `gamekit`. Headless-safe: every browser API is guarded. */
(function () {
  'use strict';

  // ---------- persistence helpers ----------
  function lsGet(k) { try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch (e) {} }
  function clamp01(v, d) { v = parseFloat(v); return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : d; }

  // ---------- canvas helpers ----------
  // Rounded-rect subpath (no beginPath — matches native ctx.roundRect semantics). r is a number or a
  // CSS-style radii array ([tl,tr,br,bl] / [tl+br,tr+bl] / [r]); radii clamp to the box.
  function rrPath(g, x, y, w, h, r) {
    var a = Array.isArray(r) ? r : [r || 0];
    var tl = a[0] || 0, tr = a.length > 1 ? a[1] || 0 : tl, br = a.length > 2 ? a[2] || 0 : tl, bl = a.length > 3 ? a[3] || 0 : (a.length > 1 ? tr : tl);
    var m = Math.min(w, h) / 2;
    tl = Math.min(tl, m); tr = Math.min(tr, m); br = Math.min(br, m); bl = Math.min(bl, m);
    g.moveTo(x + tl, y);
    g.arcTo(x + w, y, x + w, y + h, tr);
    g.arcTo(x + w, y + h, x, y + h, br);
    g.arcTo(x, y + h, x, y, bl);
    g.arcTo(x, y, x + w, y, tl);
    g.closePath();
  }
  // One polyfill for every game (old Safari + the headless mock) — bare ctx.roundRect(...) just works.
  try {
    if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect)
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { rrPath(this, x, y, w, h, r); return this; };
  } catch (e) {}
  // Convenience for game code: full fresh path, caller just fills/strokes.
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, r);
    else rrPath(g, x, y, w, h, r);
  }

  // ---------- audio state (two channels: SFX kit-played, Music settings-only) ----------
  var SFX_M = 'gamekit_sfx_muted', SFX_V = 'gamekit_sfx_vol', MUS_M = 'gamekit_music_muted', MUS_V = 'gamekit_music_vol';
  var sfxMuted = lsGet(SFX_M) === '1';
  var musMuted = lsGet(MUS_M) === '1';
  var sfxVol = clamp01(lsGet(SFX_V), 0.8);
  var musVol = clamp01(lsGet(MUS_V), 0.6);

  // Aggregate, consent-gated: report a mute toggle so we can see, across players, how often sound /
  // music gets switched off (and roughly how loud). No-op unless analytics.js loaded + consented.
  function trackAudioPref(channel, on, vol) {
    try {
      if (typeof window !== 'undefined' && typeof window.gamekitTrack === 'function') {
        var b = vol < 0.34 ? 'low' : (vol < 0.67 ? 'mid' : 'high');
        window.gamekitTrack('audio_pref', { channel: channel, state: on ? 'on' : 'off', vol_bucket: b });
      }
    } catch (e) {}
  }

  var ac, master, verbNode, verbWet, musicGain, musicVerb, musicVerbWet, musicDrum, musicPad, musicDelayIn, defs = {}, audioUIs = [], musicListeners = [];
  function ensureAC() {
    if (ac !== undefined) return;
    var AC = (typeof AudioContext !== 'undefined' && AudioContext) ||
             (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
    if (!AC) { ac = null; return; }
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
      verbNode = ac.createConvolver(); verbNode.buffer = makeImpulse(2.0, 2.4);          // shared algorithmic reverb
      verbWet = ac.createGain(); verbWet.gain.value = 0.5; verbNode.connect(verbWet); verbWet.connect(master);
      musicGain = ac.createGain(); musicGain.gain.value = musMuted ? 0 : musVol; musicGain.connect(master);
      // music voices need their own reverb path INSIDE the music channel — sending them to the
      // shared verbNode (→ master) would keep their wet tail audible with music muted.
      musicVerb = ac.createConvolver(); musicVerb.buffer = verbNode.buffer;
      musicVerbWet = ac.createGain(); musicVerbWet.gain.value = 0.5; musicVerb.connect(musicVerbWet); musicVerbWet.connect(musicGain);
      musicDrum = ac.createGain(); musicDrum.gain.value = 0.5; musicDrum.connect(musicGain);   // drums sit UNDER the music
      musicPad = ac.createGain(); musicPad.gain.value = 1; musicPad.connect(musicGain);         // sidechain target for pads
      musicDelayIn = makePingPong(0.26, 0.34);                                                   // ping-pong echo (music channel)
    } catch (e) { ac = null; }
  }
  function makeImpulse(dur, decay) {
    var len = Math.max(1, (ac.sampleRate || 44100) * dur), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (var c = 0; c < 2; c++) { var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  function makePingPong(time, fb) {
    var input = ac.createGain();
    var dL = ac.createDelay(1), dR = ac.createDelay(1); dL.delayTime.value = time; dR.delayTime.value = time;
    var fbL = ac.createGain(), fbR = ac.createGain(); fbL.gain.value = fb; fbR.gain.value = fb;
    var pan = function (p) { if (!ac.createStereoPanner) return null; var n = ac.createStereoPanner(); n.pan.value = p; return n; };
    var pL = pan(-0.85), pR = pan(0.85);
    input.connect(dL);
    if (pL) { dL.connect(pL); pL.connect(musicGain); } else dL.connect(musicGain);
    dL.connect(fbL); fbL.connect(dR);
    if (pR) { dR.connect(pR); pR.connect(musicGain); } else dR.connect(musicGain);
    dR.connect(fbR); fbR.connect(dL);
    return input;
  }
  function acNow() { return ac ? ac.currentTime : 0; }
  // ---- low-level synth voices (shared by SFX and the music engine); routed to o.out (default master),
  //      with an optional reverb send that taps post-gain so it scales with the voice. Headless-inert. ----
  function synthVoice(o) {
    ensureAC(); if (!ac) return; o = o || {};
    try {
      var t = (o.t != null) ? o.t : ac.currentTime, dur = o.dur || 0.2, out = o.out || master;
      var osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f || 440, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t + dur);
      if (o.detune) osc.detune.value = o.detune;
      if (o.vibrato) { var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = o.vibrato; lg.gain.value = o.vibratoDepth || 6; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05); }
      var g = ac.createGain(), peak = (o.gain != null ? o.gain : 0.2), a = (o.attack != null ? o.attack : 0.006);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = osc;
      if (o.filter) { var bq = ac.createBiquadFilter(); bq.type = o.filter; bq.frequency.setValueAtTime(o.cutoff || 1200, t); if (o.cutoffTo) bq.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutoffTo), t + dur); if (o.q) bq.Q.value = o.q; node.connect(bq); node = bq; }
      node.connect(g);
      var tail = g;
      if (o.pan != null && ac.createStereoPanner) { var pn = ac.createStereoPanner(); pn.pan.value = o.pan; g.connect(pn); tail = pn; }
      tail.connect(out);
      if (o.reverb && verbNode) { var s = ac.createGain(); s.gain.value = o.reverb; tail.connect(s); s.connect(out === musicGain || out === musicDrum || out === musicPad ? musicVerb : verbNode); }
      if (o.delay && musicDelayIn) { var dS = ac.createGain(); dS.gain.value = o.delay; tail.connect(dS); dS.connect(musicDelayIn); }
      osc.start(t); osc.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function synthNoise(o) {
    ensureAC(); if (!ac) return; o = o || {};
    try {
      var t = (o.t != null) ? o.t : ac.currentTime, dur = o.dur || 0.2, out = o.out || master;
      var src = ac.createBufferSource(), len = Math.max(1, ac.sampleRate * dur), b = ac.createBuffer(1, len, ac.sampleRate), dt = b.getChannelData(0);
      for (var i = 0; i < len; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / len);
      src.buffer = b;
      var bq = ac.createBiquadFilter(); bq.type = o.filter || 'lowpass'; bq.frequency.setValueAtTime(o.cutoff || 900, t);
      if (o.cutoffTo) bq.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutoffTo), t + dur);
      if (o.q) bq.Q.value = o.q;
      var g = ac.createGain(); g.gain.setValueAtTime(o.gain != null ? o.gain : 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bq); bq.connect(g);
      var tailN = g;
      if (o.pan != null && ac.createStereoPanner) { var pnN = ac.createStereoPanner(); pnN.pan.value = o.pan; g.connect(pnN); tailN = pnN; }
      tailN.connect(out);
      if (o.reverb && verbNode) { var s = ac.createGain(); s.gain.value = o.reverb; tailN.connect(s); s.connect(out === musicGain || out === musicDrum || out === musicPad ? musicVerb : verbNode); }
      if (o.delay && musicDelayIn) { var dS = ac.createGain(); dS.gain.value = o.delay; tailN.connect(dS); dS.connect(musicDelayIn); }
      src.start(t);
    } catch (e) {}
  }
  function tone(f, d, type, g) {
    if (sfxMuted) return; ensureAC(); if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    try {
      var o = ac.createOscillator(), v = ac.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      v.gain.value = (g || 0.1) * sfxVol;
      v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
      o.connect(v); v.connect(master); o.start(); o.stop(ac.currentTime + d);
    } catch (e) {}
  }
  function noise(d, g) {
    if (sfxMuted) return; ensureAC(); if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    try {
      var n = ac.createBufferSource(), b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d), ac.sampleRate);
      var dt = b.getChannelData(0);
      for (var i = 0; i < dt.length; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / dt.length);
      n.buffer = b;
      var v = ac.createGain(); v.gain.value = (g || 0.2) * sfxVol;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      n.connect(lp); lp.connect(v); v.connect(master); n.start();
    } catch (e) {}
  }
  // SFX-channel wrappers (mute-gated, scaled by sfxVol) handed to sound.define callbacks.
  function sfxVoice(o) { if (sfxMuted) return; o = o || {}; var c = {}; for (var k in o) c[k] = o[k]; c.gain = (o.gain != null ? o.gain : 0.2) * sfxVol; c.out = master; synthVoice(c); }
  function sfxNoise(o) { if (sfxMuted) return; o = o || {}; var c = {}; for (var k in o) c[k] = o[k]; c.gain = (o.gain != null ? o.gain : 0.2) * sfxVol; c.out = master; synthNoise(c); }
  function seq(arr, gap, fn) { for (var i = 0; i < arr.length; i++) (function (x, idx) { setTimeout(function () { fn(x, idx); }, idx * gap); })(arr[i], i); }
  function syncAudioUI() {
    for (var i = 0; i < audioUIs.length; i++) {
      var u = audioUIs[i];
      try {
        if (u.sfxBtn) u.sfxBtn.textContent = sfxMuted ? '🔇' : '🔊';
        if (u.sfxSlider) u.sfxSlider.value = Math.round(sfxVol * 100);
        if (u.musBtn) u.musBtn.textContent = musMuted ? '🔕' : '🎵';
        if (u.musSlider) u.musSlider.value = Math.round(musVol * 100);
        if (u.mainBtn) u.mainBtn.textContent = (sfxMuted && musMuted) ? '🔇' : '🔊';
      } catch (e) {}
    }
  }
  function notifyMusic() { var st = { muted: musMuted, volume: musVol, gain: musMuted ? 0 : musVol }; for (var i = 0; i < musicListeners.length; i++) { try { musicListeners[i](st); } catch (e) {} } }

  var sound = {
    tone: tone, noise: noise, voice: sfxVoice, noiseHit: sfxNoise, seq: seq,
    // callback ctx: { tone, noise, voice, noiseHit, seq, now } — voice/noiseHit take the rich synth opts.
    define: function (map) { if (map) for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) defs[k] = map[k]; return sound; },
    play: function (name) {
      if (sfxMuted) return; ensureAC();
      if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
      var fn = defs[name]; if (fn) { try { fn({ tone: tone, noise: noise, voice: sfxVoice, noiseHit: sfxNoise, seq: seq, now: acNow, play: sound.play }); } catch (e) {} }
    },
    isMuted: function () { return sfxMuted; },
    setMuted: function (m) { sfxMuted = !!m; lsSet(SFX_M, sfxMuted ? '1' : '0'); syncAudioUI(); },
    toggle: function () { sfxMuted = !sfxMuted; lsSet(SFX_M, sfxMuted ? '1' : '0'); syncAudioUI(); trackAudioPref('sfx', !sfxMuted, sfxVol); return sfxMuted; },
    volume: function (v) { if (v === undefined) return sfxVol; sfxVol = clamp01(v, sfxVol); lsSet(SFX_V, String(sfxVol)); syncAudioUI(); },
  };
  // shared stingers — any game plays via sound.play('victory'|'newbest'|'levelup'|'gameover'|'lose').
  sound.define({
    victory: function (c) { var t = c.now(); [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(function (p) { c.voice({ f: p[0], dur: 0.5, type: 'triangle', gain: 0.12, filter: 'lowpass', cutoff: 3000, reverb: 0.35, t: t + p[1] }); c.voice({ f: p[0] / 2, dur: 0.5, type: 'sine', gain: 0.05, t: t + p[1] }); }); c.voice({ f: 1568, dur: 0.7, type: 'sine', gain: 0.08, reverb: 0.4, t: t + 0.5 }); },
    newbest: function (c) { var t = c.now();[523, 659, 784, 1047, 1319].forEach(function (f, i) { c.voice({ f: f, dur: 0.3, type: 'triangle', gain: 0.11, reverb: 0.35, t: t + i * 0.07 }); }); c.noiseHit({ dur: 0.5, gain: 0.05, filter: 'highpass', cutoff: 6000, reverb: 0.4, t: t + 0.35 }); },
    levelup: function (c) { var t = c.now();[392, 494, 587, 784].forEach(function (f, i) { c.voice({ f: f, dur: 0.22, type: 'square', gain: 0.1, filter: 'lowpass', cutoff: 2600, reverb: 0.28, t: t + i * 0.08 }); }); },
    gameover: function (c) { var t = c.now();[440, 330, 247].forEach(function (f, i) { c.voice({ f: f, slideTo: f * 0.8, dur: 0.4, type: 'triangle', gain: 0.11, filter: 'lowpass', cutoff: 1800, cutoffTo: 500, reverb: 0.25, t: t + i * 0.16 }); }); },
    lose: function (c) { var t = c.now();[330, 247, 165, 110].forEach(function (f, i) { c.voice({ f: f, slideTo: f * 0.82, dur: 0.45, type: 'sawtooth', gain: 0.12, filter: 'lowpass', cutoff: 1400, cutoffTo: 300, reverb: 0.25, t: t + i * 0.17 }); }); },
  });

  // ---------- generative music engine v2 (procedural, kit-owned; routed through the Music channel) ----------
  // Each TRACK = a full song spec (theme params + a palette: kit / groove or prod / instrument waves).
  // Rendered by enhStep (modern) or snakeStep (remaster). Intensity (0..1) is smoothed and drives which
  // layers are present (eased fade-ins via pres()), so music builds with the gameplay a game reports.
  var NT = function (root, scale, deg) { if (deg == null) return null; var L = scale.length, oct = Math.floor(deg / L), s = scale[((deg % L) + L) % L]; return root * Math.pow(2, oct) * Math.pow(2, s / 12); };
  var NEAR = function (v, arr) { return arr.reduce(function (a, b) { return Math.abs(b - v) < Math.abs(a - v) ? b : a; }); };
  var TRACKS = {
    snake:        { kind: 'remaster', bpm: 122, root: 130.81, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4, 0, 5, 6, 4], cutoff: 1900 },
    snakebanger:  { kind: 'modern', bpm: 122, root: 130.81, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4, 0, 5, 6, 4], cutoff: 1900, kit: 'electronic', groove: 'banger', pad: 'square', bass: 'square', lead: 'square', pluck: true, detune: 8, kf0: 150, kf1: 48, prod: 'dance' },
    asteroids:    { kind: 'modern', bpm: 124, root: 130.81, scale: [0, 2, 3, 5, 7, 10], prog: [0, 6, 5, 3, 0, 4, 6, 5], cutoff: 1800, kit: 'epic', prod: 'epic', pad: 'sawtooth', bass: 'sawtooth', lead: 'sawtooth', leadSuper: true, detune: 14, choir: true },
    asteroidsplus:{ kind: 'modern', bpm: 126, root: 130.81, scale: [0, 2, 3, 5, 7, 10], prog: [0, 0, 3, 6, 0, 5, 3, 6], cutoff: 1800, kit: 'techno', groove: 'rave', pad: 'sawtooth', bass: 'sawtooth', lead: 'sawtooth', bassSuper: true, leadSuper: true, detune: 16, riser: true, swing: 0.03, kf0: 160, kf1: 50, prod: 'dance' },
    forcefield:   { kind: 'modern', bpm: 128, root: 164.81, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 7, 5, 0, 4, 3, 5], cutoff: 2000, kit: 'electronic', groove: 'trance', pad: 'sawtooth', bass: 'sawtooth', lead: 'sawtooth', leadSuper: true, detune: 14, kf0: 150, kf1: 48, prod: 'dance' },
    range:        { kind: 'modern', bpm: 126, root: 130.81, scale: [0, 2, 3, 7, 8, 10], prog: [0, 1, 5, 4, 0, 1, 3, 4], cutoff: 1300, kit: 'tactical', groove: 'tactical', pad: 'sawtooth', bass: 'square', lead: 'sawtooth', leadSuper: true, detune: 12, kf0: 110, kf1: 44, prod: 'tactical' },
    breakout:     { kind: 'modern', bpm: 98, root: 110, scale: [0, 3, 5, 7, 10], prog: [0, 3, 4, 3, 5, 4, 3, 0], cutoff: 1500, kit: 'synthwave', prod: 'synthwave', pad: 'sawtooth', bass: 'sawtooth', lead: 'sawtooth', leadSuper: true, detune: 12, halftime: true, kf0: 130, kf1: 45 },
    bubbles:      { kind: 'modern', bpm: 110, root: 174.61, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 2, 5, 4, 0, 6, 2, 5], cutoff: 2600, kit: 'electronic', groove: 'banger', pad: 'triangle', bass: 'triangle', lead: 'triangle', pluck: true, detune: 8, kf0: 150, kf1: 52, prod: 'dance' },
    frogbonk:     { kind: 'modern', bpm: 86, root: 110, scale: [0, 2, 3, 5, 7, 8, 12], prog: [0, 6, 4, 2, 0, 3, 5, 2], cutoff: 1700, kit: 'electronic', groove: 'banger', pad: 'triangle', bass: 'triangle', lead: 'square', pluck: true, detune: 8, swing: 0.06, kf0: 130, kf1: 50, prod: 'dance' },
    keep:         { kind: 'modern', bpm: 86, root: 110, scale: [0, 2, 3, 5, 7, 8, 12], prog: [0, 3, 6, 4, 0, 5, 3, 6], cutoff: 1700, kit: 'epic', prod: 'epic', pad: 'triangle', bass: 'triangle', lead: 'square', pluck: true, choir: true },
    stacker:      { kind: 'modern', bpm: 96, root: 220, scale: [0, 3, 5, 7, 10, 12], prog: [0, 4, 5, 3, 0, 4, 2, 3], cutoff: 2000, kit: 'soft', prod: 'lush', pad: 'sine', bass: 'sine', lead: 'triangle', softLead: true, vibrato: 4 },
    sudoku:       { kind: 'modern', bpm: 80, root: 155.56, scale: [0, 2, 4, 7, 9, 12], prog: [0, 5, 1, 4, 0, 2, 5, 4], cutoff: 2200, kit: 'soft', prod: 'lush', pad: 'sine', bass: 'triangle', lead: 'sine', softLead: true, vibrato: 3 },
    minesweeper:  { kind: 'modern', bpm: 88, root: 130.81, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 4, 2, 6, 0, 3, 5, 1], cutoff: 1600, kit: 'techno', groove: 'trance', pad: 'triangle', bass: 'sine', lead: 'sine', softLead: true, detune: 6 },
    '2048':       { kind: 'modern', bpm: 104, root: 196, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 1, 0, 5, 4, 2], cutoff: 2100, kit: 'electronic', groove: 'banger', pad: 'triangle', bass: 'triangle', lead: 'sine', softLead: true, pluck: true, detune: 5 },
    trapthecat:   { kind: 'modern', bpm: 112, root: 220, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 2, 0, 4, 1, 5], cutoff: 2300, kit: 'soft', prod: 'lush', pad: 'triangle', bass: 'sine', lead: 'triangle', softLead: true, pluck: true, vibrato: 6 },
    glowsays:     { kind: 'modern', bpm: 100, root: 261.63, scale: [0, 2, 4, 7, 9, 12], prog: [0, 1, 4, 5, 0, 2, 5, 3], cutoff: 2500, kit: 'soft', prod: 'lush', pad: 'sine', bass: 'sine', lead: 'triangle', softLead: true, vibrato: 5 },
    balloonpop:   { kind: 'modern', bpm: 118, root: 233.08, scale: [0, 2, 4, 7, 9, 12], prog: [0, 4, 1, 5, 0, 3, 5, 2], cutoff: 2600, kit: 'electronic', groove: 'banger', pad: 'triangle', bass: 'triangle', lead: 'triangle', softLead: true, pluck: true, swing: 0.08 },
    crittermatch: { kind: 'modern', bpm: 94, root: 174.61, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 2, 5, 4, 0, 1, 3, 5], cutoff: 2200, kit: 'soft', prod: 'lush', pad: 'sine', bass: 'triangle', lead: 'triangle', softLead: true, vibrato: 4, swing: 0.05 },
    meadow:       { kind: 'modern', bpm: 90, root: 146.83, scale: [0, 2, 4, 7, 9, 12], prog: [0, 4, 3, 5, 0, 2, 4, 5], cutoff: 2400, kit: 'soft', prod: 'lush', pad: 'triangle', bass: 'triangle', lead: 'sine', softLead: true, vibrato: 5 },
    // Keep Defender per-biome (epic palette; each biome keeps its own key/tempo/mode for mood)
    kd_grass:   { kind: 'modern', bpm: 96, root: 146.83, scale: [0, 2, 4, 7, 9, 12], prog: [0, 4, 3, 4, 0, 2, 4, 3], cutoff: 2500, kit: 'epic', prod: 'epic', pad: 'triangle', bass: 'triangle', lead: 'square', pluck: true, choir: true },
    kd_ice:     { kind: 'modern', bpm: 76, root: 130.81, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4, 0, 3, 5, 4], cutoff: 3200, kit: 'epic', prod: 'epic', pad: 'sine', bass: 'sine', lead: 'sine', choir: true },
    kd_lava:    { kind: 'modern', bpm: 118, root: 98, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 5, 0, 3, 4, 5, 0], cutoff: 1500, kit: 'epic', prod: 'epic', pad: 'sawtooth', bass: 'sawtooth', lead: 'square', pluck: true, choir: true },
    kd_desert:  { kind: 'modern', bpm: 100, root: 123.47, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 3, 1, 4, 0, 5, 3, 1], cutoff: 2000, kit: 'epic', prod: 'epic', pad: 'triangle', bass: 'triangle', lead: 'sawtooth', pluck: true, choir: true },
    kd_dungeon: { kind: 'modern', bpm: 72, root: 82.41, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 3, 4, 0, 5, 3, 4, 0], cutoff: 1400, kit: 'epic', prod: 'epic', pad: 'sine', bass: 'sine', lead: 'square', pluck: true, choir: true },
    kd_marsh:   { kind: 'modern', bpm: 84, root: 92.5, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 4, 2, 0, 4, 3, 2], cutoff: 1150, kit: 'epic', prod: 'epic', pad: 'triangle', bass: 'triangle', lead: 'triangle', pluck: true, choir: true },
  };
  // Back-compat: old theme names games still pass → the game's track.
  var ALIAS = { neon: 'snake', space: 'asteroids', synthwave: 'breakout', candy: 'bubbles', pastel: 'stacker', tactical: 'range', castle: 'keep' };

  var _mt = null, _mtStep = 0, _mtNext = 0, _mtMel = 0, curTrack = null, curKey = null;
  var musInt = 0.4, musIntTarget = 0.4, _prev = false, _prevKey = null;
  function clampN(v) { v = +v; return v < 0 ? 0 : (v > 1 ? 1 : (v || 0)); }
  function pres(lo) { var p = (musInt - lo) / 0.12; return p < 0 ? 0 : (p > 1 ? 1 : p); }   // eased layer fade-in around a threshold

  function mvoice(o) { if (o.out === undefined) o.out = musicGain; synthVoice(o); }
  function mnoise(o) { if (o.out === undefined) o.out = musicGain; synthNoise(o); }
  function mSuper(o) {
    if (!ac || o.f == null) return;
    try {
      var t = o.t != null ? o.t : ac.currentTime, dur = o.dur || 0.4;
      var g = ac.createGain(), peak = o.gain != null ? o.gain : 0.06, a = o.attack != null ? o.attack : 0.02;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(a, dur * 0.55)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = g;
      if (o.filter) { var bq = ac.createBiquadFilter(); bq.type = o.filter; bq.frequency.setValueAtTime(o.cutoff || 2000, t); if (o.cutoffTo) bq.frequency.exponentialRampToValueAtTime(Math.max(60, o.cutoffTo), t + dur); if (o.q) bq.Q.value = o.q; g.connect(bq); node = bq; }
      var n = o.voices || 5, spread = o.spread || 14;
      for (var i = 0; i < n; i++) { var osc = ac.createOscillator(); osc.type = o.type || 'sawtooth'; osc.frequency.value = o.f; osc.detune.value = (i - (n - 1) / 2) * spread; osc.connect(g); osc.start(t); osc.stop(t + dur + 0.05); }
      var out = o.out || musicGain, tail = node;
      if (o.pan != null && ac.createStereoPanner) { var pn = ac.createStereoPanner(); pn.pan.value = o.pan; node.connect(pn); tail = pn; }
      tail.connect(out);
      if (o.reverb && musicVerb) { var s = ac.createGain(); s.gain.value = o.reverb; tail.connect(s); s.connect(musicVerb); }
      if (o.delay && musicDelayIn) { var d = ac.createGain(); d.gain.value = o.delay; tail.connect(d); d.connect(musicDelayIn); }
    } catch (e) {}
  }
  function mKick(o) {
    if (!ac) return; var t = o.t, dur = o.dur || 0.16;
    try {
      var osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(o.f0 || 150, t); osc.frequency.exponentialRampToValueAtTime(o.f1 || 46, t + dur * 0.72);
      var g = ac.createGain(); g.gain.setValueAtTime(o.gain || 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(musicDrum); osc.start(t); osc.stop(t + dur + 0.02);
      if (o.click !== 0) mnoise({ t: t, dur: 0.01, gain: (o.gain || 0.5) * (o.click || 0.12), filter: 'highpass', cutoff: 1500, out: musicDrum });
    } catch (e) {}
  }
  function mSnare(t, gain) { mvoice({ f: 180, dur: 0.1, type: 'triangle', gain: gain || 0.08, out: musicDrum, t: t }); mnoise({ t: t, dur: 0.15, gain: gain || 0.08, filter: 'highpass', cutoff: 1800, reverb: 0.12, out: musicDrum }); }
  function mClap(t, gain) { [0, 0.011, 0.022].forEach(function (dl) { mnoise({ t: t + dl, dur: 0.08, gain: gain || 0.05, filter: 'bandpass', cutoff: 1500, q: 1.4, reverb: 0.18, out: musicDrum }); }); }
  function mHat(o) { mnoise({ t: o.t, dur: o.open ? (o.dur || 0.1) : 0.026, gain: o.gain || 0.02, filter: 'highpass', cutoff: o.cut || (o.open ? 7000 : 9000), pan: o.pan || 0, out: musicDrum }); }
  function mTom(o) {
    if (!ac) return; var t = o.t, dur = o.dur || 0.3;
    try {
      var osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(o.f0 || 180, t); osc.frequency.exponentialRampToValueAtTime(o.f1 || 100, t + dur * 0.8);
      var g = ac.createGain(); g.gain.setValueAtTime(o.gain || 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(musicDrum); osc.start(t); osc.stop(t + dur + 0.02);
      mnoise({ t: t, dur: 0.03, gain: (o.gain || 0.4) * 0.2, filter: 'lowpass', cutoff: 400, out: musicDrum });
    } catch (e) {}
  }
  function duck(t) { if (!musicPad) return; try { musicPad.gain.cancelScheduledValues(t); musicPad.gain.setValueAtTime(0.22, t); musicPad.gain.linearRampToValueAtTime(1, t + 0.26); } catch (e) {} }

  function perc(T, pump, s, phraseEnd, tt) {
    var K = T.kit;
    if (K === 'electronic') {
      if (pres(0.25) > 0.02 && (s === 0 || (pres(0.45) > 0.02 && s === 8) || (pump && pres(0.55) > 0.02 && s % 4 === 0))) { mKick({ t: tt, gain: 0.44 * (s === 0 ? 1 : pres(0.25)), f0: T.kf0 || 150, f1: T.kf1 || 48, dur: 0.13, click: 0.14 }); if (pump) duck(tt); }
      var hp = pres(0.45); if (hp > 0.02) { if (s === 4 || s === 12) mClap(tt, 0.045 * hp); if (s % 2 === 0) mHat({ t: tt, open: false, gain: 0.018 * hp, cut: 9500, pan: 0.12 }); }
      var hp2 = pres(0.65); if (hp2 > 0.02) { if (s % 2 === 1) mHat({ t: tt, open: false, gain: 0.013 * hp2, cut: 9500, pan: -0.12 }); if (s === 6 || s === 14) mHat({ t: tt, open: true, gain: 0.018 * hp2, cut: 8200, dur: 0.07 }); }
      if (pres(0.85) > 0.02 && phraseEnd && s >= 12) mnoise({ t: tt, dur: 0.06, gain: 0.03 * pres(0.85), filter: 'highpass', cutoff: 2600 + (s - 12) * 700, out: musicDrum });
    } else if (K === 'techno') {
      if (pres(0.35) > 0.02 && s % 4 === 0) { mKick({ t: tt, gain: 0.46 * pres(0.35), f0: T.kf0 || 160, f1: T.kf1 || 42, dur: 0.24, click: 0.07 }); if (pump) duck(tt); }
      var op = pres(0.5); if (op > 0.02 && (s === 2 || s === 6 || s === 10 || s === 14)) mHat({ t: tt, open: true, gain: 0.022 * op, cut: 6500, dur: 0.11 });
      var cp = pres(0.65); if (cp > 0.02 && s % 2 === 0) mHat({ t: tt, open: false, gain: 0.012 * cp, cut: 7500, pan: (s % 4 ? 0.1 : -0.1) });
      if (pres(0.55) > 0.02 && s === 12) mnoise({ t: tt, dur: 0.09, gain: 0.028 * pres(0.55), filter: 'highpass', cutoff: 2400, reverb: 0.15, out: musicDrum });
      if (pres(0.8) > 0.02 && phraseEnd && s >= 8 && s % 2 === 0) mnoise({ t: tt, dur: 0.04, gain: 0.018 * pres(0.8), filter: 'highpass', cutoff: 3200, out: musicDrum });
    } else if (K === 'soft') {
      if (s % 2 === 0) mnoise({ t: tt, dur: 0.05, gain: 0.01 + musInt * 0.016, filter: 'highpass', cutoff: 6800, pan: (s % 4 ? 0.2 : -0.2), out: musicDrum });
      if (pres(0.5) > 0.02 && (s === 4 || s === 12)) mvoice({ f: 920, dur: 0.05, type: 'triangle', gain: 0.04 * pres(0.5), out: musicDrum, t: tt });
      if (pres(0.8) > 0.02 && s === 0) mKick({ t: tt, gain: 0.2 * pres(0.8), f0: 100, f1: 58, dur: 0.18, click: 0 });
    } else if (K === 'synthwave') {
      if (pres(0.3) > 0.02 && s === 0) mKick({ t: tt, gain: 0.44, f0: T.kf0 || 120, f1: T.kf1 || 40, dur: 0.26, click: 0.07 });
      if (pres(0.6) > 0.02 && s === 8) mKick({ t: tt, gain: 0.38, f0: T.kf0 || 120, f1: T.kf1 || 40, dur: 0.24, click: 0.07 });
      if (pres(0.45) > 0.02 && s === 8) { mSnare(tt, 0.075 * pres(0.45)); mnoise({ t: tt, dur: 0.32, gain: 0.04 * pres(0.45), filter: 'highpass', cutoff: 1400, reverb: 0.8, out: musicDrum }); }
      if (pres(0.6) > 0.02 && (s === 4 || s === 12)) mHat({ t: tt, open: false, gain: 0.016 * pres(0.6), cut: 5800 });
      if (pres(0.8) > 0.02 && phraseEnd && s >= 12) { for (var k = 0; k < 3; k++) mTom({ t: tt + k * 0.06, f0: 210 - k * 30, f1: 110, dur: 0.18, gain: 0.07 }); }
    } else if (K === 'epic') {
      if (pres(0.25) > 0.02 && (s === 0 || s === 8)) mTom({ t: tt, f0: 135, f1: 72, dur: 0.38, gain: 0.34 * (s === 0 ? 1 : pres(0.25)) });
      if (pres(0.5) > 0.02 && (s === 4 || s === 6 || s === 12 || s === 14)) mTom({ t: tt, f0: 190, f1: 110, dur: 0.22, gain: 0.17 * pres(0.5) });
      if (pres(0.7) > 0.02 && phraseEnd && s >= 8) mnoise({ t: tt, dur: 0.1, gain: 0.03 * pres(0.7), filter: 'bandpass', cutoff: 1800, q: 0.7, reverb: 0.3, out: musicDrum });
      if (pres(0.85) > 0.02 && phraseEnd && s >= 12) mTom({ t: tt, f0: 240, f1: 120, dur: 0.15, gain: 0.18 * pres(0.85) });
    } else if (K === 'tactical') {
      if (pres(0.3) > 0.02 && (s === 0 || s === 8)) mKick({ t: tt, gain: 0.4 * (s === 0 ? 1 : pres(0.3)), f0: T.kf0 || 110, f1: T.kf1 || 44, dur: 0.16, click: 0.12 });
      if (pres(0.4) > 0.02 && (s === 4 || s === 12)) mSnare(tt, 0.09 * pres(0.4));
      if (pres(0.45) > 0.02 && s % 2 === 0) mHat({ t: tt, open: false, gain: 0.014 * pres(0.45), cut: 8500, pan: (s % 4 ? 0.1 : -0.1) });
      if (pres(0.65) > 0.02 && s % 2 === 1) mHat({ t: tt, open: false, gain: 0.01 * pres(0.65), cut: 9000 });
      if (pres(0.6) > 0.02 && (s === 7 || s === 11)) mnoise({ t: tt, dur: 0.04, gain: 0.03 * pres(0.6), filter: 'highpass', cutoff: 3200, out: musicDrum });
      if (pres(0.8) > 0.02 && phraseEnd && s >= 12) { for (var kk = 0; kk < 4; kk++) mnoise({ t: tt + kk * 0.04, dur: 0.035, gain: 0.045 * pres(0.8), filter: 'highpass', cutoff: 2400, out: musicDrum }); }
    }
  }

  function enhStep(T, step, tt) {
    var I = musInt, spb = 60 / T.bpm / 4, s = step % 16, bar = Math.floor(step / 16), L = T.scale.length;
    var chord = T.prog[bar % T.prog.length], nextChord = T.prog[(bar + 1) % T.prog.length], phraseEnd = (bar % 4 === 3);
    var cutoff = T.cutoff * (0.55 + 0.75 * I);
    var banger = T.groove === 'banger', rave = T.groove === 'rave', trance = T.groove === 'trance', tactical = T.groove === 'tactical';
    var lush = T.prod === 'lush', pump = rave || trance, padOut = pump ? musicPad : musicGain;
    var swing = (s % 2 === 1) ? spb * (T.swing || 0) * 4 : 0;
    // pads
    if (s === 0) {
      var padSwell = 0.55 + 0.45 * I;   // pads swell with intensity so calm passages actually feel calmer
      var pDur = banger ? spb * 2.5 : (tactical ? spb * 3 : spb * 16), pGain = (banger ? 0.045 : (tactical ? 0.03 : 0.026)) * padSwell, pAtk = banger ? 0.005 : (tactical ? 0.01 : 0.4);
      var vs = [chord, chord + 2, chord + 4]; if (lush) vs.push(chord + 7);
      vs.forEach(function (d) { var f = NT(T.root, T.scale, d); if (!f) return; mvoice({ f: f, dur: pDur, type: T.pad, gain: pGain, attack: pAtk, filter: 'lowpass', cutoff: cutoff * (banger ? 1 : 0.75), reverb: lush ? 0.7 : (banger ? 0.16 : 0.45), out: padOut, t: tt }); });
      var choirG = 0.033 * pres(0.5);   // epic choir now FADES IN with intensity (was always-on → epic tracks felt static)
      if (T.choir && choirG > 0.001) [chord, chord + 2, chord + 4].forEach(function (d, i) { var cf = NT(T.root, T.scale, d + L); if (cf) mSuper({ f: cf, dur: spb * 10, type: 'sine', gain: choirG, voices: 3, spread: 8, attack: 0.6, filter: 'lowpass', cutoff: 2200, reverb: 0.75, pan: (i - 1) * 0.4, t: tt }); });
      var swellG = 0.03 * pres(0.4);    // lush swell also builds with intensity
      if (lush && swellG > 0.001) { var wf = NT(T.root, T.scale, chord + 4 + L); if (wf) mvoice({ f: wf, dur: spb * 14, type: 'sine', gain: swellG, attack: 2.2, filter: 'lowpass', cutoff: 3200, reverb: 0.7, delay: 0.3, t: tt }); }
    }
    if (banger && pres(0.5) > 0.02 && (s === 6 || s === 14)) [chord, chord + 2, chord + 4].forEach(function (d) { var f = NT(T.root, T.scale, d + L); if (f) mvoice({ f: f, dur: spb * 1.3, type: T.pad, gain: 0.03 * pres(0.5), attack: 0.004, filter: 'lowpass', cutoff: cutoff, reverb: 0.12, pan: 0.1, t: tt }); });
    // bass
    if (banger) {
      if (s % 2 === 0) { var hi = ((s / 2) % 2 === 1); var deg = (s === 8 ? (phraseEnd ? nextChord : chord) : chord) + (hi ? L : 0); var bbf = NT(T.root / 2, T.scale, deg); if (bbf) mvoice({ f: bbf, dur: spb * 1.7, type: T.bass, gain: 0.15, filter: 'lowpass', cutoff: 520 + I * 540, q: 5, t: tt }); }
    } else if (trance) {
      if (s % 8 === 0) { var abf = NT(T.root / 2, T.scale, chord); if (abf) mvoice({ f: abf, dur: spb * 1.2, type: T.bass, gain: 0.09, filter: 'lowpass', cutoff: 420, t: tt }); }
      if (s % 4 !== 0) { var rbf = NT(T.root / 2, T.scale, (s >= 8 && phraseEnd) ? nextChord : chord); if (rbf) mvoice({ f: rbf, dur: spb * 0.9, type: T.bass, gain: 0.12, filter: 'lowpass', cutoff: 480 + I * 520, q: 6, t: tt }); }
    } else if (tactical) {
      var bpat = [0, 0, 4, 0, 0, 3, 4, 2];
      if (s % 2 === 0) { var bd0 = chord + bpat[(s / 2) % 8]; var pbf = NT(T.root / 2, T.scale, bd0); if (pbf) mvoice({ f: pbf, dur: spb * 0.7, type: T.bass, gain: 0.11, filter: 'lowpass', cutoff: 460 + I * 340, q: 6, t: tt }); }
      if (s === 0) { var laf = NT(T.root / 2, T.scale, chord); if (laf) mvoice({ f: laf, dur: spb * 2.5, type: 'sawtooth', gain: 0.05, attack: 0.04, filter: 'lowpass', cutoff: 300, t: tt }); }
    } else {
      if (s % 4 === 0) { var bd = (s === 0) ? chord : (s === 8 ? (phraseEnd ? nextChord : chord + 4) : chord); var bf = NT(T.root / 2, T.scale, bd);
        if (bf) { if (T.bassSuper) mSuper({ f: bf, dur: spb * 3.2, type: T.bass, gain: 0.1, voices: 3, spread: 9, filter: 'lowpass', cutoff: 430 + I * 320, q: 6, out: padOut, t: tt }); else mvoice({ f: bf, dur: spb * (T.halftime ? 3.6 : 3.2), type: T.bass, gain: 0.16, filter: 'lowpass', cutoff: 500 + I * 380, q: 4, out: padOut, t: tt }); } }
      if (rave && pres(0.65) > 0.02 && (s === 6 || s === 14)) { var bf2 = NT(T.root / 2, T.scale, chord); if (bf2) mvoice({ f: bf2, dur: spb * 1.4, type: T.bass, gain: 0.09 * pres(0.65), filter: 'lowpass', cutoff: 640, out: padOut, t: tt }); }
    }
    perc(T, pump, s, phraseEnd, tt);
    // lead / arp
    if (banger && pres(0.45) > 0.02) {
      var shp = [0, 2, 4, 7, 4, 2, 7, 4], baf = NT(T.root, T.scale, chord + L + shp[step % shp.length]), bg = pres(0.45);
      if (baf) { mvoice({ f: baf, dur: spb * 1.1, type: T.lead, gain: 0.075 * bg, filter: 'lowpass', cutoff: cutoff + 500, reverb: 0.15, delay: 0.18, pan: (step % 2 ? 0.14 : -0.14), t: tt }); if (pres(0.7) > 0.02) mvoice({ f: baf * 2, dur: spb * 0.5, type: 'square', gain: 0.016 * pres(0.7), filter: 'lowpass', cutoff: 6500, pan: 0.2, t: tt }); }
    } else if (rave && pres(0.5) > 0.02) {
      var at = [chord + L, chord + 2 + L, chord + 4 + L, chord + 2 + L], af = NT(T.root, T.scale, at[step % at.length] + (pres(0.7) > 0.5 && (step % 8 >= 4) ? L : 0)), rg = pres(0.5);
      if (af) { if (T.leadSuper) mSuper({ f: af, dur: spb * 1.4, type: T.lead, gain: 0.05 * rg, voices: 5, spread: T.detune || 16, filter: 'lowpass', cutoff: cutoff, q: 3, reverb: 0.2, delay: 0.28, pan: (step % 2 ? 0.25 : -0.25), t: tt + swing }); else mvoice({ f: af, dur: spb * 1.2, type: T.lead, gain: 0.055 * rg, filter: 'lowpass', cutoff: cutoff, reverb: 0.25, delay: 0.28, pan: (step % 2 ? 0.2 : -0.2), t: tt + swing }); }
    } else if (trance && pres(0.45) > 0.02) {
      var tshp = [0, 2, 4, 7, 9, 7, 4, 2], taf = NT(T.root, T.scale, chord + L + tshp[step % tshp.length]);
      if (taf) mSuper({ f: taf, dur: spb * 1.6, type: T.lead, gain: 0.05 * pres(0.45), voices: 5, spread: T.detune || 14, filter: 'lowpass', cutoff: cutoff + 300, q: 2, reverb: 0.35, delay: 0.3, pan: (step % 2 ? 0.22 : -0.22), t: tt + swing });
    } else if (tactical && pres(0.45) > 0.02) {
      var mshp = [0, 3, 0, 4, 0, 3, 0, 5]; if (s % 2 === 0) { var saf = NT(T.root, T.scale, chord + L + mshp[step % mshp.length]); if (saf) mvoice({ f: saf, dur: spb * 0.55, type: 'sawtooth', gain: 0.05 * pres(0.45), attack: 0.003, filter: 'lowpass', cutoff: cutoff, q: 5, reverb: 0.08, pan: (step % 2 ? 0.1 : -0.1), t: tt }); }
      if (phraseEnd && pres(0.7) > 0.02 && s === 12) { var r1 = NT(T.root, T.scale, chord + L), r2 = NT(T.root, T.scale, chord + L + 5); if (r1 && r2) mvoice({ f: r1, slideTo: r2, dur: spb * 3, type: 'sawtooth', gain: 0.04, filter: 'lowpass', cutoff: 1400, cutoffTo: 3400, q: 7, reverb: 0.2, t: tt }); }
    } else if (pres(0.45) > 0.02) {
      if (T.pluck ? (s % 2 === 0) : (s % 4 === 0)) {
        var tones = [chord + L, chord + 2 + L, chord + 4 + L];
        if (s === 0 || Math.random() < 0.4) _mtMel = NEAR(_mtMel, tones); else { var stp = [-2, -1, -1, 1, 1, 2]; _mtMel += stp[(Math.random() * stp.length) | 0]; }
        _mtMel = Math.max(L, Math.min(L * 2 + 4, _mtMel));
        var chance = (T.pluck ? (0.4 + I * 0.5) : (0.5 + I * 0.4)) * pres(0.45);
        if (Math.random() < chance) {
          var lf = NT(T.root, T.scale, _mtMel), base = T.pluck ? spb * 1.5 : spb * 4, ldur = base * (T.softLead ? 1.6 : 1), atk = T.pluck ? 0.004 : (T.softLead ? 0.12 : 0.02), lg = pres(0.45);
          if (T.leadSuper) mSuper({ f: lf, dur: ldur, type: T.lead, gain: 0.06 * lg, voices: 4, spread: T.detune || 14, filter: 'lowpass', cutoff: cutoff, reverb: lush ? 0.6 : 0.4, delay: 0.18, pan: 0.1, t: tt + swing });
          else { mvoice({ f: lf, dur: ldur, type: T.lead, gain: 0.085 * lg, attack: atk, filter: 'lowpass', cutoff: cutoff, reverb: (lush ? 0.5 : 0.3) * 0.8, delay: 0.18, vibrato: T.vibrato || 0, vibratoDepth: 5, pan: 0.08, t: tt + swing });
            mvoice({ f: lf, dur: ldur, type: T.lead, gain: 0.04 * lg, detune: T.pluck ? 6 : 9, attack: atk, filter: 'lowpass', cutoff: cutoff, pan: -0.08, t: tt + swing }); }
        }
      }
    }
    if (T.riser && phraseEnd && s === 8) mvoice({ f: 400, slideTo: 2400, dur: spb * 8, type: 'sawtooth', gain: 0.03, filter: 'lowpass', cutoff: 1000, cutoffTo: 6000, q: 4, reverb: 0.4, t: tt });
  }

  // Snake "remaster" — today's neon banger, enriched (real drums + sub + stereo + delay), intensity-gated.
  function snakeStep(T, step, tt) {
    var I = musInt, spb = 60 / T.bpm / 2, s = step % 8, bar = Math.floor(step / 8), L = T.scale.length;
    var chord = T.prog[bar % T.prog.length], nextChord = T.prog[(bar + 1) % T.prog.length], phraseEnd = (bar % 4 === 3);
    var cutoff = T.cutoff * (0.7 + 0.5 * I), tones = [chord + L, chord + 2 + L, chord + 4 + L];
    if (s === 0) { [chord, chord + 2, chord + 4].forEach(function (d) { var f = NT(T.root, T.scale, d); if (f) mvoice({ f: f / 2, dur: spb * 8.2, type: 'sine', gain: 0.026, attack: 0.25, filter: 'lowpass', cutoff: 1100, reverb: 0.4, t: tt }); });
      var sf = NT(T.root / 4, T.scale, chord); if (sf) mvoice({ f: sf, dur: spb * 8, type: 'sine', gain: 0.09, attack: 0.2, filter: 'lowpass', cutoff: 220, t: tt }); }
    if (s === 0) mvoice({ f: NT(T.root / 2, T.scale, chord), dur: spb * 2.4, type: 'square', gain: 0.16, filter: 'lowpass', cutoff: 600 + I * 320, q: 3, t: tt });
    else if (s === 4) mvoice({ f: NT(T.root / 2, T.scale, phraseEnd ? nextChord : chord + 4), dur: spb * 2.2, type: 'square', gain: 0.14, filter: 'lowpass', cutoff: 600 + I * 320, q: 3, t: tt });
    else if (s === 6) mvoice({ f: NT(T.root / 2, T.scale, chord), dur: spb * 1.2, type: 'square', gain: 0.09, filter: 'lowpass', cutoff: 560, t: tt });
    if (pres(0.2) > 0.02 && s % 4 === 0) mKick({ t: tt, gain: 0.42 * pres(0.2), f0: 150, f1: 48, dur: 0.14, click: 0.14 });
    if (pres(0.45) > 0.02 && (s === 2 || s === 6)) mClap(tt, 0.038 * pres(0.45));
    if (pres(0.35) > 0.02 && s % 2 === 1) mHat({ t: tt, open: false, gain: 0.015 * pres(0.35), cut: 9500, pan: (s % 4 === 1 ? 0.12 : -0.12) });
    if (pres(0.7) > 0.02 && s === 7) mHat({ t: tt, open: true, gain: 0.018 * pres(0.7), cut: 8000, dur: 0.07 });
    if (pres(0.8) > 0.02 && phraseEnd && s >= 6) mnoise({ t: tt, dur: 0.05, gain: 0.028 * pres(0.8), filter: 'highpass', cutoff: 3000, out: musicDrum });
    var dens = (0.6 + (phraseEnd ? 0.18 : 0) + (s === 0 ? 0.25 : 0)) * (0.5 + 0.6 * I);
    if (Math.random() < dens) {
      if (s === 0 || Math.random() < 0.35) _mtMel = NEAR(_mtMel, tones); else { var steps = [-2, -1, -1, 1, 1, 2]; _mtMel += steps[(Math.random() * steps.length) | 0]; }
      _mtMel = Math.max(L, Math.min(L * 2 + 3, _mtMel));
      var lf = NT(T.root, T.scale, _mtMel), ldur = (Math.random() < 0.25 ? spb * 0.55 : spb * 1.35);
      mvoice({ f: lf, dur: ldur, type: 'square', gain: 0.1, attack: 0.006, filter: 'lowpass', cutoff: cutoff, reverb: 0.28, delay: 0.14, pan: 0.1, t: tt });
      mvoice({ f: lf, dur: ldur, type: 'square', gain: 0.045, detune: 9, attack: 0.006, filter: 'lowpass', cutoff: cutoff, pan: -0.1, t: tt });
      if (I >= 0.75) mvoice({ f: lf * 2, dur: ldur * 0.8, type: 'square', gain: 0.02, attack: 0.006, filter: 'lowpass', cutoff: 6000, pan: 0.25, t: tt });
    }
  }

  function resolveTrack(key) { return TRACKS[key] || TRACKS[ALIAS[key]] || null; }
  // Start the scheduler — only once the context exists AND is running (the gesture unlock owns creation).
  function startScheduler() {
    if (_mt || !curTrack) return;
    if (!ac || ac.state !== 'running') return;
    _mtNext = ac.currentTime + 0.06;
    _mt = setInterval(function () {
      if (!ac || !curTrack) return;
      if (ac.state !== 'running') { _mtNext = ac.currentTime + 0.06; return; }
      musInt += (musIntTarget - musInt) * 0.06;   // ease intensity toward the game's target (smooth builds)
      var T = curTrack, eight = T.kind === 'remaster', spb = eight ? 60 / T.bpm / 2 : 60 / T.bpm / 4, guard = 0;
      while (_mtNext < ac.currentTime + 0.14 && guard++ < 64) { if (eight) snakeStep(T, _mtStep, _mtNext); else enhStep(T, _mtStep, _mtNext); _mtStep++; _mtNext += spb; }
    }, 25);
  }
  function _startTrack(T, key) { curTrack = T; curKey = key; _mtStep = 0; _mtMel = T.scale.length + 3; startScheduler(); }
  function musicPlay(key) { var T = resolveTrack(key); if (!T) return; _prev = false; _startTrack(T, key); }
  function musicStop() { if (_mt) { try { clearInterval(_mt); } catch (e) {} _mt = null; } curTrack = null; curKey = null; _prev = false; }
  // Preview (shop): play a track on demand without losing the game's music state; audible even if muted.
  function musicPreview(key) {
    var T = resolveTrack(key); if (!T) return;
    if (!_prev) _prevKey = curKey;
    _prev = true; musIntTarget = 0.6; musInt = 0.6;
    ensureAC(); if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    if (musMuted && musicGain) musicGain.gain.value = musVol;
    _startTrack(T, key);
  }
  function musicStopPreview() {
    if (!_prev) return; _prev = false;
    if (musicGain) musicGain.gain.value = musMuted ? 0 : musVol;
    if (_prevKey) { var T = resolveTrack(_prevKey); if (T) { _startTrack(T, _prevKey); return; } }
    musicStop();
  }

  // Music channel: kit owns settings + UI + the generative engine.
  var music = {
    isMuted: function () { return musMuted; },
    volume: function (v) { if (v === undefined) return musVol; musVol = clamp01(v, musVol); lsSet(MUS_V, String(musVol)); if (musicGain && !_prev) musicGain.gain.value = musMuted ? 0 : musVol; syncAudioUI(); notifyMusic(); },
    gain: function () { return musMuted ? 0 : musVol; },
    setMuted: function (m) { musMuted = !!m; lsSet(MUS_M, musMuted ? '1' : '0'); if (musicGain && !_prev) musicGain.gain.value = musMuted ? 0 : musVol; syncAudioUI(); notifyMusic(); },
    toggle: function () { musMuted = !musMuted; lsSet(MUS_M, musMuted ? '1' : '0'); if (musicGain && !_prev) musicGain.gain.value = musMuted ? 0 : musVol; syncAudioUI(); notifyMusic(); trackAudioPref('music', !musMuted, musVol); return musMuted; },
    subscribe: function (cb) { if (typeof cb === 'function') { musicListeners.push(cb); try { cb({ muted: musMuted, volume: musVol, gain: musMuted ? 0 : musVol }); } catch (e) {} } },
    play: musicPlay, stop: musicStop, current: function () { return curKey; }, tracks: TRACKS, themes: TRACKS,
    intensity: function (v) { if (v === undefined) return musInt; musIntTarget = clampN(v); return musIntTarget; },
    preview: musicPreview, stopPreview: musicStopPreview,
  };

  // ---------- in-page confirm dialog (replaces the browser confirm()) ----------
  // confirmDialog(msg, onYes[, yesLabel][, onCancel]) — yesLabel defaults to 'OK'; onCancel fires on
  // Cancel / overlay-click / Esc. Fully keyboard-steerable: ←/→ (or Tab) move between Cancel/Leave,
  // Enter/Space activate the focused button (default = Cancel, the safe choice), Esc cancels. It's a
  // MODAL — while open it owns the keyboard (_modalOpen gates the menu engine; events are stopped so
  // nothing behind it reacts).
  var _modalOpen = 0;
  // every _modalOpen change goes through these so the shared pause veil stays in sync
  function modalInc() { _modalOpen++; syncPauseVeil(); }
  function modalDec() { _modalOpen = Math.max(0, _modalOpen - 1); syncPauseVeil(); }
  // ---- the ONE in-play pause veil ----
  // Whenever gameplay is halted by an open panel/modal (sound, ☰, side stack, controls, challenges,
  // shop…) the frozen game stays visible under a light "⏸ PAUSED" splash (~30% dim, no blur — the
  // player can read the field and plan the next input). It sits UNDER whatever caused the pause
  // (z 30) and never eats clicks, so click-outside-to-close keeps working. Game pages only (nav()
  // sets _navMounted); kit menus have their own screens, so no veil while one is open.
  var _navMounted = false, _pauseVeil = null;
  function syncPauseVeil() {
    try {
      var want = _navMounted && !_menuEl && _modalOpen > 0;
      if (want && !_pauseVeil) {
        if (typeof document === 'undefined' || !document.body || !document.createElement) return;
        _pauseVeil = document.createElement('div'); _pauseVeil.className = 'gamekit-pauseveil';
        _pauseVeil.innerHTML = '<div class="gkpv"><div class="gkpv-ico">⏸</div><div>' + t('pause.paused') + '</div></div>';
        document.body.appendChild(_pauseVeil);
      }
      if (_pauseVeil && _pauseVeil.classList) _pauseVeil.classList.toggle('show', want);
    } catch (e) {}
  }
  var _confirmOn = false; // one confirm at a time — repeated clicks must not stack overlays
  function confirmDialog(msg, onYes, yesLabel, onCancel, opts) {
    if (typeof document === 'undefined' || !document.body) { if (onYes) onYes(); return; }
    if (_confirmOn) return;
    _confirmOn = true;
    var holdMs = (opts && +opts.hold) || 0; // destructive confirms: press-and-HOLD the yes button
    var ov = document.createElement('div'); ov.className = 'gamekit-confirm';
    ov.innerHTML = '<div class="gamekit-confirm-box"><p>' + msg + '</p><div class="gamekit-confirm-btns">'
      + '<button class="gamekit-cf-no" type="button">' + t('confirm.cancel') + '</button>'
      + '<button class="gamekit-cf-yes' + (holdMs ? ' gkm-cf-hold' : '') + '" type="button">' + (yesLabel || t('confirm.ok')) + '</button></div></div>';
    applyMenuTheme(ov, opts && opts.theme); // match the game's menu look (falls back to the neutral kit palette)
    document.body.appendChild(ov);
    var no = ov.querySelector ? ov.querySelector('.gamekit-cf-no') : null;
    var yes = ov.querySelector ? ov.querySelector('.gamekit-cf-yes') : null;
    var btns = [no, yes], fi = 0; // 0 = Cancel (default focus), 1 = yes/Leave
    function paint() { for (var i = 0; i < btns.length; i++) if (btns[i] && btns[i].classList) btns[i].classList.toggle('gkm-cf-focus', i === fi); }
    var done = false;
    var hTimer = 0, hStart = 0;
    function setHoldFill(p) { try { if (yes && yes.style && yes.style.setProperty) yes.style.setProperty('--gk-hold', Math.round(p * 100) + '%'); } catch (e) {} }
    function stopHold() { if (hTimer) { clearInterval(hTimer); hTimer = 0; } setHoldFill(0); }
    function startHold() {
      if (done || hTimer || typeof setInterval !== 'function') return;
      hStart = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
      hTimer = setInterval(function () {
        var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : hStart + holdMs;
        var p = Math.min(1, (now - hStart) / holdMs);
        setHoldFill(p);
        if (p >= 1) { stopHold(); finish(onYes); }
      }, 50);
    }
    function finish(cb) {
      if (done) return; done = true; _confirmOn = false; modalDec();
      stopHold();
      try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
      try { document.removeEventListener('keyup', onKeyUp, true); } catch (e) {}
      try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
      if (cb) try { cb(); } catch (e) {}
    }
    function onKey(e) {
      if (!e || done) return;
      if (e.preventDefault) e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation(); else if (e.stopPropagation) e.stopPropagation();
      var k = e.key;
      if (k === 'Escape' || k === 'Esc') finish(onCancel);
      else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        if (fi !== 1) finish(onCancel);
        else if (holdMs) startHold(); // hold the key down for the full duration (keyup cancels)
        else finish(onYes);
      }
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'a' || k === 'A' || k === 'w' || k === 'W') { fi = 0; paint(); }
      else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'd' || k === 'D' || k === 's' || k === 'S' || k === 'Tab') { fi = (fi + 1) % 2; paint(); }
    }
    function onKeyUp(e) { if (!e || done) return; var k = e.key; if (k === 'Enter' || k === ' ' || k === 'Spacebar') stopHold(); }
    if (no) { no.addEventListener('click', function () { finish(onCancel); }); no.addEventListener('mouseenter', function () { fi = 0; paint(); }); }
    if (yes) {
      if (holdMs) {
        var press = function (e) { if (e && e.preventDefault) e.preventDefault(); fi = 1; paint(); startHold(); };
        var release = function () { stopHold(); };
        yes.addEventListener('pointerdown', press);
        yes.addEventListener('pointerup', release);
        yes.addEventListener('pointerleave', release);
        yes.addEventListener('touchstart', press);
        yes.addEventListener('touchend', release);
        yes.addEventListener('touchcancel', release);
      } else {
        yes.addEventListener('click', function () { finish(onYes); });
      }
      yes.addEventListener('mouseenter', function () { fi = 1; paint(); });
    }
    ov.addEventListener('click', function (e) { if (e && e.target === ov) finish(onCancel); });
    paint();
    modalInc();
    if (typeof document.addEventListener === 'function') { document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKeyUp, true); }
  }

  // ---------- embed modal (iframe snippet) — used by the per-game nav button + catalogue menu ----------
  function embedSnippet(slug, title) {
    var t = String(title || 'Komyo Games').replace(/"/g, '&quot;');
    // slug '' (or falsy) → embed the whole arcade catalogue; otherwise a single game
    var src = slug ? ('https://komyo.online/games/' + slug + '/') : 'https://komyo.online/';
    return '<iframe src="' + src + '" width="480" height="720" loading="lazy" style="max-width:100%;border:0;border-radius:12px" title="' + t + ' — Komyo Games"></iframe>';
  }
  // opts: { slug, title } for one game, OR { games: [{slug,title}, …] } for a picker.
  function embedModal(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return;
    var games = opts.games || (opts.slug ? [{ slug: opts.slug, title: opts.title || (typeof document !== 'undefined' && document.title) || opts.slug }] : []);
    if (!games.length) return;
    var ov = document.createElement('div'); ov.className = 'gamekit-embed';
    var picker = games.length > 1 ? '<select class="gamekit-embed-sel" aria-label="' + t('embed.pick') + '">' + games.map(function (g, i) { return '<option value="' + i + '">' + (g.icon ? g.icon + ' ' : '') + (g.title || g.slug) + '</option>'; }).join('') + '</select>' : '';
    ov.innerHTML = '<div class="gamekit-embed-box"><button class="gamekit-embed-x" type="button" aria-label="' + t('menu.close') + '">✕</button>'
      + '<h3>' + (games.length > 1 ? t('embed.titleGame') : t('embed.titleThis')) + '</h3>'
      + '<p>' + t('embed.body') + '</p>'
      + picker
      + '<textarea class="gamekit-embed-code" readonly rows="4"></textarea>'
      + '<button class="gamekit-embed-copy" type="button">' + t('embed.copyCode') + '</button></div>';
    document.body.appendChild(ov);
    modalInc(); // open overlay → halts the game underneath
    var sel = ov.querySelector ? ov.querySelector('.gamekit-embed-sel') : null;
    var code = ov.querySelector ? ov.querySelector('.gamekit-embed-code') : null;
    var copy = ov.querySelector ? ov.querySelector('.gamekit-embed-copy') : null;
    var setCode = function () { var g = games[(sel ? (sel.value | 0) : 0)] || games[0]; if (code) code.value = embedSnippet(g.slug, g.title); };
    setCode();
    if (sel) sel.addEventListener('change', setCode);
    var closed = false;
    var close = function () { if (closed) return; closed = true; modalDec(); try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} };
    var xb = ov.querySelector ? ov.querySelector('.gamekit-embed-x') : null; if (xb) xb.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    if (copy) copy.addEventListener('click', function () {
      try {
        if (code && code.select) code.select();
        if (navigator.clipboard) navigator.clipboard.writeText(code ? code.value : '').then(function () { copy.textContent = t('embed.copied'); setTimeout(function () { copy.textContent = t('embed.copyCode'); }, 1500); })['catch'](function () {});
      } catch (e) {}
    });
  }

  // ---------- controls board (top-bar 🎮 button → modal) ----------
  // controlsModal(cfg[, theme]): cfg.title?, cfg.note?, and rows in cfg.keyboard / cfg.touch — each row is
  // [keys, action]. Renders a per-section list; scrolls for games with lots of controls. Modal (gates the
  // menu engine + Esc-closes). Available on the menu AND mid-play, so it's the in-game reference too.
  function controlsModal(cfg, theme) {
    cfg = cfg || {};
    if (typeof document === 'undefined' || !document.body) return;
    var sec = function (label, rows) {
      if (!rows || !rows.length) return '';
      return '<div class="gkctl-sec">' + label + '</div>' + rows.map(function (r) {
        return '<div class="gkctl-row"><span class="gkctl-keys">' + r[0] + '</span><span class="gkctl-act">' + r[1] + '</span></div>';
      }).join('');
    };
    var ov = document.createElement('div'); ov.className = 'gamekit-controls';
    ov.innerHTML = '<div class="gkctl-box"><button class="gkctl-x" type="button" aria-label="' + t('menu.close') + '">&#x2715;</button>'
      + '<div class="gkctl-scroll"><h3>' + (cfg.title || t('controls.title')) + '</h3>'
      + sec('⌨️ ' + t('controls.keyboard'), cfg.keyboard) + sec('🖱️ ' + t('controls.mouse'), cfg.mouse) + sec('👆 ' + t('controls.touch'), cfg.touch)
      + (cfg.note ? '<p class="gkctl-note">' + cfg.note + '</p>' : '') + '</div></div>';
    if (theme) applyMenuTheme(ov, theme);
    document.body.appendChild(ov);
    modalInc(); // counts as an open overlay → isPaused() halts the game underneath
    var done = false;
    function close() { if (done) return; done = true; modalDec(); try { document.removeEventListener('keydown', onKey, true); } catch (e) {} try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} }
    function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); close(); } }
    var x = ov.querySelector ? ov.querySelector('.gkctl-x') : null; if (x) x.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
  }

  // ---------- about / how-to board (the game's SEO section → ☰ menu modal) ----------
  // A game ships a static, crawlable <section id="gk-about" hidden> in its HTML (title, how to
  // play, FAQ, related-game links) — raw-HTML crawlers read the English source; the kit localizes
  // it in place for players and rendering crawlers, and lifts a copy into this modal from the
  // ☰ "ℹ️ How to play" entry. One source of truth for players AND search engines.
  function aboutSection() { try { return document.getElementById ? document.getElementById('gk-about') : null; } catch (e) { return null; } }
  function aboutTranslate() {
    var sec = aboutSection(); if (!sec || !sec.querySelectorAll) return;
    var els = sec.querySelectorAll('[data-t]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-t'), v = k ? t(k) : null;
      if (v && v !== k) els[i].textContent = v; // untranslated key → keep the English source text
    }
  }
  function aboutModal(theme) {
    var sec = aboutSection();
    if (!sec || typeof document === 'undefined' || !document.body) return;
    var ov = document.createElement('div'); ov.className = 'gamekit-controls gamekit-about';
    ov.innerHTML = '<div class="gkctl-box"><button class="gkctl-x" type="button" aria-label="' + t('menu.close') + '">&#x2715;</button>'
      + '<div class="gkctl-scroll gk-about-body">' + sec.innerHTML + '</div></div>';
    if (theme) applyMenuTheme(ov, theme);
    document.body.appendChild(ov);
    modalInc(); // counts as an open overlay → isPaused() halts the game underneath
    var done = false;
    function close() { if (done) return; done = true; modalDec(); try { document.removeEventListener('keydown', onKey, true); } catch (e) {} try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} }
    function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); close(); } }
    var x = ov.querySelector ? ov.querySelector('.gkctl-x') : null; if (x) x.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
  }

  // ---------- reset scores (per-game; clears only keys starting with `prefix`) ----------
  function resetScores(prefix) {
    if (!prefix || typeof localStorage === 'undefined' || typeof localStorage.key !== 'function') return;
    try {
      var keys = [], i;
      for (i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(prefix) === 0) keys.push(k); }
      for (i = 0; i < keys.length; i++) { try { localStorage.removeItem(keys[i]); } catch (e) {} }
      // also drop this game's bests/plays from the unified profile store, so the two never diverge
      var slug = prefix.replace(/_+$/, ''), pb = pbLoad();
      if (pb[slug]) { delete pb[slug]; lsSet('gamekit_pb', JSON.stringify(pb)); }
    } catch (e) {}
  }

  // ---------- player display name (optional; used for Discord score posts) ----------
  var NAME = 'gamekit_name';
  // Default display name is a random, family-friendly nickname (not the player's identity), assigned
  // once per device and persisted. Players can change it in the menu; clearing it picks a new one.
  var FN_ADJ = ['Sneaky', 'Turbo', 'Wobbly', 'Sleepy', 'Cosmic', 'Zippy', 'Fuzzy', 'Jolly', 'Mighty', 'Sparkly', 'Bouncy', 'Speedy', 'Cheeky', 'Brave', 'Silly', 'Groovy', 'Nifty', 'Plucky', 'Dizzy', 'Sunny'];
  var FN_NOUN = ['Otter', 'Pigeon', 'Wizard', 'Narwhal', 'Waffle', 'Pickle', 'Panda', 'Goblin', 'Raccoon', 'Muffin', 'Yeti', 'Llama', 'Ninja', 'Wombat', 'Noodle', 'Penguin', 'Dragon', 'Hamster', 'Robot', 'Taco'];
  function randomName() { return FN_ADJ[Math.floor(Math.random() * FN_ADJ.length)] + ' ' + FN_NOUN[Math.floor(Math.random() * FN_NOUN.length)]; }
  function player() { var n = lsGet(NAME); if (n && n.replace(/\s+/g, '')) return n; var gen = randomName(); lsSet(NAME, gen); return gen; }
  function setName(n) { n = (n == null ? '' : String(n)).replace(/\s+/g, ' ').trim().slice(0, 24); if (!n) n = randomName(); lsSet(NAME, n); return n; }

  // ---------- Discord Activity: served from <app-id>.discordsays.com; external hosts must be reached
  // through the /.proxy/<prefix> mappings declared in the Dev Portal. Detect once, tag <html> so CSS can
  // hide un-proxyable external links, and expose a URL rewriter for our own fetches. Works on the
  // catalogue AND inside a game iframe (both live on discordsays.com). No-op everywhere else. ----------
  var IN_ACTIVITY = false;
  try { IN_ACTIVITY = /(^|\.)discordsays\.com$/i.test(location.hostname); } catch (e) {}
  try { if (IN_ACTIVITY && typeof document !== 'undefined' && document.documentElement) document.documentElement.classList.add('in-activity'); } catch (e) {}
  function proxyUrl(u) {
    if (!IN_ACTIVITY || !u) return u;
    return String(u)
      .replace('https://app.kit.com', '/.proxy/kit')
      .replace('https://api.web3forms.com', '/.proxy/w3f')
      .replace('https://discord.com', '/.proxy/dhook');
  }

  // ---------- post a score to the public Komyo Games Discord (webhook) ----------
  // Three-tier gate for the end-screen AUTO-post (manual share buttons are always user-intent):
  // no cookie consent → nothing is sent at all (the request itself exposes the player's IP to
  // Discord, same class as GA4); consent → posts as "anonymous"; the Settings opt-in
  // (gamekit_discord_name) attaches the device nickname.
  function discordTier() {
    if (lsGet('gamekit_consent') !== 'granted') return 'off';
    return lsGet('gamekit_discord_name') === '1' ? 'named' : 'anon';
  }
  var DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1520515996933296378/YlXg2W8ypFcQGMHRf0BvWxp10-m7Z7DggStKrBZfusWo8e_emNF6gLpiVjfb0YIExL24';
  var _dcLastMsg = '', _dcLastAt = 0; // Discord auto-post dedupe/throttle — module-level so a share-row rebuilt each game-over can't reset it
  function postDiscord(text, url, file) {
    try {
      if (typeof fetch !== 'function' || typeof FormData === 'undefined') return;
      var fd = new FormData();
      // fixed username (no impersonation via override) + no pings (player name/text can't @everyone).
      // With a score-card `file`: Components V2 (verified 2026-07-02) — a MediaGallery with the bare
      // (boxless) card image, then a TextDisplay with the clickable masked play link BELOW it; the
      // only single-message layout Discord renders that way (plain content sits above attachments,
      // embeds draw the quote box, embed footers aren't clickable). Without a file: plain text +
      // masked markdown play link.
      var link = url ? '[▶ Play this game on Komyo](<' + String(url) + '>)' : '';
      var payload = { username: 'Komyo Games', allowed_mentions: { parse: [] } };
      var endpoint = proxyUrl(DISCORD_WEBHOOK);
      if (file) {
        var fname = 'komyo-score.' + (file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : 'png');
        payload.flags = 32768; // IS_COMPONENTS_V2 (content/embeds must stay unset)
        payload.components = [{ type: 12, items: [{ media: { url: 'attachment://' + fname } }] }];
        if (link) payload.components.push({ type: 10, content: link });
        payload.attachments = [{ id: 0, filename: fname }];
        try { fd.append('files[0]', file, fname); } catch (e) {}
        endpoint += (endpoint.indexOf('?') < 0 ? '?' : '&') + 'with_components=true';
      } else {
        payload.content = (String(text || '') + (link ? '\n' + link : '')).slice(0, 1800);
      }
      fd.append('payload_json', JSON.stringify(payload));
      fetch(endpoint, { method: 'POST', body: fd })['catch'](function () {}); // multipart = no CORS preflight; fire-and-forget (proxied in a Discord Activity)
    } catch (e) {}
  }
  // downscaled copy of a card blob for the Discord post (the shared/copied card stays full-res)
  function shrinkBlob(blob, factor) {
    return new Promise(function (res) {
      try {
        var u = URL.createObjectURL(blob), im = new Image();
        im.onload = function () {
          try {
            var cc = document.createElement('canvas');
            cc.width = Math.max(1, Math.round(im.naturalWidth * factor)); cc.height = Math.max(1, Math.round(im.naturalHeight * factor));
            cc.getContext('2d').drawImage(im, 0, 0, cc.width, cc.height); URL.revokeObjectURL(u);
            cc.toBlob(function (b) {
              if (b && b.type === 'image/webp') return res(b);
              cc.toBlob(function (b2) { res(b2 || b || blob); }, 'image/jpeg', 0.85);
            }, 'image/webp', 0.85);
          } catch (e) { res(blob); }
        };
        im.onerror = function () { try { URL.revokeObjectURL(u); } catch (e) {} res(blob); };
        im.src = u;
      } catch (e) { res(blob); }
    });
  }

  // ---------- per-game results + per-day activity log (powers challenges + score cards) ----------
  function nowMs() { try { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; } catch (e) { return 0; } }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function utcDateStr(ms) { try { var d = (ms != null) ? new Date(ms) : new Date(); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); } catch (e) { return '1970-01-01'; } }
  // whole UTC days since epoch — the stable, timezone-independent key for "same challenge for everyone".
  function utcDayNumber(ms) { try { var d = (ms != null) ? new Date(ms) : new Date(); return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000); } catch (e) { return 0; } }
  function emptyLog() { return { slugs: [], totalScore: 0, count: 0, goodRuns: 0 }; }
  // per-game "good run" bar — a run at/above this counts as one good run toward cross-game goals.
  // Keeps cross goals FAIR across wildly different score scales (a run is one good run, never more),
  // so a single big-score game (e.g. Asteroids+) can't single-handedly complete a weekly goal.
  // The table itself lives in challenges.js (CHALLENGES.goodRun) — data with the other challenge
  // knobs, loaded by the catalogue AND every game, and part of the new-game wiring checklist.
  function chGoodRun(slug) { var C = chGoals(); return (slug && C && C.goodRun && C.goodRun[slug]) || 0; }

  // ---------- good-run trophy trickle: +5 🏆 per good run, capped at 3/day ----------
  // Earned trophies live as one per-day entry in gamekit_done ('gr#YYYY-MM-DD') so lifetime,
  // titles and the spendable cosmetics balance all pick them up with zero extra storage.
  var GR_PER = 5, GR_CAP = 3;
  function chDoneMap() { try { return JSON.parse(lsGet('gamekit_done') || 'null') || {}; } catch (e) { return {}; } }
  function grCount(dStr) { return Math.floor(((chDoneMap()['gr#' + (dStr || utcDateStr())]) | 0) / GR_PER); }
  function grAward() {
    try {
      var d = chDoneMap(), k = 'gr#' + utcDateStr(), cur = d[k] | 0;
      if (cur >= GR_PER * GR_CAP) return false;
      d[k] = cur + GR_PER;
      lsSet('gamekit_done', JSON.stringify(d));
      return true;
    } catch (e) { return false; }
  }
  function goodRunBonus() { return { count: grCount(), cap: GR_CAP, per: GR_PER }; }
  // the good-run bonus as a centered VISUAL widget (bolt pips that light up as they're earned) —
  // ONE builder shared by the catalogue drawer and the in-game 🏆 panel so they can't drift
  function grbHtml() {
    var b = goodRunBonus(), pips = '';
    for (var i = 0; i < b.cap; i++) pips += '<span class="gk-grb-pip' + (i < b.count ? ' on' : '') + '">⚡</span>';
    return '<div class="gk-grb"><span class="gk-grb-head">' + t('grb.head') + '</span>'
      + '<span class="gk-grb-pips">' + pips + '</span>'
      + '<span class="gk-grb-sub">' + t('grb.sub', { per: b.per }) + '</span></div>';
  }
  var _grAwarded = false; // did the LAST recorded result earn the trickle? (end-menu receipt)

  // ---------- cosmetics (registry data in cosmetics.js; the kit owns storage + the economy) ----------
  // Two metrics: LIFETIME trophies = Σ gamekit_done (only ever grows; titles read this) and the
  // SPENDABLE balance = lifetime − Σ owned costs — derived, never stored, so it can't drift.
  // gamekit_owned = { itemId: { c: cost, t: utcDay } }; free defaults are implicit (never stored).
  // Per-set selection lives in gamekit_cos_sel = { setId: itemId } (per-device, rides Export/Import).
  function cosReg() { return (typeof window !== 'undefined' && window.COSMETICS) ? window.COSMETICS : null; }
  function cosItems() { var C = cosReg(); return (C && C.items) || []; }
  function cosItem(id) { var a = cosItems(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function cosOwnedMap() { try { return JSON.parse(lsGet('gamekit_owned') || 'null') || {}; } catch (e) { return {}; } }
  function cosLifetime() { var d = chDoneMap(), t = 0; for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) t += (d[k] | 0); return t; }
  function cosSpent() { var o = cosOwnedMap(), t = 0; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) t += ((o[k] && o[k].c) | 0); return t; }
  function cosBalance() { return Math.max(0, cosLifetime() - cosSpent()); }
  function cosOwnedReal(id) {
    var item = cosItem(id); if (!item) return false;
    if (!(+item.price)) return true; // free default = pre-owned
    return !!cosOwnedMap()[id];
  }
  // Free play = a per-device LENS, never a purchase: owned() reads true for everything while the
  // flag is on, but gamekit_owned / the derived balance stay untouched — switching it off restores
  // the real collection exactly. Titles are exempt by design (the earned-only track).
  function cosFreePlay() { return lsGet('gamekit_freeplay') === '1'; }
  function cosSetFreePlay(on) {
    if (on) lsSet('gamekit_freeplay', '1');
    else { try { if (typeof localStorage !== 'undefined') localStorage.removeItem('gamekit_freeplay'); } catch (e) {} }
    try { applyCursor(); applyCrt(); } catch (e) {} // site-wide skins re-resolve under the new lens
    try { if (typeof window !== 'undefined' && typeof window.gamekitTrack === 'function') window.gamekitTrack('shop_freeplay', { on: on ? 1 : 0 }); } catch (e) {}
  }
  function cosOwned(id) { return cosOwnedReal(id) || (cosFreePlay() && !!cosItem(id)); }
  // One-time welcome gift, claimed in the shop: a single 'gift#welcome' entry in gamekit_done, so
  // lifetime, titles and the spendable balance all pick it up like any earned trophy.
  var GIFT_AMT = 100, GIFT_KEY = 'gift#welcome';
  function giftClaimed() { return ((chDoneMap()[GIFT_KEY]) | 0) > 0; }
  function giftClaim() {
    if (giftClaimed()) return false;
    var d = chDoneMap(); d[GIFT_KEY] = GIFT_AMT;
    lsSet('gamekit_done', JSON.stringify(d));
    try { if (typeof window !== 'undefined' && typeof window.gamekitTrack === 'function') window.gamekitTrack('shop_gift', { amount: GIFT_AMT }); } catch (e) {}
    return true;
  }
  function cosBuy(id) {
    var item = cosItem(id); if (!item) return false;
    if (cosOwned(id)) return true; // idempotent — a double-tap can't double-charge
    var price = +item.price || 0;
    if (cosBalance() < price) return false;
    var o = cosOwnedMap(); o[id] = { c: price, t: utcDayNumber() };
    lsSet('gamekit_owned', JSON.stringify(o));
    try { if (typeof window !== 'undefined' && typeof window.gamekitTrack === 'function') window.gamekitTrack('shop_buy', { id: id }); } catch (e) {}
    return true;
  }
  function cosSelMap() { try { return JSON.parse(lsGet('gamekit_cos_sel') || 'null') || {}; } catch (e) { return {}; } }
  function cosDefault(setId) { var a = cosItems(); for (var i = 0; i < a.length; i++) if (a[i].set === setId && !(+a[i].price)) return a[i].id; return null; }
  function cosSelected(setId) {
    var id = cosSelMap()[setId], item = id && cosItem(id);
    if (item && item.set === setId && cosOwned(id)) return id;
    return cosDefault(setId);
  }
  function cosSelect(setId, id) {
    var item = cosItem(id);
    if (!item || item.set !== setId || !cosOwned(id)) return false;
    var m = cosSelMap(); m[setId] = id; lsSet('gamekit_cos_sel', JSON.stringify(m));
    if (setId === 'site.cursor') applyCursor();
    if (setId === 'site.fx') applyCrt(); // selecting the CRT item = enable it; 'off' = disable (shop toggles it)
    return true;
  }
  // Collection progress is a plain item COUNT: pct = items owned / total items. Free defaults
  // (price 0) are auto-owned and count as unlocked, so a fresh account already reads a real
  // starting fraction (the defaults ARE part of the collection you hold) — no weighting needed.
  // owned/total are the raw counts the bar shows ("20 / 90 · 22%").
  function cosProgress(game) {
    var a = cosItems(), total = 0, own = 0;
    for (var i = 0; i < a.length; i++) {
      if (game != null && a[i].game !== game) continue;
      total++;
      if (cosOwnedReal(a[i].id)) own++; // REAL ownership — free play never inflates the collection %
    }
    return { owned: own, total: total, pct: total ? own / total : 0 };
  }
  // menu-group factory: the ONE wiring for a game's start-menu STYLE grid (select + buy-in-place).
  // Games do: groups: [..., KIT.cosmetics.menuGroup('snake.food', { label: 'FOOD' })] and in
  // onChange/onPlay: KIT.cosmetics.select('snake.food', st['snake.food']). opts.preview(g,w,h,item)
  // overrides the registry painter (e.g. flappy draws its real bird models).
  function cosMenuGroup(setId, opts) {
    opts = opts || {};
    var C = cosReg(), setMeta = (C && C.sets && C.sets[setId]) || {};
    var list = cosItems().filter(function (it) { return it.set === setId; });
    return {
      id: opts.id || setId,
      label: opts.label != null ? opts.label : (setMeta.label || t('shop.styleGroup')),
      style: 'grid',
      'default': cosSelected(setId),
      choices: list.map(function (it) {
        return {
          id: it.id, label: it.name, pvW: opts.pvW || 46, pvH: opts.pvH || 40,
          preview: opts.preview ? function (g, w, h, st) { opts.preview(g, w, h, it, st); } : (it.painter || undefined),
          desc: it.desc, price: it.price,
          locked: function () { return !cosOwned(it.id); },
          lockedLabel: function () { return '🏆 ' + fmtScore(+it.price || 0); },
          sub: it.price ? t('shop.owned') : (opts.freeLabel || t('shop.free')),
          afford: function () { return cosBalance() >= (+it.price || 0); },
          buy: function () {
            var okB = cosBuy(it.id);
            if (okB) { cosSelect(setId, it.id); try { sound.play('levelup'); } catch (e) {} }
            return okB;
          },
        };
      }),
    };
  }
  // one-time Meadow Flyer migration: banked in-game cash → trophies (1:1), already-unlocked birds
  // (old cash thresholds) → owned at cost 0, old keys removed. Flag-gated — an old Export imported
  // later lacks the flag (but has flappy_cash) → it re-migrates correctly (import wipes first).
  (function () {
    try {
      if (lsGet('gamekit_flappy_migrated') === '1') return;
      var raw = lsGet('flappy_cash');
      if (raw == null) { lsSet('gamekit_flappy_migrated', '1'); return; }
      var cash = parseInt(raw, 10) || 0;
      var OLD_COST = { bee: 0, robin: 50, bluebird: 100, parrot: 200, owl: 300, bielik: 500, rarog: 700, raven: 850, phoenix: 1000 };
      var o = cosOwnedMap();
      for (var b in OLD_COST) {
        if (!Object.prototype.hasOwnProperty.call(OLD_COST, b)) continue;
        if (OLD_COST[b] > 0 && cash >= OLD_COST[b]) o['flappy.bird.' + b] = { c: 0, t: utcDayNumber() }; // stays owned, costs nothing
      }
      lsSet('gamekit_owned', JSON.stringify(o));
      if (cash > 0) { var d = chDoneMap(); d['flappy-migrate'] = (d['flappy-migrate'] | 0) + cash; lsSet('gamekit_done', JSON.stringify(d)); }
      var selBird = lsGet('flappy_bird');
      if (selBird && OLD_COST[selBird] != null && cash >= OLD_COST[selBird]) { var m = cosSelMap(); m['flappy.bird'] = 'flappy.bird.' + selBird; lsSet('gamekit_cos_sel', JSON.stringify(m)); }
      try { if (typeof localStorage !== 'undefined') { localStorage.removeItem('flappy_cash'); localStorage.removeItem('flappy_bird'); } } catch (e) {}
      lsSet('gamekit_flappy_migrated', '1');
    } catch (e) {}
  })();
  // ---- site-wide cursor skin (desktop / fine pointers only) ----
  var _curTrail = null; // { canvas, ctx, ps, raf, kind }
  function cursorKey() { var id = cosSelected('site.cursor'); return id ? id.split('.').pop() : 'classic'; }
  function stopCursorTrail() {
    if (!_curTrail) return;
    try { if (_curTrail.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_curTrail.raf); } catch (e) {}
    try { if (_curTrail.canvas && _curTrail.canvas.parentNode) _curTrail.canvas.parentNode.removeChild(_curTrail.canvas); } catch (e) {}
    _curTrail = null;
  }
  function startCursorTrail(kind) {
    if (typeof document === 'undefined' || !document.body || typeof requestAnimationFrame !== 'function') return;
    if (_curTrail && _curTrail.kind === kind) return;
    stopCursorTrail();
    try {
      var cv = document.createElement('canvas'); cv.className = 'gamekit-cursor-trail';
      document.body.appendChild(cv);
      var ctx = cv.getContext('2d'); if (!ctx) { stopCursorTrail(); return; }
      var t = { canvas: cv, ctx: ctx, ps: [], raf: 0, kind: kind, hue: 0, idle: 0 };
      var COLS = ['#ff5b5b', '#ffd166', '#7fe0a0', '#7fd0ff', '#b98cff'];
      document.addEventListener('pointermove', function (e) {
        if (!_curTrail || _curTrail !== t || !e) return;
        t.hue = (t.hue + 1) % COLS.length;
        t.ps.push({ x: e.clientX, y: e.clientY, life: 1, r: kind === 'comet' ? 4 : 3, c: kind === 'comet' ? '#9fe8ff' : COLS[t.hue] });
        if (t.ps.length > 40) t.ps.shift();
      }, { passive: true });
      var frame = function () {
        if (!_curTrail || _curTrail !== t) return;
        try {
          var w = (typeof window !== 'undefined' && window.innerWidth) || 0, h = (typeof window !== 'undefined' && window.innerHeight) || 0;
          if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
          ctx.clearRect(0, 0, w, h);
          for (var i = t.ps.length - 1; i >= 0; i--) {
            var p = t.ps[i]; p.life -= 0.045;
            if (p.life <= 0) { t.ps.splice(i, 1); continue; }
            ctx.globalAlpha = p.life * 0.65; ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, 6.29); ctx.fill();
          }
          ctx.globalAlpha = 1;
        } catch (e) {}
        t.raf = requestAnimationFrame(frame);
      };
      t.raf = requestAnimationFrame(frame);
      _curTrail = t;
    } catch (e) { stopCursorTrail(); }
  }
  // terminal cursor: a blinking phosphor block that FOLLOWS the pointer (OS cursor images can't blink),
  // colour = green normally, or the CRT colour while CRT mode is on. Desktop only (fine pointer).
  var _termCur = null;
  function termColor() {
    try { var r = document.documentElement; if (r.classList && r.classList.contains('gk-crt')) return { green: '#33ff88', amber: '#ffb454', cyan: '#5cc8ff', mono: '#eef2f8' }[r.getAttribute('data-crt-color') || 'green']; } catch (e) {}
    return '#33ff88';
  }
  function stopTermCursor() {
    if (!_termCur) return;
    try { document.removeEventListener('pointermove', _termCur.move); } catch (e) {}
    try { if (_termCur.el && _termCur.el.parentNode) _termCur.el.parentNode.removeChild(_termCur.el); } catch (e) {}
    _termCur = null;
  }
  function startTermCursor() {
    if (typeof document === 'undefined' || !document.body) return;
    var col = termColor();
    if (_termCur) { try { _termCur.el.style.background = col; _termCur.el.style.boxShadow = '0 0 8px ' + col; } catch (e) {} return; }
    try {
      var el = document.createElement('div'); el.className = 'gamekit-term-cursor'; el.setAttribute('aria-hidden', 'true');
      el.style.background = col; el.style.boxShadow = '0 0 8px ' + col;
      document.body.appendChild(el);
      // put the block in the browser TOP LAYER (via the popover API) so it draws above native <dialog>
      // modals (settings/changelog…), which no z-index can beat.
      try { if (el.showPopover) { el.setAttribute('popover', 'manual'); el.showPopover(); } } catch (e) {}
      var lastN = -1;
      var move = function (e) {
        if (!e) return;
        el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
        // the top layer is insertion-ordered — when a dialog opens it lands above us, so re-assert once
        // whenever the open-dialog count changes to jump back on top
        try {
          if (el.showPopover) { var n = document.querySelectorAll('dialog[open]').length; if (n !== lastN) { lastN = n; try { el.hidePopover(); } catch (x) {} try { el.showPopover(); } catch (x) {} } }
        } catch (x) {}
        // hide the block ONLY over an element that renders its own cursor (marked data-gk-hide-cursor,
        // e.g. aim-trainer's canvas) — everywhere else it stays visible so you can reach the top-bar menu
        var over = null; try { over = document.elementFromPoint(e.clientX, e.clientY); } catch (x) {}
        el.style.display = (over && over.closest && over.closest('[data-gk-hide-cursor]')) ? 'none' : '';
      };
      document.addEventListener('pointermove', move, { passive: true });
      _termCur = { el: el, move: move };
    } catch (e) { stopTermCursor(); }
  }
  // per-cursor orientation: paw/comet/rainbow are tilted to point NW like the classic arrow, with the
  // hotspot moved to that visual "tip"; classic/crosshair/sword keep their own geometry.
  var CURSOR_TWEAK = {
    comet:   { rot: -1.5708, hot: [10, 10] },  // streak head → NW, tail trails SE
    rainbow: { rot: -1.5708, hot: [10, 10] },
    paw:     { rot: -0.7854, hot: [12, 12] },   // leaned ~45° NW
  };
  // a managed <style> forces the custom cursor onto ALL elements — a plain html.style.cursor loses
  // to any element's own `cursor:pointer` (that was the "reverts on hover over buttons" bug).
  var _curStyleEl = null;
  function setCursorRule(css) {
    try {
      if (typeof document === 'undefined' || !document.head) return;
      if (!_curStyleEl) { _curStyleEl = document.createElement('style'); _curStyleEl.id = 'gamekit-cursor'; document.head.appendChild(_curStyleEl); }
      _curStyleEl.textContent = css || '';
    } catch (e) {}
  }
  function applyCursor() {
    try {
      if (typeof document === 'undefined' || !document.documentElement || !document.documentElement.style) return;
      var fine = false;
      try { fine = !!(typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches); } catch (e) {}
      var key = fine ? cursorKey() : 'classic';
      if (key === 'terminal') { // blinking-block follower replaces the OS cursor
        stopCursorTrail(); startTermCursor();
        document.documentElement.style.cursor = 'none';
        setCursorRule('html, html * { cursor: none !important; }');
        return;
      }
      stopTermCursor();
      var C = cosReg(), painter = C && C.cursors && C.cursors[key];
      if (key === 'classic' || !painter || typeof document.createElement !== 'function') {
        document.documentElement.style.cursor = ''; setCursorRule(''); stopCursorTrail(); return;
      }
      var cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
      var g = cv.getContext && cv.getContext('2d');
      if (!g || !cv.toDataURL) { document.documentElement.style.cursor = ''; setCursorRule(''); stopCursorTrail(); return; }
      var tw = CURSOR_TWEAK[key] || { rot: 0, hot: [16, 16] };
      g.save(); g.translate(16, 16); if (tw.rot) g.rotate(tw.rot); g.scale(0.9, 0.9); painter(g); g.restore();
      // CSS filter can't reach the OS cursor, so tint the cursor PNG itself to match an active CRT colour.
      // 'source-atop' paints the colour ONLY over the glyph's opaque pixels (transparency preserved, no
      // square) → a flat phosphor silhouette. Reads the live root state so it follows the CRT preview too.
      try {
        var croot = document.documentElement;
        if (croot.classList && croot.classList.contains('gk-crt')) {
          var ctint = { green: '#33ff88', amber: '#ffb454', cyan: '#5cc8ff', mono: '#eef2f8' }[croot.getAttribute('data-crt-color') || 'green'];
          if (ctint) {
            g.globalCompositeOperation = 'source-atop'; g.fillStyle = ctint; g.fillRect(0, 0, cv.width, cv.height);
            g.globalCompositeOperation = 'source-over';
          }
        }
      } catch (e) {}
      var val = 'url(' + cv.toDataURL('image/png') + ') ' + tw.hot[0] + ' ' + tw.hot[1] + ', auto';
      document.documentElement.style.cursor = val;
      // override element-level cursors (buttons/links) so the skin never flips back on hover; text fields
      // keep their I-beam. EXCLUDE elements that render their own cursor (data-gk-hide-cursor, e.g.
      // aim-trainer's canvas) so their own cursor:none wins; every other surface keeps the skin.
      setCursorRule('html, html *:not([data-gk-hide-cursor]) { cursor: ' + val + ' !important; } input, textarea, [contenteditable] { cursor: text !important; }');
      if (key === 'comet' || key === 'rainbow') startCursorTrail(key); else stopCursorTrail();
    } catch (e) {}
  }
  // apply once the DOM exists (the kit loads in <head>, before <body>)
  (function () {
    try {
      if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
      if (document.body) applyCursor();
      else document.addEventListener('DOMContentLoaded', function () { applyCursor(); });
    } catch (e) {}
  })();

  // dev FPS meter — opt in with ?fps=1 (never shown to players). Counts real display frames, so it
  // reflects the GPU cost of effects like the CRT filter; shows current + lowest FPS to catch stutters.
  (function () {
    try {
      if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return;
      var on = false; try { on = /[?&]fps(=1)?(&|$)/.test(location.search || ''); } catch (e) {}
      if (!on) return;
      var el = null, frames = 0, last = 0, lo = 9999;
      var mount = function () { if (el || !document.body) return; el = document.createElement('div'); el.id = 'gamekitFps'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); };
      var loop = function (t) {
        frames++; if (!last) last = t;
        if (t - last >= 500) {
          var fps = Math.round(frames * 1000 / (t - last)); if (fps < lo) lo = fps;
          mount(); if (el) el.textContent = 'FPS ' + fps + ' · min ' + lo;
          frames = 0; last = t;
        }
        requestAnimationFrame(loop);
      };
      var go = function () { requestAnimationFrame(loop); };
      if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
    } catch (e) {}
  })();
  var cosmetics = {
    lifetime: cosLifetime, spent: cosSpent, balance: cosBalance,
    owned: cosOwned, ownedReal: cosOwnedReal, buy: cosBuy, selected: cosSelected, select: cosSelect,
    progress: cosProgress, items: cosItems, item: cosItem, menuGroup: cosMenuGroup,
    goodRunBonus: goodRunBonus,
    freePlay: cosFreePlay, setFreePlay: cosSetFreePlay,
    gift: function () { return { claimed: giftClaimed(), amount: GIFT_AMT }; }, claimGift: giftClaim,
  };

  // ---------- CRT display mode (site-wide, unlockable via the 'site.fx.crt' cosmetic) ----------
  // ONE unlock; on/off + colour are per-device preferences after that. Applied globally from the kit
  // (loads on every page), so a single toggle recolours the whole site — catalogue, games, modals.
  var CRT_COLORS = ['green', 'amber', 'cyan', 'mono'];
  function crtOwned() { try { return cosOwned('site.fx.crt'); } catch (e) { return false; } }
  // on/off IS the cosmetic selection: selecting 'site.fx.crt' enables it, 'site.fx.off' disables — so
  // the shop's normal buy→equip flow toggles CRT, and buying it turns it on (green) with no extra step.
  function crtIsOn() { try { return cosSelected('site.fx') === 'site.fx.crt'; } catch (e) { return false; } }
  function crtColor() { var c; try { c = lsGet('gamekit_crt_color'); } catch (e) {} return CRT_COLORS.indexOf(c) >= 0 ? c : 'green'; }
  function applyCrt() {
    try {
      if (typeof document === 'undefined' || !document.documentElement) return;
      var on = crtOwned() && crtIsOn();
      var root = document.documentElement;
      if (root.classList) root.classList.toggle('gk-crt', on);
      if (on) root.setAttribute('data-crt-color', crtColor()); else root.removeAttribute('data-crt-color');
      if (on && document.body && !document.getElementById('gamekitCrtOverlay') && document.createElement) {
        var ov = document.createElement('div'); ov.id = 'gamekitCrtOverlay'; ov.className = 'gamekit-crt-overlay';
        ov.setAttribute('aria-hidden', 'true'); document.body.appendChild(ov);
      }
      try { applyCursor(); } catch (e) {} // re-tint the custom cursor to match (or clear) the CRT colour
    } catch (e) {}
  }
  function crtSet(on) {
    if (on) { if (!crtOwned()) return; cosSelect('site.fx', 'site.fx.crt'); }
    else cosSelect('site.fx', 'site.fx.off'); // free default — always selectable
    applyCrt();
  }
  function crtSetColor(c) { if (CRT_COLORS.indexOf(c) < 0 || !crtOwned()) return; try { lsSet('gamekit_crt_color', c); } catch (e) {} cosSelect('site.fx', 'site.fx.crt'); applyCrt(); }
  // live, NON-persisting preview: cycles the colours while hovering/selecting the CRT item (even before
  // buying). previewStop() restores the real persisted state.
  var _crtPvTimer = null, _crtPvIdx = 0;
  function crtEnsureOverlay() { try { if (document.body && !document.getElementById('gamekitCrtOverlay') && document.createElement) { var o = document.createElement('div'); o.id = 'gamekitCrtOverlay'; o.className = 'gamekit-crt-overlay'; o.setAttribute('aria-hidden', 'true'); document.body.appendChild(o); } } catch (e) {} }
  function crtPreviewStart() {
    try {
      if (typeof document === 'undefined' || !document.documentElement || _crtPvTimer || typeof setInterval !== 'function') return;
      crtEnsureOverlay();
      var root = document.documentElement; _crtPvIdx = 0;
      var tick = function () { if (root.classList) root.classList.add('gk-crt'); root.setAttribute('data-crt-color', CRT_COLORS[_crtPvIdx % CRT_COLORS.length]); _crtPvIdx++; try { applyCursor(); } catch (e) {} };
      tick(); _crtPvTimer = setInterval(tick, 850);
    } catch (e) {}
  }
  function crtPreviewColor(c) { // preview a SPECIFIC colour (or 'off') statically — for hovering a dropdown option
    try {
      if (typeof document === 'undefined' || !document.documentElement) return;
      if (_crtPvTimer) { clearInterval(_crtPvTimer); _crtPvTimer = null; }
      var root = document.documentElement;
      if (c === 'off') { if (root.classList) root.classList.remove('gk-crt'); root.removeAttribute('data-crt-color'); return; }
      if (CRT_COLORS.indexOf(c) < 0) return;
      crtEnsureOverlay(); if (root.classList) root.classList.add('gk-crt'); root.setAttribute('data-crt-color', c);
      try { applyCursor(); } catch (e) {}
    } catch (e) {}
  }
  function crtPreviewStop() { try { if (_crtPvTimer) { clearInterval(_crtPvTimer); _crtPvTimer = null; } } catch (e) {} applyCrt(); }
  var crt = {
    colors: function () { return CRT_COLORS.slice(); }, available: crtOwned,
    enabled: function () { return crtOwned() && crtIsOn(); }, on: crtIsOn, color: crtColor,
    set: crtSet, setColor: crtSetColor, apply: applyCrt, previewStart: crtPreviewStart, previewColor: crtPreviewColor, previewStop: crtPreviewStop,
  };
  (function () {
    try {
      if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
      if (document.body) applyCrt(); else document.addEventListener('DOMContentLoaded', function () { applyCrt(); });
    } catch (e) {}
  })();

  // ---------- challenges (shared source: the catalogue panel + the in-game 🏆 button read this) ----------
  // Reads window.CHALLENGES (loaded via challenges.js) + the kit's own per-day activity/best storage.
  var CH_WEEK_ANCHOR = Math.floor(Date.UTC(2026, 5, 22) / 86400000); // a Monday — matches the catalogue
  function chGoals() { return (typeof window !== 'undefined' && window.CHALLENGES) ? window.CHALLENGES : null; }
  // integer hash (Wang) — turns the period index into a same-for-everyone "random" pick, so
  // consecutive days jump around the pool instead of walking it in order (no easy/hard clusters)
  function chHash(n) {
    n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return n >>> 0;
  }
  // THE pick — hashed, same-for-everyone; EXPORTED (gamekit.challengePick) so the catalogue's
  // drawer / backfill / tile badges use the exact same math as the in-game panel (a modulo copy
  // in index.html once drifted from this after the shuffle landed — never fork it again).
  // kind: 'daily'|'weekly'; day: UTC day number (defaults to today; weekly resolves its week).
  function chPickAt(kind, day) {
    var C = chGoals(); if (!C || !C.goals) return null;
    var isWeek = kind === 'weekly';
    var list = isWeek ? C.weekly : C.daily;
    if (!list || !list.length) return null;
    var d = (day == null) ? utcDayNumber() : day;
    var idx = isWeek ? Math.floor((d - CH_WEEK_ANCHOR) / 7) : d;
    // FROZEN like the random-pick pool: a goal only joins the rotation from the period AFTER its
    // game's go-live date (playableSince, STRICTLY before the period start) — a same-day `<=`
    // would admit today's launches into TODAY'S pool mid-day and re-roll a pick players already
    // saw (the 2026-07-12 six-game batch did exactly that).
    if (C.playableSince) {
      var startD = isWeek ? (CH_WEEK_ANCHOR + idx * 7) : d;
      list = list.filter(function (id) {
        var g = C.goals[id], a = g && g.slug && C.playableSince[g.slug];
        return !a || chDayNum(a) < startD;
      });
      if (!list.length) return null;
    }
    var n = list.length, i = 0;
    if (n >= 2) {
      i = chHash(idx) % n;
      if (i === chHash(idx - 1) % n) i = (i + 1) % n; // never the same goal two periods in a row
    }
    var id = list[i];
    return { id: id, goal: C.goals[id] || null, idx: idx, period: isWeek ? ('W' + idx) : utcDateStr(d * 86400000) };
  }
  // today's daily + this week's weekly pick
  function chToday() {
    var d = chPickAt('daily'), w = chPickAt('weekly');
    return { daily: (d && d.goal) ? d : null, weekly: (w && w.goal) ? w : null };
  }
  // does THIS game have an active game-specific challenge right now? (drives the badge + the notify glow)
  function chActiveSlug(slug) {
    if (!slug) return false;
    var t = chToday();
    return !!((t.daily && t.daily.goal && t.daily.goal.slug === slug) || (t.weekly && t.weekly.goal && t.weekly.goal.slug === slug));
  }
  // like chActiveSlug, but false once every matching goal is already done — a completed challenge
  // must not keep nudging (drives the in-game 🏆 glow, re-synced after each recorded run)
  function chActiveUndone(slug) {
    if (!slug) return false;
    var t = chToday(), arr = [t.daily, t.weekly];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (e && e.goal && e.goal.slug === slug) {
        var r = null; try { r = chEval(e.goal, {}); } catch (x) {}
        if (!r || !r.done) return true;
      }
    }
    return false;
  }
  var _chNotifyEl = null, _chNotifyTabEl = null, _chNotifySlug = '', _chNotifySeen = false;
  function syncChNotify() {
    var on = !_chNotifySeen && chActiveUndone(_chNotifySlug);
    if (_chNotifyEl && _chNotifyEl.classList) _chNotifyEl.classList.toggle('gkm-notify', on);
    if (_chNotifyTabEl && _chNotifyTabEl.classList) _chNotifyTabEl.classList.toggle('gkm-notify', on);
  }
  // aggregate the week containing refDay (default: today); a PAST week reads its full Mon–Sun
  // window from whatever played-logs survive retention — the catalogue's weekly back-fill needs it
  function chWeekAgg(refDay) {
    var today = utcDayNumber(), day = (refDay == null) ? today : refDay;
    var start = CH_WEEK_ANCHOR + Math.floor((day - CH_WEEK_ANCHOR) / 7) * 7, end = Math.min(start + 6, today), seen = {}, slugs = [], totalScore = 0, count = 0, goodRuns = 0, d;
    for (d = start; d <= end; d++) {
      var log = null; try { log = JSON.parse(lsGet('gamekit_played_' + utcDateStr(d * 86400000)) || 'null'); } catch (e) {}
      if (log) { (log.slugs || []).forEach(function (s) { if (!seen[s]) { seen[s] = 1; slugs.push(s); } }); totalScore += log.totalScore || 0; count += log.count || 0; goodRuns += log.goodRuns || 0; }
    }
    return { slugs: slugs, totalScore: totalScore, count: count, goodRuns: goodRuns };
  }
  function chCrossVal(m, a, genreOf) {
    if (m === 'distinctGames') return a.slugs.length;
    if (m === 'totalGames') return a.count;
    if (m === 'goodRuns') return a.goodRuns || 0;
    if (m === 'totalScore') return a.totalScore;
    if (m === 'distinctGenres') { var seen = {}, n = 0; a.slugs.forEach(function (x) { var g = genreOf && genreOf[x]; if (g && !seen[g]) { seen[g] = 1; n++; } }); return n; }
    return 0;
  }
  function chDayLog(dStr) {
    var lg = null; try { lg = JSON.parse(lsGet('gamekit_played_' + dStr) || 'null'); } catch (e) {}
    lg = lg || emptyLog();
    return { slugs: lg.slugs || [], totalScore: lg.totalScore || 0, count: lg.count || 0, goodRuns: lg.goodRuns || 0 };
  }
  function chDayNum(dStr) { try { var n = utcDayNumber(Date.parse(dStr + 'T00:00:00Z')); return isFinite(n) ? n : utcDayNumber(); } catch (e) { return utcDayNumber(); } }
  // evaluate a goal's progress from kit storage — THE one evaluator (in-game 🏆 panel + the catalogue
  // both route here). opts: genres (slug→genre; only distinctGenres needs it), day ('YYYY-MM-DD',
  // defaults to today; week-range goals always read the current week), playable + titles (ordered live
  // slugs + slug→title, resolve scope:'random' picks — without them a random goal shows no progress).
  function chEval(goal, opts) {
    if (!goal) return null;
    opts = opts || {};
    var genreOf = opts.genres || null, dStr = opts.day || utcDateStr(), val = 0;
    if (goal.scope === 'random') {
      var C = chGoals(), isWeek = goal.range === 'week', dn = chDayNum(dStr);
      var idx = isWeek ? Math.floor((dn - CH_WEEK_ANCHOR) / 7) : dn;
      // pool = CHALLENGES.playable unless the caller binds its own (the catalogue passes games.js),
      // FROZEN to the games live at the period's start (playableSince) — a game shipping mid-period
      // must never re-resolve an already-seen pick to a different target
      var playable = opts.playable || (C && C.playable) || null;
      if (playable && C && C.playableSince) {
        var startD = isWeek ? (CH_WEEK_ANCHOR + idx * 7) : dn;
        playable = playable.filter(function (s) { var a = C.playableSince[s]; return !a || chDayNum(a) < startD; }); // strictly before the period start — same-day launches wait for the NEXT period
      }
      var slug = (C && C.randomSlug && playable && playable.length) ? C.randomSlug(idx, playable) : '';
      var played = !!slug && ((isWeek ? chWeekAgg(dn) : chDayLog(dStr)).slugs.indexOf(slug) >= 0);
      var title = slug ? t(isWeek ? 'challenges.playWeek' : 'challenges.playToday', { game: (opts.titles && opts.titles[slug]) || t('game.' + slug + '.title', { def: slug }) }) : goal.title;
      return { val: played ? 1 : 0, target: 1, done: played, pct: played ? 1 : 0, title: title, slug: slug };
    }
    if (goal.scope === 'cross') {
      val = chCrossVal(goal.metric, goal.range === 'week' ? chWeekAgg(chDayNum(dStr)) : chDayLog(dStr), genreOf);
    } else {
      var best = null; try { best = (JSON.parse(lsGet('gamekit_daybest_' + dStr) || 'null') || {})[goal.slug] || null; } catch (e) {}
      if (best) val = goal.metric === 'score' ? (best.score || 0) : goal.metric === 'time' ? (best.time || 0) : ((best.stats && best.stats[goal.metric]) || 0);
    }
    var target = goal.target || 0;
    return { val: val, target: target, done: val >= target, pct: target ? Math.max(0, Math.min(1, val / target)) : 0, title: opts.id ? t('challenge.goal.' + opts.id, { def: goal.title }) : goal.title, slug: goal.slug };
  }
  // in-game challenges board (🏆 top-bar button → modal): today's daily + this week's weekly, progress
  // from kit storage, with the goal that targets `opts.slug` (this game) highlighted. Modal (freezes game).
  function challengesPanel(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body || !document.createElement) return;
    var slug = opts.slug, genreOf = opts.genres || null, ct = chToday();
    function card(entry, kindLabel) {
      if (!entry || !entry.goal) return '<div class="gkch-empty">' + t('challenges.noneKind', { kind: kindLabel.toLowerCase() }) + '</div>';
      var g = entry.goal, e = chEval(g, { genres: genreOf, id: entry.id }), mine = !!(slug && g.slug === slug), pct = Math.round((e ? e.pct : 0) * 100);
      var prog = e ? (e.done ? t('challenges.done') : (fmtScore(e.val) + ' / ' + fmtScore(e.target))) : '';
      // "good runs" goal: spell out the bar — the current game's exact bar in-game, generic on the catalogue
      var hint = '';
      if (g.metric === 'goodRuns') hint = '<div class="gkch-hint">' + (chGoodRun(slug) ? t('challenges.goodRunHere', { n: fmtScore(chGoodRun(slug)) }) : t('challenges.goodRunGeneric')) + '</div>';
      return '<div class="gkch-card' + (mine ? ' mine' : '') + (e && e.done ? ' done' : '') + '">'
        + '<div class="gkch-k">' + kindLabel + (mine ? ' · <b>' + t('challenges.thisGame') + '</b>' : '') + '</div>'
        + '<div class="gkch-t">' + ((e && e.title) || g.title) + '</div>'
        + '<div class="gkch-bar"><span style="width:' + pct + '%"></span></div>'
        + '<div class="gkch-p">' + prog + '</div>' + hint + '</div>';
    }
    var body = chGoals() ? (card(ct.daily, t('challenges.today')) + card(ct.weekly, t('challenges.thisWeek')))
      : '<div class="gkch-empty">' + t('challenges.notLoaded') + '</div>';
    // trophies pill (lifetime) + Cosmetics pill (spendable balance → the store) + the always-on
    // good-run bonus line, so "is one more run worth it?" has an answer before playing
    var pills = '<div class="gkch-pills"><span class="gkch-pill">' + t('chal.lifetime', { count: cosLifetime() }) + '</span>'
      + (cosItems().length ? '<button class="gkch-pill gkch-shop" id="gkchShop" type="button">' + t('challenges.cosmeticsBtn') + '</button>' : '')
      + '</div>'
      + grbHtml();
    var ov = document.createElement('div'); ov.className = 'gamekit-challenges';
    ov.innerHTML = '<div class="gkch-box"><button class="gkch-x" type="button" aria-label="' + t('menu.close') + '">&#x2715;</button>'
      + '<div class="gkch-scroll"><h3>🏆 ' + t('challenges.title') + '</h3>' + pills + body
      + '<p class="gkch-note">' + t('challenges.note') + '</p></div></div>';
    if (opts.theme) applyMenuTheme(ov, opts.theme);
    document.body.appendChild(ov);
    modalInc();
    var shopBtn = ov.querySelector ? ov.querySelector('#gkchShop') : null;
    if (shopBtn) shopBtn.addEventListener('click', function () { shopPanel({ theme: opts.theme }); });
    var done = false;
    function close() { if (done) return; done = true; modalDec(); try { document.removeEventListener('keydown', onKey, true); } catch (e) {} try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} }
    function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); close(); } }
    var x = ov.querySelector ? ov.querySelector('.gkch-x') : null; if (x) x.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
  }

  // ---------- Cosmetics store modal (kit-owned; opened from the challenges drawer/panel + profile) ----------
  // Header = spendable balance + overall collection bar; items grouped BY GAME (site-wide sets
  // first, then favorite games, then most-played, then the rest); cells reuse the shop-cell
  // interaction (touch two-step select→buy, mouse hover+click, focused-desc line, gold buy
  // button). Owned cells EQUIP on click. The titles ladder renders read-only at the bottom.
  // shopPanel(opts): the Cosmetics store modal. opts.game = scope to ONE game (+ site-wide cursors),
  // header becomes "🎨 <Game> cosmetics"; opts.allGames = fn → an "All games →" link (opens the full
  // store); opts.onTitles = fn → a "See titles" button under the collection line; opts.theme, opts.onClose.
  function shopPanel(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body || !document.createElement) return;
    var items = cosItems();
    if (!items.length) return; // cosmetics.js not loaded here
    var C = cosReg(), gamesMeta = (C && C.games) || {}, setsMeta = (C && C.sets) || {};
    try { if (typeof window !== 'undefined' && typeof window.gamekitTrack === 'function') window.gamekitTrack('feature_open', { feature: 'cosmetics' }); } catch (e) {}
    var scopeGame = (opts.game != null) ? String(opts.game) : null; // game-scoped (in-game) vs full store
    // ---- game ordering: site-wide first, then favorites (catalogue stars), most-played, registry order ----
    var order = [], seen = {};
    items.forEach(function (it) { if (!seen[it.game]) { seen[it.game] = 1; order.push(it.game); } });
    var favs = [];
    try { favs = JSON.parse(lsGet('arcade_favs') || '[]') || []; } catch (e) {}
    var plays = {};
    try { var pb = pbLoad(); for (var s in pb) { if (!Object.prototype.hasOwnProperty.call(pb, s)) continue; var n = 0; for (var m in pb[s]) if (Object.prototype.hasOwnProperty.call(pb[s], m)) n += (pb[s][m].plays || 0); plays[s] = n; } } catch (e) {}
    var baseIdx = {}; order.forEach(function (g, i) { baseIdx[g] = i; });
    order.sort(function (a, b) {
      if ((a === '') !== (b === '')) return a === '' ? -1 : 1;               // site-wide first
      var fa = favs.indexOf(a) >= 0 ? 1 : 0, fb = favs.indexOf(b) >= 0 ? 1 : 0;
      if (fa !== fb) return fb - fa;                                          // favorites next
      var pa = plays[a] || 0, pbn = plays[b] || 0;
      if (pa !== pbn) return pbn - pa;                                        // then most-played
      return baseIdx[a] - baseIdx[b];
    });
    // game-scoped: only this game + site-wide (cursors); full store: everything.
    var shown = scopeGame != null ? order.filter(function (g) { return g === scopeGame || g === ''; }) : order.slice();

    var ov = document.createElement('div'); ov.className = 'gamekit-shoppanel';
    var box = mkEl('div', 'gksp-box'); ov.appendChild(box);
    if (opts.theme) applyMenuTheme(ov, opts.theme);
    var xb = mkEl('button', 'gksp-x', '&#x2715;'); try { xb.type = 'button'; xb.setAttribute('aria-label', t('menu.close')); } catch (e) {}
    box.appendChild(xb);
    var head = mkEl('div', 'gksp-head');
    var scopeMeta = scopeGame != null ? (gamesMeta[scopeGame] || { title: scopeGame }) : null;
    head.appendChild(mkEl('span', 'gksp-title', '🎨 ' + (scopeMeta ? t('shop.titleGame', { game: (scopeGame ? t('game.' + scopeGame + '.title', { def: scopeMeta.title }) : scopeMeta.title) }) : t('shop.title'))));
    var balEl = mkEl('span', 'gksp-bal'); head.appendChild(balEl);
    box.appendChild(head);
    // one-time welcome gift — a prominent claim row that disappears forever once taken
    if (!giftClaimed()) {
      var giftRow = mkEl('div', 'gksp-gift');
      giftRow.appendChild(mkEl('span', 'gksp-gift-t', t('shop.gift', { n: GIFT_AMT })));
      var giftBtn = mkEl('button', 'gksp-gift-btn', t('shop.giftClaim', { n: GIFT_AMT })); try { giftBtn.type = 'button'; } catch (e) {}
      giftBtn.addEventListener('click', function () {
        if (!giftClaim()) return;
        try { sound.play('levelup'); } catch (e) {}
        giftRow.className = 'gksp-gift claimed';
        giftRow.innerHTML = '';
        giftRow.appendChild(mkEl('span', 'gksp-gift-t', t('shop.giftClaimed', { n: GIFT_AMT })));
        setTimeout(function () { try { if (giftRow.parentNode) giftRow.parentNode.removeChild(giftRow); } catch (e) {} }, 2500);
        syncCells();
      });
      giftRow.appendChild(giftBtn);
      box.appendChild(giftRow);
    }
    // controls row: search + (full store) a game filter, or (scoped) an "All games →" link
    var ctrls = mkEl('div', 'gksp-ctrls');
    var search = mkEl('input', 'gksp-search'); try { search.type = 'search'; search.placeholder = t('shop.searchPh'); search.setAttribute('aria-label', t('shop.searchAria')); } catch (e) {}
    ctrls.appendChild(search);
    var gameSel = null, allGamesLink = null;
    if (scopeGame == null) {
      var filterOpts = [{ value: '__all', label: t('shop.allGamesOpt') }];
      shown.forEach(function (g) {
        var m = gamesMeta[g] || { title: g || t('shop.siteWide') };
        var ttl = g ? t('game.' + g + '.title', { def: m.title || g }) : t('shop.siteWide');
        filterOpts.push({ value: g, label: (m.icon ? m.icon + ' ' : '') + ttl });
      });
      gameSel = mkGameFilter(filterOpts);
      ctrls.appendChild(gameSel.el);
    } else if (typeof opts.allGames === 'function') {
      allGamesLink = mkEl('button', 'gksp-allgames', t('shop.allGamesLink')); try { allGamesLink.type = 'button'; } catch (e) {}
      ctrls.appendChild(allGamesLink);
    }
    box.appendChild(ctrls);
    var barWrap = mkEl('div', 'gksp-barrow');
    var bar = mkEl('div', 'gksp-bar'); var barFill = mkEl('i'); bar.appendChild(barFill);
    var barTxt = mkEl('span', 'gksp-bartxt');
    barWrap.appendChild(bar); barWrap.appendChild(barTxt);
    // compact progress donut — shown only in short-height landscape (CSS), where the linear bar is hidden
    var ringWrap = mkEl('div', 'gksp-ringwrap');
    var ring = mkEl('div', 'gksp-ring');
    var ringLabel = mkEl('div', 'gksp-ringlabel');
    var ringPct = mkEl('b'), ringSub = mkEl('span');
    ringLabel.appendChild(ringPct); ringLabel.appendChild(ringSub);
    ringWrap.appendChild(ring); ringWrap.appendChild(ringLabel);
    barWrap.appendChild(ringWrap);
    box.appendChild(barWrap);
    var focdesc = mkEl('div', 'gksp-focdesc'); box.appendChild(focdesc);
    var scroll = mkEl('div', 'gksp-scroll'); box.appendChild(scroll);
    // titles pointer (no ladder table here) — only when an opener is provided (catalogue)
    if (typeof opts.onTitles === 'function') {
      var tl = mkEl('div', 'gksp-titleline');
      tl.appendChild(mkEl('span', null, t('shop.titlesLine')));
      var tb = mkEl('button', 'gksp-titlebtn', t('shop.seeTitles')); try { tb.type = 'button'; } catch (e) {}
      tb.addEventListener('click', function () { try { opts.onTitles(); } catch (e) {} });
      tl.appendChild(tb); box.appendChild(tl);
    }
    var buyBtn = mkEl('button', 'gksp-buy'); try { buyBtn.type = 'button'; } catch (e) {}
    box.appendChild(buyBtn);
    // free-play footer — a quiet settings-ish row, deliberately NOT styled like a shop item
    var fpRow = mkEl('div', 'gksp-fp');
    var fpTxt = mkEl('div', 'gksp-fp-txt');
    fpTxt.appendChild(mkEl('div', 'gksp-fp-l', t('shop.freePlay')));
    fpTxt.appendChild(mkEl('div', 'gksp-fp-s', t('shop.freePlaySub')));
    var fpBtn = mkEl('button', 'gksp-fp-toggle');
    try { fpBtn.type = 'button'; fpBtn.setAttribute('role', 'switch'); fpBtn.setAttribute('aria-label', t('shop.freePlayAria')); } catch (e) {}
    function syncFp() {
      var on = cosFreePlay();
      try { fpBtn.setAttribute('aria-checked', on ? 'true' : 'false'); } catch (e) {}
      if (fpBtn.classList) fpBtn.classList.toggle('on', on);
      if (ov.classList) ov.classList.toggle('gksp-freeplay', on);
    }
    fpBtn.addEventListener('click', function () { cosSetFreePlay(!cosFreePlay()); syncFp(); syncCells(); });
    fpRow.appendChild(fpTxt); fpRow.appendChild(fpBtn);
    box.appendChild(fpRow);
    syncFp();
    var cells = [], focused = -1, gameProgEls = [];
    function fmtT(n) { return fmtScore(n | 0); }
    // registry-data display → t() with the cosmetics.js English as the def fallback (byte-identical until S7)
    function cosName(it) { return t('cos.' + it.id + '.name', { def: it.name }); }
    function cosDesc(it) { return t('cos.' + it.id + '.desc', { def: it.desc || '' }); }
    function cosSetLabel(sid, def) { return t('cos.set.' + sid, { def: def || sid }); }
    function shopGameTitle(slug, def) { return t('game.' + slug + '.title', { def: def || slug }); }
    // themed game filter (replaces the native <select> so it matches the kit look): a trigger button
    // showing the current pick, opening a langMenu-style themed overlay list. Picking sets .value +
    // rebuilds. `gameSel` stays a plain {value, el} so rebuild() reads .value unchanged.
    function mkGameFilter(options) {
      var self = { value: '__all', el: null };
      var btn = mkEl('button', 'gksp-filter'); try { btn.type = 'button'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-label', t('shop.filterAria')); } catch (e) {}
      function labelFor(v) { for (var i = 0; i < options.length; i++) if (options[i].value === v) return options[i].label; return options[0].label; }
      function syncLabel() {
        btn.innerHTML = '';
        btn.appendChild(mkEl('span', 'gksp-filter-lbl', labelFor(self.value)));
        btn.appendChild(mkEl('span', 'gksp-filter-caret', '▾'));
      }
      function openMenu() {
        var pov = document.createElement('div'); pov.className = 'gamekit-shopfilter-menu';
        var pbox = mkEl('div', 'gkspf-box'); pov.appendChild(pbox);
        options.forEach(function (o) {
          var it = mkEl('button', 'gkspf-opt' + (o.value === self.value ? ' selected' : ''), o.label); try { it.type = 'button'; } catch (e) {}
          it.addEventListener('click', function () { self.value = o.value; syncLabel(); pclose(); rebuild(); });
          pbox.appendChild(it);
        });
        if (opts.theme) applyMenuTheme(pov, opts.theme);
        var phost = document.body; try { var d = document.querySelector && document.querySelector('dialog[open]'); if (d) phost = d; } catch (e) {}
        phost.appendChild(pov); modalInc();
        var pdone = false;
        function pclose() {
          if (pdone) return; pdone = true; modalDec();
          try { document.removeEventListener('keydown', pkey, true); } catch (e) {}
          try { if (pov.parentNode) pov.parentNode.removeChild(pov); } catch (e) {}
        }
        function pkey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); pclose(); } }
        pov.addEventListener('click', function (e) { if (e && e.target === pov) pclose(); });
        if (typeof document.addEventListener === 'function') document.addEventListener('keydown', pkey, true);
      }
      btn.addEventListener('click', openMenu);
      syncLabel();
      self.el = btn;
      return self;
    }
    function syncHeader() {
      balEl.textContent = '🏆 ' + fmtT(cosBalance());
      var pr = scopeGame != null ? cosProgress(scopeGame) : cosProgress();
      var pct = Math.round(pr.pct * 100);
      try { barFill.style.width = pct + '%'; } catch (e) {}
      barTxt.textContent = t('shop.progress', { owned: pr.owned, total: pr.total, pct: pct });
      try { ring.style.setProperty('--pct', pct); } catch (e) {}
      ringPct.textContent = pct + '%'; ringSub.textContent = pr.owned + '/' + pr.total;
      gameProgEls.forEach(function (fn) { try { fn(); } catch (e) {} });
    }
    // focused item → the desc line + the BUY/EQUIP button. Buying NEVER happens on a plain cell click
    // (no instant spend): a cell click only SELECTS; the gold button confirms the purchase.
    function syncFocus() {
      var f = cells[focused] || null;
      cells.forEach(function (c2, i) { if (c2.el.classList) c2.el.classList.toggle('gksp-focus', i === focused); });
      if (!f) { focdesc.innerHTML = ''; buyBtn.textContent = ''; buyBtn.disabled = true; try { buyBtn.style.display = 'none'; } catch (e) {} return; }
      var it = f.item, ownedNow = cosOwned(it.id), isSel = cosSelected(it.set) === it.id;
      focdesc.innerHTML = '&#9656; <b>' + cosName(it) + '</b> — ' + cosDesc(it) +
        (ownedNow ? '' : ' <span class="gksp-price">🏆 ' + fmtT(it.price) + '</span>');
      buyBtn.textContent = ownedNow ? (isSel ? t('shop.equipped') : t('shop.equip', { name: cosName(it) })) : t('shop.buy', { name: cosName(it), price: fmtT(it.price) });
      buyBtn.disabled = ownedNow ? isSel : cosBalance() < (+it.price || 0);
      if (buyBtn.classList) buyBtn.classList.toggle('gksp-buy-equip', ownedNow && !isSel);
      try { buyBtn.style.display = ''; } catch (e) {}
    }
    function syncCells() {
      cells.forEach(function (c2) {
        var it = c2.item, ownedNow = cosOwned(it.id), ownedReal = cosOwnedReal(it.id), isSel = cosSelected(it.set) === it.id;
        if (c2.el.classList) {
          c2.el.classList.toggle('gksp-owned', ownedNow);
          c2.el.classList.toggle('gksp-sel', isSel);
          c2.el.classList.toggle('gksp-dim', !ownedNow && cosBalance() < (+it.price || 0));
        }
        // free-play-unlocked (not really owned): struck-through price, so "what it normally costs" stays visible
        c2.sub.innerHTML = ownedNow
          ? (isSel ? '<span class="gksp-on">' + t('shop.on') + '</span>'
            : (ownedReal ? (+it.price ? t('shop.owned') : t('shop.default'))
              : '<span class="gksp-price gksp-strike">🏆 ' + fmtT(it.price) + '</span>'))
          : '<span class="gksp-price">🏆 ' + fmtT(it.price) + '</span>';
      });
      syncHeader(); syncFocus();
    }
    // music-track items: ▶ preview (toggle) + apply the chosen track live when it's equipped in-game
    var _pvBtn = null;
    function stopPv() { if (_pvBtn) { try { _pvBtn.textContent = '▶'; } catch (e) {} _pvBtn = null; } try { music.stopPreview(); } catch (e) {} }
    function togglePv(btn, it) { if (_pvBtn === btn) { stopPv(); return; } stopPv(); _pvBtn = btn; try { btn.textContent = '⏸'; } catch (e) {} try { music.preview(it.music); } catch (e) {} }
    function applyMusic(it) { if (it && it.music) { stopPv(); if (music.current()) { try { music.play(it.music); } catch (e) {} } } }
    // buy the focused unowned item (via the BUY button), OR equip a focused owned one
    function confirmFocused() {
      try { crt.previewStop(); } catch (e) {} // buying/equipping ends any live CRT preview → real state applies
      var f = cells[focused]; if (!f) return;
      var it = f.item;
      if (cosOwned(it.id)) { cosSelect(it.set, it.id); applyMusic(it); syncCells(); return; }
      if (cosBalance() < (+it.price || 0)) return; // unaffordable: the button is disabled; the programmatic path bails the same way
      var doBuy = function () { if (cosBuy(it.id)) { cosSelect(it.set, it.id); applyMusic(it); try { sound.play('levelup'); } catch (e) {} syncCells(); } };
      // premium items get a second "spend?" step — there is no refund, so one mis-tap on a 🏆500
      // skin must not be able to drain weeks of trophies
      if ((+it.price || 0) >= 100) confirmDialog(t('shop.confirmBuy', { def: 'Spend {price} 🏆 on {name}?', price: fmtT(it.price), name: cosName(it) }), doBuy, t('shop.confirmBtn', { def: 'BUY' }), null, { theme: opts.theme });
      else doBuy();
    }
    // click a cell: OWNED → equip immediately (no spend); UNOWNED → just select (BUY button confirms)
    function clickCell(idx) {
      try { crt.previewStop(); } catch (e) {} // switching selection ends a CRT preview (the CRT cell restarts its own)
      stopPv();                               // and ends any music preview
      focused = idx; syncFocus();
      var f = cells[idx]; if (!f) return;
      if (cosOwned(f.item.id)) confirmFocused();
    }
    // themed CRT colour DROPDOWN (opened by the ▾ on the CRT cell) — anchored under the caret, not a modal.
    // hovering an option live-previews that colour; leaving restores the real state.
    var _crtDD = null;
    function closeCrtDD() { if (_crtDD) { try { if (_crtDD.parentNode) _crtDD.parentNode.removeChild(_crtDD); } catch (e) {} _crtDD = null; try { document.removeEventListener('click', crtDDoutside, true); } catch (e) {} crt.previewStop(); } }
    function crtDDoutside(e) { if (_crtDD && (!e || !_crtDD.contains(e.target))) closeCrtDD(); }
    function openCrtColorMenu(anchor) {
      closeCrtDD();
      var seq = ['off'].concat(crt.colors());
      var LBL = { off: t('crt.off', { def: 'Off' }), green: t('crt.green', { def: 'Green' }), amber: t('crt.amber', { def: 'Amber' }), cyan: t('crt.cyan', { def: 'Cyan' }), mono: t('crt.mono', { def: 'Mono' }) };
      var cur = crt.enabled() ? crt.color() : 'off';
      var dd = mkEl('div', 'gksp-crt-dd'); _crtDD = dd;
      seq.forEach(function (id) {
        var o = mkEl('button', 'gksp-crt-opt' + (id === cur ? ' on' : ''), LBL[id] || id); try { o.type = 'button'; } catch (e) {}
        if (id !== 'off') o.insertBefore(mkEl('span', 'gksp-crt-dot', ''), o.firstChild), o.firstChild.setAttribute('data-c', id);
        o.addEventListener('mouseenter', function () { crt.previewColor(id); });
        o.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (id === 'off') crt.set(false); else crt.setColor(id); closeCrtDD(); syncCells(); });
        dd.appendChild(o);
      });
      dd.addEventListener('mouseleave', function () { crt.previewStop(); }); // back to real state when the mouse leaves the list
      if (opts.theme) applyMenuTheme(dd, opts.theme);
      // anchor: fixed under the caret (the scroll area would clip an absolute popover)
      try {
        var r = anchor && anchor.getBoundingClientRect && anchor.getBoundingClientRect();
        dd.style.position = 'fixed'; dd.style.zIndex = '9500';
        if (r) { dd.style.top = (r.bottom + 6) + 'px'; dd.style.right = Math.max(8, (typeof window !== 'undefined' ? window.innerWidth : 0) - r.right) + 'px'; }
      } catch (e) {}
      (document.body || document.documentElement).appendChild(dd);
      setTimeout(function () { try { document.addEventListener('click', crtDDoutside, true); } catch (e) {} }, 0);
    }
    // (re)build the grid from the current search + game filter
    function rebuild() {
      var q = (search.value || '').trim().toLowerCase();
      var filterG = (gameSel && gameSel.value != null && gameSel.value !== '__all') ? gameSel.value : null; // '' = Site-wide (falsy but a real filter)
      stopPv();
      scroll.innerHTML = ''; cells = []; focused = -1; gameProgEls = [];
      var any = false;
      shown.forEach(function (game) {
        if (filterG != null && game !== filterG) return;
        var meta = gamesMeta[game] || { title: game || t('shop.siteWide'), icon: '🎮' };
        var gameSets = [], seenSet = {};
        items.forEach(function (it) { if (it.game === game && !seenSet[it.set]) { seenSet[it.set] = 1; gameSets.push(it.set); } });
        // items matching the search within this game
        // match over BOTH the raw source strings and their translations, so it works in every language
        var match = function (it) {
          if (!q) return true;
          var setLabel = (setsMeta[it.set] || {}).label || '';
          var hay = (it.name + ' ' + cosName(it) + ' ' + cosDesc(it) + ' ' + (meta.title || '') + ' ' + shopGameTitle(it.game, meta.title) + ' ' + setLabel + ' ' + cosSetLabel(it.set, setLabel)).toLowerCase();
          return hay.indexOf(q) >= 0;
        };
        var gameItems = items.filter(function (it) { return it.game === game && match(it); });
        if (!gameItems.length) return;
        any = true;
        var gh = mkEl('div', 'gksp-game');
        var gt = mkEl('span', 'gksp-gt', (meta.icon ? meta.icon + ' ' : '') + shopGameTitle(game, meta.title).toUpperCase());
        var gp = mkEl('span', 'gksp-gp');
        gh.appendChild(gt); gh.appendChild(gp); gh.appendChild(mkEl('span', 'gksp-gline'));
        if (meta.accent && gh.style && gh.style.setProperty) { try { gh.style.setProperty('--acc', meta.accent); } catch (e) {} }
        scroll.appendChild(gh);
        (function (gm) { gameProgEls.push(function () { var p = cosProgress(gm); gp.textContent = p.owned + '/' + p.total; }); })(game);
        gameSets.forEach(function (setId) {
          var setItems = gameItems.filter(function (it) { return it.set === setId; });
          if (!setItems.length) return;
          var sm = setsMeta[setId] || {};
          if (gameSets.length > 1 || sm.note) scroll.appendChild(mkEl('div', 'gksp-set', cosSetLabel(setId, sm.label) + (sm.note ? ' <span class="gksp-note">· ' + sm.note + '</span>' : '')));
          var grid = mkEl('div', 'gksp-grid');
          setItems.forEach(function (it) {
            var cell = mkEl('div', 'gksp-cell');
            var isCrt = it.id === 'site.fx.crt';
            // CRT swatch = an animated colour-cycling tile (the whole icon changes colour); others = a painted canvas
            var cv;
            if (isCrt) { cv = mkEl('div', 'gksp-sw gk-crt-sw'); }
            else { cv = mkEl('canvas', 'gksp-sw'); try { cv.width = 40; cv.height = 40; } catch (e) {} if (it.painter) { try { drawPreview(cv, function (g, w, h) { it.painter(g, w, h); }); } catch (e) {} } }
            var txt = mkEl('div', 'gksp-txt');
            var nm = mkEl('div', 'gksp-nm', cosName(it)), sub = mkEl('div', 'gksp-sub');
            txt.appendChild(nm); txt.appendChild(sub);
            cell.appendChild(cv); cell.appendChild(txt);
            var idx = cells.length;
            cells.push({ el: cell, sub: sub, item: it });
            // click-only selection (no hover-focus): moving the mouse toward the BUY button used to
            // pass over other tiles and retarget it — the selection now stays on the clicked item
            cell.addEventListener('click', function () { clickCell(idx); });
            // the CRT item: a ▾ caret opens the colour dropdown, and hovering/selecting it (even unbought)
            // previews the effect (cycling colours) until you leave
            if (isCrt) {
              cell.classList.add('gksp-crt-cell');
              var caret = mkEl('button', 'gksp-crt-caret', '▾'); try { caret.type = 'button'; caret.setAttribute('aria-label', t('crt.pickColor', { def: 'Pick colour' })); } catch (e) {}
              caret.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (crtOwned()) openCrtColorMenu(caret); else clickCell(idx); });
              cell.appendChild(caret);
              var crtPv = function () { if (!crt.enabled()) crt.previewStart(); };
              cell.addEventListener('mouseenter', crtPv);
              cell.addEventListener('mouseleave', function () { crt.previewStop(); });
              cell.addEventListener('click', crtPv); // touch: selecting it previews too
            }
            if (it.music) { // music tracks: a ▶/⏸ button previews the track without buying
              var pvb = mkEl('button', 'gksp-crt-caret gksp-pv', '▶'); try { pvb.type = 'button'; pvb.setAttribute('aria-label', 'Preview'); } catch (e) {}
              (function (b, item) { b.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); togglePv(b, item); }); })(pvb, it);
              cell.appendChild(pvb);
            }
            grid.appendChild(cell);
          });
          scroll.appendChild(grid);
        });
      });
      // textContent, NOT mkEl's innerHTML — the search box is the one user-input → t() path
      if (!any) { var noneEl = mkEl('div', 'gksp-empty'); noneEl.textContent = t('shop.noMatch', { q: (search.value || '') }); scroll.appendChild(noneEl); }
      syncCells();
    }
    // mount inside an open <dialog> when there is one (the profile modal's top layer would
    // otherwise cover a body-level overlay) — same trick as the share menu
    var host = document.body;
    try { var dlg = document.querySelector && document.querySelector('dialog[open]'); if (dlg) host = dlg; } catch (e) {}
    host.appendChild(ov);
    modalInc();
    var done = false;
    function close() {
      if (done) return; done = true; modalDec();
      try { crt.previewStop(); } catch (e) {} // leaving the shop restores the real CRT state
      stopPv();                               // and stops any music preview

      try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
      try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
      if (typeof opts.onClose === 'function') { try { opts.onClose(); } catch (e) {} }
    }
    function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc') && document.activeElement !== search && !(document.querySelector && document.querySelector('.gamekit-shopfilter-menu'))) { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); close(); } }
    xb.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    buyBtn.addEventListener('click', function () { if (focused >= 0) confirmFocused(); });
    if (search) search.addEventListener('input', rebuild);
    if (allGamesLink) allGamesLink.addEventListener('click', function () { close(); try { opts.allGames(); } catch (e) {} });
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
    rebuild();
    return { el: ov, close: close, buy: function (id) { var i = -1; cells.forEach(function (c2, k) { if (c2.item.id === id) i = k; }); if (i >= 0) { focused = i; syncFocus(); confirmFocused(); } } };
  }

  function pruneOldLogs() {
    if (typeof localStorage === 'undefined' || typeof localStorage.key !== 'function') return;
    try {
      var today = utcDayNumber(), kill = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var pfx = (k && k.indexOf('gamekit_played_') === 0) ? 'gamekit_played_' : (k && k.indexOf('gamekit_daybest_') === 0) ? 'gamekit_daybest_' : null;
        if (pfx) {
          var n = utcDayNumber(Date.parse(k.slice(pfx.length) + 'T00:00:00Z'));
          if (today - n > 15) kill.push(k); // keep 2+ weeks: the weekly back-fill must still see a FULL previous week whenever the catalogue opens during the current one
        }
      }
      for (var j = 0; j < kill.length; j++) { try { localStorage.removeItem(kill[j]); } catch (e) {} }
    } catch (e) {}
  }
  // ---------- single source of truth for bests (gamekit_pb): games read/write via best()/saveBest();
  //            recordResult() also writes here (+ a play). score keeps the MAX, time keeps the best (MIN>0). ----------
  function pbLoad() { try { return JSON.parse(lsGet('gamekit_pb') || 'null') || {}; } catch (e) { return {}; } }
  function pbSave(slug, mode, score, time, countPlay, stats) {
    if (!slug) return { isBest: false, record: { score: 0, time: 0, plays: 0, stats: {} } };
    var pb = pbLoad(), pg = pb[slug] || (pb[slug] = {}), mk = (mode != null ? String(mode) : '');
    var me = pg[mk] || (pg[mk] = { score: 0, time: 0, plays: 0 }), isBest = false;
    score = +score || 0; time = +time || 0;
    if (score > (me.score || 0)) { me.score = score; isBest = true; }
    if (time > 0 && (!(me.time > 0) || time < me.time)) { me.time = time; isBest = true; }   // best time = min
    if (countPlay) me.plays = (me.plays || 0) + 1;
    if (stats) { me.stats = me.stats || {}; for (var k in stats) if (Object.prototype.hasOwnProperty.call(stats, k)) { var v = +stats[k] || 0; if (v > (me.stats[k] || 0)) me.stats[k] = v; } }   // stats keep the max (e.g. best wave)
    lsSet('gamekit_pb', JSON.stringify(pb));
    return { isBest: isBest, record: { score: me.score || 0, time: me.time || 0, plays: me.plays || 0, stats: me.stats || {} } };
  }
  function getBest(slug, mode) { var pb = pbLoad(), g = pb[slug], r = g && g[(mode != null ? String(mode) : '')]; return r ? { score: r.score || 0, time: r.time || 0, plays: r.plays || 0, stats: r.stats || {} } : { score: 0, time: 0, plays: 0, stats: {} }; }
  function getBestScore(slug, mode) { return getBest(slug, mode).score; }
  function saveBest(slug, mode, data) { data = data || {}; return pbSave(slug, mode, data.score, data.time, false, data.stats); }

  // recordResult(slug, {mode, score, time, stats}) — called by each game on game-over. Stores the
  // latest result + appends to today's UTC activity log (for cross-game "play N games" challenges).
  function recordResult(slug, data) {
    if (!slug) return null;
    data = data || {};
    // mode = language-STABLE key (best-store grouping); modeText = LOCALIZED display (score card / profile),
    // falling back to mode when a game doesn't provide it.
    var rec = { mode: (data.mode != null ? String(data.mode) : ''), modeText: (data.modeText != null ? String(data.modeText) : (data.mode != null ? String(data.mode) : '')), score: (+data.score || 0), time: (+data.time || 0), stats: (data.stats || {}), ts: nowMs() };
    lsSet('gamekit_result_' + slug, JSON.stringify(rec));
    try {
      var key = 'gamekit_played_' + utcDateStr();
      var log = JSON.parse(lsGet(key) || 'null') || emptyLog();
      if (log.slugs.indexOf(slug) < 0) log.slugs.push(slug);
      log.totalScore += rec.score; log.count += 1;
      var par = chGoodRun(slug); if (par && rec.score >= par) log.goodRuns = (log.goodRuns || 0) + 1; // a run that clears the game's bar
      lsSet(key, JSON.stringify(log));
      // per-day BEST per slug (max of each numeric metric) — lets the catalogue detect a daily-challenge
      // completion for the day it happened, even if you never reopened the catalogue that day or later
      // replayed with a lower score. (No daily goal uses 'time' as a ≥-target, so max is fine here.)
      var bkey = 'gamekit_daybest_' + utcDateStr();
      var best = JSON.parse(lsGet(bkey) || 'null') || {};
      var cur = best[slug] || { score: 0, time: 0, stats: {} };
      if (rec.score > (cur.score || 0)) cur.score = rec.score;
      if (rec.time > (cur.time || 0)) cur.time = rec.time;
      cur.stats = cur.stats || {};
      for (var sk in rec.stats) { if (Object.prototype.hasOwnProperty.call(rec.stats, sk)) { var sv = +rec.stats[sk] || 0; if (sv > (cur.stats[sk] || 0)) cur.stats[sk] = sv; } }
      best[slug] = cur;
      lsSet(bkey, JSON.stringify(best));
      // all-time best per (slug, mode) — the single source of truth (menus + profile), +1 play
      pbSave(slug, rec.mode, rec.score, rec.time, true, rec.stats);
      // lifetime rollup for the profile: member-since, distinct days played, lifetime good runs
      var st = JSON.parse(lsGet('gamekit_stats') || 'null') || { first: 0, days: 0, lastDay: '', goodRuns: 0 };
      if (!st.first) st.first = rec.ts;
      var today = utcDateStr();
      if (st.lastDay !== today) { st.days = (st.days || 0) + 1; st.lastDay = today; }
      if (par && rec.score >= par) st.goodRuns = (st.goodRuns || 0) + 1;
      lsSet('gamekit_stats', JSON.stringify(st));
      // good-run trophy trickle (+5 🏆, capped 3/day) — the end menu reads _grAwarded for its receipt
      _grAwarded = (par && rec.score >= par) ? grAward() : false;
      pruneOldLogs();
    } catch (e) {}
    // aggregate, consent-gated: which games/modes actually get played to completion
    try { if (typeof window !== 'undefined' && typeof window.gamekitTrack === 'function') window.gamekitTrack('game_play', { slug: slug, mode: rec.mode || '(default)' }); } catch (e) {}
    try { syncChNotify(); } catch (e) {} // this run may have just completed the active challenge
    return rec;
  }
  function lastResult(slug) { try { return JSON.parse(lsGet('gamekit_result_' + slug) || 'null'); } catch (e) { return null; } }
  function playedToday() { try { return JSON.parse(lsGet('gamekit_played_' + utcDateStr()) || 'null') || emptyLog(); } catch (e) { return emptyLog(); } }
  // profile() — aggregate all-time bests from the uniform gamekit_pb store (device-only). The catalogue
  // enriches per-slug data with titles/icons from games.js; the kit just returns the numbers.
  function profile() {
    var pb; try { pb = JSON.parse(lsGet('gamekit_pb') || 'null') || {}; } catch (e) { pb = {}; }
    var st; try { st = JSON.parse(lsGet('gamekit_stats') || 'null') || {}; } catch (e) { st = {}; }
    var perGame = {}, gamesPlayed = 0, modesPlayed = 0, plays = 0;
    var top = { slug: null, score: 0, mode: '' }, favGame = { slug: null, plays: 0 }, favMode = { slug: null, mode: '', plays: 0 };
    for (var slug in pb) {
      if (!Object.prototype.hasOwnProperty.call(pb, slug)) continue;
      var g = pb[slug], modes = [], gBest = 0, gPlays = 0, played = false;
      for (var m in g) {
        if (!Object.prototype.hasOwnProperty.call(g, m)) continue;
        var e = g[m], sc = e.score || 0, pl = e.plays || 0;
        if (pl > 0) { modesPlayed++; played = true; }
        gPlays += pl;
        modes.push({ mode: m, score: sc, plays: pl, time: e.time || 0 });
        if (sc > gBest) gBest = sc;
        if (sc > top.score) top = { slug: slug, score: sc, mode: m };
        if (pl > favMode.plays) favMode = { slug: slug, mode: m, plays: pl };
      }
      if (played) gamesPlayed++;
      plays += gPlays;
      if (gPlays > favGame.plays) favGame = { slug: slug, plays: gPlays };
      modes.sort(function (a, b) { return b.score - a.score; });
      perGame[slug] = { modes: modes, best: gBest, plays: gPlays, played: played };
    }
    return {
      perGame: perGame, gamesPlayed: gamesPlayed, modesPlayed: modesPlayed, plays: plays,
      top: top, favGame: favGame, favMode: favMode,
      since: st.first || 0, daysPlayed: st.days || 0, goodRuns: st.goodRuns || 0,
    };
  }

  // ---------- universal pause (button in the top-right cluster + overlay; games skip update when isPaused) ----------
  var _paused = false, _pauseOv = null, _pauseBtns = [];
  function pauseOverlay() {
    if (_pauseOv) return _pauseOv;
    if (typeof document === 'undefined' || !document.body || !document.createElement) return null;
    var ov = document.createElement('div'); ov.className = 'gamekit-pause';
    ov.innerHTML = '<div class="gamekit-pause-box"><div class="gamekit-pause-ico">⏸</div><div>' + t('pause.paused') + '</div><button class="gamekit-pause-resume" type="button">' + t('pause.resume') + '</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var t = e && e.target;
      if (t === ov || (t && t.closest && t.closest('.gamekit-pause-resume'))) setPaused(false);
    });
    _pauseOv = ov; return ov;
  }
  function syncPauseUI() {
    var ov = _paused ? pauseOverlay() : _pauseOv;
    if (ov && ov.classList) ov.classList.toggle('show', _paused);
    for (var i = 0; i < _pauseBtns.length; i++) { try { _pauseBtns[i].textContent = _paused ? '▶' : '⏸'; _pauseBtns[i].setAttribute('aria-pressed', _paused ? 'true' : 'false'); _pauseBtns[i].title = _paused ? t('pause.resume') : t('pause.pause'); } catch (e) {} }
  }
  function setPaused(p) { _paused = !!p; syncPauseUI(); }
  function togglePause() { setPaused(!_paused); }
  // quiet pause: freezes the game loop (isPaused → true) WITHOUT showing the universal pause overlay.
  // Used while a leave-confirm is up so the game stops underneath but no second pause UI appears.
  var _frozen = false;
  function freeze(on) { _frozen = !!on; }
  // paused when: the game set it, a quiet freeze is on, OR any kit overlay is open (confirm / controls /
  // embed / sound panel) — so opening any top-bar control halts the game underneath until it's closed.
  function isPaused() { return _paused || _frozen || _modalOpen > 0; }

  // ---------- fixed-timestep main loop (frame-rate independence) ----------
  // gamekit.loop(update, render, opts) — game-time advances in fixed 1000/60 ms steps regardless of
  // the display's refresh rate (60/90/120 Hz): real elapsed time accumulates and drains in STEP
  // chunks (update() once per chunk); render() runs once per display frame. The kit pause is built
  // in (isPaused → render only; lastT stays fresh so resume has no dt jump), and a tab stall is
  // clamped (MAX_FRAME) so there's no catch-up spiral. update()'s per-step physics is untouched —
  // only how often it's called — so 60 Hz behavior is bit-identical to a plain per-frame loop.
  // opts.mult: () => n scales game-time (a 2× speed toggle = exactly 2× real-time on any screen);
  // opts.frame: fn runs once per display frame before stepping (input polling etc.).
  // Headless-safe: no/inert requestAnimationFrame → never ticks (tests drive update() via __test.step).
  var LOOP_STEP = 1000 / 60, LOOP_MAX_FRAME = 100;
  // Render-interpolation phase: how far (0..1) real time has progressed into the NEXT 60 Hz
  // step at render() time. A game that offsets constant-velocity movers by
  // `velocityPerStep * gamekit.loopAlpha()` renders them gliding smoothly at ANY refresh
  // rate instead of hitching on 0-/2-step frames. View-only; headless it stays 0.
  var _loopAlpha = 0;
  function loopAlpha() { return _loopAlpha; }
  function gameLoop(update, render, opts) {
    opts = opts || {};
    if (typeof requestAnimationFrame !== 'function') return;
    var lastT = null, acc = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      try {
        if (typeof opts.frame === 'function') opts.frame();
        if (now === undefined) now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (lastT === null) lastT = now;
        var dt = now - lastT;
        lastT = now;
        if (isPaused()) { if (typeof render === 'function') render(); return; }
        if (dt > LOOP_MAX_FRAME) dt = LOOP_MAX_FRAME;
        if (dt < 0) dt = 0;
        acc += dt * (typeof opts.mult === 'function' ? (+opts.mult() || 1) : 1);
        while (acc >= LOOP_STEP) { update(); acc -= LOOP_STEP; }
        _loopAlpha = acc / LOOP_STEP;
        if (typeof render === 'function') render();
      } catch (e) { try { if (typeof console !== 'undefined') console.error(e); } catch (e2) {} }
    }
    requestAnimationFrame(tick);
  }

  // ---------- top-right sound menu (+ optional per-game "reset scores") ----------
  // ---------- right-edge side stack (Profile / Challenges / Collection) + the profile modal ----------
  // Ported 1:1 from the catalogue (index.html) — the kit is now the ONE owner of both; the catalogue
  // mounts them via gamekit.sideStack({...}) and games get them from nav(). Game pages add:
  // the stack shows at ALL times (auto-tucked when a run starts; the ‹‹ tab re-opens it and the
  // expanded stack counts as an open overlay → the game pauses underneath). The gutter-measured
  // default behaves exactly like the home page — on menu screens it measures against the open
  // menu's box instead of .wrap.
  var _sideMenuSync = null;   // set by sideStack(); called from menuShow/menuTeardown
  var _pfMounted = false, _sideMounted = false;

  function mountProfilePanels() {
    if (_pfMounted || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return;
    _pfMounted = true;
    var dlg = document.createElement('dialog'); dlg.id = 'profileModal';
    dlg.innerHTML = '<button type="button" class="pf-x" id="profileClose" aria-label="' + t('cat.close', { def: 'Close' }) + '">✕</button>'
      + '<div class="about profile"><div id="profileBody"></div></div>';
    document.body.appendChild(dlg);
    var tdlg = document.createElement('dialog'); tdlg.id = 'titlesModal';
    tdlg.innerHTML = '<button type="button" class="pf-x" id="titlesClose" aria-label="' + t('cat.close', { def: 'Close' }) + '">✕</button>'
      + '<div class="about titles"><div class="cl-head"><h3>' + t('titles.title', { def: '🏆 Titles' }) + '</h3></div>'
      + '<p class="tl-sub">' + t('titles.sub', { def: 'Earn trophies to climb the ladder — a new title is worn automatically, but tap any <b>unlocked</b> rank to wear it instead. Titles read <b>lifetime</b> trophies, so spending on your collection never slows you down.' }) + '</p>'
      + '<div class="tl-list" id="titlesList"></div></div>';
    document.body.appendChild(tdlg);
    (function () {
      const modal = document.getElementById('profileModal'), btn = document.getElementById('profileBtn'), closeBtn = document.getElementById('profileClose'), body = document.getElementById('profileBody');
      if (!modal || !modal.showModal) return;
      const K = window.gamekit, GAMES = window.GAMES || [];
      const T = (k, def) => (window.gamekit && window.gamekit.t) ? window.gamekit.t(k, { def }) : def;
      const lock = v => { try { document.body.style.overflow = v ? 'hidden' : ''; } catch (e) {} };
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const fmt = n => (typeof n === 'number' && n.toLocaleString) ? n.toLocaleString() : String(n);
      // speedrun/time bests are stored in ms (canonical) → mm:ss.cs, matching the in-game timer
      const fmtTime = ms => { ms = Math.max(0, ms | 0); const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), cs = Math.floor((ms % 1000) / 10); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(cs).padStart(2, '0'); };
      const meta = slug => { for (let i = 0; i < GAMES.length; i++) if (GAMES[i].slug === slug) return GAMES[i]; return null; };
      const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
      let shareData = null;
      // Snapshot the profile panel to a PNG that looks exactly like the on-screen modal — no libraries:
      // clone it, inline computed styles (an SVG <foreignObject> has no access to the page's CSS),
      // rasterise via an <img>. Falls back (returns null) if the browser taints the canvas (e.g. Safari).
      // Sizing props are NOT inlined: baked used-widths are razor-tight to live font metrics, and the
      // rasterizer's fonts can differ slightly (Android) → truncated/wrapped text. The flex/grid props
      // reflow the same layout at the clone's width instead.
      const SNAP_SKIP = new Set(['width', 'height', 'inline-size', 'block-size']);
      function inlineStyles(src, dst) {
        try { const cs = getComputedStyle(src); let s = ''; for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (SNAP_SKIP.has(p)) continue; s += p + ':' + cs.getPropertyValue(p) + ';'; } dst.style.cssText = s; } catch (e) {}
        const sc = src.children || [], dc = dst.children || [];
        for (let i = 0; i < sc.length && i < dc.length; i++) inlineStyles(sc[i], dc[i]);
      }
      function snapshot() {
        return new Promise(resolve => {
          try {
            const panel = modal.querySelector('.about.profile');
            if (!panel || typeof XMLSerializer === 'undefined') return resolve(null);
            const W = Math.round(panel.getBoundingClientRect().width) || 480;
            // the earned-title particle canvas isn't DOM (its bitmap won't serialize into the SVG),
            // so grab the live element + its position now → composite the current frame in afterwards
            let pfx = null;
            try { const cv = panel.querySelector('.pf-pfx'); if (cv && cv.toDataURL) { const pr = panel.getBoundingClientRect(), cr = cv.getBoundingClientRect(); pfx = { cv: cv, x: cr.left - pr.left, y: cr.top - pr.top, w: cr.width, h: cr.height }; } } catch (e) {}
            const clone = panel.cloneNode(true);
            inlineStyles(panel, clone);                                   // BEFORE removals (indices must align)
            clone.querySelectorAll('.dx, .pf-share, .pf-tt, .pf-pen').forEach(n => n.remove());
            const cs = getComputedStyle(modal);
            clone.style.background = cs.backgroundColor; clone.style.border = '1px solid ' + cs.borderColor;
            clone.style.borderRadius = '16px'; clone.style.margin = '0'; clone.style.width = W + 'px'; clone.style.boxSizing = 'border-box';
            clone.style.maxHeight = 'none'; clone.style.overflow = 'visible'; clone.style.height = 'auto'; clone.style.display = 'block';  // capture full content, not the scroll-capped view
            // inlineStyles copied the flex scroll area's tall pixel height (incl. logical block-size /
            // flex-basis) → force plain block flow with all sizing cleared so the clone (and the PNG)
            // crop to the real content height instead of the 88vh scroll box
            clone.querySelectorAll('#profileBody, .pf-scroll').forEach(n => { n.style.cssText += ';display:block;flex:none;height:auto;min-height:0;max-height:none;block-size:auto;min-block-size:0;max-block-size:none;overflow:visible'; });
            const foot = document.createElement('div'); foot.textContent = 'komyo.online';
            foot.style.cssText = 'text-align:right;font:600 13px ui-monospace,monospace;color:#7a8aa0;margin-top:14px;';
            clone.appendChild(foot);
            clone.style.position = 'fixed'; clone.style.left = '-9999px'; clone.style.top = '0'; clone.style.bottom = 'auto';
            document.body.appendChild(clone);
            const H = Math.ceil(clone.getBoundingClientRect().height);
            clone.style.position = 'static'; clone.style.left = 'auto'; clone.style.top = 'auto';
            const xml = new XMLSerializer().serializeToString(clone);
            document.body.removeChild(clone);
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
              + '<foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">' + xml + '</div></foreignObject></svg>';
            const img = new Image();
            img.onload = () => {
              try {
                const c = document.createElement('canvas'), s = 2; c.width = W * s; c.height = H * s;
                const g = c.getContext('2d'); g.scale(s, s);
                g.fillStyle = cs.backgroundColor || '#12151c'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0);
                if (pfx) { try { g.drawImage(pfx.cv, pfx.x, pfx.y, pfx.w, pfx.h); } catch (e) {} }  // bake the particle frame on top
                g.getImageData(0, 0, 1, 1);                               // throws if tainted (Safari) → fallback
                c.toBlob(b => resolve(b), 'image/png');
              } catch (e) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          } catch (e) { resolve(null); }
        });
      }
      // lifetime challenge points → EARNED title (highest passed). The WORN title can be any
      // unlocked one the player picks (gamekit_title_sel); earning a new higher tier auto-switches
      // to it (gamekit_title_adopted tracks the highest auto-claimed tier), and you can switch back.
      const TSEL = 'gamekit_title_sel', TADOPT = 'gamekit_title_adopted';
      function titleFor(pts) { return (window.CHALLENGES && window.CHALLENGES.titleFor) ? window.CHALLENGES.titleFor(pts) : { tier: 0, emoji: '🎖️', title: '' }; }
      function titleByTier(tier) { const list = (window.CHALLENGES && window.CHALLENGES.titles) || []; for (let i = 0; i < list.length; i++) if (list[i].tier === tier) return list[i]; return list[0] || { tier: 0, emoji: '🎖️', title: '' }; }
      // rank name → gamekit.t with the challenges.js English as the def fallback (byte-identical until S7)
      const rankTitle = r => (window.gamekit && window.gamekit.t) ? window.gamekit.t('title.t' + ((r && r.tier) | 0), { def: (r && r.title) || '' }) : ((r && r.title) || '');
      // pick which title is WORN: read the saved selection, but auto-adopt any newly-earned higher tier
      function wornTier(earnedTier) {
        let sel = earnedTier, adopted = -1;
        try { const s = localStorage.getItem(TSEL); if (s != null && s !== '') sel = parseInt(s, 10); } catch (e) {}
        try { const a = localStorage.getItem(TADOPT); if (a != null && a !== '') adopted = parseInt(a, 10); } catch (e) {}
        if (!isFinite(sel)) sel = earnedTier;
        if (earnedTier > adopted) { sel = earnedTier; try { localStorage.setItem(TSEL, String(sel)); localStorage.setItem(TADOPT, String(earnedTier)); } catch (e) {} } // new higher title → auto-switch
        return Math.max(0, Math.min(earnedTier, sel));
      }
      function setWornTier(tier) { try { localStorage.setItem(TSEL, String(tier)); } catch (e) {} }
      function titleData() {
        const who = (K && K.player) ? K.player() : 'anonymous';
        let chPts = 0;
        try { const d = JSON.parse(localStorage.getItem('gamekit_done') || '{}'); for (const k in d) chPts += (d[k] | 0); } catch (e) {}
        const earned = titleFor(chPts), TT = titleByTier(wornTier(earned.tier));
        return { who, chPts, TT, earnedTier: earned.tier };
      }
      // the identity box (title + name, both shined to the tier). Full (profile): particles for
      // tiers 3+, clickable name (rename), meta column (pts / good runs / since). Compact
      // (drawer card): just emoji + title + name + chevron. Titles ladder opens from the
      // challenges drawer's points pill.
      function titleBarHTML(o) {
        const TT = o.TT, who = o.who;
        let h = '<div class="pf-titlebar' + (o.compact ? ' pf-compact' : '') + ' pf-t' + TT.tier + '">'
          + (TT.tier >= 3 ? '<canvas class="pf-pfx" data-tier="' + TT.tier + '"></canvas>' : '')
          + '<span class="pf-tb-emoji">' + (TT.emoji || '🎖️') + '</span>'
          + '<div class="pf-tb-main">'
          + '<span class="pf-tb-label">' + (o.compact ? 'Title' : '<button type="button" class="pf-title-link" id="pfTitleOpen">Title · see ladder ›</button>') + '</span>'
          + '<span class="pf-title"><span class="pf-halo"></span><span class="pf-sh pf-gl" data-text="' + esc(rankTitle(TT)) + '">' + esc(rankTitle(TT)) + '</span></span>';
        h += o.compact
          ? '<span class="pf-tb-name"><span class="pf-sh pf-gl" data-text="' + esc(who) + '">' + esc(who) + '</span></span>'
          : '<span class="pf-tb-name"><button type="button" class="pf-name-btn" id="pfNameEdit" aria-label="Change your display name">'
            + '<span class="pf-sh pf-gl" data-text="' + esc(who) + '">' + esc(who) + '</span>'
            + '<svg class="pf-pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'
            + '<span class="pf-tt">Click to change your name</span></button></span>';
        h += '</div>';
        if (o.compact) h += '<span class="pf-chev">›</span>';
        else h += '<div class="pf-tb-meta">'
          + '<span class="pf-tb-pts">🏆 ' + fmt(o.chPts) + ' <span>' + window.gamekit.t('profile.trophiesEarned', { def: 'TROPHIES EARNED' }) + '</span></span>'
          + '<span class="pf-tb-mini" title="Runs that cleared a game’s bar">💪 <b>' + fmt(o.goodRuns) + '</b> ' + window.gamekit.t('profile.goodRunsWord', { count: o.goodRuns }) + '</span>'
          + '<span class="pf-tb-mini">📅 Since <b>' + esc(o.sinceStr || '—') + '</b></span>'
          + '</div>';
        return h + '</div>';
      }
      window.__titleBar = () => { const d = titleData(); return titleBarHTML({ compact: true, TT: d.TT, who: d.who }); };
      // worn title (tier + emoji + translated name) for the side stack's Profile button; defined
      // after the stack's IIFE ran, so nudge its renderer now that real data is available
      window.__wornTitle = () => { const d = titleData(); return { tier: d.TT.tier | 0, emoji: d.TT.emoji, name: rankTitle(d.TT) }; };
      if (window.__refreshSideStack) window.__refreshSideStack();
      function wireNameEdit() {
        const nb = document.getElementById('pfNameEdit');
        if (nb) nb.addEventListener('click', () => {
          if (window.__openNameModal) { window.__openNameModal(); return; }
          // game pages have no name modal — a plain prompt keeps rename working everywhere
          try { const cur = (K && K.player) ? K.player() : ''; const nn = (typeof prompt === 'function') ? prompt(T('profile.namePrompt', 'Display name'), cur) : null; if (nn != null && K && K.setName) { K.setName(nn); render(); } } catch (e) {}
        });
        // 🎨 collection bar → the Cosmetics store (mounts inside the open profile dialog)
        const cb = document.getElementById('pfCollect');
        if (cb) cb.addEventListener('click', () => { if (K && K.shopPanel) K.shopPanel({ onTitles: () => window.__openTitlesLadder && window.__openTitlesLadder(), onClose: render }); });
        // the title box opens the titles ladder (titles live in the profile + ☰ menu)
        const to = document.getElementById('pfTitleOpen');
        if (to) to.addEventListener('click', () => { if (window.__openTitlesLadder) window.__openTitlesLadder(); });
      }
      function render() {
        const p = (K && K.profile) ? K.profile() : null;
        const { who, chPts, TT } = titleData();
        let sinceStr = '';
        if (p && p.since) { try { sinceStr = new Date(p.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); } catch (e) {} }
        // identity (title + name) is the full-width box at the very top — no separate header;
        // shown in both empty + populated states
        const goodRuns = (p && p.goodRuns) ? p.goodRuns : 0;
        const cos = (K && K.cosmetics && window.COSMETICS) ? K.cosmetics.progress() : null;
        const tb = titleBarHTML({ TT, who, chPts, goodRuns, sinceStr, cos });
        // collection progress bar — a real bar (not just a number), tappable → the Cosmetics store
        // the fill is a background GRADIENT (not a width-sized <i>) so it survives the share
        // snapshot, whose inlineStyles drops width/height — a min-height div + a computed-style
        // background both make it through; an <i>'s inline width got wiped and collapsed to 0.
        const pctW = Math.round(cos ? cos.pct * 100 : 0);
        const collectBar = cos ? ('<div class="pf-collect" id="pfCollect" role="button" tabindex="0" title="Open the Cosmetics store">'
          + '<div class="pf-collect-top"><span>🎨 Collection</span><span class="pf-collect-n">' + cos.owned + ' / ' + cos.total + ' · ' + pctW + '%</span></div>'
          + '<div class="pf-collect-bar" style="background:linear-gradient(90deg,#ffce5c,#ff9a5c) left/' + pctW + '% 100% no-repeat,rgba(255,255,255,0.09)"></div></div>') : '';
        // one list, most-played first: every game with plays, each showing its modes' bests
        const ranked = [];
        if (p) GAMES.forEach(gm => { const pg = p.perGame[gm.slug]; if (pg && pg.plays > 0) ranked.push({ gm, pg }); });
        ranked.sort((a, b) => b.pg.plays - a.pg.plays || b.pg.best - a.pg.best);
        if (!ranked.length) {
          body.innerHTML = '<div class="pf-scroll">' + tb + collectBar + '<p class="pf-empty">' + window.gamekit.t('profile.noScores', { def: 'No scores yet — play a few games and your bests, favorites and stats show up here, sorted by how much you play them. Everything stays on this device.' }) + '</p></div>';
          shareData = null; startTitleFx(); wireNameEdit(); return;
        }
        const favGameMeta = meta(p.favGame.slug), accent = (favGameMeta && favGameMeta.accent) || '#9fe8ff';
        // stat labels pluralize with their count ("1 Day", not "1 Days")
        const chips = [['profile.statGames', p.gamesPlayed], ['profile.statModes', p.modesPlayed], ['profile.statPlays', p.plays], ['profile.statDays', p.daysPlayed]];
        let html = '<div class="pf-scroll">' + tb + '<div class="pf-stats">';
        chips.forEach(s => { const lbl = window.gamekit.t(s[0], { count: s[1] }); html += '<div class="pf-stat"><b>' + esc(fmt(s[1])) + '</b><span>' + esc(lbl) + '</span></div>'; });
        html += '</div>' + collectBar;
        // Your games — total plays in the header (its unit shown once), then each mode's best;
        // a per-mode "×N" appears only when that mode was played more than once (no ×1 noise).
        const rows = [];
        html += '<div class="pf-sec">' + window.gamekit.t('profile.yourGames', { def: 'Your games' }) + '</div><div class="pf-games">';
        ranked.forEach(function (it) {
          const gm = it.gm, pg = it.pg;
          const modes = pg.modes.slice().filter(m => m.plays > 0).sort((a, b) => b.plays - a.plays || b.score - a.score);
          let rowsHtml = '';
          modes.forEach(m => {
            // show plays on every mode (even single-mode, where it repeats the header total) for consistency; hide only ×1
            const x = m.plays > 1 ? ' <i class="pr-x" title="' + fmt(m.plays) + ' plays">×' + fmt(m.plays) + '</i>' : '';
            // time-primary modes (named "Speedrun"/"Sprint" by convention) show their time (stored ms);
            // every other mode shows its score. (score modes may also record a run duration we ignore.)
            const isTimeMode = /speedrun|sprint/i.test(m.mode || '');
            const val = (isTimeMode && m.time > 0) ? fmtTime(m.time) : (m.score > 0 ? fmt(m.score) : '—');
            rowsHtml += '<div class="pf-row"><span class="pr-mode">' + esc(m.mode || T('profile.colBest', 'Best')) + x + '</span><span class="pr-val">' + val + '</span></div>';
          });
          html += '<div class="pf-game pf-tinted" style="--acc:' + (gm.accent || '#9fe8ff') + '">'
            + '<div class="pf-gh"><span class="pf-gt">' + (gm.icon || '🎮') + ' ' + esc(gm.title) + '</span>'
            + '<span class="pf-gp"><b>' + fmt(pg.plays) + '</b> ' + window.gamekit.t('profile.playsWord', { count: pg.plays }) + '</span></div>'
            + '<div class="pf-rows"><div class="pf-rhead"><span>' + T('profile.colMode', 'Mode') + '</span><span>' + T('profile.colBest', 'Best') + '</span></div>' + rowsHtml + '</div></div>';
          rows.push({ name: gm.title, best: fmt(pg.best), mode: (modes[0] && modes[0].mode) || '', accent: gm.accent });
        });
        html += '</div>'; // close .pf-games
        html += '</div>'; // close .pf-scroll (the games list scrolls; the share button below stays pinned)
        html += '<div class="pf-share"><button type="button" id="pfShare">' + window.gamekit.t('profile.share', { def: '📷 Share my profile' }) + '</button></div>';
        body.innerHTML = html;
        startTitleFx();
        wireNameEdit();
        shareData = { player: who, accent: accent, stats: [{ label: window.gamekit.t('profile.cardGames', { def: 'Games' }), value: p.gamesPlayed }, { label: window.gamekit.t('profile.cardModes', { def: 'Modes' }), value: p.modesPlayed }, { label: window.gamekit.t('profile.cardPlays', { def: 'Plays' }), value: p.plays }, { label: window.gamekit.t('profile.cardDays', { def: 'Days' }), value: p.daysPlayed }], rows: rows, collection: cos };
        const sh = document.getElementById('pfShare');
        if (sh) sh.addEventListener('click', () => {
          if (sh.disabled) return;
          const orig = window.gamekit.t('profile.share', { def: '📷 Share my profile' });
          sh.disabled = true; sh.textContent = window.gamekit.t('profile.rendering', { def: 'Rendering…' });
          const flash = (msg) => { sh.textContent = msg; setTimeout(() => { sh.textContent = orig; sh.disabled = false; }, 1500); };
          snapshot()
            .then(b => b || (K && K.profileCard && shareData ? K.profileCard(shareData) : null))   // DOM snapshot, else drawn card
            .then(b => {
              if (!(b && K && K.shareCard)) { flash(window.gamekit.t('profile.renderErr', { def: "Couldn't render" })); return; }
              K.shareCard(b, { slug: 'profile', title: 'My Komyo Games profile' });   // opens the kit share menu (it owns the feedback)
              sh.textContent = orig; sh.disabled = false;
            })
            .catch(() => flash(window.gamekit.t('profile.renderErr', { def: "Couldn't render" })));
        });
      }
      // titles ladder modal — every rank prerendered with its tier shine (same classes as the
      // profile title box), current one highlighted; points only, no time estimates
      const tlModal = document.getElementById('titlesModal'), tlList = document.getElementById('titlesList'), tlClose = document.getElementById('titlesClose');
      // ladder: unlocked ranks are tap-to-equip (wear a previous title if you like it more); the worn
      // one shows "✓ Worn", locked ones stay locked. `wornT` = worn tier, `earnedT` = highest unlocked.
      function renderTitles() {
        if (!tlList || !window.CHALLENGES || !window.CHALLENGES.titles) return;
        const d = titleData(), wornT = d.TT.tier, earnedT = d.earnedTier;
        let h = '';
        window.CHALLENGES.titles.forEach(t => {
          const unlocked = t.tier <= earnedT, worn = t.tier === wornT;
          h += '<div class="tl-row pf-t' + t.tier + (worn ? ' tl-cur' : '') + (unlocked ? ' tl-unlocked' : ' tl-locked') + '"'
            + (unlocked ? ' role="button" tabindex="0" data-tier="' + t.tier + '"' : '') + '>'
            + (t.tier >= 3 ? '<canvas class="pf-pfx" data-tier="' + t.tier + '"></canvas>' : '')
            + '<span class="tl-emoji">' + (t.emoji || '🎖️') + '</span>'
            + '<span class="pf-title"><span class="pf-halo"></span><span class="pf-sh pf-gl" data-text="' + esc(rankTitle(t)) + '">' + esc(rankTitle(t)) + '</span></span>'
            + '<span class="tl-pts">' + (worn ? '<b class="tl-worn">' + window.gamekit.t('titles.worn', { def: '✓ Worn' }) + '</b>' : (unlocked ? window.gamekit.t('titles.wear', { def: 'Wear' }) : fmt(t.min) + ' 🏆')) + '</span></div>';
        });
        tlList.innerHTML = h;
      }
      // equip an unlocked title from the ladder → re-render the ladder + the profile + the ☰ id card
      if (tlList) tlList.addEventListener('click', e => {
        const row = e.target && e.target.closest ? e.target.closest('.tl-row.tl-unlocked') : null;
        if (!row) return;
        const t = parseInt(row.getAttribute('data-tier'), 10);
        if (!isFinite(t)) return;
        setWornTier(t); renderTitles(); startTitleFx();
        try { if (window.__renderProfile) window.__renderProfile(); } catch (e2) {}
        try { if (window.__refreshSideStack) window.__refreshSideStack(); } catch (e2) {} // worn title drives the stack's Profile icon/tint
        if (window.gamekitTrack) window.gamekitTrack('title_wear', { tier: t });
      });
      // challenges drawer's points pill opens the ladder — points → titles is the payoff
      window.__openTitlesLadder = () => {
        if (!tlModal || !tlModal.showModal) return;
        renderTitles(); tlModal.showModal(); startTitleFx();
        try { if (window.__setPanelUrl) window.__setPanelUrl('titles'); } catch (e) {}
        if (window.gamekitTrack) window.gamekitTrack('feature_open', { feature: 'titles' });
      };
      if (tlClose) tlClose.addEventListener('click', () => tlModal.close());
      if (tlModal) tlModal.addEventListener('click', e => { if (e.target === tlModal) tlModal.close(); });
      if (tlModal) tlModal.addEventListener('close', () => { try { if (window.__closePanelUrl) window.__closePanelUrl('titles'); } catch (e) {} tlList.innerHTML = ''; startTitleFx(); });   // drop the ladder fields, keep the profile-box one running
      // ☰ dot has two independent sources — a title-unlock moment (crossing a titles-ladder tier
      // since the last-seen one) and a ready-to-apply site update — ORed into one badge so neither
      // tracker stomps the other's state. Title "seen" tracking stays scoped to titles only; the
      // update source is read-only here (gamekit.updates.apply(), from Settings, clears its own state).
      const TSEEN = 'gamekit_title_seen';
      const seenTier = () => { try { return parseInt(localStorage.getItem(TSEEN) || '0', 10) || 0; } catch (e) { return 0; } };
      const titleIsFresh = () => {
        const cur = titleData().earnedTier; // the dot tracks the highest EARNED title, not the worn one
        if (cur < seenTier()) { try { localStorage.setItem(TSEEN, String(cur)); } catch (e) {} } // import/reset lowered the tier — resync silently
        return cur > seenTier();
      };
      const updateIsAvailable = () => { try { return !!(window.gamekit && window.gamekit.updates.state().available); } catch (e) { return false; } };
      function renderMenuDot() {
        // the UPDATE dot lives on the top-bar ⚙️ Settings button (it hosts "Update now"); a fresh
        // TITLE dots the side stack's Profile button. The ☰ drawer holds neither → no dot there.
        const sb = document.getElementById('settingsBtn');
        if (sb && sb.classList) sb.classList.toggle('tb-notify', updateIsAvailable());
        if (window.__setStackDot) window.__setStackDot('profileQuick', titleIsFresh());
      }
      window.__titleIsFresh = titleIsFresh;
      window.__markTitleSeen = () => {
        try { localStorage.setItem(TSEEN, String(titleData().earnedTier)); } catch (e) {}
        renderMenuDot();
      };
      function syncTitleNotify() { const fresh = titleIsFresh(); renderMenuDot(); return fresh; }
      syncTitleNotify();
      if (window.gamekit && window.gamekit.updates) window.gamekit.updates.onChange(renderMenuDot);
      window.__syncTitleNotify = syncTitleNotify;
      // earned-title particle fields (premium tiers) — ONE engine driving EVERY `.pf-pfx` canvas in
      // the profile body + titles ladder, so a new title-shine surface only has to include the canvas.
      // Canvases with no size yet (modal not open / closed) are retried each frame and skipped.
      let _pfRaf = 0;
      function stopTitleFx() { if (_pfRaf) { try { cancelAnimationFrame(_pfRaf); } catch (e) {} _pfRaf = 0; } }
      function startTitleFx() {
        stopTitleFx();
        const CFG = { 3: { n: 9, cols: ['#d3deed', '#fff'], sz: [.7, 1.8], v: .13, glow: 5 }, 4: { n: 12, cols: ['#b98cff', '#c9b3ff'], sz: [.7, 2], v: .16, glow: 5 }, 5: { n: 15, cols: ['#b98cff', '#9fe8ff'], sz: [.7, 2.2], v: .18, glow: 6 }, 6: { n: 18, cols: ['#9fe8ff', '#7fe8d0', '#fff'], sz: [.7, 2.4], v: .22, glow: 7 }, 7: { n: 24, cols: ['#ff8ad1', '#b98cff', '#9fe8ff', '#7fffc4'], sz: [.8, 2.6], v: .26, glow: 8 }, 8: { n: 32, cols: ['#ffd76a', '#fff3c0', '#fff', '#ff9ad1'], sz: [.9, 3], v: .32, glow: 10 } };
        const dpr = Math.min(window.devicePixelRatio || 1, 2), rnd = (a, b) => a + Math.random() * (b - a);
        const fields = [];
        const cvs = document.querySelectorAll ? document.querySelectorAll('#profileBody .pf-pfx, #titlesList .pf-pfx') : [];
        cvs.forEach(cv => {
          const cfg = CFG[+cv.getAttribute('data-tier')];
          const ctx = cv.getContext && cv.getContext('2d');
          if (cfg && ctx) fields.push({ cv, ctx, cfg, W: 0, H: 0, ps: [] });
        });
        if (!fields.length) return;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : null;
        const spawn = (f, y) => ({ x: rnd(0, f.W), y: y == null ? rnd(0, f.H) : y, r: rnd(f.cfg.sz[0], f.cfg.sz[1]), c: f.cfg.cols[(Math.random() * f.cfg.cols.length) | 0], vy: rnd(f.cfg.v * .6, f.cfg.v * 1.5), sway: rnd(.2, .9), ph: rnd(0, 6.28), tw: rnd(1.5, 3.5) });
        const size = f => {
          const r = f.cv.getBoundingClientRect();
          if (!r.width || !r.height) return false;
          f.W = r.width; f.H = r.height; f.cv.width = f.W * dpr; f.cv.height = f.H * dpr; f.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          for (let i = 0; i < f.cfg.n; i++) f.ps.push(spawn(f));
          return true;
        };
        const draw = (f, t, moving) => { const ctx = f.ctx; ctx.clearRect(0, 0, f.W, f.H); for (const q of f.ps) { ctx.globalAlpha = moving ? (.35 + .65 * (.5 + .5 * Math.sin(t * (6.28 / q.tw) + q.ph))) : .7; ctx.fillStyle = q.c; ctx.shadowBlur = f.cfg.glow; ctx.shadowColor = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.28); ctx.fill(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; };
        if (!raf) { fields.forEach(f => { if (size(f)) draw(f, 0, false); }); return; }
        const frame = ms => {
          const t = ms / 1000;
          let pending = false;
          for (const f of fields) {
            if (!f.W) { if (!size(f)) { pending = true; continue; } if (reduce) { draw(f, 0, false); continue; } }
            if (reduce) continue;
            for (const q of f.ps) { q.y -= q.vy; q.x += Math.sin(t * q.sway + q.ph) * .25; if (q.y < -6) { const np = spawn(f, f.H + 6); for (const k in np) q[k] = np[k]; } }
            draw(f, t, true);
          }
          if (reduce && !pending) return;
          _pfRaf = raf(frame);
        };
        _pfRaf = raf(frame);
      }
      window.__renderProfile = render; // exposed for tests
      window.__startTitleFx = startTitleFx;
      // the profile opens from the side stack (and the ?m=profile deep link) — no drawer card anymore
      window.__openProfile = () => { render(); modal.showModal(); lock(true); };
      if (btn) btn.addEventListener('click', window.__openProfile);
      if (closeBtn) closeBtn.addEventListener('click', () => modal.close());
      modal.addEventListener('close', () => { lock(false); stopTitleFx(); });
      modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
    })();
  }

  function sideStack(opts) {
    opts = opts || {};
    if (_sideMounted || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return;
    _sideMounted = true;
    mountProfilePanels();
    var host = document.createElement('div'); host.className = 'side-stack'; host.id = 'sideStack';
    host.innerHTML = '<button class="side-tab" id="sideTab" type="button" aria-label="Show quick menu">‹‹</button>'
      + '<div class="side-clip" id="sideClip"><div class="side-panel" id="sidePanel">'
      + '<button class="side-btn side-profile" id="profileQuick" type="button" aria-label="' + t('drawer.myProfile', { def: 'My profile' }) + '" data-ta="drawer.myProfile">'
      + '<span class="ico" id="spIco">🎖️</span><span class="lbl" data-t="cat.profileBtn">' + t('cat.profileBtn', { def: 'Profile' }) + '</span><span class="side-sub" id="spSub"></span></button>'
      + '<button class="side-btn side-chal" id="chalBtn" aria-label="' + t('cat.openChallenges', { def: 'Open challenges' }) + '" data-ta="cat.openChallenges" aria-haspopup="dialog">'
      + '<span class="ico">🏆</span><span class="lbl" data-t="cat.challengesBtn">' + t('cat.challengesBtn', { def: 'CHALLENGES' }) + '</span><span class="side-sub" id="scSub"></span></button>'
      + '<button class="side-btn side-cos" id="collectionQuick" type="button" aria-label="' + t('cat.collectionBtn', { def: 'Collection' }) + '">'
      + '<span class="ico">🎨</span><span class="lbl" data-t="cat.collectionBtn">' + t('cat.collectionBtn', { def: 'Collection' }) + '</span><span class="side-sub" id="skSub"></span></button>'
      + '</div></div>';
    document.body.appendChild(host);
    (function () {
      const K = window.gamekit;
      const stack = document.getElementById('sideStack'), tab = document.getElementById('sideTab');
      const clip = document.getElementById('sideClip'), panel = document.getElementById('sidePanel');
      if (!stack || !tab || !clip || !panel) return;
      // a manual show/hide is REMEMBERED (per device) and wins WHEN the drawer fits beside the
      // content; when the gutter can't hold it (phones, landscape) it always starts tucked — a
      // manual open there is a transient overlay, never the sticky default over the menu/game
      const STACK_KEY = 'arcade_stack';
      const storedChoice = () => { try { const v = localStorage.getItem(STACK_KEY); return v === null ? null : v === '1'; } catch (e) { return null; } };
      let shown = false, lastFits = null, playPause = false;
      // during live play (game page, no menu) an EXPANDED stack counts as an open overlay →
      // isPaused() halts the game until it's tucked away again
      const syncPlayPause = () => { if (!opts.game) return; const want = !!(shown && !_menuEl); if (want !== playPause) { playPause = want; if (want) modalInc(); else modalDec(); } };
      // per-button notification dots; the tab bubbles "any dot inside" while the drawer is hidden
      const dots = {};
      const syncTabDot = () => {
        const any = Object.keys(dots).some(k => dots[k]);
        if (tab.classList) tab.classList.toggle('has-dot', any && !shown);
      };
      window.__setStackDot = (id, on) => {
        dots[id] = !!on;
        const b = document.getElementById(id);
        if (b && b.classList) b.classList.toggle('has-dot', !!on);
        syncTabDot();
      };
      const applyClip = () => {
        clip.style.width = (shown ? (panel.offsetWidth || 152) : 0) + 'px';
        stack.classList.toggle('shown', shown);
        // live gameplay (game page, tucked, no menu): fade the tab so it never hides the action
        // under it (e.g. a snake fruit) — hover/expand restores full opacity
        stack.classList.toggle('gameplay-dim', !!(opts.game && !shown && !_menuEl));
        syncPlayPause();
        tab.textContent = shown ? '»' : '‹‹';
        syncTabDot();
      };
      const place = () => {
        // anchor = the open kit menu's box (games) or the catalogue's .wrap — the gutter beside
        // it decides the DEFAULT state exactly like on the home page
        let anchor = null;
        try { anchor = _menuEl && _menuEl.querySelector ? _menuEl.querySelector('.gkm-box') : null; } catch (e) {}
        if (!anchor && document.querySelector) anchor = document.querySelector('.wrap');
        if (opts.game && !_menuEl) { shown = false; applyClip(); return; }   // gameplay → tucked (tab stays)
        if (!anchor || !anchor.getBoundingClientRect || typeof window.innerWidth !== 'number') return;
        const gutter = window.innerWidth - anchor.getBoundingClientRect().right;
        const fits = gutter >= (panel.offsetWidth || 152) + 22 + 13; // panel + tab + breathing room
        if (fits !== lastFits) {
          lastFits = fits;
          const choice = storedChoice();
          shown = fits ? (choice === null ? true : choice) : false;
          applyClip();
        }
      };
      tab.addEventListener('click', () => {
        shown = !shown;
        try { localStorage.setItem(STACK_KEY, shown ? '1' : '0'); } catch (e) {}
        applyClip();
      });
      if (window.addEventListener) window.addEventListener('resize', place);
      place();
      // quick actions: Profile → the profile modal (via the drawer card's existing wiring, which
      // also reflects ?m=profile); Collection → the store (window.__openShop reflects ?m=cosmetics)
      const pq = document.getElementById('profileQuick');
      if (pq) pq.addEventListener('click', () => {
        const fresh = window.__titleIsFresh ? window.__titleIsFresh() : false;
        if (window.__markTitleSeen) window.__markTitleSeen(); // opening the profile counts as "seen the new title"
        if (window.__openProfile) window.__openProfile();
        if (fresh) requestAnimationFrame(() => {   // one-shot "★ NEW TITLE" reveal on the freshly rendered titlebar
          const tb = document.querySelector('#profileModal .pf-titlebar');
          if (tb) { tb.classList.add('pf-reveal'); setTimeout(() => { try { tb.classList.remove('pf-reveal'); } catch (e) {} }, 2700); }
        });
      });
      const cq = document.getElementById('collectionQuick');
      if (cq) cq.addEventListener('click', () => {
        if (opts.onCollection) { opts.onCollection(); return; }
        if (window.__openShop) { window.__openShop(); return; }
        shopPanel(opts.game ? { game: opts.slug, theme: opts.theme, allGames: function () { shopPanel({ theme: opts.theme }); } } : {});
      });
      // Challenges dot: "a new challenge rotation you haven't looked at yet" — compares today's
      // daily period + this week's weekly period (the kit's canonical rotation keys) against the
      // last pair seen; opening the drawer marks both seen.
      const CH_SEEN = 'arcade_chal_seen';
      const chPeriods = () => {
        try {
          const d = K.challengePick('daily'), w = K.challengePick('weekly');
          return (d && w) ? { d: d.period, w: w.period } : null;
        } catch (e) { return null; }
      };
      const syncChalDot = () => {
        const p = chPeriods(); if (!p) return;
        let s = {}; try { s = JSON.parse(localStorage.getItem(CH_SEEN) || '{}'); } catch (e) {}
        window.__setStackDot('chalBtn', p.d !== s.d || p.w !== s.w || !!(opts.game && chActiveUndone(opts.slug)));
      };
      const cb = document.getElementById('chalBtn');
      if (cb) cb.addEventListener('click', () => {
        // open the challenges surface FIRST (drawer on the catalogue via the late-bound hook,
        // kit panel in games) — the NEW-chip marking below targets the freshly rendered drawer
        if (opts.onChallenges) opts.onChallenges();
        else if (opts.game) challengesPanel({ slug: opts.slug, genres: opts.genres, theme: opts.theme });
        else if (window.__openChalDrawer) window.__openChalDrawer();
        const p = chPeriods();
        // badge whichever rotation is NEW inside the freshly-rendered drawer (the drawer-open
        // listener registered earlier already ran __renderChallenges) — the dot alone said nothing
        let s = {}; try { s = JSON.parse(localStorage.getItem(CH_SEEN) || '{}'); } catch (e) {}
        const mark = (id, fresh) => {
          const box = document.getElementById(id);
          if (!box || !box.classList) return;
          box.classList.toggle('ch-new', !!fresh);
          if (fresh && box.setAttribute) box.setAttribute('data-new', K.t('challenges.newBadge', { def: '★ NEW' }));
        };
        if (p) { mark('chalToday', p.d !== s.d); mark('chalWeek', p.w !== s.w); }
        if (p) { try { localStorage.setItem(CH_SEEN, JSON.stringify(p)); } catch (e) {} }
        syncChalDot();
      });
      syncChalDot();
      window.__syncChalDot = syncChalDot;
      // live bits: the Profile button wears your current title (icon + tint + name), Challenges
      // shows lifetime trophies, Collection shows unlock progress
      const TIER_TINT = ['rgba(120,130,143,.18)', 'rgba(195,204,216,.16)', 'rgba(208,149,79,.18)', 'rgba(215,224,236,.16)',
        'rgba(195,156,255,.20)', 'rgba(185,140,255,.20)', 'rgba(159,232,255,.18)', 'rgba(255,138,209,.18)', 'rgba(255,215,106,.20)'];
      const refreshStack = () => {
        try {
          const wt = window.__wornTitle && window.__wornTitle();
          if (wt) {
            const ico = document.getElementById('spIco');
            if (ico) ico.textContent = wt.emoji || '🎖️';
            if (pq && pq.style && pq.style.setProperty) pq.style.setProperty('--ttbg', TIER_TINT[wt.tier] || TIER_TINT[0]);
          }
          // detail sub-lines: player name · lifetime 🏆 · collection progress
          const K = window.gamekit;
          const sp = document.getElementById('spSub'), sc = document.getElementById('scSub'), sk = document.getElementById('skSub');
          if (sp && K && K.player) { const who = K.player(); sp.textContent = (who && who !== 'anonymous') ? who : ''; }
          if (K && K.cosmetics && window.COSMETICS) {
            if (sc) sc.textContent = '🏆 ' + K.cosmetics.lifetime().toLocaleString();
            if (sk) { const pr = K.cosmetics.progress(); sk.textContent = pr.owned + '/' + pr.total + ' · ' + Math.round(pr.pct * 100) + '%'; }
          }
        } catch (e) {}
      };
      window.__refreshSideStack = refreshStack;
      refreshStack();
      // refresh after anything that can change titles/trophies/unlocks closes (cheap, event-driven)
      [document.getElementById('chalBtn'), pq, cq].forEach(b => { if (b) b.addEventListener('click', () => setTimeout(refreshStack, 400)); });
      // outside click/tap during live play tucks the stack away → unpauses (same behaviour as the
      // sound panel); a dismissal is NOT remembered — only deliberate tab toggles persist
      if (opts.game && typeof document.addEventListener === 'function') document.addEventListener('click', function (e) {
        if (!shown || _menuEl) return;
        var tgt = e && e.target;
        if (tgt && tgt.closest && tgt.closest('#sideStack')) return;
        shown = false; applyClip();
      });
      // ---- game-page glue (no-op on the catalogue) ----
      _sideMenuSync = function () {
        if (!opts.game) return;
        if (_menuEl) { lastFits = null; place(); }        // menu screen → re-apply the measured default / stored choice
        else { shown = false; applyClip(); }              // a run started → auto-tuck (the ‹‹ tab stays)
      };
      // live language switch: re-label the stack buttons (the catalogue's data-t scanner does this
      // on the home page; game pages re-label here)
      if (opts.game) onLang(function () {
        try {
          var els = { 'cat.profileBtn': 'profileQuick', 'cat.challengesBtn': 'chalBtn', 'cat.collectionBtn': 'collectionQuick' };
          for (var k in els) { var b = document.getElementById(els[k]); if (b && b.querySelector) { var l = b.querySelector('.lbl'); if (l) l.textContent = t(k); } }
        } catch (e) {}
      });
    })();
  }

  function audioMenu(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return;
    var wrap = document.createElement('div'); wrap.className = 'gamekit-audio';
    var rows = '<div class="gamekit-au-row"><button class="gamekit-au-toggle" id="gamekitSfxM" type="button" aria-label="' + t('sound.muteSfx') + '">🔊</button>'
      + '<input class="gamekit-au-slider" id="gamekitSfxV" type="range" min="0" max="100" aria-label="' + t('sound.sfxVol') + '"></div>';
    if (opts.music) rows += '<div class="gamekit-au-row"><button class="gamekit-au-toggle" id="gamekitMusM" type="button" aria-label="' + t('sound.muteMusic') + '">🎵</button>'
      + '<input class="gamekit-au-slider" id="gamekitMusV" type="range" min="0" max="100" aria-label="' + t('sound.musVol') + '"></div>';
    // ☰ menu panel: version + update status, force refresh, embed, reset — one home for the
    // rarely-needed actions (keeps the button cluster narrow on phones)
    // ☰ order: How to play (when the game ships a #gk-about section) · Update · Language
    // (inserted before Embed below) · Embed · Reset.
    // (Fullscreen moved OUT to its own top-bar ⛶ button; Challenges/Collection live on the side stack.)
    // The version stamp lives in the catalogue footer/Settings; CRT is bought/toggled in the 🎨 shop.
    var more = (aboutSection() ? '<button class="gamekit-more-item" id="gamekitAbout" type="button">ℹ️ ' + t('kit.howto') + '</button>' : '')
      + '<button class="gamekit-more-item" id="gamekitUpdate" type="button">' + t('update.upToDate') + '</button>'
      + '<button class="gamekit-more-item" id="gamekitEmbed" type="button" title="' + t('kit.embedTitle') + '">&#x29C9; ' + t('embed.titleThis') + '</button>'
      + (opts.reset ? '<button class="gamekit-more-item gamekit-more-danger" id="gamekitReset" type="button" title="' + t('kit.resetTitle') + '">' + t('kit.reset') + '</button>' : '');
    wrap.innerHTML = '<button class="gamekit-au-btn gamekit-au-pausebtn" id="gamekitPause" type="button" aria-pressed="false" aria-label="' + t('pause.pause') + '" title="' + t('pause.pause') + '">⏸</button>'
      + '<button class="gamekit-au-btn" id="gamekitAudioBtn" type="button" aria-label="' + t('sound.settings') + '" title="' + t('sound.settings') + '">🔊</button>'
      + '<div class="gamekit-au-panel" id="gamekitAudioPanel">' + rows + '</div>'
      + (opts.controls ? '<button class="gamekit-au-btn gamekit-au-ctlbtn" id="gamekitControls" type="button" aria-label="' + t('controls.title') + '" title="' + t('controls.navTitle') + '">🎮</button>' : '')
      + (fsSupported() ? '<button class="gamekit-au-btn gamekit-au-fsbtn" id="gamekitFs" type="button" aria-pressed="false" aria-label="' + t('kit.fullscreen') + '" title="' + t('kit.fullscreenTitle') + '">⛶</button>' : '')
      + '<button class="gamekit-au-btn gamekit-au-morebtn" id="gamekitMore" type="button" aria-label="' + t('kit.gameMenu') + '" title="' + t('kit.gameMenu') + '">☰</button>'
      + '<div class="gamekit-au-panel gamekit-more-panel" id="gamekitMorePanel">' + more + '</div>';
    document.body.appendChild(wrap);
    _audioEl = wrap;
    var btn = document.getElementById('gamekitAudioBtn'), panel = document.getElementById('gamekitAudioPanel');
    var moreBtn = document.getElementById('gamekitMore'), morePanel = document.getElementById('gamekitMorePanel');
    // open/close panels idempotently; an open panel counts as an overlay (halts the game); the two
    // panels (sound / ☰) are mutually exclusive
    var panelOpen = false, moreOpen = false;
    function setPanel(open) { if (!panel || !panel.classList) return; open = !!open; if (open === panelOpen) return; if (open) setMore(false); panelOpen = open; panel.classList.toggle('open', open); if (open) modalInc(); else modalDec(); }
    function setMore(open) { if (!morePanel || !morePanel.classList) return; open = !!open; if (open === moreOpen) return; if (open) setPanel(false); moreOpen = open; morePanel.classList.toggle('open', open); if (open) modalInc(); else modalDec(); if (open) { renderMoreVer(); updates.check(); } }
    if (btn && panel) btn.addEventListener('click', function () { setPanel(!panelOpen); });
    if (moreBtn && morePanel) moreBtn.addEventListener('click', function () { setMore(!moreOpen); });
    // click anywhere outside an open panel closes it
    if (typeof document.addEventListener === 'function') document.addEventListener('click', function (e) {
      var t = e && e.target;
      if (panelOpen && !(t === btn || (t && t.closest && (t.closest('#gamekitAudioBtn') || t.closest('#gamekitAudioPanel'))))) setPanel(false);
      if (moreOpen && !(t === moreBtn || (t && t.closest && (t.closest('#gamekitMore') || t.closest('#gamekitMorePanel'))))) setMore(false);
    });
    // ☰ version row + update button: the button IS the status — greyed "✓ Up to date" when current
    // (checked live on every panel open), lit "🔆 Update now" when a new build is ready. The badge
    // dot on ☰ mirrors "an update is ready" without interrupting anyone.
    var verEl = document.getElementById('gamekitMoreVer'), upBtn = document.getElementById('gamekitUpdate');
    function renderMoreVer() {
      var b = buildInfo(), st = _upState;
      if (verEl) verEl.textContent = b.label; // sha · date time — same one-line format as the footer stamp
      if (upBtn) {
        var busy = st.status === 'refreshing' || st.status === 'checking';
        upBtn.textContent = st.status === 'refreshing' ? t('update.updating')
          : st.status === 'checking' ? t('update.checking')
          : st.available ? t('update.updateNow')
          : st.status === 'offline' ? t('update.offline')
          : t('update.upToDate');
        upBtn.disabled = busy || !st.available;
      }
      if (moreBtn && moreBtn.classList) moreBtn.classList.toggle('gkm-notify', !!st.available && st.status !== 'refreshing');
    }
    updates.onChange(renderMoreVer);
    renderMoreVer();
    if (upBtn) upBtn.addEventListener('click', function () { updates.apply(); });
    var u = { mainBtn: btn };
    u.sfxBtn = document.getElementById('gamekitSfxM'); u.sfxSlider = document.getElementById('gamekitSfxV');
    if (u.sfxBtn) u.sfxBtn.addEventListener('click', function () { sound.toggle(); });
    if (u.sfxSlider) u.sfxSlider.addEventListener('input', function (e) { var t = e && e.target; sound.volume(((t ? t.value : u.sfxSlider.value) || 0) / 100); });
    if (opts.music) {
      u.musBtn = document.getElementById('gamekitMusM'); u.musSlider = document.getElementById('gamekitMusV');
      if (u.musBtn) u.musBtn.addEventListener('click', function () { music.toggle(); });
      if (u.musSlider) u.musSlider.addEventListener('input', function (e) { var t = e && e.target; music.volume(((t ? t.value : u.musSlider.value) || 0) / 100); });
    }
    if (opts.reset) {
      var rb = document.getElementById('gamekitReset');
      if (rb) rb.addEventListener('click', function () {
        setMore(false);
        confirmDialog(t('confirm.reset'), function () { resetScores(opts.reset); try { location.reload(); } catch (e) {} }, t('confirm.holdReset'), null, { hold: 3000, theme: opts.theme });
      });
    }
    // ☰ language row: a full-width item (split globe/flag glyph + "Language") opening the themed
    // grid; closing the ☰ panel first keeps it from lingering behind the overlay.
    if (morePanel) {
      var langBtn = langButton({ label: t('lang.header', { def: 'Language' }), className: 'gamekit-more-item gamekit-more-lang', theme: opts.theme });
      if (langBtn) {
        langBtn.addEventListener('click', function () { setMore(false); }, true);
        var embedRow = document.getElementById('gamekitEmbed');
        if (embedRow && morePanel.insertBefore) morePanel.insertBefore(langBtn, embedRow);
        else if (morePanel.appendChild) morePanel.appendChild(langBtn);
      }
    }
    var eb = document.getElementById('gamekitEmbed');
    if (eb) eb.addEventListener('click', function () {
      setMore(false);
      var m = ((typeof location !== 'undefined' && location.pathname) ? location.pathname : '').match(/games\/([^\/?#]+)/);
      embedModal({ slug: m ? m[1] : '', title: (typeof document !== 'undefined' ? document.title : '') });
    });
    var abBtn = document.getElementById('gamekitAbout');
    if (abBtn) abBtn.addEventListener('click', function () { setMore(false); aboutModal(opts.theme); });
    aboutTranslate(); onLang(aboutTranslate); // localize the static SEO section in place (see aboutModal)
    var fsBtn = document.getElementById('gamekitFs');
    if (fsBtn) {
      var renderFsBtn = function () { var on = fullscreen.active(); fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); fsBtn.title = on ? t('kit.exitFullscreen') : t('kit.fullscreenTitle'); };
      renderFsBtn(); fullscreen.onChange(renderFsBtn);
      fsBtn.addEventListener('click', function () { fullscreen.toggle(); });
    }
    _navMounted = true;
    sideStack({ game: true, slug: opts.challenges || opts.cosmetics || '', genres: opts.genres, theme: opts.theme });
    if (opts.controls) { var ctlb = document.getElementById('gamekitControls'); if (ctlb) ctlb.addEventListener('click', function () { controlsModal(opts.controls, opts.theme); }); }
    var pb = document.getElementById('gamekitPause'); _pauseBtnEl = pb;
    if (pb) {
      // a game with its own (menu-based) pause passes onPause → the ⏸ button drives THAT, so there's a
      // single pause UI; otherwise the button toggles the kit's universal pause overlay.
      if (typeof opts.onPause === 'function') pb.addEventListener('click', function () { try { opts.onPause(); } catch (e) {} });
      else { _pauseBtns.push(pb); pb.addEventListener('click', togglePause); }
    }
    syncPauseUI();
    audioUIs.push(u); syncAudioUI();
  }

  // ---------- top-left nav: ‹ Menu · Komyo Games › (+ injects the top-right sound menu) ----------
  // The ‹ Menu button (go to the game's own menu) is only meaningful DURING play — on the game's menu
  // it confuses people who expect it to go back to the site (that's the "Komyo Games ›" link). Games
  // call showMenuButton(true) when play starts and (false) on their menu screen.
  var _menuBtn = null, _navEl = null, _audioEl = null, _pauseBtnEl = null;
  function showMenuButton(show) { if (_menuBtn && _menuBtn.style) _menuBtn.style.display = show ? '' : 'none'; }
  function showPauseButton(show) { if (_pauseBtnEl && _pauseBtnEl.style) _pauseBtnEl.style.display = show ? '' : 'none'; }
  // Collapse the "Komyo ›" label to just "›" ONLY when the left nav would actually overlap the
  // right sound/pause cluster — measured, not a hardcoded breakpoint (so portrait phones with room
  // keep the full label).
  function fitNav() {
    if (!_navEl || !_audioEl || !_navEl.classList || !_navEl.getBoundingClientRect) return;
    _navEl.classList.remove('gamekit-nav-tight'); // measure at full width first
    try {
      var nr = _navEl.getBoundingClientRect(), ar = _audioEl.getBoundingClientRect();
      if (nr.right + 12 > ar.left) _navEl.classList.add('gamekit-nav-tight');
    } catch (e) {}
  }
  // bottom-left build stamp (the short commit SHA from version.js) — tiny, 50% opacity, no link,
  // there only so it's legible in a screenshot. Hidden on local/dev (no real SHA).
  function versionTag() {
    try {
      if (typeof document === 'undefined' || !document.body || !document.createElement) return;
      var v = (typeof window !== 'undefined') ? window.KOMYO_VERSION : null;
      if (!v || !v.sha || v.sha === 'dev') return;
      var el = document.getElementById('gamekitVersion');
      if (!el) { el = document.createElement('div'); el.id = 'gamekitVersion'; document.body.appendChild(el); }
      el.textContent = buildInfo().label; // sha · deploy date+time (viewer-local)
    } catch (e) {}
  }

  function nav(opts) {
    opts = opts || {};
    // slug is the one identity: reset prefix + challenges key derive from it (explicit opts override),
    // so folder = games.js slug = reset prefix = challenge key can't drift apart per game.
    if (opts.slug) {
      if (opts.reset == null) opts.reset = opts.slug + '_';
      if (opts.challenges == null) opts.challenges = opts.slug;
      // the 🎨 cosmetics button appears when the registry is loaded (scoped to this game)
      if (opts.cosmetics == null && typeof window !== 'undefined' && window.COSMETICS) opts.cosmetics = opts.slug;
    }
    if (typeof document !== 'undefined' && document.body) {
      var wrap = document.createElement('div'); wrap.className = 'gamekit-nav';
      wrap.innerHTML = '<button class="gamekit-back" id="gamekitMenu" type="button">' + t('nav.menu') + '</button>'
        + '<a class="gamekit-back" id="gamekitHome" draggable="false" href="' + (opts.home || '../../') + '"><span class="gamekit-home-label">Komyo </span>&#x203A;</a>';
      document.body.appendChild(wrap);
      _navEl = wrap;
      var menu = document.getElementById('gamekitMenu');
      _menuBtn = menu || null;
      // confirmLeave: true | 'message' | function()->(message|false). Evaluated at click time, so a
      // game can return false on its start screen (no run to lose) and a message while mid-run. Pauses
      // the game while the confirm is up so you can't die mid-decision; Cancel resumes.
      var cl = opts.confirmLeave;
      var leaveMsg = function () {
        if (!cl) return false;
        if (typeof cl === 'function') { try { return cl(); } catch (e) { return false; } }
        return cl === true ? t('confirm.leave') : cl;
      };
      var guarded = function (doLeave) {
        var msg = leaveMsg();
        // confirmDialog opens an overlay (isPaused → game halts under it); cancel resumes automatically
        if (msg) confirmDialog(msg, doLeave, t('nav.leave'), null, { theme: opts.theme });
        else doLeave();
      };
      if (menu) menu.addEventListener('click', function () {
        guarded(function () {
          if (typeof opts.onMenu === 'function') { try { opts.onMenu(); } catch (e) {} }
          else { try { location.reload(); } catch (e) {} }
        });
      });
      // live language switch (no reload in games): the nav back label is the one piece of
      // always-visible kit DOM built at mount — refresh it when the language changes
      onLang(function () { try { if (menu) menu.textContent = t('nav.menu'); } catch (e) {} });
      var homeA = document.getElementById('gamekitHome');
      if (homeA) homeA.addEventListener('click', function (e) {
        if (!leaveMsg()) return; // no run → let the link navigate normally
        if (e && e.preventDefault) e.preventDefault();
        var href = homeA.getAttribute('href');
        // navigate the CURRENT frame (not window.top) — works on the normal site AND inside an
        // embedded iframe (e.g. a Discord Activity, where window.top is Discord's cross-origin frame)
        guarded(function () { try { location.href = href; } catch (e2) {} });
      });
    }
    audioMenu({ music: !!opts.music, reset: opts.reset, onPause: opts.onPause, controls: opts.controls, challenges: opts.challenges, cosmetics: opts.cosmetics, genres: opts.genres, theme: opts.theme });
    versionTag();
    if (typeof layout !== 'undefined' && layout && layout.on) layout.on(fitNav);
    fitNav();
    tapToStart(); // audio-unlock splash (once per load); no-op when both channels are muted
    // block the browser context menu on game canvases (no "save image…" popping mid-play)
    if (typeof document !== 'undefined' && document.querySelectorAll) {
      try {
        var cvs = document.querySelectorAll('canvas');
        for (var i = 0; i < cvs.length; i++) cvs[i].addEventListener('contextmenu', function (e) { if (e && e.preventDefault) e.preventDefault(); });
      } catch (e) {}
    }
  }

  // ---------- end-screen share row ----------
  var SVG = {
    native: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12c-.688 0-1.25.561-1.25 1.25 0 .687.562 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.6-.71 1.39-.97 2.01a18.3 18.3 0 0 0-5.02 0 12.6 12.6 0 0 0-.98-2.01.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 8.02.943 11.58 1.51 15.09a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127c-.598.349-1.225.645-1.873.892a.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-4.06-.838-7.59-3.549-10.695a.06.06 0 0 0-.031-.028zM8.02 12.95c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z"/></svg>',
  };
  // build a consistent share sentence from structured parts (so every game reads the same):
  //   "{verb} {score} {unit} in {game} {emoji} — {mode}, {extra…}"
  function shareText(o) {
    o = o || {};
    var s = t('share.line', {
      verb: o.verb || t('share.verb'), score: o.score,
      unit: o.unit ? ' ' + o.unit : '', game: o.game, emoji: o.emoji ? ' ' + o.emoji : ''
    });
    var tail = [o.mode].concat(o.extra || []).filter(function (x) { return x != null && x !== ''; });
    if (tail.length) s += ' — ' + tail.join(', ');
    return s;
  }

  // read a deep-link query param (so a shared link can preselect a game mode)
  function param(k, d) {
    try { var v = (typeof location !== 'undefined') ? new URLSearchParams(location.search).get(k) : null; return (v == null) ? d : v; }
    catch (e) { return d; }
  }

  function enc(s) { return (typeof encodeURIComponent === 'function') ? encodeURIComponent(s) : String(s); }
  // Append UTM tags so GA4 can attribute shared traffic (a QR scan has no referrer → otherwise it's
  // filed as "direct"). Short + kept AFTER any deep-link params (mode/diff), so a shared link still
  // opens the exact mode. source = where it was shared from, medium = the channel (qr | share | discord).
  function withUtm(url, source, medium) {
    if (!url) return url;
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'utm_source=' + source + '&utm_medium=' + medium;
  }
  function shareUrls(url, message) {
    return {
      x: 'https://twitter.com/intent/tweet?text=' + enc(message) + '&url=' + enc(url),
      reddit: 'https://www.reddit.com/submit?url=' + enc(url) + '&title=' + enc(message),
      copy: message + '\n' + url,
    };
  }
  // ---------- score card (Level 2): a branded PNG the player shares ----------
  // Draws a 1200×630 card (brand bg + mascot + big score + game title + komyo.online) on an
  // offscreen canvas and resolves a PNG Blob. Mascot = the in-repo favicon.svg (placeholder until
  // real art); falls back to a 🦊 glyph if it can't load. Headless-safe → resolves null.
  // mm:ss.cs from ms — the speedrun/sprint time shown on TIME score cards (matches the in-game timer)
  function fmtMs(ms) { ms = Math.max(0, ms | 0); var p2 = function (n) { return (n < 10 ? '0' : '') + n; }; return p2(Math.floor(ms / 60000)) + ':' + p2(Math.floor(ms % 60000 / 1000)) + '.' + p2(Math.floor(ms % 1000 / 10)); }
  function mixHex(a, b, t) {
    try {
      var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), m = 0, i;
      for (i = 16; i >= 0; i -= 8) m |= Math.round(((pa >> i & 255) * (1 - t)) + ((pb >> i & 255) * t)) << i;
      return '#' + ('00000' + m.toString(16)).slice(-6);
    } catch (e) { return a; }
  }
  // Lazy-load the reusable QR encoder (qr.js) on first use — it's only needed when a score card is
  // built (share), so it stays out of the atomic <head> and loads on demand (cached by the root SW
  // SHELL for offline). Resolves window.KOMYO_QR or null (never throws / blocks the card).
  var _qrLib = null;
  function ensureQR() {
    if (typeof window !== 'undefined' && window.KOMYO_QR) return Promise.resolve(window.KOMYO_QR);
    if (_qrLib) return _qrLib;
    _qrLib = new Promise(function (res) {
      try {
        if (typeof document === 'undefined' || !document.createElement) return res(null);
        var onGame = (typeof location !== 'undefined' && (location.pathname || '').indexOf('/games/') >= 0);
        var s = document.createElement('script'); s.src = onGame ? '../../qr.js' : 'qr.js';
        s.onload = function () { res(window.KOMYO_QR || null); };
        s.onerror = function () { res(null); };
        (document.head || document.body || document.documentElement).appendChild(s);
      } catch (e) { res(null); }
    });
    return _qrLib;
  }
  // Draw a themed, scannable QR (a KOMYO_QR matrix) onto the score card: light panel + accent-tinted
  // dark modules (high luminance contrast = scans) + accent rounded finder eyes (themed flair).
  // Centered under the KOMYO GAMES wordmark, above the ▶ play-on CTA.
  function drawCardQR(x, rr, qr, accent) {
    // NO box: the QR code FILLS its footprint (max module size = best scan), right-anchored at the card
    // margin (W-82). The quiet zone is the card itself — we repaint the card's own gradient over the
    // footprint + a margin so the grid/sparkles can't sit in the quiet zone, but it's invisible (same
    // gradient) so there's no visible panel. Bright accent modules on that dark field = inverted QR.
    var n = qr.size, mods = qr.modules, box = 272, bx = 1200 - 82 - box, by = 190; // centered between wordmark & url
    var cell = box / n, q = Math.round(4 * cell);
    var modC = mixHex(accent, '#ffffff', 0.16), eye = mixHex(accent, '#ffffff', 0.32), gap = mixHex('#0a0f17', accent, 0.10);
    var qg = x.createLinearGradient(0, 0, 1200, 630); qg.addColorStop(0, '#0a0f17'); qg.addColorStop(1, '#121a28');
    // clean quiet field = the card's own gradient, ROUNDED corners so the patch looks intentional (the
    // corners are far from the finder patterns, so rounding doesn't affect scanning)
    x.fillStyle = qg; rr(bx - q, by - q, box + 2 * q, box + 2 * q, 26); x.fill();
    // integer, gapless module grid — shared pixel edges, no anti-aliased seams
    var mx = function (i) { return Math.round(bx + i * cell); }, my = function (i) { return Math.round(by + i * cell); };
    var inFinder = function (r, c) { return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7); };
    x.fillStyle = modC;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) { if (mods[r][c] && !inFinder(r, c)) { var X = mx(c), Y = my(r); x.fillRect(X, Y, mx(c + 1) - X, my(r + 1) - Y); } }
    var eyeAt = function (fr, fc) { // square (crisp) finder eyes — standard shape scans most reliably
      var X = mx(fc), Y = my(fr);
      x.fillStyle = eye; x.fillRect(X, Y, mx(fc + 7) - X, my(fr + 7) - Y);                                     // bright outer 7×7
      x.fillStyle = gap; x.fillRect(mx(fc + 1), my(fr + 1), mx(fc + 6) - mx(fc + 1), my(fr + 6) - my(fr + 1));  // dark gap ring
      x.fillStyle = eye; x.fillRect(mx(fc + 2), my(fr + 2), mx(fc + 5) - mx(fc + 2), my(fr + 5) - my(fr + 2));  // bright 3×3 centre
    };
    eyeAt(0, 0); eyeAt(0, n - 7); eyeAt(n - 7, 0);
  }
  // Score-card PNG (1200×630) — "neon marquee": themed by the game's accent (top glow, perspective
  // grid floor, glowing frame, white→accent gradient score, baked sparkles), the game's icon emoji
  // drawn bare with an accent glow top-left (NOT the boxed PWA icon png), mascot logo + stacked
  // KOMYO/GAMES wordmark top-right, ▶ play-on CTA bottom-right. opts: { slug, title, accent, icon,
  // score, scoreText, label ('SCORE'|'TIME'), sub, player, mascot } — 'TIME' renders a step smaller.
  function buildScoreCard(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      try {
        if (typeof document === 'undefined' || !document.createElement) return resolve(null);
        var c = document.createElement('canvas'); c.width = 1200; c.height = 630;
        var x = c.getContext && c.getContext('2d'); if (!x) return resolve(null);
        var W = 1200, H = 630, accent = opts.accent || '#9fe8ff';
        var who = opts.player || (typeof player === 'function' ? player() : t('card.anonymous'));
        var rr = function (X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
        var lsp = function (v) { try { x.letterSpacing = v; } catch (e) {} };
        var noFx = function () { x.globalAlpha = 1; x.shadowBlur = 0; lsp('0px'); };
        // base
        var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a0f17'); g.addColorStop(1, '#121a28');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        // top accent glow (wide ellipse, like the mock's 70%×60% radial)
        try { x.save(); x.translate(W / 2, -70); x.scale(1.7, 1); var rg = x.createRadialGradient(0, 0, 30, 0, 0, 420); rg.addColorStop(0, accent); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 0.34; x.fillStyle = rg; x.fillRect(-W, 0, W * 2, H + 100); x.restore(); noFx(); } catch (e) {}
        // perspective grid floor
        var hz = H * 0.55, cx2 = W / 2;
        x.strokeStyle = accent; x.lineWidth = 1;
        x.globalAlpha = 0.1;
        for (var gi = -7; gi <= 7; gi++) { x.beginPath(); x.moveTo(cx2 + gi * 108, hz); x.lineTo(cx2 + gi * 108 * 2.6, H + 40); x.stroke(); }
        x.globalAlpha = 0.08;
        for (var gj = 1; gj <= 6; gj++) { var gy = hz + (H - hz) * Math.pow(gj / 6, 1.8); x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
        noFx();
        // frame — exact port of the mock's box-shadow pair. Both glows are the shadow of the frame's
        // SOLID silhouette (full intensity at the edge — a stroked line's shadow is far too faint):
        // outer `0 0 1.1em accent40%` + inset `0 0 1.4em accent14%`, then the crisp 1px border.
        // Offset-shadow trick: the filled shape is drawn 2000px off-canvas so only its shadow lands
        // in view, clipped to the side it belongs to.
        var FR = function () { var X = 42, Y = 42, w2 = W - 84, h2 = H - 84, r2 = 30; x.moveTo(X + r2, Y); x.arcTo(X + w2, Y, X + w2, Y + h2, r2); x.arcTo(X + w2, Y + h2, X, Y + h2, r2); x.arcTo(X, Y + h2, X, Y, r2); x.arcTo(X, Y, X + w2, Y, r2); x.closePath(); };
        x.save(); x.beginPath(); x.rect(0, 0, W, H); FR(); x.clip('evenodd');
        x.shadowColor = accent; x.globalAlpha = 0.4; x.shadowBlur = 42; x.shadowOffsetX = 2000; x.translate(-2000, 0);
        x.beginPath(); FR(); x.fillStyle = '#000'; x.fill(); x.restore();
        x.save(); x.beginPath(); FR(); x.clip();
        x.shadowColor = accent; x.globalAlpha = 0.14; x.shadowBlur = 54; x.shadowOffsetX = 2000; x.translate(-2000, 0);
        x.beginPath(); x.rect(-200, -200, W + 400, H + 400); FR(); x.fillStyle = '#000'; x.fill('evenodd'); x.restore(); noFx();
        x.strokeStyle = accent; x.globalAlpha = 0.65; x.lineWidth = 3; rr(42, 42, W - 84, H - 84, 30); x.stroke(); noFx();
        // sparkles — big soft halos (the mock's box-shadow blur is 4× the dot size)
        for (var pi = 0; pi < 16; pi++) {
          var psz = 3 + Math.random() * 12, px2 = W * (0.03 + Math.random() * 0.94), py2 = H * (0.06 + Math.random() * 0.88);
          var pa = (Math.random() * 0.5 + 0.35) * 0.7, hr = psz * 3.2;
          try { var hg = x.createRadialGradient(px2, py2, 0, px2, py2, hr); hg.addColorStop(0, accent); hg.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = pa * 0.35; x.fillStyle = hg; x.beginPath(); x.arc(px2, py2, hr, 0, 6.29); x.fill(); } catch (e) {}
          x.globalAlpha = pa; x.fillStyle = Math.random() < 0.35 ? '#fff' : accent;
          x.beginPath(); x.arc(px2, py2, psz / 2, 0, 6.29); x.fill();
        }
        noFx();
        x.textAlign = 'left';
        // game title (ellipsized so it can't reach the brand) + mode
        var title = String(opts.title || 'Komyo Games');
        x.fillStyle = '#eef4fc'; x.font = '700 64px system-ui, sans-serif';
        while (title.length > 2 && x.measureText(title).width > 590) title = title.replace(/…?$/, '').slice(0, -1) + '…';
        x.fillText(title, 288, 130);
        if (opts.sub) {
          // mode/difficulty — clamped to a width that clears the right-side art (wordmark + QR quiet
          // zone, whose gradient repaint would otherwise cut it off). Shrink to fit, ellipsize last.
          var subTxt = String(opts.sub).toUpperCase(), subFs = 32, subMaxW = 480;
          x.fillStyle = '#9fb2c8'; lsp('5px');
          while (subFs > 20) { x.font = '600 ' + subFs + 'px ui-monospace, monospace'; if (x.measureText(subTxt).width <= subMaxW) break; subFs -= 2; }
          x.font = '600 ' + subFs + 'px ui-monospace, monospace';
          while (subTxt.length > 2 && x.measureText(subTxt).width > subMaxW) subTxt = subTxt.replace(/…?$/, '').slice(0, -1) + '…';
          x.fillText(subTxt, 290, 192); lsp('0px');
        }
        // label + gradient score (TIME strings are wider → a step smaller)
        var isTime = (opts.label || '') === 'TIME';
        x.fillStyle = '#67788f'; x.font = '600 30px ui-monospace, monospace'; lsp('9px'); x.fillText(isTime ? t('card.time') : t('card.score'), 88, 268); lsp('0px');
        var scoreText = String(opts.scoreText != null ? opts.scoreText : (opts.score || 0));
        var fs = isTime ? 157 : 192, sy = 265;
        var sg = x.createLinearGradient(0, sy, 0, sy + fs);
        sg.addColorStop(0.12, '#ffffff'); sg.addColorStop(0.58, accent); sg.addColorStop(1, mixHex(accent, '#ffffff', 0.45));
        // tight accent halo + crisp gradient fill on top — the shine lives in the gradient contrast
        // (white top edge → saturated accent), not in a wide haze
        var sbx = 84, sby = sy + fs * 0.82;
        x.font = '800 ' + fs + 'px system-ui, sans-serif'; x.shadowColor = accent; x.fillStyle = accent;
        x.globalAlpha = 0.75; x.shadowBlur = 20; x.fillText(scoreText, sbx, sby);
        noFx(); x.fillStyle = sg; x.fillText(scoreText, sbx, sby);
        // player
        x.fillStyle = '#cdd9e8'; x.font = '600 36px system-ui, sans-serif'; x.fillText('— ' + who, 86, H - 62);
        // www.komyo.online stays bottom-right (unchanged)
        x.textAlign = 'right';
        x.fillStyle = '#dfe9f5'; x.font = '700 40px ui-monospace, monospace'; x.fillText('www.komyo.online', W - 82, H - 60);
        x.textAlign = 'left';
        // (the ▶ play-on CTA is drawn LATER, after the QR — see the async block — so the QR's
        // quiet-zone gradient repaint can't paint over it)
        // async art: the game's own icon (top-left) + the mascot logo & stacked wordmark (top-right)
        var loadImg = function (src) {
          return new Promise(function (res) {
            try {
              var im = new Image(), done = false;
              im.onload = function () { if (!done) { done = true; res(im); } };
              im.onerror = function () { if (!done) { done = true; res(null); } };
              im.src = src;
              if (typeof setTimeout === 'function') setTimeout(function () { if (!done) { done = true; res(null); } }, 1500);
            } catch (e) { res(null); }
          });
        };
        // Output = 1200×630, the full drawn resolution (a 780×410 export pixelated on zoom/hi-DPI;
        // the Discord post still gets a halved copy via shrinkBlob) — a ROUNDED-corner
        // card on transparency (WebP keeps the alpha; the Safari JPEG fallback squares off dark).
        // WebP ≈ 10× smaller than PNG for this gradient-heavy art; browsers without a WebP encoder
        // (Safari) silently hand back PNG → re-encode as JPEG there.
        var finish = function () {
          try {
            var out = c;
            try {
              var R = 40, S = 1;
              var c2 = document.createElement('canvas');
              c2.width = Math.round(W * S); c2.height = Math.round(H * S);
              var g2 = c2.getContext('2d'); g2.scale(S, S);
              g2.beginPath(); g2.moveTo(R, 0); g2.arcTo(W, 0, W, H, R); g2.arcTo(W, H, 0, H, R); g2.arcTo(0, H, 0, 0, R); g2.arcTo(0, 0, W, 0, R); g2.closePath();
              g2.clip(); g2.drawImage(c, 0, 0);
              out = c2;
            } catch (e) {}
            // opts.target: draw the finished card straight onto a caller-supplied canvas (used by the
            // headless PNG render — captures a canvas reliably, unlike a blob→<img> under virtual time)
            try { if (opts.target && opts.target.getContext) { opts.target.width = W; opts.target.height = H; opts.target.getContext('2d').drawImage(out, 0, 0); } } catch (e) {}
            if (!out.toBlob) return resolve(null);
            if (opts.png) { out.toBlob(function (b) { resolve(b); }, 'image/png'); return; } // lossless (print / hi-res render)
            out.toBlob(function (b) {
              if (b && b.type === 'image/webp') return resolve(b);
              out.toBlob(function (b2) { resolve(b2 || b || null); }, 'image/jpeg', 0.85);
            }, 'image/webp', 0.85);
          } catch (e) { resolve(null); }
        };
        // icon centers on the title+mode BLOCK (title alone when there's no mode row)
        if (opts.icon) { x.shadowColor = accent; x.font = '120px system-ui, sans-serif'; x.globalAlpha = 0.9; x.shadowBlur = 26; x.fillText(String(opts.icon), 84, opts.sub ? 182 : 158); noFx(); }
        Promise.all([
          loadImg(opts.mascot || '../../mascot-head.svg'),
          (opts.url || opts.qrUrl) ? ensureQR() : Promise.resolve(null)
        ]).then(function (parts) {
          var logo = parts[0], QRlib = parts[1];
          try {
            // wordmark right-aligned to the card's right margin (W-82) so its right edge lines up with
            // www.komyo.online + the QR; the logo sits just left of it.
            var RX = W - 82;
            x.fillStyle = accent; x.font = '800 36px system-ui, sans-serif'; lsp('5px'); x.textAlign = 'right';
            x.fillText('KOMYO', RX, 95); x.fillText('GAMES', RX, 139);
            var wmW = Math.max(x.measureText('KOMYO').width, x.measureText('GAMES').width);
            x.textAlign = 'left'; lsp('0px');
            var logoX = RX - wmW - 20 - 100;
            if (logo) x.drawImage(logo, logoX, 54, 100, 100);
            else { x.font = '86px system-ui, sans-serif'; x.fillText('🦊', logoX, 134); }
          } catch (e) {}
          // scan-to-play QR of the share URL (game link only; short → fewer modules → scans small)
          try { var qsrc = opts.qrUrl || opts.url, qr = (QRlib && qsrc) ? (QRlib.encode(qsrc) || QRlib.encode(qsrc.split('&utm_')[0])) : null; if (qr) drawCardQR(x, rr, qr, accent); } catch (e) {}
          // ▶ play-on CTA — drawn AFTER the QR so its quiet-zone repaint can't cover it. With a QR it's
          // centered under it (QR bottom ~440); otherwise bottom-right above the url.
          try {
            var playOn = t('card.playOn');
            x.fillStyle = '#8ea2ba'; x.font = '600 27px ui-monospace, monospace'; lsp('7.5px');
            if (opts.url) {
              var cxQ = W - 82 - 136, ctaY = 496; // centered group: QR bottom ~462, play-on below, above the url
              var pwc = x.measureText(playOn).width, gp = 10, gx = cxQ - (24 + gp + pwc) / 2, tyc = ctaY - 10;
              x.fillStyle = accent; x.beginPath(); x.moveTo(gx, tyc - 15); x.lineTo(gx, tyc + 15); x.lineTo(gx + 24, tyc); x.closePath(); x.fill();
              x.fillStyle = '#8ea2ba'; x.textAlign = 'left'; x.fillText(playOn, gx + 24 + gp, ctaY); lsp('0px');
            } else {
              x.textAlign = 'right'; var cy = H - 132; x.fillText(playOn, W - 82, cy); var pw = x.measureText(playOn).width; lsp('0px');
              x.fillStyle = accent; x.beginPath(); var tx = W - 82 - pw - 30, ty = cy - 10;
              x.moveTo(tx, ty - 15); x.lineTo(tx, ty + 15); x.lineTo(tx + 24, ty); x.closePath(); x.fill();
              x.textAlign = 'left';
            }
          } catch (e) {}
          finish();
        });
      } catch (e) { resolve(null); }
    });
  }
  // A shareable "My Profile" card: header + a stats row + a list of top games.
  // opts: { player, accent, stats:[{label,value}], rows:[{name,best,mode,accent}] }
  function buildProfileCard(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      try {
        if (typeof document === 'undefined' || !document.createElement) return resolve(null);
        var c = document.createElement('canvas'); c.width = 1200; c.height = 630;
        var x = c.getContext && c.getContext('2d'); if (!x) return resolve(null);
        var W = 1200, H = 630, accent = opts.accent || '#9fe8ff';
        var who = opts.player || (typeof player === 'function' ? player() : t('card.anonymous'));
        var rr = function (X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
        var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a0f17'); g.addColorStop(1, '#121a28'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        try { var rg = x.createRadialGradient(W - 200, 150, 40, W - 200, 150, 620); rg.addColorStop(0, accent); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 0.14; x.fillStyle = rg; x.fillRect(0, 0, W, H); x.globalAlpha = 1; } catch (e) {}
        x.fillStyle = 'rgba(255,255,255,0.02)'; rr(36, 36, W - 72, H - 72, 28); x.fill();
        x.strokeStyle = accent; x.globalAlpha = 0.5; x.lineWidth = 2; rr(36, 36, W - 72, H - 72, 28); x.stroke(); x.globalAlpha = 1;
        x.fillStyle = accent; rr(36, 36, 12, H - 72, 6); x.fill();
        x.textAlign = 'left';
        x.fillStyle = accent; x.font = '800 28px system-ui, sans-serif'; x.fillText('KOMYO GAMES', 92, 104);
        // avatar glyph: a simple blob head + shoulders, in the accent
        var ax = 108; x.fillStyle = accent;
        x.beginPath(); x.arc(ax, 138, 16, 0, 7); x.fill();                 // head
        x.beginPath(); x.arc(ax, 196, 30, Math.PI, 2 * Math.PI); x.fill(); // shoulders (upward dome)
        x.fillStyle = '#eef4fc'; x.font = '700 52px system-ui, sans-serif'; x.fillText(who, ax + 52, 172);
        var stats = opts.stats || [], sx = 92;
        for (var i = 0; i < stats.length; i++) {
          x.fillStyle = accent; x.font = '800 44px system-ui, sans-serif'; var v = String(stats[i].value); x.fillText(v, sx, 252);
          x.fillStyle = '#8aa0ba'; x.font = '600 19px ui-monospace, monospace'; x.fillText(String(stats[i].label).toUpperCase(), sx, 286);
          sx += Math.max(x.measureText(v).width, 140) + 56;
        }
        var yDiv = 314;
        // cosmetics collection bar (matches the profile page) — drawn when progress is supplied
        if (opts.collection && opts.collection.total) {
          var col = opts.collection, cx0 = 92, cw = W - 184, cy0 = 306, bh = 13;
          x.textAlign = 'left'; x.fillStyle = '#8aa0ba'; x.font = '600 19px ui-monospace, monospace'; x.fillText(t('card.collection'), cx0, cy0);
          x.textAlign = 'right'; x.fillStyle = accent; x.fillText((col.owned || 0) + ' / ' + (col.total || 0) + ' · ' + Math.round((col.pct || 0) * 100) + '%', W - 92, cy0); x.textAlign = 'left';
          var by = cy0 + 12;
          x.fillStyle = 'rgba(255,255,255,0.09)'; rr(cx0, by, cw, bh, 6); x.fill();
          var fillW = Math.max(bh, cw * (col.pct || 0));
          var lg = x.createLinearGradient(cx0, 0, cx0 + cw, 0); lg.addColorStop(0, '#ffd166'); lg.addColorStop(1, '#ff9a5c');
          x.fillStyle = lg; rr(cx0, by, fillW, bh, 6); x.fill();
          yDiv = by + bh + 22;
        }
        x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 1; x.beginPath(); x.moveTo(92, yDiv); x.lineTo(W - 92, yDiv); x.stroke();
        var rows = opts.rows || [], y = yDiv + 44, maxRows = opts.collection ? 5 : 6;
        for (var r2 = 0; r2 < rows.length && r2 < maxRows; r2++) {
          var row = rows[r2];
          x.fillStyle = row.accent || '#cdd9e8'; x.beginPath(); x.arc(104, y - 10, 7, 0, 7); x.fill();
          x.textAlign = 'left'; x.fillStyle = '#dfe8f4'; x.font = '600 30px system-ui, sans-serif'; x.fillText(String(row.name), 126, y);
          x.textAlign = 'right'; x.fillStyle = accent; x.font = '700 30px ui-monospace, monospace'; x.fillText(String(row.best), W - 96, y);
          if (row.mode) { x.fillStyle = '#7a8aa0'; x.font = '400 19px system-ui, sans-serif'; x.fillText(String(row.mode), W - 96, y + 23); }
          y += (row.mode ? 58 : 46);
        }
        x.textAlign = 'right'; x.fillStyle = '#7a8aa0'; x.font = '600 28px ui-monospace, monospace'; x.fillText('komyo.online', W - 92, H - 66); x.textAlign = 'left';
        try { if (c.toBlob) c.toBlob(function (b) { resolve(b || null); }, 'image/png'); else resolve(null); } catch (e) { resolve(null); }
      } catch (e) { resolve(null); }
    });
  }
  function downloadBlob(blob, name) {
    try {
      var u = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = u; a.download = name; (document.body || document.documentElement).appendChild(a); a.click();
      setTimeout(function () { try { URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); } catch (e) {} }, 1000);
    } catch (e) {}
  }
  // share the card via a small in-page menu: Share… (native sheet — direct app targets), Copy image
  // (our own single-flavor PNG write; the OS sheet's Copy writes multiple clipboard flavors, which
  // Discord/chat paste as TWO images), Download. Same menu on every platform; per-action detection.
  function shareCardBlob(blob, opts) {
    if (!blob) return;
    opts = opts || {};
    var ext = blob.type === 'image/webp' ? '.webp' : blob.type === 'image/jpeg' ? '.jpg' : '.png';
    var name = (opts.slug || 'komyo') + '-score' + ext;
    if (typeof document === 'undefined' || !document.body) return;
    // clipboards only take image/png — re-encode the (webp/jpeg) card on demand for the Copy action
    var toPng = function (b) {
      if (b.type === 'image/png') return Promise.resolve(b);
      return new Promise(function (res, rej) {
        try {
          var u = URL.createObjectURL(b), im = new Image();
          im.onload = function () {
            try {
              var cc = document.createElement('canvas'); cc.width = im.naturalWidth; cc.height = im.naturalHeight;
              cc.getContext('2d').drawImage(im, 0, 0); URL.revokeObjectURL(u);
              cc.toBlob(function (p) { p ? res(p) : rej(new Error('png')); }, 'image/png');
            } catch (e) { rej(e); }
          };
          im.onerror = function () { try { URL.revokeObjectURL(u); } catch (e) {} rej(new Error('img')); };
          im.src = u;
        } catch (e) { rej(e); }
      });
    };
    var file = null;
    try { if (typeof File !== 'undefined') file = new File([blob], name, { type: blob.type || 'image/png' }); } catch (e) {}
    var canNative = false, canCopy = false;
    try { canNative = !!(file && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share); } catch (e) {}
    try { canCopy = !!(typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.write); } catch (e) {}
    var url = '';
    try { if (typeof URL !== 'undefined' && URL.createObjectURL) url = URL.createObjectURL(blob); } catch (e) {}
    var ov = document.createElement('div'); ov.className = 'gamekit-confirm';
    ov.innerHTML = '<div class="gamekit-confirm-box gamekit-sharemenu">'
      + (url ? '<img class="gamekit-sm-preview" alt="" src="' + url + '">' : '')
      + '<div class="gamekit-sm-btns">'
      + (canNative ? '<button class="gamekit-sm-share" type="button">' + t('card.shareBtn') + '</button>' : '')
      + (canCopy ? '<button class="gamekit-sm-copy" type="button">' + t('card.copyImage') + '</button>' : '')
      + '<button class="gamekit-sm-dl" type="button">' + t('card.download') + '</button>'
      + '<button class="gamekit-sm-x" type="button">' + t('menu.close') + '</button>'
      + '</div></div>';
    // mount inside an open <dialog> when there is one (e.g. the profile modal) — the top layer
    // renders above any z-index, so a body-level overlay would be invisible behind it
    var host = document.body;
    try { var dlg = document.querySelector('dialog[open]'); if (dlg) host = dlg; } catch (e) {}
    host.appendChild(ov);
    var done = false;
    function close() {
      if (done) return; done = true; modalDec();
      try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
      try { if (url) URL.revokeObjectURL(url); } catch (e) {}
      try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
    }
    function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.preventDefault) e.preventDefault(); close(); } }
    var q = function (sel) { try { return ov.querySelector(sel); } catch (e) { return null; } };
    var bShare = q('.gamekit-sm-share'), bCopy = q('.gamekit-sm-copy'), bDl = q('.gamekit-sm-dl'), bX = q('.gamekit-sm-x');
    if (bShare) bShare.addEventListener('click', function () {
      close();
      // attach the card image AND the link/text: targets that take files show the card, the rest keep the link
      var data = { files: [file], title: opts.title || 'Komyo Games' };
      if (opts.text) data.text = opts.text;
      if (opts.url) data.url = opts.url;
      try { navigator.share(data)['catch'](function () {}); } catch (e) {}
    });
    if (bCopy) bCopy.addEventListener('click', function () {
      try {
        // promise-valued ClipboardItem keeps the write inside the user gesture (Safari requires it)
        navigator.clipboard.write([new ClipboardItem({ 'image/png': toPng(blob) })]).then(function () {
          bCopy.textContent = t('card.copied');
          if (typeof setTimeout === 'function') setTimeout(close, 900); else close();
        }, function () { downloadBlob(blob, name); close(); });
      } catch (e) { downloadBlob(blob, name); close(); }
    });
    if (bDl) bDl.addEventListener('click', function () { downloadBlob(blob, name); close(); });
    if (bX) bX.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    modalInc();
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
  }

  function shareRow(el, o) {
    if (!el) return;
    o = o || {};
    var base = o.url || ('https://komyo.online/games/' + (o.slug || '') + '/');
    // optional o.params (object or fn) → appended as a query string so a shared link
    // deep-links back to the same mode (the game preselects it on load).
    function getUrl() {
      if (!o.params) return base;
      try {
        var p = (typeof o.params === 'function') ? o.params() : o.params;
        var qs = (typeof URLSearchParams !== 'undefined') ? new URLSearchParams(p || {}).toString() : '';
        return qs ? base.replace(/\/+$/, '') + '?' + qs : base; // drop trailing slash before query for a cleaner link
      } catch (e) { return base; }
    }
    var title = o.title || 'Komyo Games';
    var getMsg = (typeof o.message === 'function') ? o.message : function () { return o.message || ''; };
    // Score-card first: the end screen shows the branded card inline (it IS the shareable artifact,
    // personalised to the run) + ONE Share button that opens the image menu (native w/ image+link,
    // copy image, download). No X/Reddit/copy-link buttons — a link web-intent can't carry the card,
    // and the native sheet already lists every app on mobile.
    if (el.classList) el.classList.add('gamekit-share', 'gamekit-share-card');
    el.innerHTML =
      '<img class="gkshare-card" alt="" style="display:none">' +
      '<button class="gkshare-btn" type="button" data-act="card">' + SVG.card + '<span>' + t('share.share') + '</span></button>';
    var q = function (sel) { try { return el.querySelector ? el.querySelector(sel) : null; } catch (e) { return null; } };
    var cardImg = q('.gkshare-card'), cardBtn = q('[data-act="card"]');
    // card options from the last recorded result (recordResult ran earlier in menu.show) — shared by
    // the inline render, the Share button and the Discord auto-post. A game may pass o.card to customise.
    var cardOpts = function () {
      var lr = lastResult(o.slug) || {};
      var extra = (typeof o.card === 'function') ? (o.card() || {}) : (o.card || {});
      var score = (extra.score != null) ? extra.score : (lr.score || 0);
      var opts = {
        title: o.title || 'Komyo Games', slug: o.slug,
        accent: extra.accent || o.accent, mascot: extra.mascot || o.mascot, icon: extra.icon || o.icon,
        score: score, scoreText: (typeof score === 'number' && score.toLocaleString) ? score.toLocaleString() : String(score),
        sub: (extra.sub != null) ? extra.sub : (lr.modeText || lr.mode || ''), // localized display, not the stable store key
        // the shareable link keeps the mode/diff deep-link; the QR drops them (shorter URL = fewer QR
        // modules = bigger, easier to scan when printed small). Source 'sc' (scorecard), kept short too.
        url: withUtm(getUrl(), 'sc', 'share'), qrUrl: withUtm(base, 'sc', 'qr'), text: getMsg(),
      };
      // speedrun/sprint modes: the record IS the time (same rule as the profile) → TIME card
      if (/speedrun|sprint/i.test(String(opts.sub)) && extra.score == null && lr.time > 0) { opts.label = 'TIME'; opts.scoreText = fmtMs(lr.time); }
      return opts;
    };
    // render the card inline once (async, headless-safe → resolves null → just the button); reuse the
    // rendered blob when the player taps Share so we don't re-render.
    var _blob = null, _blobUrl = '';
    var openMenu = function () {
      if (_blob) { shareCardBlob(_blob, cardOpts()); return; }
      var opts = cardOpts(); buildScoreCard(opts).then(function (b) { shareCardBlob(b, opts); });
    };
    try {
      buildScoreCard(cardOpts()).then(function (b) {
        _blob = b || null;
        if (b && cardImg) { try { _blobUrl = URL.createObjectURL(b); cardImg.src = _blobUrl; if (cardImg.style) cardImg.style.display = ''; } catch (e) {} }
      });
    } catch (e) {}
    if (cardBtn) cardBtn.addEventListener('click', openMenu);
    if (cardImg) cardImg.addEventListener('click', openMenu); // tapping the card itself opens the menu too
    // auto-post the score to the Komyo Games Discord when the end-screen share row is on-screen.
    // Handles BOTH patterns: built once at init (hidden → shown later) AND rebuilt at game-over
    // (already visible). Gated by discordTier() (consent → anonymous, opt-in → named).
    // Dedupe + 60s throttle — the state lives at MODULE level (_dcLastMsg/_dcLastAt): the share
    // row is rebuilt on every game-over, so closure-local state reset each run and a player
    // finishing several runs back-to-back spammed the channel. Zero-score runs never post.
    (function () {
      var visible = function () { try { return !!(el.getClientRects && el.getClientRects().length); } catch (e) { return false; } };
      var maybePost = function () {
        if (!visible()) return;
        var tier = discordTier();
        if (tier === 'off') return;
        var lr = lastResult(o.slug) || {};
        if (!((lr.score | 0) > 0 || (lr.time | 0) > 0)) return; // nothing worth announcing
        var msg = getMsg(), now = (typeof Date !== 'undefined' ? Date.now() : 0);
        if (!msg || msg === _dcLastMsg || now - _dcLastAt <= 60000) return;
        _dcLastMsg = msg; _dcLastAt = now;   // claim BEFORE the async card render (no double-fire)
        var who = tier === 'named' ? ((player() || 'anonymous').replace(/[@`]/g, '').slice(0, 24) || 'anonymous') : 'anonymous';
        // post the score card image (downscaled 50% for chat); text line = fallback if the render fails
        var opts = cardOpts(); opts.player = who;
        buildScoreCard(opts).then(function (b) {
          var durl = withUtm(getUrl(), 'sc', 'discord');
          if (!b) return postDiscord('**' + who + '** — ' + msg, durl);
          shrinkBlob(b, 0.5).then(function (s) { postDiscord('', durl, s); });
        });
      };
      if (typeof setTimeout === 'function') setTimeout(maybePost, 0);   // already-visible (built at game-over)
      if (typeof IntersectionObserver !== 'undefined') {               // hidden → shown later (built at init)
        try {
          if (el._gkIO) el._gkIO.disconnect();
          var io = new IntersectionObserver(function (es) { for (var k = 0; k < es.length; k++) if (es[k].isIntersecting) maybePost(); }, { threshold: 0.5 });
          el._gkIO = io; io.observe(el);
        } catch (e) {}
      }
    })();
  }

  // ---------- PWA auto-update ----------
  // ONE root-scope worker serves the whole site (catalogue + every game). Pages under /games/<slug>/
  // register it as '../../sw.js'; the catalogue as 'sw.js'.
  function pwa(file) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    var prevCtl = navigator.serviceWorker.controller || null;
    // A new worker took control. Two cases, told apart by the worker SCRIPT URL (not a timing guess):
    //  - different URL → scope hand-over (a legacy per-game worker giving way to the root one during
    //    the single-SW migration) — same build, not an update, ignore;
    //  - same URL → a genuinely new build of THIS page's worker is live. We NEVER auto-reload the
    //    visible page for it: a new build just lights the ☰ badge / catalogue "Update now" and the
    //    player applies it when they choose. The ONLY reload is an explicit Update (_upApplying) —
    //    there is no backgrounded-tab auto-reload (updates are fully player-initiated).
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      var ctl = navigator.serviceWorker.controller || null;
      var handover = !prevCtl || !ctl || (ctl.scriptURL !== prevCtl.scriptURL);
      prevCtl = ctl;
      if (_swReloaded) return;
      if (_upApplying) { doReload(); return; }             // the player pressed Update — finish it
      if (handover) return;
      _upState.available = true; _upState.controlled = true; upEmit(); // new build controls → badge only, never auto-reload
    });
    var register = function () {
      try {
        navigator.serviceWorker.register(file || 'sw.js').then(function (r) {
          try { r.update(); } catch (e) {}
          setInterval(function () { try { r.update(); } catch (e) {} }, 3600000);
        }).catch(function () {});
        // migration sweep: legacy per-game registrations (pre single-SW) would shadow the root
        // scope on /games/<slug>/ pages forever — unregister every non-root scope
        if (navigator.serviceWorker.getRegistrations) {
          navigator.serviceWorker.getRegistrations().then(function (regs) {
            regs.forEach(function (reg) {
              try { if (new URL(reg.scope).pathname !== '/') reg.unregister(); } catch (e) {}
            });
          }).catch(function () {});
        }
      } catch (e) {}
    };
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('load', register); else register();
  }

  // ---------- layout: orientation + debounced relayout (resize / orientationchange / visualViewport) ----------
  // Games register a relayout callback with gamekit.layout.on(fn); the kit fires it (coalesced into
  // one rAF) on resize, orientationchange AND visualViewport changes — so rotation actually re-lays-
  // out (most games previously listened only for `resize`, which fires late/stale on rotate). It does
  // NOT fire on registration: every game already calls its own resize() at boot, so this is purely
  // additive. `hudTop()` is the one source for the center HUD headroom (clears nav + sound menu).
  var layoutCbs = [], layoutWired = false, layoutRaf = 0;
  function vw() { try { return (typeof window !== 'undefined' && window.innerWidth) || 0; } catch (e) { return 0; } }
  function vh() { try { return (typeof window !== 'undefined' && window.innerHeight) || 0; } catch (e) { return 0; } }
  function isPortrait() { return vh() > vw(); }
  function isNarrow() { var w = vw(); return isPortrait() || (w > 0 && w <= 560); }
  function layoutState() { return { w: vw(), h: vh(), portrait: isPortrait(), landscape: !isPortrait(), narrow: isNarrow(), hudTop: isNarrow() ? 92 : 48 }; }
  function fireLayout() { var st = layoutState(); for (var i = 0; i < layoutCbs.length; i++) { try { layoutCbs[i](st); } catch (e) {} } }
  function scheduleLayout() {
    if (typeof requestAnimationFrame === 'function') { if (layoutRaf) return; layoutRaf = requestAnimationFrame(function () { layoutRaf = 0; fireLayout(); }); }
    else fireLayout();
  }
  function wireLayout() {
    if (layoutWired || typeof window === 'undefined' || !window.addEventListener) return;
    layoutWired = true;
    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', scheduleLayout);
    try { var vv = window.visualViewport; if (vv && vv.addEventListener) { vv.addEventListener('resize', scheduleLayout); vv.addEventListener('scroll', scheduleLayout); } } catch (e) {}
  }
  var layout = {
    get w() { return vw(); }, get h() { return vh(); },
    get portrait() { return isPortrait(); }, get landscape() { return !isPortrait(); }, get narrow() { return isNarrow(); },
    hudTop: function () { return isNarrow() ? 92 : 48; },
    state: layoutState,
    on: function (cb) { if (typeof cb === 'function') { layoutCbs.push(cb); wireLayout(); } return layout; },
    // Lock-and-inform: show a "rotate your phone" overlay when the orientation isn't what the game
    // needs (for the few games that can't do both). Returns true when the wanted orientation is met.
    requireOrientation: function (want) {
      if (!want || typeof document === 'undefined' || !document.body) return true;
      var ok = (want === 'portrait') ? isPortrait() : !isPortrait();
      var el = document.getElementById('gamekitRotate');
      if (!ok && !el && document.createElement) {
        el = document.createElement('div'); el.id = 'gamekitRotate'; el.className = 'gamekit-rotate';
        el.innerHTML = '<div class="gamekit-rotate-box"><div class="gamekit-rotate-ico">↻</div><div>' + t('kit.rotate') + '</div></div>';
        document.body.appendChild(el);
      }
      if (el && el.classList) el.classList.toggle('show', !ok);
      // keep the left nav (‹ Menu · Komyo ›) clickable ABOVE the splash so the player can leave
      // without rotating; the right cluster stays under it (its panels would open behind the splash)
      try { if (document.body.classList) document.body.classList.toggle('gk-rotate-lock', !ok); } catch (e) {}
      return ok;
    },
    // test hook: set mocked dims (guarded — innerWidth is read-only in real browsers) + relayout now.
    __emit: function (w, h) { try { if (typeof window !== 'undefined') { if (w != null) window.innerWidth = w; if (h != null) window.innerHeight = h; } } catch (e) {} fireLayout(); },
  };

  // ---------- fitCanvas: the ONE canvas sizing + DPR policy ----------
  // The game computes its CSS size (each has its own playfield policy) and calls this from its
  // resize path; the kit sets the CSS box, scales the backing store by devicePixelRatio (capped
  // at 2, headless-safe → 1) and applies the matching transform, so game code keeps drawing in
  // CSS pixels. Omit w/h for a full-viewport canvas. {dpr:false} opts out (scaled-world canvases
  // that manage their own transforms); games that call ctx.setTransform with absolute values must
  // compose the returned dpr in (or opt out). Reads of canvas.width in game logic should switch
  // to the game's own W/H (CSS px) — the backing store is dpr-scaled.
  function fitCanvas(canvas, w, h, opts) {
    opts = opts || {};
    if (w == null) w = vw();
    if (h == null) h = vh();
    var dpr = 1;
    if (opts.dpr !== false) { try { dpr = Math.min(Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1), opts.maxDpr || 2); } catch (e) {} }
    try {
      if (canvas.style) { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      var g = canvas.getContext && canvas.getContext('2d');
      if (g && g.setTransform) g.setTransform(dpr, 0, 0, dpr, 0, 0);
    } catch (e) {}
    return { w: w, h: h, dpr: dpr };
  }

  // Unlock/resume the AudioContext on user gestures. Browsers keep it SUSPENDED until a real gesture,
  // so on a fresh load / refresh nothing plays until the first tap or key — that's unavoidable. We
  // listen in the CAPTURE phase so a game canvas that calls stopPropagation can't swallow the gesture
  // (that was making music flaky, e.g. Bubble Pop), and keep listening (not `once`) so audio also
  // recovers after a tab-switch re-suspends the context.
  (function () {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    var unlock = function () {
      ensureAC(); if (!ac) return;                                  // create the context DURING the gesture
      if (ac.state === 'running') { startScheduler(); return; }
      try { var p = ac.resume(); if (p && p.then) p.then(startScheduler, function () {}); else startScheduler(); } catch (e) {}
    };
    var evs = ['pointerdown', 'touchstart', 'keydown'];
    for (var i = 0; i < evs.length; i++) {
      try { document.addEventListener(evs[i], unlock, { capture: true, passive: true }); }
      catch (e) { try { document.addEventListener(evs[i], unlock, true); } catch (_) {} }
    }
  })();

  // slug from the URL (/games/<slug>/) — used for the game_start analytics event
  function currentSlug() { try { var m = String(location.pathname).match(/\/games\/([^/]+)\//); return m ? m[1] : ''; } catch (e) { return ''; } }

  // ---------- "recently played" (for the catalogue's "pick up where you left off" strip) ----------
  // Recorded at the SAME moment as the game_start analytics event (entering gameplay from a menu via
  // 'play' or 'again') — i.e. a mode was actually chosen and Play was pressed, not just "opened the
  // page". Deliberately NOT tied to record()/end-of-run: long-round games (Keep Defender…) should
  // show up even if the player leaves mid-run. De-duped by slug (replaying bumps it to the front).
  var RECENT_KEY = 'gamekit_recent', RECENT_CAP = 12;
  function recentlyPlayed() {
    try { var a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function touchRecent(slug) {
    if (!slug) return;
    try {
      var a = recentlyPlayed().filter(function (r) { return r && r.slug !== slug; });
      a.unshift({ slug: slug, at: Date.now() });
      localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, RECENT_CAP)));
    } catch (e) {}
  }

  // ---------- "Tap to play" splash (start gate + audio unlock) ----------
  // Always shown once per game load — a normal start gate. It also doubles as the audio-unlock gesture:
  // browsers block audio until a user interacts, so the tap lets music start with the menu instead of
  // looking broken. Kept ALWAYS-ON (not gated on the music toggle) for consistency — everyone gets the
  // same behaviour, on every device, so there's nothing to explain. (Revisit only if players find the
  // screen annoying — see the komyo-audio-design note.)
  var _tapShown = false;
  function tapToStart() {
    try {
      if (_tapShown) return;                                   // once per page load — never re-show, even on fast clicks / re-entry
      if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return;
      if (ac && ac.state === 'running') return;                // audio already unlocked this load → nothing to gate, skip
      if (document.querySelector && document.querySelector('.gamekit-tap')) return;
      _tapShown = true;
      var el = document.createElement('div'); el.className = 'gamekit-tap';
      el.innerHTML = '<div class="gamekit-tap-inner"><div class="gamekit-tap-play">▶</div><div>' + t('kit.tapToPlay') + '</div><small></small></div>';
      try { var lab = el.querySelector('small'); if (lab) lab.textContent = (typeof document.title === 'string' && document.title) ? document.title : 'Komyo'; } catch (e) {}
      var gone = false;
      // the dismissing gesture must not leak underneath (it would instantly press a menu card/button):
      // dismiss on CLICK — the overlay is still on top for the whole pointerdown→up gesture, so it eats
      // it — and swallow the key event in capture phase before any game/menu handler sees it
      var dismiss = function (e) {
        if (e) { try { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); else if (e.stopPropagation) e.stopPropagation(); } catch (x) {} }
        if (gone) return; gone = true;
        el.className = 'gamekit-tap gk-hide'; var rm = function () { try { if (el.parentNode) el.parentNode.removeChild(el); } catch (e2) {} }; if (typeof setTimeout === 'function') setTimeout(rm, 320); else rm();
      };
      el.addEventListener('click', dismiss);
      try { document.addEventListener('keydown', dismiss, { once: true, capture: true }); } catch (e) { try { document.addEventListener('keydown', dismiss, true); } catch (_) {} }
      document.body.appendChild(el);
    } catch (e) {}
  }

  // ---------- shared menu engine (declarative overlays: start / pause / end) ----------
  // ONE structure + behaviour for every game's menus; the LOOK is fully per-game via CSS custom
  // properties (--gkm-accent / --gkm-bg / --gkm-glow / --gkm-shadow / --gkm-border / --gkm-text /
  // --gkm-overlay / --gkm-radius / --gkm-font). A game themes them in its own CSS, or passes a
  // `theme` object to menu.show() (short keys → those vars) for per-screen tweaks.
  var _menuEl = null, _menuKey = null, _menuHandle = null, _menuKind = null;
  var _menuArrange = null, _menuArrangeWired = false; // current menu's split-layout arranger (one shared layout hook)
  var _recRun = 1, _recDone = 0; // record idempotency: run counter (armed by menuHide) vs last run recorded
  var _bdRaf = 0, _bdFrame = 0, _bdResize = null; // per-menu backdrop canvas: rAF id, frame counter, resize listener
  // ---------- build info + update engine (gamekit.updates) ----------
  // Policy: updates NEVER auto-reload. A new build is ALWAYS just a dot on the ☰ menu (and the
  // catalogue's "Update now"); the player applies it whenever they choose. ONE root-scope worker
  // serves the whole site, so applying anywhere updates the catalogue AND every game at once.
  var _swReloaded = false;
  function doReload() { if (_swReloaded) return; _swReloaded = true; try { location.reload(); } catch (e) {} }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function buildInfo() {
    var v = (typeof window !== 'undefined' && window.KOMYO_VERSION) || {};
    var sha = v.sha || 'dev', when = '';
    if (v.built) {
      try {
        var d = new Date(v.built); // deploy stamp (UTC ISO) → shown in the viewer's local time
        if (!isNaN(d.getTime())) when = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      } catch (e) {}
    }
    return { sha: sha, url: v.url || '', built: v.built || '', when: when, label: sha === 'dev' ? 'dev' : (when ? sha + ' · ' + when : sha) };
  }
  var _upSubs = [], _upApplying = false;
  var _upState = { status: 'idle', available: false, controlled: false, latest: null }; // status: idle|checking|ok|offline|refreshing
  function upEmit() { for (var i = 0; i < _upSubs.length; i++) { try { _upSubs[i](_upState); } catch (e) {} } }
  function upCheck() {
    var cur = buildInfo();
    var setSt = function (v) { if (!_upApplying) _upState.status = v; upEmit(); }; // apply()'s 'refreshing' outranks check states
    if (typeof fetch !== 'function' || cur.sha === 'dev') { setSt('ok'); return Promise.resolve(_upState); }
    setSt('checking');
    // version.js is tiny and SW-cached — the cache-buster query + no-store dodges both cache layers
    var base = (typeof location !== 'undefined' && (location.pathname || '').indexOf('/games/') >= 0) ? '../../version.js' : 'version.js';
    return fetch(base + '?u=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (txt) {
      var sha = (txt.match(/sha:\s*'([^']+)'/) || [])[1] || '';
      var built = (txt.match(/built:\s*'([^']*)'/) || [])[1] || '';
      _upState.latest = { sha: sha, built: built };
      if (sha && sha !== 'dev' && sha !== cur.sha) _upState.available = true; // sticky until applied
      setSt('ok'); return _upState;
    }).catch(function () { setSt('offline'); return _upState; });
  }
  // drive the SW to the new build: update() → wait for the fresh worker to activate (its install
  // precaches the new shell into a fresh version-cache, so the next navigation serves NEW).
  // Resolves immediately when there's nothing new, and is backstopped so a slow update can't hang.
  function refreshScope(reg) {
    return new Promise(function (res) {
      if (!reg) { res(); return; }
      var done = false, d = function () { if (!done) { done = true; res(); } };
      setTimeout(d, 7000); // per-scope backstop
      try {
        var p = reg.update();
        (p && p.then ? p : Promise.resolve()).then(function () {
          var w = reg.installing || reg.waiting;
          if (!w) { d(); return; } // no new worker (edge still serving old sw.js) → this scope is as fresh as it gets
          try { w.addEventListener('statechange', function () { if (w.state === 'activated' || w.state === 'redundant') d(); }); } catch (e) { d(); }
        }, d);
      } catch (e) { d(); }
    });
  }
  function upApply() {
    if (_upApplying || _swReloaded) return;
    _upApplying = true; _upState.status = 'refreshing'; upEmit();
    var cap = setTimeout(doReload, 9000); // absolute cap: a plain refresh beats an endless spinner
    var finish = function () { clearTimeout(cap); doReload(); };
    upCheck().then(function (st) {
      if (!st.available) { finish(); return; } // already latest → plain refresh
      try {
        var sw = (typeof navigator !== 'undefined') ? navigator.serviceWorker : null;
        if (!sw || !sw.getRegistration) { finish(); return; }
        // ONE root-scope worker serves the whole site — refreshing it updates every page at once.
        // We WAIT on the new worker to activate before reloading, so the reload serves the new build.
        sw.getRegistration('/').then(refreshScope).catch(function () {}).then(finish, finish);
      } catch (e) { finish(); }
    });
  }
  var updates = {
    info: buildInfo,
    state: function () { return _upState; },
    onChange: function (cb) { if (typeof cb === 'function') _upSubs.push(cb); },
    check: upCheck,
    apply: upApply,
  };
  function stampUrl(params) {
    try {
      if (typeof history === 'undefined' || !history.replaceState || typeof location === 'undefined') return;
      var qs = (typeof URLSearchParams !== 'undefined') ? new URLSearchParams(params || {}).toString() : '';
      history.replaceState(null, '', qs ? location.pathname + '?' + qs : location.pathname);
    } catch (e) {}
  }
  function menuTeardown() {
    if (_menuKey) { try { document.removeEventListener('keydown', _menuKey, true); } catch (e) {} _menuKey = null; }
    if (_bdRaf && typeof cancelAnimationFrame === 'function') { try { cancelAnimationFrame(_bdRaf); } catch (e) {} } _bdRaf = 0;
    if (_bdResize && typeof window !== 'undefined' && window.removeEventListener) { try { window.removeEventListener('resize', _bdResize); } catch (e) {} } _bdResize = null;
    if (_menuEl) { try { if (_menuEl.parentNode) _menuEl.parentNode.removeChild(_menuEl); } catch (e) {} _menuEl = null; }
    _menuHandle = null; _menuKind = null; _menuArrange = null;
    try { if (_sideMenuSync) _sideMenuSync(); } catch (e) {}
    syncPauseVeil();
  }
  // public hide = a game dismissing the menu (a new run starts) → arm the next cfg.record.
  // menuShow's internal rebuild uses menuTeardown directly so a re-shown end menu can't re-record.
  function menuHide() { _recRun++; menuTeardown(); }
  function applyMenuTheme(el, theme) {
    if (typeof theme === 'function') { try { theme = theme(); } catch (e) { theme = null; } } // dynamic themes (e.g. flappy day/night) resolve at open time
    if (!el || !el.style || !theme) return;
    for (var k in theme) {
      if (!Object.prototype.hasOwnProperty.call(theme, k)) continue;
      var v = theme[k]; if (v == null) continue;
      try { el.style.setProperty(k.indexOf('--') === 0 ? k : '--gkm-' + k, String(v)); } catch (e) {}
    }
  }
  function fmtScore(n) { return (typeof n === 'number' && n.toLocaleString) ? n.toLocaleString() : String(n); }
  function mkEl(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) { try { e.innerHTML = html; } catch (x) { e.textContent = String(html); } }
    return e;
  }
  function evalVal(v, st) { return (typeof v === 'function') ? v(st) : v; }
  function evalItem(v, item, st) { return (typeof v === 'function') ? v(item, st) : v; } // for per-item callbacks (shop cells)
  function drawPreview(cv, fn, st) {
    if (!cv || !cv.getContext || typeof fn !== 'function') return;
    try { var g = cv.getContext('2d'); var w = cv.width || 0, h = cv.height || 0; if (g.clearRect) g.clearRect(0, 0, w, h); fn(g, w, h, st); } catch (e) {}
  }
  // menu.show(cfg): cfg.kind 'start'|'pause'|'end'; title; score/scoreText/best/newBest/lines:[…];
  //   groups:[{id,label,default,style?:'cards',choices:[…]}] — a plain group's choices are {id,label,desc?}
  //     buttons; a style:'cards' group's choices are rich cards {id,label,tag?,desc,mech,best,preview} where
  //     desc/mech/best may be a value OR a fn(state) (re-evaluated on every change), mech entries are a string
  //     or {label,hot}, and preview is fn(ctx,w,h,state) drawn into the card's canvas.
  //   toggles:[{id,label,caption?,default?}] — boolean checkboxes (rendered after the groups).
  //   hint(state)->string; share:{slug,title,message,…} (→ shareRow + Discord); record:{slug,mode,score,time,stats}
  //     (→ recordResult); actions:[{id,label,primary?,danger?,confirm?:msg|fn,confirmYes?}];
  //   onPlay(state); onAction(id,state); onChange(state) (fires on every selection/toggle change — e.g.
  //   to live-stamp the URL); onEsc; theme. `state` = selections merged with toggle booleans.
  //   A style:'shop' group is an ACTION grid (buy/pick, not select): choices are {id,label,tag?,desc},
  //     sub(item,state)->html (level/cost line), disabled(item,state)->bool (dim + unclickable), and
  //     onPick(id,handle) fires on click/Enter (the menu re-renders after, so costs/affordability update
  //     live). Powers the Asteroids+ level-up picker + between-wave shop; reusable for any store.
  //   banner(state)->html: a live line under the title (e.g. a running credit counter), re-rendered on refresh.
  // ONE structure + behaviour; the look is per-game via --gkm-* (theme object or the game's own CSS).
  // Built with createElement + direct refs (no querySelectorAll), so it drives the same headless + live.
  function menuShow(cfg) {
    cfg = cfg || {};
    var noop = function () {};
    if (typeof document === 'undefined' || !document.body || !document.createElement) return { hide: noop, el: null, selection: function () { return {}; }, select: noop, toggle: noop, activate: noop };
    menuTeardown();
    var kind = cfg.kind || 'start';
    var groups = cfg.groups || [];
    var toggles = cfg.toggles || [];
    var actions = cfg.actions || [];
    var hasCards = false;
    // big-list groups (cards/grid/shop) drive the landscape-phone split layout: the list pane left,
    // title + simple selectors/toggles/hint + actions in a right rail (nothing hidden below the fold)
    var BIG_STYLES = { cards: 1, grid: 1, shop: 1 }, hasBig = false, bigNodes = [];
    var sel = {}, tog = {};
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    groups.forEach(function (g2) { sel[g2.id] = (g2['default'] != null ? g2['default'] : (g2.choices && g2.choices[0] ? g2.choices[0].id : null)); if (g2.style === 'cards') hasCards = true; if (BIG_STYLES[g2.style]) hasBig = true; });
    // end screens with a score card split too: the CARD is the big pane, score lines + actions
    // form the right rail — stacked, the card overflowed short-landscape viewports
    var endSplit = kind === 'end' && !!cfg.share;
    if (endSplit) hasBig = true;
    toggles.forEach(function (t) { tog[t.id] = !!t['default']; });
    function state() { var o = {}, k; for (k in sel) if (has(sel, k)) o[k] = sel[k]; for (k in tog) if (has(tog, k)) o[k] = tog[k]; return o; }

    // record BEFORE building the DOM — the "✓ Good run" line below is the trickle RECEIPT, so the
    // award (recordResult → grAward) must land first. Idempotent per run (menuHide arms the next).
    if (cfg.record && _recDone !== _recRun) { _recDone = _recRun; try { recordResult(cfg.record.slug || (cfg.share && cfg.share.slug), cfg.record); } catch (e) {} }

    var ov = document.createElement('div'); ov.className = 'gamekit-menu gamekit-menu-' + kind + (hasCards ? ' gkm-wide' : '') + (hasBig ? ' gkm-split' : '');
    // pause screens resume on an outside click/tap (matches every other pause surface); start/end
    // menus keep requiring an explicit action — only wired when the game gave us an onEsc resume
    if (kind === 'pause') ov.addEventListener('click', function (e) { if (e && e.target === ov && typeof cfg.onEsc === 'function') cfg.onEsc(); });
    // pause menus never paint a backdrop: the FROZEN GAME is the backdrop (plan the next move);
    // start/end menus keep their per-game art behind the frosted box
    var bdCanvas = (kind !== 'pause' && typeof cfg.backdrop === 'function') ? mkEl('canvas', 'gkm-backdrop') : null;
    if (bdCanvas) ov.appendChild(bdCanvas);
    var box = mkEl('div', 'gkm-box'); ov.appendChild(box);
    function paintBackdrop() {
      if (!bdCanvas || !bdCanvas.getContext) return;
      try { var cw = ov.clientWidth || 0, ch = ov.clientHeight || 0; if (bdCanvas.width !== cw) bdCanvas.width = cw; if (bdCanvas.height !== ch) bdCanvas.height = ch;
        var g2 = bdCanvas.getContext('2d');
        cfg.backdrop(g2, cw, ch, state(), _bdFrame);
        // dim toward the menu's own overlay tint so the (opaque) backdrop reads as a background behind glass
        var scrim = cfg.theme && (cfg.theme.scrim || cfg.theme.overlay);
        if (scrim && g2.fillRect) { g2.save(); g2.globalAlpha = 0.5; g2.fillStyle = scrim; g2.fillRect(0, 0, cw, ch); g2.restore(); } } catch (e) {}
    }

    if (cfg.title != null) box.appendChild(mkEl('h1', 'gkm-title', cfg.title));
    var scroll = mkEl('div', 'gkm-scroll'); box.appendChild(scroll); // content scrolls; title + actions stay pinned
    if (cfg.score != null) {
      scroll.appendChild(mkEl('div', 'gkm-score', cfg.scoreText != null ? cfg.scoreText : fmtScore(cfg.score)));
      if (cfg.best != null) scroll.appendChild(mkEl('p', 'gkm-best', t('menu.best', { score: fmtScore(cfg.best) }) + (cfg.newBest ? ' <span class="gkm-new">' + t('menu.newBest') + '</span>' : '')));
    }
    var bannerEl = (typeof cfg.banner === 'function') ? mkEl('div', 'gkm-banner') : null; // live line under the title (e.g. credit counter)
    if (bannerEl) scroll.appendChild(bannerEl);
    // shop menus: on small screens the cells hide their description — this line carries the FOCUSED
    // choice's desc instead (rail in split landscape, under the banner in portrait), so touch players
    // read before they buy (first tap selects, second tap / the BUY button confirms)
    var hasShop = groups.some(function (g2) { return g2.style === 'shop' || (g2.style === 'grid' && (g2.choices || []).some(function (c) { return typeof c.buy === 'function'; })); });
    var focdescEl = hasShop ? mkEl('p', 'gkm-focdesc') : null;
    if (focdescEl) scroll.appendChild(focdescEl);
    var buyBtn = null;

    var choiceRefs = [], pickRefs = [], dynamic = [], popupRefs = []; // dynamic[]: per-card updater(state); pickRefs: shop action-cells; popupRefs: map-picker triggers
    groups.forEach(function (g2) {
      var secEl = null;
      if (g2.label != null) { secEl = mkEl('div', 'gkm-sec', g2.label); scroll.appendChild(secEl); }
      if (BIG_STYLES[g2.style] && secEl) bigNodes.push(secEl); // the big list keeps its heading in its pane
      if (g2.style === 'cards') {
        var list = mkEl('div', 'gkm-cards');
        (g2.choices || []).forEach(function (c) {
          var card = mkEl('div', 'gkm-card');
          var pv = mkEl('canvas', 'gkm-card-pv'); try { pv.width = c.pvW || 120; pv.height = c.pvH || 120; } catch (e) {}
          var nm = mkEl('div', 'gkm-card-nm', c.label + (c.tag ? ' <span class="gkm-tag">' + c.tag + '</span>' : ''));
          var best = mkEl('div', 'gkm-card-best');
          var head = mkEl('div', 'gkm-card-head'); head.appendChild(nm); head.appendChild(best);
          var desc = mkEl('div', 'gkm-card-desc');
          var mech = mkEl('div', 'gkm-card-mech');
          var body = mkEl('div', 'gkm-card-body'); body.appendChild(head); body.appendChild(desc); body.appendChild(mech);
          card.appendChild(pv); card.appendChild(body);
          // c.onRemove(handle): renders a small 🗑 in the card's corner (delete a save slot etc.);
          // the click never bubbles into the card's select.
          if (typeof c.onRemove === 'function') {
            var rm = mkEl('button', 'gkm-card-rm', '🗑');
            try { rm.type = 'button'; } catch (e) {}
            rm.addEventListener('click', function (e) { try { e.stopPropagation(); } catch (e2) {} try { c.onRemove(handle); } catch (e2) {} });
            card.appendChild(rm);
          }
          var ref = { el: card, kind: 'choice', grp: g2.id, choice: c.id, locked: false };
          card.addEventListener('click', function () { selectChoice(ref); setFocusEl(card); });
          card.addEventListener('mouseenter', function () { setFocusEl(card); });
          choiceRefs.push(ref); list.appendChild(card);
          dynamic.push(function (st) {
            var lk = !!evalVal(c.locked, st); ref.locked = lk; if (card.classList) card.classList.toggle('gkm-locked', lk);
            drawPreview(pv, c.preview, st);
            best.innerHTML = (c.best != null) ? ('<span class="l">' + t('menu.bestLabel') + '</span>' + fmtScore(evalVal(c.best, st))) : '';
            var chips = (typeof c.mech === 'function') ? c.mech(st) : (c.mech || []);
            mech.innerHTML = (chips || []).filter(function (x) { return x != null && x !== ''; }).map(function (x) {
              var s = (typeof x === 'object') ? x : { label: x };
              return '<span' + (s.hot ? ' class="hot"' : '') + '>' + s.label + '</span>';
            }).join('');
            desc.textContent = lk ? '' : (evalVal(c.desc, st) || ''); // locked "SOON" cards: name + tag pill only, no long desc
          });
        });
        scroll.appendChild(list); bigNodes.push(list);
      } else if (g2.style === 'slider') {
        // segmented slider: a track + thumb driven by selection; each stop label IS a focusable choice
        var chs = g2.choices || [], nS = chs.length;
        var sw = mkEl('div', 'gkm-slider'), sh = mkEl('div', 'gkm-sl-hit'), tr = mkEl('div', 'gkm-sl-track');
        var fl = mkEl('div', 'gkm-sl-fill'); tr.appendChild(fl);
        chs.forEach(function (c, i) { var tk = mkEl('div', 'gkm-sl-tick'); tk.style.left = (nS > 1 ? i / (nS - 1) * 100 : 0) + '%'; tr.appendChild(tk); });
        var th = mkEl('div', 'gkm-sl-thumb'); tr.appendChild(th);
        var labs = mkEl('div', 'gkm-sl-labels');
        chs.forEach(function (c) {
          var sp = mkEl('span', 'gkm-sl-label', c.label);
          var ref = { el: sp, kind: 'choice', grp: g2.id, choice: c.id };
          sp.addEventListener('click', function () { selectChoice(ref); setFocusEl(sp); });
          sp.addEventListener('mouseenter', function () { setFocusEl(sp); });
          choiceRefs.push(ref); labs.appendChild(sp);
        });
        var slFromX = function (x) { try { var r = tr.getBoundingClientRect(); if (!r.width) return; var i = Math.round((x - r.left) / r.width * (nS - 1)); i = Math.max(0, Math.min(nS - 1, i)); for (var k = 0; k < choiceRefs.length; k++) if (choiceRefs[k].grp === g2.id && choiceRefs[k].choice === chs[i].id) { selectChoice(choiceRefs[k]); return; } } catch (e) {} };
        var dn = false;
        sh.addEventListener('pointerdown', function (e) { dn = true; try { sh.setPointerCapture(e.pointerId); } catch (x) {} slFromX(e.clientX); });
        sh.addEventListener('pointermove', function (e) { if (dn) slFromX(e.clientX); });
        sh.addEventListener('pointerup', function () { dn = false; }); sh.addEventListener('pointercancel', function () { dn = false; });
        sh.appendChild(tr); sw.appendChild(sh); sw.appendChild(labs);
        dynamic.push(function () { var idx = 0; for (var i = 0; i < chs.length; i++) if (chs[i].id === sel[g2.id]) { idx = i; break; } var p = (nS > 1 ? idx / (nS - 1) : 0) * 100; th.style.left = p + '%'; fl.style.width = p + '%'; });
        scroll.appendChild(sw);
      } else if (g2.style === 'grid') {
        // thumbnail grid: cells with a preview + name + sub-label; supports locked/cost cells.
        // A locked cell with a `buy(id)` fn is BUYABLE in place (cosmetics): same two-step touch
        // machinery as shop cells (first tap focuses so the desc/price can be read, second tap /
        // the gold button buys; mouse hover+click buys in one go). A successful buy selects it.
        var gr = mkEl('div', 'gkm-grid');
        (g2.choices || []).forEach(function (c) {
          var cell = mkEl('div', 'gkm-gcell');
          var cv = mkEl('canvas', 'gkm-gcv'); try { cv.width = c.pvW || 46; cv.height = c.pvH || 40; } catch (e) {}
          var nm = mkEl('div', 'gkm-gnm', c.label), sub = mkEl('div', 'gkm-gsub');
          cell.appendChild(cv); cell.appendChild(nm); cell.appendChild(sub);
          var ref = { el: cell, kind: 'choice', grp: g2.id, choice: c.id, locked: false, c: c, buyFn: null };
          if (typeof c.buy === 'function') ref.buyFn = function () {
            if (!ref.locked) return;
            var okB = false; try { okB = !!c.buy(c.id, handle); } catch (e) {}
            if (okB) { sel[g2.id] = c.id; changed(); }
          };
          var preFocused = false, viaTouch = false;
          cell.addEventListener('pointerdown', function (e) { preFocused = (focusables[fi] === ref); viaTouch = !!(e && e.pointerType === 'touch'); });
          cell.addEventListener('click', function () {
            setFocusEl(cell);
            if (!ref.locked) { selectChoice(ref); return; }
            if (!ref.buyFn) return;
            if (viaTouch && !preFocused) return; // first tap = read the desc; second tap buys
            ref.buyFn();
          });
          cell.addEventListener('mouseenter', function () { setFocusEl(cell); });
          choiceRefs.push(ref); gr.appendChild(cell);
          dynamic.push(function (st) {
            drawPreview(cv, c.preview, st);
            var lk = !!evalVal(c.locked, st); ref.locked = lk; if (cell.classList) cell.classList.toggle('gkm-locked', lk);
            if (c.afford != null && cell.classList) cell.classList.toggle('gkm-noafford', lk && !evalVal(c.afford, st));
            sub.innerHTML = lk ? (c.lockedLabel != null ? evalVal(c.lockedLabel, st) : ('🔒 ' + (evalVal(c.cost, st) || '')))
              : (c.sub != null ? evalVal(c.sub, st) : (c.best != null ? (t('menu.bestLabel') + ' ' + fmtScore(evalVal(c.best, st))) : ''));
          });
        });
        scroll.appendChild(gr); bigNodes.push(gr);
      } else if (g2.style === 'popup') {
        // map-picker: a trigger showing the current choice; opens a modal (list + description) to change it
        var chsP = g2.choices || [];
        var find = function (id) { for (var i = 0; i < chsP.length; i++) if (chsP[i].id === id) return chsP[i]; return chsP[0]; };
        var trig = mkEl('button', 'gkm-picker'); try { trig.type = 'button'; } catch (e) {}
        var openPicker = function () {
          var mv = mkEl('div', 'gkm-picker-modal'), pn = mkEl('div', 'gkm-picker-panel');
          var ph = mkEl('div', 'gkm-picker-head'); ph.appendChild(mkEl('h3', null, g2.pickerTitle || t('menu.choose'))); var xb = mkEl('button', 'gkm-picker-x', '×'); try { xb.type = 'button'; } catch (e) {} ph.appendChild(xb);
          var pb = mkEl('div', 'gkm-picker-body'), plist = mkEl('div', 'gkm-picker-list'), pdesc = mkEl('div', 'gkm-picker-desc');
          var closed = false, onKey;
          var closeP = function () { if (closed) return; closed = true; modalDec(); try { document.removeEventListener('keydown', onKey, true); } catch (e) {} try { if (mv.parentNode) mv.parentNode.removeChild(mv); } catch (e) {} };
          var renderDesc = function (id) { var c = find(id); pdesc.innerHTML = ''; var big = mkEl('canvas'); try { big.width = c.pvW || 210; big.height = c.pvH || 110; } catch (e) {} drawPreview(big, c.preview, state()); pdesc.appendChild(big); pdesc.appendChild(mkEl('h4', null, c.label)); if (c.desc != null) pdesc.appendChild(mkEl('p', null, evalVal(c.desc, state()))); if (c.best != null) pdesc.appendChild(mkEl('div', 'gkm-picker-best', t('menu.bestLabel') + ' ' + fmtScore(evalVal(c.best, state())))); };
          chsP.forEach(function (c) {
            var it = mkEl('div', 'gkm-picker-item' + (c.id === sel[g2.id] ? ' gkm-on' : ''));
            var cv = mkEl('canvas', 'gkm-picker-cv'); try { cv.width = 34; cv.height = 24; } catch (e) {} drawPreview(cv, c.preview, state());
            it.appendChild(cv); it.appendChild(mkEl('span', null, c.label));
            it.addEventListener('mouseenter', function () { var kids = plist.childNodes; for (var i = 0; i < kids.length; i++) if (kids[i].classList) kids[i].classList.remove('gkm-hot'); if (it.classList) it.classList.add('gkm-hot'); renderDesc(c.id); });
            it.addEventListener('click', function () { sel[g2.id] = c.id; changed(); closeP(); });
            plist.appendChild(it);
          });
          pb.appendChild(plist); pb.appendChild(pdesc); pn.appendChild(ph); pn.appendChild(pb); mv.appendChild(pn);
          applyMenuTheme(mv, cfg.theme);
          xb.addEventListener('click', closeP);
          mv.addEventListener('click', function (e) { if (e.target === mv) closeP(); });
          onKey = function (e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.stopImmediatePropagation) e.stopImmediatePropagation(); closeP(); } };
          if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
          modalInc(); document.body.appendChild(mv); renderDesc(sel[g2.id]);
        };
        var pref = { el: trig, kind: 'popup', open: openPicker };
        trig.addEventListener('click', function () { setFocusEl(trig); openPicker(); });
        trig.addEventListener('mouseenter', function () { setFocusEl(trig); });
        popupRefs.push(pref);
        dynamic.push(function (st) { var c = find(sel[g2.id]); trig.innerHTML = ''; var cv = mkEl('canvas', 'gkm-picker-cv'); try { cv.width = 40; cv.height = 26; } catch (e) {} drawPreview(cv, c.preview, st); trig.appendChild(cv); trig.appendChild(mkEl('span', 'gkm-picker-nm', c.label)); if (c.sub != null || c.best != null) trig.appendChild(mkEl('span', 'gkm-picker-sub', c.sub != null ? evalVal(c.sub, st) : (t('menu.bestWord') + ' ' + fmtScore(evalVal(c.best, st))))); trig.appendChild(mkEl('span', 'gkm-picker-chev', '▾')); });
        scroll.appendChild(trig);
      } else if (g2.style === 'shop') {
        // action grid: each cell BUYS/PICKS on click or Enter (it doesn't hold a selection). sub()/disabled()
        // are per-item + re-run on every refresh, so after onPick the costs/affordability/banner update live.
        // opts: icon (painter, like cards' preview), cols:3 / cols:2 (fixed grid shape),
        // pickLabel (choice→label for the small-screen BUY/TAKE button).
        var shopWrap = mkEl('div', 'gkm-shop' + (g2.cols === 3 ? ' gkm-shop-c3' : g2.cols === 2 ? ' gkm-shop-c2' : ''));
        (g2.choices || []).forEach(function (c) {
          var cell = mkEl('div', 'gkm-shopcard' + (c.icon ? ' gkm-has-ic' : ''));
          var icc = null;
          if (c.icon) { icc = mkEl('canvas', 'gkm-shop-ic'); try { icc.width = 48; icc.height = 48; } catch (e) {} cell.appendChild(icc); }
          var nm = mkEl('div', 'gkm-shop-nm', c.label + (c.tag ? ' <span class="gkm-tag">' + c.tag + '</span>' : ''));
          var dsc = mkEl('div', 'gkm-shop-desc');
          var sub = mkEl('div', 'gkm-shop-sub');
          cell.appendChild(nm); cell.appendChild(dsc); cell.appendChild(sub);
          var ref = { el: cell, kind: 'pick', grp: g2.id, choice: c.id, c: c, g2: g2, disabled: false, pick: null };
          var fire = function () { if (ref.disabled) return; if (typeof g2.onPick === 'function') { try { g2.onPick(c.id, handle); } catch (e) {} } if (_menuEl === ov) refresh(); };
          ref.pick = fire;
          // touch two-step: a tap on a cell that wasn't focused BEFORE the tap only selects it (its
          // desc becomes readable) — the second tap, or the BUY button, buys. Mouse hover already
          // focuses pre-click, so a mouse click still buys in one go. preFocused is captured on
          // pointerdown because touch fires an emulated mouseenter right before click.
          var preFocused = false, viaTouch = false;
          cell.addEventListener('pointerdown', function (e) { preFocused = (focusables[fi] === ref); viaTouch = !!(e && e.pointerType === 'touch'); });
          cell.addEventListener('click', function () { setFocusEl(cell); if (viaTouch && !preFocused) return; fire(); });
          cell.addEventListener('mouseenter', function () { setFocusEl(cell); });
          pickRefs.push(ref); shopWrap.appendChild(cell);
          dynamic.push(function (st) {
            if (icc) drawPreview(icc, c.icon, st);
            dsc.textContent = evalItem(c.desc, c, st) || '';
            sub.innerHTML = (g2.sub != null) ? (evalItem(g2.sub, c, st) || '') : '';
            var dis = g2.disabled ? !!evalItem(g2.disabled, c, st) : false;
            ref.disabled = dis; if (cell.classList) cell.classList.toggle('gkm-disabled', dis);
          });
        });
        scroll.appendChild(shopWrap); bigNodes.push(shopWrap);
      } else {
        var row = mkEl('div', 'gkm-row');
        (g2.choices || []).forEach(function (c) {
          var b = mkEl('button', 'gkm-choice', c.label + (c.desc ? '<span class="gkm-desc">' + c.desc + '</span>' : ''));
          try { b.type = 'button'; } catch (e) {}
          // grpDisabled: a group-level evaluator (bool | state->bool) — grays the whole row and makes
          // selecting a no-op (same pattern as toggles/shop), re-evaluated on every refresh.
          var ref = { el: b, kind: 'choice', grp: g2.id, choice: c.id, grpDisabled: g2.disabled };
          b.addEventListener('click', function () { selectChoice(ref); setFocusEl(b); });
          b.addEventListener('mouseenter', function () { setFocusEl(b); });
          choiceRefs.push(ref); row.appendChild(b);
        });
        scroll.appendChild(row);
      }
    });

    var toggleRefs = [];
    toggles.forEach(function (t) {
      var rowT = mkEl('div', 'gkm-checkrow');
      var lab = mkEl('label', 'gkm-check');
      lab.appendChild(mkEl('span', 'gkm-check-box'));
      lab.appendChild(mkEl('span', 'gkm-check-txt', t.label + (t.caption ? ' <span class="cap">' + t.caption + '</span>' : '')));
      rowT.appendChild(lab); scroll.appendChild(rowT);
      var ref = { el: lab, kind: 'toggle', id: t.id, cfg: t };
      lab.addEventListener('click', function (e) { if (e && e.preventDefault) e.preventDefault(); toggleOne(ref); setFocusEl(lab); });
      lab.addEventListener('mouseenter', function () { setFocusEl(lab); });
      toggleRefs.push(ref);
    });

    // "✓ Good run" cue + trickle receipt: if this result cleared the game's bar, say what it paid —
    // "+5 🏆 (2/3 today)" while the daily bonus lasts, "daily bonus maxed 3/3" after. The player
    // learns the cap the moment it matters. Generic, so every game's end menu gets it.
    if (cfg.record && cfg.record.slug) {
      var _par = chGoodRun(cfg.record.slug);
      if (_par && (+cfg.record.score || 0) >= _par) {
        var _grb = goodRunBonus();
        scroll.appendChild(mkEl('p', 'gkm-goodrun',
          _grAwarded ? t('grb.receipt', { per: _grb.per, count: _grb.count, cap: _grb.cap })
            : (_grb.count >= _grb.cap ? t('grb.maxed', { cap: _grb.cap })
              : t('grb.counts'))));
      }
    }
    (cfg.lines || []).forEach(function (ln) { scroll.appendChild(mkEl('p', 'gkm-line', ln)); });
    var hintEl = cfg.hint ? mkEl('p', 'gkm-hint') : null; if (hintEl) scroll.appendChild(hintEl);
    var shareHost = cfg.share ? mkEl('div', 'gkm-share-host') : null;
    if (shareHost) { scroll.appendChild(shareHost); if (endSplit) bigNodes.push(shareHost); }
    var actionRefs = [];
    if (actions.length || hasShop) {
      var arow = mkEl('div', 'gkm-actions');
      if (hasShop) {
        // small-screen BUY/TAKE for the focused shop cell (hidden on desktop — hover+click buys there)
        buyBtn = mkEl('button', 'gkm-action gkm-buybtn');
        try { buyBtn.type = 'button'; } catch (e) {}
        buyBtn.addEventListener('click', function () {
          var f = focusables[fi];
          if (f && f.kind === 'pick' && !f.disabled) f.pick();
          else if (f && f.kind === 'choice' && f.locked && f.buyFn) f.buyFn();
        });
        arow.appendChild(buyBtn);
      }
      actions.forEach(function (a) {
        var b = mkEl('button', 'gkm-action' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), a.label);
        try { b.type = 'button'; } catch (e) {}
        // a.disabled: true|fn() — rendered grayed out, unclickable, out of the focus order
        var dis = (typeof a.disabled === 'function') ? !!a.disabled() : !!a.disabled;
        if (dis) {
          if (b.classList) b.classList.add('gkm-disabled');
          try { b.disabled = true; } catch (e) {}
          arow.appendChild(b);
          return;
        }
        var ref = { el: b, kind: 'action', action: a };
        b.addEventListener('click', function () { setFocusEl(b); fireAction(a); });
        b.addEventListener('mouseenter', function () { setFocusEl(b); });
        actionRefs.push(ref); arow.appendChild(b);
      });
      box.appendChild(arow);
    }

    // landscape-phone split: move everything that ISN'T a big list (simple selector rows, sliders,
    // toggles, lines, hint) into a right-hand rail next to the title/actions; moved back on rotate.
    // Nodes are re-parented (not rebuilt) so listeners, canvas bitmaps and selection state survive.
    var railEl = null, splitOn = false, stackOrder = null;
    function arrange() {
      if (!hasBig || _menuEl !== ov) return;
      var want = false;
      try { want = vw() > vh() && vh() <= 560; } catch (e) {} // mirrors the CSS media query
      if (want === splitOn) return;
      try {
        if (!stackOrder) stackOrder = Array.prototype.slice.call(scroll.childNodes || []);
        if (want) {
          if (!railEl) railEl = mkEl('div', 'gkm-rail');
          box.appendChild(railEl); // grid areas place it — DOM position is irrelevant
          stackOrder.forEach(function (n) { if (bigNodes.indexOf(n) < 0) railEl.appendChild(n); });
        } else {
          stackOrder.forEach(function (n) { scroll.appendChild(n); }); // restores the built order
          if (railEl && railEl.parentNode) railEl.parentNode.removeChild(railEl);
        }
        splitOn = want;
      } catch (e) {}
    }
    _menuArrange = arrange;
    if (!_menuArrangeWired) { _menuArrangeWired = true; layout.on(function () { if (_menuArrange) _menuArrange(); }); }

    applyMenuTheme(ov, cfg.theme);
    document.body.appendChild(ov);
    _menuEl = ov; _menuKind = kind;
    try { if (_sideMenuSync) _sideMenuSync(); } catch (e) {}
    syncPauseVeil();
    arrange(); // AFTER _menuEl is set — its stale-menu guard would no-op the initial pass otherwise
    if (bdCanvas) {
      _bdFrame = 0;
      _bdResize = function () { paintBackdrop(); };
      if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', _bdResize);
      var reduceMotion = false;
      try { reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      if (cfg.backdropAnimate && !reduceMotion && typeof requestAnimationFrame === 'function') { // reduced-motion → static frame only
        var bdLoop = function () { if (_menuEl !== ov) return; _bdFrame++; paintBackdrop(); _bdRaf = requestAnimationFrame(bdLoop); };
        _bdRaf = requestAnimationFrame(bdLoop);
      }
    }
    if (shareHost) { try { shareRow(shareHost, cfg.share); } catch (e) {} }

    var focusables = choiceRefs.concat(pickRefs).concat(toggleRefs).concat(popupRefs).concat(actionRefs);
    var fi = 0;
    function setFocus(i) { if (!focusables.length) return; fi = (i % focusables.length + focusables.length) % focusables.length; for (var k = 0; k < focusables.length; k++) { if (focusables[k].el.classList) focusables[k].el.classList.toggle('gkm-focus', k === fi); } syncShopFocus(); }
    // reflect the focused shop cell into the desc line + the BUY/TAKE button (small screens)
    function syncShopFocus() {
      if (!focdescEl && !buyBtn) return;
      var f = focusables[fi], isPick = !!(f && f.kind === 'pick'), st = state();
      var isBuy = !!(f && f.kind === 'choice' && f.locked && f.buyFn); // buyable locked grid cell (cosmetics)
      if (focdescEl) {
        var d = isPick ? (evalItem(f.c.desc, f.c, st) || '')
          : isBuy ? ((evalVal(f.c.desc, st) || '') + (f.c.price ? ' <span class="gkm-price">🏆 ' + fmtScore(f.c.price) + '</span>' : '')) : '';
        focdescEl.innerHTML = (isPick || isBuy) && d ? ('&#9656; <b>' + f.c.label + '</b> — ' + d) : '';
      }
      if (buyBtn) {
        var lbl = isPick ? (f.g2.pickLabel != null ? (evalItem(f.g2.pickLabel, f.c, st) || '') : t('menu.pick', { label: f.c.label }))
          : isBuy ? (t('menu.unlock', { label: f.c.label }) + (f.c.price ? ' · 🏆 ' + fmtScore(f.c.price) : '')) : '';
        buyBtn.textContent = lbl;
        buyBtn.disabled = isPick ? !!f.disabled : isBuy ? (f.c.afford != null && !evalVal(f.c.afford, st)) : true;
        if (buyBtn.style) buyBtn.style.visibility = (isPick || isBuy) && lbl ? '' : 'hidden';
      }
    }
    function setFocusEl(el) { for (var k = 0; k < focusables.length; k++) if (focusables[k].el === el) { setFocus(k); return; } }
    function paintChoices() {
      var st = null;
      for (var k = 0; k < choiceRefs.length; k++) {
        var r = choiceRefs[k];
        if (r.el.classList) r.el.classList.toggle('gkm-on', sel[r.grp] === r.choice);
        if (r.grpDisabled != null) {
          if (st === null) st = state();
          r.disabled = !!evalVal(r.grpDisabled, st);
          if (r.el.classList) r.el.classList.toggle('gkm-disabled', r.disabled);
          try { if (r.disabled) r.el.setAttribute('aria-disabled', 'true'); else r.el.removeAttribute('aria-disabled'); } catch (e) {}
        }
      }
    }
    function paintToggles() {
      var st = state();
      for (var k = 0; k < toggleRefs.length; k++) {
        var r = toggleRefs[k];
        r.disabled = r.cfg && r.cfg.disabled ? (typeof r.cfg.disabled === 'function' ? !!r.cfg.disabled(st) : !!r.cfg.disabled) : false;
        if (r.el.classList) { r.el.classList.toggle('gkm-on', !!tog[r.id]); r.el.classList.toggle('gkm-disabled', r.disabled); }
      }
    }
    function renderDynamic() { var st = state(); for (var k = 0; k < dynamic.length; k++) try { dynamic[k](st); } catch (e) {} }
    function renderHint() { if (hintEl) { try { hintEl.textContent = cfg.hint(state()); } catch (e) {} } }
    function renderBanner() { if (bannerEl) { try { bannerEl.innerHTML = cfg.banner(state()); } catch (e) {} } }
    function refresh() { paintChoices(); paintToggles(); renderDynamic(); renderHint(); renderBanner(); syncShopFocus(); paintBackdrop(); }
    function changed() { refresh(); if (typeof cfg.onChange === 'function') { try { cfg.onChange(state()); } catch (e) {} } }
    function selectChoice(ref) { if (ref.locked || ref.disabled) return; sel[ref.grp] = ref.choice; changed(); }
    function toggleOne(ref) { if (ref.disabled) return; tog[ref.id] = !tog[ref.id]; changed(); }
    function fireAction(a) {
      var go = function () {
        // game_start (analytics) + "recently played" (catalogue strip): fired on entering gameplay
        // from a menu — 'play' (start) or 'again' (replay), i.e. a mode was actually chosen.
        if (a.id === 'play' || a.id === 'again') {
          try { if (typeof window !== 'undefined' && typeof window.gamekitTrack === 'function') window.gamekitTrack('game_start', { slug: currentSlug() || 'unknown' }); } catch (e) {}
          touchRecent(currentSlug());
        }
        if (a.id === 'play' && typeof cfg.onPlay === 'function') cfg.onPlay(state()); else if (typeof cfg.onAction === 'function') cfg.onAction(a.id, state());
      };
      var cm = a.confirm ? (typeof a.confirm === 'function' ? a.confirm() : a.confirm) : null;
      if (cm) confirmDialog(cm, go, a.confirmYes || t('nav.leave'), null); else go();
    }
    function activate(ref) { if (!ref) return; if (ref.kind === 'choice') { if (ref.locked && ref.buyFn) ref.buyFn(); else selectChoice(ref); } else if (ref.kind === 'pick') { if (!ref.disabled) ref.pick(); } else if (ref.kind === 'toggle') toggleOne(ref); else if (ref.kind === 'popup') ref.open(); else fireAction(ref.action); }
    function stop(ev) { if (ev.preventDefault) ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); }

    refresh();
    var primIdx = 0; for (var p = 0; p < actionRefs.length; p++) { if (actionRefs[p].action.primary) { primIdx = choiceRefs.length + pickRefs.length + toggleRefs.length + popupRefs.length + p; break; } }
    setFocus(primIdx);

    var keyFn = function (e) {
      if (_menuKey !== keyFn || !_menuEl || !e || _modalOpen) return; // stale, or a confirm owns the keyboard
      var k = e.key;
      if (k === 'a' || k === 'A') k = 'ArrowLeft'; else if (k === 'd' || k === 'D') k = 'ArrowRight';
      else if (k === 'w' || k === 'W') k = 'ArrowUp'; else if (k === 's' || k === 'S') k = 'ArrowDown';
      if (k === 'ArrowLeft' || k === 'ArrowUp') { stop(e); setFocus(fi - 1); }
      else if (k === 'ArrowRight' || k === 'ArrowDown') { stop(e); setFocus(fi + 1); }
      else if (k === 'Enter' || k === ' ' || k === 'Spacebar') { stop(e); activate(focusables[fi]); }
      else if ((k === 'Escape' || k === 'Esc') && typeof cfg.onEsc === 'function') { stop(e); cfg.onEsc(); }
    };
    _menuKey = keyFn;
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', keyFn, true);

    var handle = {
      hide: menuHide, el: ov, selection: state, focus: setFocus,
      // programmatic affordances (used by the headless harness + available to games):
      select: function (grp, choice) { for (var k = 0; k < choiceRefs.length; k++) if (choiceRefs[k].grp === grp && choiceRefs[k].choice === choice) { selectChoice(choiceRefs[k]); return true; } return false; },
      toggle: function (id, on) { for (var k = 0; k < toggleRefs.length; k++) if (toggleRefs[k].id === id) { tog[id] = (on == null ? !tog[id] : !!on); refresh(); return true; } return false; },
      activate: function (actionId) { for (var k = 0; k < actionRefs.length; k++) if (actionRefs[k].action.id === actionId) { fireAction(actionRefs[k].action); return true; } return false; },
      focusedId: function () { var f = focusables[fi]; return f ? (f.kind === 'action' ? f.action.id : f.kind === 'toggle' ? f.id : f.choice) : null; },
    };
    _menuHandle = handle;
    return handle;
  }
  var menu = { show: menuShow, hide: menuHide, current: function () { return _menuHandle; } };

  // ---- i18n ------------------------------------------------------------
  var I18N_SUPPORTED = { en: 1, pl: 1, es: 1, pt: 1, fr: 1, it: 1, cs: 1, uk: 1 };
  // a language is "ready" once its dictionary is populated (en is the built-in reference via def:
  // fallbacks). es/pt/fr/it ship as empty {} until translated → shown as "soon" and not selectable.
  function langReady(code) {
    if (code === 'en') return true;
    try {
      var d = (window.KOMYO_I18N || {})[code];
      if (d && Object.keys(d).length > 0) return true;
      // locales ship as separate i18n.<code>.js files loaded lazily — a language whose file
      // exists (the loader's AVAILABLE list) is selectable even before its dictionary arrives
      var av = window.KOMYO_I18N_AVAILABLE;
      return !!(av && av.indexOf && av.indexOf(code) >= 0);
    } catch (e) { return false; }
  }
  // inject a language file that hasn't been lazy-loaded yet (mid-game live switch before the
  // idle loader ran) — t() falls back to en until it arrives, then repaints on the next frame
  function langFetch(code) {
    try {
      if (code === 'en' || !window.KOMYO_I18N_SRC || (window.KOMYO_I18N && window.KOMYO_I18N[code])) return;
      if (typeof document === 'undefined' || !document.createElement || !document.head) return;
      var s = document.createElement('script'); s.src = window.KOMYO_I18N_SRC(code); s.async = true;
      s.onload = function () { _langSubs.forEach(function (fn) { try { fn(code); } catch (e) {} }); };
      document.head.appendChild(s);
    } catch (e) {}
  }
  var I18N_LANGS = [
    { code: 'en', label: 'English' }, { code: 'pl', label: 'Polski' },
    { code: 'es', label: 'Español' }, { code: 'pt', label: 'Português' },
    { code: 'fr', label: 'Français' }, { code: 'it', label: 'Italiano' },
    { code: 'cs', label: 'Čeština' }, { code: 'uk', label: 'Українська' }
  ];
  // inline-SVG flags (viewBox 30×20) — render everywhere incl. Windows, no external assets.
  // en = clip-path Union Jack; pt = full official Brazilian flag (all ids namespaced brz* to stay collision-safe).
  var I18N_FLAG_SVG = {
    en: '<svg viewBox="0 0 50 30"><clipPath id="gkuj"><path d="M25,15h25v15zv15h-25zh-25v-15zv-15h25z"/></clipPath><path d="M0,0v30h50v-30z" fill="#012169"/><path d="M0,0 50,30M50,0 0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 50,30M50,0 0,30" clip-path="url(#gkuj)" stroke="#C8102E" stroke-width="4"/><path d="M-1 11h22v-12h8v12h22v8h-22v12h-8v-12h-22z" fill="#C8102E" stroke="#FFF" stroke-width="2"/></svg>',
    pl: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect y="10" width="30" height="10" fill="#dc143c"/></svg>',
    es: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/></svg>',
    pt: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-2100 -1470 4200 2940"><defs><g id="brzG"><clipPath id="brzg"><path d="m-31.5 0v-70h63v70zm31.5-47v12h31.5v-12z"/></clipPath><use clip-path="url(#brzg)" xlink:href="#brzO"/><path d="M5-35H31.5V-25H5z"/><path d="m21.5-35h10v35h-10z"/></g><g id="brzR"><use xlink:href="#brzP"/><path d="m28 0c0-10 0-32-15-32h-19c22 0 22 22 22 32"/></g><g id="brzs" fill="#fff"><g id="brzc"><path id="brzt" transform="rotate(18,0,-1)" d="m0-1v1h0.5"/><use transform="scale(-1,1)" xlink:href="#brzt"/></g><use transform="rotate(72)" xlink:href="#brzc"/><use transform="rotate(-72)" xlink:href="#brzc"/><use transform="rotate(144)" xlink:href="#brzc"/><use transform="rotate(216)" xlink:href="#brzc"/></g><g id="brza"><use transform="scale(31.5)" xlink:href="#brzs"/></g><g id="brzb"><use transform="scale(26.25)" xlink:href="#brzs"/></g><g id="brzf"><use transform="scale(21)" xlink:href="#brzs"/></g><g id="brzh"><use transform="scale(15)" xlink:href="#brzs"/></g><g id="brzi"><use transform="scale(10.5)" xlink:href="#brzs"/></g><path id="brzD" d="m-31.5 0h33a30 30 0 0 0 30-30v-10a30 30 0 0 0-30-30h-33zm13-13h19a19 19 0 0 0 19-19v-6a19 19 0 0 0-19-19h-19z" fill-rule="evenodd"/><path id="brzE" transform="translate(-31.5)" d="m0 0h63v-13h-51v-18h40v-12h-40v-14h48v-13h-60z"/><path id="brze" d="m-26.25 0h52.5v-12h-40.5v-16h33v-12h-33v-11h39.25v-12h-51.25z"/><path id="brzM" d="m-31.5 0h12v-48l14 48h11l14-48v48h12v-70h-17.5l-14 48-14-48h-17.5z"/><path id="brzO" d="m0 0a31.5 35 0 0 0 0-70 31.5 35 0 0 0 0 70m0-13a18.5 22 0 0 0 0-44 18.5 22 0 0 0 0 44" fill-rule="evenodd"/><path id="brzP" d="m-31.5 0h13v-26h28a22 22 0 0 0 0-44h-40zm13-39h27a9 9 0 0 0 0-18h-27z" fill-rule="evenodd"/><path id="brzS" d="m-15.75-22c0 7 6.75 10.5 16.75 10.5s14.74-3.25 14.75-7.75c0-14.25-46.75-5.25-46.5-30.25 0.25-21.5 24.75-20.5 33.75-20.5s26 4 25.75 21.25h-15.25c0-7.5-7-10.25-15-10.25-7.75 0-13.25 1.25-13.25 8.5-0.25 11.75 46.25 4 46.25 28.75 0 18.25-18 21.75-31.5 21.75-11.5 0-31.55-4.5-31.5-22z"/></defs><clipPath id="brzB"><circle r="735"/></clipPath><path d="m-2100-1470h4200v2940h-4200z" fill="#009440"/><path d="M -1743,0 0,1113 1743,0 0,-1113 Z" fill="#ffcb00"/><circle r="735" fill="#302681"/><path d="m-2205 1470a1785 1785 0 0 1 3570 0h-105a1680 1680 0 1 0-3360 0z" clip-path="url(#brzB)" fill="#fff"/><g transform="translate(-420,1470)" fill="#009440"><use transform="rotate(-7)" y="-1697.5" xlink:href="#brzO"/><use transform="rotate(-4)" y="-1697.5" xlink:href="#brzR"/><use transform="rotate(-1)" y="-1697.5" xlink:href="#brzD"/><use transform="rotate(2)" y="-1697.5" xlink:href="#brzE"/><use transform="rotate(5)" y="-1697.5" xlink:href="#brzM"/><use transform="rotate(9.75)" y="-1697.5" xlink:href="#brze"/><use transform="rotate(14.5)" y="-1697.5" xlink:href="#brzP"/><use transform="rotate(17.5)" y="-1697.5" xlink:href="#brzR"/><use transform="rotate(20.5)" y="-1697.5" xlink:href="#brzO"/><use transform="rotate(23.5)" y="-1697.5" xlink:href="#brzG"/><use transform="rotate(26.5)" y="-1697.5" xlink:href="#brzR"/><use transform="rotate(29.5)" y="-1697.5" xlink:href="#brzE"/><use transform="rotate(32.5)" y="-1697.5" xlink:href="#brzS"/><use transform="rotate(35.5)" y="-1697.5" xlink:href="#brzS"/><use transform="rotate(38.5)" y="-1697.5" xlink:href="#brzO"/></g><use x="-600" y="-132" xlink:href="#brza"/><use x="-535" y="177" xlink:href="#brza"/><use x="-625" y="243" xlink:href="#brzb"/><use x="-463" y="132" xlink:href="#brzh"/><use x="-382" y="250" xlink:href="#brzb"/><use x="-404" y="323" xlink:href="#brzf"/><use x="228" y="-228" xlink:href="#brza"/><use x="515" y="258" xlink:href="#brza"/><use x="617" y="265" xlink:href="#brzf"/><use x="545" y="323" xlink:href="#brzb"/><use x="368" y="477" xlink:href="#brzb"/><use x="367" y="551" xlink:href="#brzf"/><use x="441" y="419" xlink:href="#brzf"/><use x="500" y="382" xlink:href="#brzb"/><use x="365" y="405" xlink:href="#brzf"/><use x="-280" y="30" xlink:href="#brzb"/><use x="200" y="-37" xlink:href="#brzf"/><use y="330" xlink:href="#brza"/><use x="85" y="184" xlink:href="#brzb"/><use y="118" xlink:href="#brzb"/><use x="-74" y="184" xlink:href="#brzf"/><use x="-37" y="235" xlink:href="#brzh"/><use x="220" y="495" xlink:href="#brzb"/><use x="283" y="430" xlink:href="#brzf"/><use x="162" y="412" xlink:href="#brzf"/><use x="-295" y="390" xlink:href="#brza"/><use y="575" xlink:href="#brzi"/></svg>',
    fr: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#0055A4"/><rect x="20" width="10" height="20" fill="#EF4135"/></svg>',
    it: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#009246"/><rect x="20" width="10" height="20" fill="#CE2B37"/></svg>',
    cs: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect y="10" width="30" height="10" fill="#D7141A"/><path d="M0,0 L15,10 L0,20 Z" fill="#11457E"/></svg>',
    uk: '<svg viewBox="0 0 30 20"><rect width="30" height="10" fill="#005BBB"/><rect y="10" width="30" height="10" fill="#FFD500"/></svg>'
  };
  function flagSvg(code) { return I18N_FLAG_SVG[code] || ''; }
  var _lang = null, _langSubs = [];
  function normLang(c) {
    c = String(c || '').toLowerCase();
    if (c.indexOf('pt') === 0) return 'pt';
    var two = c.slice(0, 2);
    return I18N_SUPPORTED[two] ? two : (I18N_SUPPORTED[c] ? c : 'en');
  }
  function detectLang() {
    var res = null;
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (q && I18N_SUPPORTED[normLang(q)]) res = normLang(q);
    if (!res) { try { var s = localStorage.getItem('gamekit_lang'); if (s && I18N_SUPPORTED[s]) res = s; } catch (e) {} }
    if (!res) { var nav = 'en'; try { nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'; } catch (e) {} res = normLang(nav); }
    return langReady(res) ? res : 'en'; // never activate a not-yet-translated ("soon") locale
  }
  // consume a ?lang= deep link at load: persist the choice + strip the param. Runs at head-script
  // eval, BEFORE the catalogue's syncURL rewrites the query string (which would drop the param
  // unread), and a stripped URL can't override the picker on later reloads.
  (function () {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (!q) return;
      // validate against the static supported set (NOT langReady — i18n.js loads after this
      // script; detectLang's own langReady guard still keeps a "soon" locale from activating)
      var low = String(q).toLowerCase();
      var code = low.indexOf('pt') === 0 ? 'pt' : low.slice(0, 2);
      if (!I18N_SUPPORTED[code]) return;
      try { localStorage.setItem('gamekit_lang', code); } catch (e) {}
      var u = new URL(location.href); u.searchParams.delete('lang');
      history.replaceState(history.state, '', u);
    } catch (e) {}
  })();
  function lang() { if (!_lang) _lang = detectLang(); return _lang; }
  function setLang(code) {
    code = I18N_SUPPORTED[code] ? code : 'en';
    _lang = code;
    try { localStorage.setItem('gamekit_lang', code); } catch (e) {}
    try { document.documentElement.lang = code; } catch (e) {}
    langFetch(code); // split locale files: pull this one in now if the lazy loader hasn't yet
    _langSubs.forEach(function (fn) { try { fn(code); } catch (e) {} });
  }
  function onLang(fn) { _langSubs.push(fn); return function () { var i = _langSubs.indexOf(fn); if (i >= 0) _langSubs.splice(i, 1); }; }
  function pluralCat(l, n) {
    try { return new Intl.PluralRules(l).select(n); } catch (e) { return n === 1 ? 'one' : 'other'; }
  }
  function interp(s, params) {
    if (!params) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; });
  }
  function t(key, params) {
    var all = window.KOMYO_I18N || {};
    var en = all.en || {};
    var dict = all[lang()] || en;
    var entry = (key in dict) ? dict[key] : (key in en ? en[key] : undefined);
    if (entry == null) return (params && params.def != null) ? interp(params.def, params) : key;
    if (typeof entry === 'object') {
      var n = (params && params.count != null) ? params.count : 0;
      var cat = pluralCat(lang(), n);
      entry = entry[cat] != null ? entry[cat]
            : (entry.other != null ? entry.other
            : (en[key] && en[key].other != null ? en[key].other : key));
    }
    return interp(entry, params);
  }
  // the current language's flag (inline SVG — renders everywhere, incl. Windows).
  function langGlyphHTML(code) {
    return '<span class="gk-langflag" aria-hidden="true">' + flagSvg(code) + '</span>';
  }
  // langButton(opts) → a trigger element (icon-only, or icon + opts.label) that opens langMenu.
  // opts.className appended for context fit; opts.theme / opts.onClose forwarded to langMenu.
  function langButton(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.createElement) return null;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gamekit-langbtn' + (opts.className ? ' ' + opts.className : '');
    b.setAttribute('aria-label', opts.label || 'Language');
    b.title = opts.label || 'Language';
    b.innerHTML = langGlyphHTML(lang()) + (opts.label ? '<span class="gk-lang-lbl">' + opts.label + '</span>' : '');
    b.addEventListener('click', function () { langMenu(opts); });
    onLang(function (code) { try { b.innerHTML = langGlyphHTML(code) + (opts.label ? '<span class="gk-lang-lbl">' + (opts.label || '') + '</span>' : ''); } catch (e) {} });
    return b;
  }
  // langMenu(opts) → a themed overlay grid: big flags + small language names, current one highlighted.
  // Picking → setLang + reload. Esc/backdrop/✕ close (fires opts.onClose so a caller can reopen its own
  // dialog it had to close first — mirrors the catalogue confirm-from-Settings pattern).
  function langMenu(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return;
    var cur = lang();
    var soonTxt = t('lang.soon', { def: 'soon' });
    var cells = I18N_LANGS.map(function (l) {
      var ready = langReady(l.code);
      return '<button class="gklang-cell' + (l.code === cur ? ' selected' : '') + (ready ? '' : ' soon') + '" type="button" data-code="' + l.code + '"'
        + (ready ? '' : ' disabled aria-disabled="true"') + '>'
        + '<span class="gklang-flag" aria-hidden="true">' + flagSvg(l.code) + '</span>'
        + '<span class="gklang-name">' + l.label + '</span>'
        + (ready ? '' : '<span class="gklang-soon">' + soonTxt + '</span>') + '</button>';
    }).join('');
    var ov = document.createElement('div'); ov.className = 'gamekit-langmenu';
    ov.innerHTML = '<div class="gklang-box"><button class="gklang-x" type="button" aria-label="Close">✕</button>'
      + '<h3>🌐 ' + t('lang.header', { def: 'Language' }) + '</h3><div class="gklang-grid">' + cells + '</div></div>';
    if (opts.theme) applyMenuTheme(ov, opts.theme);
    document.body.appendChild(ov);
    modalInc();
    var done = false;
    function close() {
      if (done) return; done = true; modalDec();
      try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
      try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
      if (typeof opts.onClose === 'function') { try { opts.onClose(); } catch (e) {} }
    }
    function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); close(); } }
    if (ov.querySelectorAll) Array.prototype.forEach.call(ov.querySelectorAll('.gklang-cell'), function (cell) {
      if (!langReady(cell.getAttribute('data-code'))) return; // "soon" languages aren't selectable yet
      cell.addEventListener('click', function () {
        setLang(cell.getAttribute('data-code'));
        // INSIDE a game (nav mounted): never reload — a reload wipes the run in progress. The
        // canvas HUD retranslates next frame (t() per draw), menus on their next rebuild, and
        // onLang subscribers fire for anything live. Catalogue/legal pages have nothing to lose
        // and plenty of boot-built strings → a reload there guarantees a complete switch.
        if (_navEl) { close(); return; }
        try { location.reload(); } catch (e) {}
      });
    });
    var xb = ov.querySelector ? ov.querySelector('.gklang-x') : null; if (xb) xb.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
  }

  // ---- fullscreen (Fullscreen API, vendor-prefix-free — every supported browser ships the
  // unprefixed form now) — useful when an installed PWA/Chrome-app window has no OS "maximize to
  // true fullscreen" affordance. Headless-safe: every call is guarded, no-ops with no `document`.
  var _fsSubs = [];
  function fsSupported() { try { return !!(typeof document !== 'undefined' && document.documentElement && document.documentElement.requestFullscreen); } catch (e) { return false; } }
  function fsActive() { try { return !!(typeof document !== 'undefined' && document.fullscreenElement); } catch (e) { return false; } }
  function fsEmit() { for (var i = 0; i < _fsSubs.length; i++) { try { _fsSubs[i](fsActive()); } catch (e) {} } }
  function fsToggle() {
    if (!fsSupported()) return;
    try {
      if (fsActive()) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    } catch (e) {}
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('fullscreenchange', fsEmit);
  var fullscreen = { supported: fsSupported, active: fsActive, toggle: fsToggle, onChange: function (cb) { if (typeof cb === 'function') _fsSubs.push(cb); } };

  var api = { sound: sound, music: music, nav: nav, audioMenu: audioMenu, resetScores: resetScores, confirm: confirmDialog, menu: menu, stampUrl: stampUrl, shareRow: shareRow, shareUrls: shareUrls, shareText: shareText, withUtm: withUtm, param: param, pwa: pwa, player: player, setName: setName, postDiscord: postDiscord, discordTier: discordTier, inActivity: IN_ACTIVITY, proxyUrl: proxyUrl, layout: layout, fitCanvas: fitCanvas, roundRect: roundRect, recordResult: recordResult, lastResult: lastResult, playedToday: playedToday, profile: profile, best: getBest, bestScore: getBestScore, saveBest: saveBest, utcDateStr: utcDateStr, utcDayNumber: utcDayNumber, scoreCard: buildScoreCard, profileCard: buildProfileCard, shareCard: shareCardBlob, embedModal: embedModal, isPaused: isPaused, setPaused: setPaused, togglePause: togglePause, loop: gameLoop, loopAlpha: loopAlpha, showMenuButton: showMenuButton, showPauseButton: showPauseButton, controls: controlsModal, challengesPanel: challengesPanel, activeChallenge: chActiveSlug, challengeEval: chEval, challengePick: chPickAt, cosmetics: cosmetics, crt: crt, shopPanel: shopPanel, goodRunBonus: goodRunBonus, goodRunBonusHtml: grbHtml, versionTag: versionTag, updates: updates, buildInfo: buildInfo, t: t, lang: lang, setLang: setLang, onLang: onLang, langs: function () { return I18N_LANGS.slice(); }, langButton: langButton, langMenu: langMenu, fullscreen: fullscreen, recentlyPlayed: recentlyPlayed, sideStack: sideStack };
  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
  g.gamekit = api;
  if (typeof window !== 'undefined') window.gamekit = api;
})();
