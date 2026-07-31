#!/usr/bin/env node
// Renders komyo tracks to YouTube-ready soundtrack videos. Dev tool — nothing here ships.
//
//   node scripts/render-soundtrack.mjs <track|all> [--fps 30] [--out dist-soundtrack]
//
// Audio: gamekit.music.render() renders ONE full pass of the arrangement in an OfflineAudioContext
// (faster than real time, deterministic — same seed, same tune as in-game). We drive it in headless
// Chromium because the engine is Web Audio; the AudioBuffer comes back as a WAV.
//
// Video: a static background painted from games.js (icon + accent), with ffmpeg's `showfreqs`
// spectrum drawn from THE SAME rendered wav — so the bars genuinely match what you hear, plus a
// dimmed mirrored reflection. No frame-by-frame work, no real-time capture.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../', import.meta.url).pathname;
const args = process.argv.slice(2);
const WHICH = args[0] || 'all';
const FPS = +(args[args.indexOf('--fps') + 1] || 30) || 30;
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'dist-soundtrack';
const OUTDIR = join(ROOT, OUT);
// per-process scratch: with --jobs, a shared .tmp meant the first worker to finish deleted the
// WAV another was still reading (ENOENT mid-render)
const TMP = join(OUTDIR, '.tmp-' + process.pid);
// --size 1920x1080  frame size. More bars needs more PIXELS: you cannot draw more bars than the
//                   frame is wide, so spectrum detail is capped by width.
// --win 2048        FFT window for the analyser. Bigger = finer frequency detail but a longer time
//                   window, so the bars react more sluggishly to a kick. 512 is punchy, 4096 is
//                   detailed-but-smeared. Bins = win/2, and bins above the frame width are wasted.
// --rate 16000      analysis sample rate; Nyquist (rate/2) is the top of the drawn range.
// --seconds N       trim the render — for quick look-tests.
const SIZE = (args.includes('--size') ? args[args.indexOf('--size') + 1] : '1280x720').split('x');
const W = +SIZE[0] || 1280, H = +SIZE[1] || 720;
const WIN = +(args[args.indexOf('--win') + 1] || 512) || 512;
const RATE = +(args[args.indexOf('--rate') + 1] || 16000) || 16000;
const SECONDS = args.includes('--seconds') ? +args[args.indexOf('--seconds') + 1] : 0;
const TAG = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : '';
// --viz waves|freqs
//   waves — the actual waveform. Detail is samples-per-pixel, so it is as fine as the frame is wide
//           and reacts instantly. No FFT, so none of the log-axis bar-width problem below.
//   freqs — showfreqs spectrum. `fscale=log` stretches the low bins across the left (wide blocky
//           bars) and crushes hundreds of high bins into the right edge, so raising win_size barely
//           changes what you actually see.
const VIZ = args.includes('--viz') ? args[args.indexOf('--viz') + 1] : 'waves';
// --window 4   SECONDS of audio visible on screen at once — the real resolution knob.
//   Smaller = more detail per beat. The whole track is drawn ONCE as a long strip and panned in
//   sync with the audio, so frame rate is independent of window length. (ffmpeg's own showwaves
//   couldn't do this: it consumes n*width samples per FRAME, so a 2.8 s window meant 0.36 fps.)
const WINDOW = +(args[args.indexOf('--window') + 1] || 4) || 4;
// --from 0   start the audio (and the pan) at this offset — for like-for-like comparison clips.
const FROM = +(args[args.indexOf('--from') + 1] || 0) || 0;
const SLICE_MAX = 8000;   // canvas is capped in width, so the strip is drawn in slices and hstacked
// --bands 48   how many frequency bars. 32-64 is what music players use; hundreds of raw FFT bins
//              is what made earlier attempts look like noise rather than music.
const BANDS = +(args[args.indexOf('--bands') + 1] || 48) || 48;
// --jobs N        render N tracks at once. Each worker is its own process with its own Chromium,
//                 so keep it near core count, not 30 (each browser costs real memory).
// --only a,b,c    restrict to these track ids (this is how --jobs shards the work to workers).
const JOBS = +(args[args.indexOf('--jobs') + 1] || 1) || 1;
const ONLY = args.includes('--only') ? String(args[args.indexOf('--only') + 1]).split(',').filter(Boolean) : null;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
               '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

// ---- a tiny static server, because Web Audio + module loading want a real origin ---------------
// port 0 = let the OS pick. A fixed port meant two --jobs workers collided on EADDRINUSE, which is
// why one shard died while the same track rendered fine on its own.
function serve() {
  return new Promise(res => {
    const s = createServer((req, rq) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      try {
        const body = readFileSync(join(ROOT, p));
        rq.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
        rq.end(body);
      } catch { rq.writeHead(404); rq.end('nope'); }
    });
    s.listen(0, () => res(s));
  });
}

// ---- the render page: game-kit + games.js, nothing else ----------------------------------------
const PAGE = `<meta charset="utf-8"><title>render</title>
<script src="/version.js"></script><script src="/game-kit.js"></script><script src="/games.js"></script>
<script src="/qr.js"></script>
<canvas id="bg" width="${W}" height="${H}"></canvas>`;

// Encoded in-page so the AudioBuffer never has to cross the boundary as raw floats.
const INPAGE_WAV = `
function toWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, ch, true); data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    let v = Math.max(-1, Math.min(1, chans[c][i]));
    data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  let bin = '', bytes = new Uint8Array(data.buffer);
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}`;

// ---- the background plate (cover style 4, minus the frozen bars — ffmpeg draws the real ones) ---
const INPAGE_BG = `
function paintBg(t) {
  const c = document.getElementById('bg'), x = c.getContext('2d');
  const W = c.width, H = c.height;
  const rgb = h => { h = String(h).replace('#',''); if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n = parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; };
  const shade = (h,f) => 'rgb(' + rgb(h).map(v=>Math.max(0,Math.min(255,Math.round(v*f)))).join(',') + ')';
  const rgba = (h,a) => { const v = rgb(h); return 'rgba('+v[0]+','+v[1]+','+v[2]+','+a+')'; };
  x.fillStyle = '#07080d'; x.fillRect(0,0,W,H);
  // a soft accent wash so the frame isn't flat black behind the bars
  const g = x.createRadialGradient(W/2, H*0.62, 40, W/2, H*0.62, W*0.75);
  g.addColorStop(0, rgba(t.accent, 0.16)); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0,0,W,H);
  function fit(text, max, start, weight) {
    let s = start;
    do { x.font = (weight||800)+' '+s+'px -apple-system,Segoe UI,Roboto,sans-serif'; s -= 2; }
    while (x.measureText(text).width > max && s > 12);
    return s + 2;
  }
  x.font = Math.round(H*0.15)+'px serif'; x.textBaseline='alphabetic';
  x.fillText(t.icon, W*0.055, H*0.22);
  // Everything below the wave is laid out inside the free band, vertically centred in it, so the
  // title block and the QR block share one baseline grid instead of floating at fixed fractions.
  var wb = t.waveBottom || Math.round(H * 0.74), band = H - wb;
  var s1 = fit(t.name, W*0.60, Math.round(H*0.105));
  var metaS = Math.round(H*0.038);
  var titleH = s1 + Math.round(band*0.10) + metaS;
  var titleTop = wb + Math.round((band - titleH) / 2);
  x.fillStyle = '#fff'; x.font = '800 '+s1+'px -apple-system,Segoe UI,Roboto,sans-serif';
  x.fillText(t.name, W*0.055, titleTop + s1);
  x.font = '600 '+metaS+'px ui-monospace,Menlo,monospace';
  x.fillStyle = rgba(t.accent, 0.95);
  x.fillText(t.bpm+' BPM  ·  '+t.dur+'  ·  '+t.kit, W*0.055, titleTop + titleH);
  x.font = '600 '+Math.round(H*0.03)+'px ui-monospace,Menlo,monospace';
  x.fillStyle = 'rgba(255,255,255,.34)'; x.textAlign = 'left';
  x.fillText('generated live in the browser — no audio files', W*0.055, H*0.06);

  // ---- scan-to-play QR, bottom right (same encoder the score cards use) --------------------------
  // Kept SHORT on purpose: fewer modules = bigger modules = scans off a phone screen or a TV.
  var qr = (window.KOMYO_QR && t.url) ? window.KOMYO_QR.encode(t.url) : null;
  if (qr) {
    // The QR + its two label lines are ONE block, sized to fit and centred in the free band.
    var lab1 = Math.round(H * 0.030), lab2 = Math.round(H * 0.028);
    var g1 = Math.round(band * 0.055), g2 = Math.round(band * 0.03);
    var box = Math.min(Math.round(H * 0.20), band - (g1 + lab1 + g2 + lab2) - Math.round(band * 0.10));
    var blockH = box + g1 + lab1 + g2 + lab2;
    var qy = wb + Math.round((band - blockH) / 2);
    var qx = W - box - Math.round(W * 0.045);
    var quiet = Math.round(box * 0.075);
    x.fillStyle = '#ffffff';
    K_roundRect(x, qx, qy, box, box, Math.round(box * 0.06)); x.fill();
    var m = (box - quiet * 2) / qr.size;
    x.fillStyle = '#0a0c11';
    for (var r = 0; r < qr.size; r++) for (var cc = 0; cc < qr.size; cc++) {
      if (qr.modules[r][cc]) x.fillRect(qx + quiet + cc * m, qy + quiet + r * m, Math.ceil(m), Math.ceil(m));
    }
    x.textAlign = 'center';
    x.font = '800 ' + lab1 + 'px -apple-system,Segoe UI,Roboto,sans-serif';
    x.fillStyle = rgba(t.accent, 0.98);
    x.fillText('▶ play on', qx + box / 2, qy + box + g1 + lab1);
    x.font = '600 ' + lab2 + 'px ui-monospace,Menlo,monospace';
    x.fillStyle = 'rgba(255,255,255,.72)';
    x.fillText('komyo.online', qx + box / 2, qy + box + g1 + lab1 + g2 + lab2);
  } else {
    x.textAlign = 'right';
    x.font = '600 ' + Math.round(H*0.036) + 'px ui-monospace,Menlo,monospace';
    x.fillStyle = 'rgba(255,255,255,.5)';
    x.fillText('komyo.online', W-26, H*0.89);
  }
  x.textAlign = 'left';
  return c.toDataURL('image/png');
}
function K_roundRect(x, a, b, w, h, r) {
  x.beginPath(); x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r);
  x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
  x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
  x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
}`;

// Draws the ENTIRE track as a min/max envelope strip, in slices (canvas has a width cap).
// Returns { slices: [dataURL], width, height } — ffmpeg hstacks them back into one long image.
const INPAGE_STRIP = `
function paintStrip(buf, pxPerSec, h, color, sliceMax, padPx) {
  const total = Math.ceil(buf.duration * pxPerSec);
  const ch0 = buf.getChannelData(0);
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
  const spp = buf.length / total;
  const full = total + padPx * 2;                 // half a screen of pad each side => exact playhead
  const out = [], n = Math.ceil(full / sliceMax);
  const each = Math.ceil(full / n);
  for (let s = 0; s < n; s++) {
    const w = Math.min(each, full - s * each);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = color;
    for (let i = 0; i < w; i++) {
      const col = s * each + i - padPx;            // column index into the wave itself
      if (col < 0 || col >= total) continue;
      let mn = 1, mx = -1;
      const a = Math.floor(col * spp), b = Math.min(buf.length, Math.floor((col + 1) * spp));
      for (let k = a; k < b; k++) { const v = (ch0[k] + ch1[k]) * 0.5; if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mx < mn) continue;
      const y0 = (1 - mx) * h / 2, y1 = (1 - mn) * h / 2;
      x.fillRect(i, y0, 1, Math.max(2, y1 - y0));
    }
    out.push(c.toDataURL('image/png'));
  }
  return { slices: out, width: full, sliceW: each, height: h, wave: total };
}`;

// ================================================================================================
// The bar visualiser. ffmpeg has no filter that does what a music player's spectrum does, so this
// is the DSP by hand. What separates "reads as music" from "random flicker":
//   · 48 bands, log-spaced by octave — not hundreds of raw FFT bins
//   · attack/release smoothing: a band jumps up instantly and falls slowly. Without this, every
//     frame is an independent FFT and the result flickers no matter how pretty the bars are.
//   · peak caps that hang and drift down, so hits stay legible
//   · dB amplitude scaling, because hearing is logarithmic
// Bars are rectangles, so they're written straight into an RGBA framebuffer and piped to ffmpeg —
// no canvas needed, and drawn at half width then point-scaled back up (rectangles survive that
// exactly) to keep the pipe volume sane.
// ================================================================================================
function readWav(path) {
  const b = readFileSync(path);
  let p = 12, sr = 44100, ch = 2, bits = 16, dataOff = 44, dataLen = b.length - 44;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(p + 10); sr = b.readUInt32LE(p + 12); bits = b.readUInt16LE(p + 22); }
    else if (id === 'data') { dataOff = p + 8; dataLen = sz; break; }
    p += 8 + sz + (sz & 1);
  }
  const bytes = bits / 8, frames = Math.floor(dataLen / (bytes * ch));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < ch; c++) acc += b.readInt16LE(dataOff + (i * ch + c) * bytes) / 32768;
    mono[i] = acc / ch;
  }
  return { sr, mono, frames };
}
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const w = ang * k, wr = Math.cos(w), wi = Math.sin(w);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}
function barFrames({ wav, fps, width, height, bands, accent, fromSec, seconds }) {
  const { sr, mono, frames } = readWav(wav);
  const N = 2048, win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const binHz = sr / N;
  // log-spaced band edges. Capped at 6 kHz on purpose: our tracks are lowpassed well below Nyquist,
  // so bands above that barely moved and showed up as a dead flat run on the right of the frame.
  const LO = 38, HI = 6000, edges = [];
  for (let i = 0; i <= bands; i++) edges.push(LO * Math.pow(HI / LO, i / bands));
  const level = new Float32Array(bands), peak = new Float32Array(bands);
  const [ar, ag, ab] = (() => { let h = accent.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; })();
  const total = Math.ceil((seconds || (frames / sr - fromSec)) * fps);
  const gap = Math.max(1, Math.round(width / bands * 0.22));
  const bw = Math.max(1, Math.floor(width / bands) - gap);
  const RELEASE = Math.pow(0.001, 1 / (fps * 0.42));   // ~0.42 s to fall to silence
  const PEAKFALL = 1 / (fps * 1.5);                    // peak cap drifts down over ~1.5 s

  return { total, sr, *gen() {
    const re = new Float64Array(N), im = new Float64Array(N);
    const fb = Buffer.alloc(width * height * 4);
    for (let f = 0; f < total; f++) {
      const centre = Math.floor((fromSec + f / fps) * sr);
      const start = Math.max(0, Math.min(frames - N, centre - (N >> 1)));
      for (let i = 0; i < N; i++) { re[i] = (mono[start + i] || 0) * win[i]; im[i] = 0; }
      fftInPlace(re, im);
      // band energies -> dB -> 0..1, then attack/release
      for (let b = 0; b < bands; b++) {
        const b0 = Math.max(1, Math.round(edges[b] / binHz)), b1 = Math.max(b0 + 1, Math.round(edges[b + 1] / binHz));
        let m = 0;
        for (let k = b0; k < b1 && k < N / 2; k++) { const v = Math.hypot(re[k], im[k]); if (v > m) m = v; }
        const db = 20 * Math.log10(m / (N / 4) + 1e-9);
        let v = (db + 68) / 62;                        // -68 dB .. -6 dB -> 0..1
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        v = Math.pow(v, 0.85);
        level[b] = v > level[b] ? v : level[b] * RELEASE;      // instant attack, slow release
        peak[b] = level[b] > peak[b] ? level[b] : Math.max(0, peak[b] - PEAKFALL);
      }
      fb.fill(0);
      for (let b = 0; b < bands; b++) {
        const x0 = Math.round(b * width / bands + gap / 2);
        const h = Math.round(level[b] * (height - 6));
        for (let y = height - h; y < height; y++) {
          const t = (height - y) / Math.max(1, h);                 // brighter at the base
          const a = 235, rr = Math.round(ar * (0.72 + 0.28 * (1 - t)));
          const gg = Math.round(ag * (0.72 + 0.28 * (1 - t))), bb2 = Math.round(ab * (0.72 + 0.28 * (1 - t)));
          let o = (y * width + x0) * 4;
          for (let x = 0; x < bw; x++) { fb[o] = rr; fb[o + 1] = gg; fb[o + 2] = bb2; fb[o + 3] = a; o += 4; }
        }
        const py = height - 4 - Math.round(peak[b] * (height - 6));
        if (py >= 0 && py < height - 1) {
          for (let y = py; y < py + 3 && y < height; y++) {
            let o = (y * width + x0) * 4;
            for (let x = 0; x < bw; x++) { fb[o] = 255; fb[o + 1] = 255; fb[o + 2] = 255; fb[o + 3] = 190; o += 4; }
          }
        }
      }
      yield fb;
    }
  } };
}

const SLUG_FIX = { keep: 'tower-defense', range: 'aim-trainer', meadow: 'flappy' };
const BIOME = { kd_grass: 'Grasslands', kd_ice: 'Ice', kd_lava: 'Lava',
                kd_desert: 'Desert', kd_dungeon: 'Dungeon', kd_marsh: 'Marsh' };

async function main() {
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
  if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

  const server = await serve();
  const PORT = server.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.error('  page error:', e.message));
  await page.route('**/__render', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
  await page.goto(`http://localhost:${PORT}/__render`);
  await page.waitForFunction(() => window.gamekit && window.gamekit.music && window.GAMES);
  // addScriptTag, not evaluate: evaluate parses its argument as an EXPRESSION, so a bare
  // `function foo(){}` declaration is a syntax error there.
  await page.addScriptTag({ content: INPAGE_WAV + '\n' + INPAGE_BG + '\n' + INPAGE_STRIP });

  const ids = await page.evaluate(({ SLUG_FIX, BIOME }) => {
    const M = window.gamekit.music, TR = M.tracks, byslug = {};
    (window.GAMES || []).forEach(g => { byslug[g.slug] = g; });
    return Object.keys(TR).map(id => {
      const T = TR[id], fam = T.game || id, slug = SLUG_FIX[fam] || fam;
      let g = byslug[slug];
      if (!g) { const hy = Object.keys(byslug).find(s => s.replace(/-/g, '') === fam); g = byslug[hy] || {}; }
      const arr = M.arrangement(id), bars = arr.reduce((n, s) => n + s.bars, 0);
      const secs = bars * 4 * 60 / T.bpm;
      let name = g.title || id;
      if (BIOME[id]) name = (byslug['tower-defense'] || {}).title + ' · ' + BIOME[id];
      if (id === 'snakebanger') name += ' · Banger';
      return { id, name, icon: g.icon || '🎵', accent: g.accent || '#6ee7b7', bpm: T.bpm,
               kit: T.kit || '', bars, slug: g.slug || '',
               // short by design — a dense QR does not scan reliably off a screen
               url: g.slug ? 'https://komyo.online/games/' + g.slug + '/?utm_source=yt&utm_medium=qr&utm_campaign=ost' : '',
               dur: Math.floor(secs / 60) + ':' + String(Math.round(secs % 60)).padStart(2, '0') };
    });
  }, { SLUG_FIX, BIOME });

  let todo = WHICH === 'all' ? ids : ids.filter(t => t.id === WHICH);
  if (ONLY) todo = ids.filter(t => ONLY.includes(t.id));

  // --jobs: shard the list across child processes of this same script and wait for them all.
  if (JOBS > 1 && todo.length > 1) {
    await browser.close(); server.close();
    const shards = Array.from({ length: Math.min(JOBS, todo.length) }, () => []);
    todo.forEach((t, i) => shards[i % shards.length].push(t.id));
    const passthru = args.filter((a, i) =>
      !['--jobs', '--only'].includes(a) && !['--jobs', '--only'].includes(args[i - 1]) && a !== WHICH);
    console.log(`\nrendering ${todo.length} tracks across ${shards.length} workers…\n`);
    const t0 = Date.now();
    const codes = await Promise.all(shards.map(sh => new Promise(res => {
      const c = spawn(process.execPath, [process.argv[1], 'all', '--only', sh.join(','), ...passthru],
                      { stdio: 'inherit' });
      c.on('close', res);
    })));
    const bad = codes.filter(c => c !== 0).length;
    console.log(`\n${bad ? '⚠️  ' + bad + ' worker(s) failed' : '✓ all workers finished'} · ` +
                `${((Date.now() - t0) / 1000).toFixed(0)}s wall clock for ${todo.length} tracks\n`);
    process.exitCode = bad ? 1 : 0;
    return;
  }
  if (!todo.length) { console.error('no such track:', WHICH, '\navailable:', ids.map(t => t.id).join(' ')); process.exitCode = 1; }

  for (const t of todo) {
    const t0 = Date.now();
    process.stdout.write(`\n▶ ${t.id} (${t.name}) ${t.dur}\n`);

    // 1. audio — offline render, straight out of the shipped engine
    const b64 = await page.evaluate(async id => {
      const buf = await window.gamekit.music.render(id, { sampleRate: 44100 });
      return { wav: toWav(buf), secs: buf.duration, sr: buf.sampleRate, ch: buf.numberOfChannels };
    }, t.id);
    const wav = join(TMP, t.id + '.wav');
    writeFileSync(wav, Buffer.from(b64.wav, 'base64'));
    console.log(`  audio  ${b64.secs.toFixed(1)}s · ${b64.sr} Hz · ${b64.ch}ch · ${(Buffer.byteLength(b64.wav, 'base64') / 1048576).toFixed(1)} MB wav`);

    // 2. background plate — needs the visualiser's geometry first, so the QR block can be centred
    //    in the free band between the bottom of the wave and the bottom of the frame.
    // ONE source of truth for the visualiser's box — the plate and the ffmpeg overlay both read it,
    // so the QR can never drift out of the free band. `bottom` includes the reflection, since the
    // bars are overlaid ON TOP of the plate and anything under them would get tinted.
    const geo = (() => {
      if (VIZ === 'bars') {
        const h = Math.round(H * 0.32), y = Math.round(H * 0.25), mir = Math.round(h * 0.18);
        return { y, h, mir, bottom: y + h + mir };
      }
      if (VIZ === 'scope' || VIZ === 'waves') { const h = Math.round(H * 0.40), y = Math.round(H * 0.27); return { y, h, mir: 0, bottom: y + h }; }
      const h = Math.round(H * 0.38), y = Math.round(H * 0.24), mir = Math.round(H * 0.115);
      return { y, h, mir, bottom: y + h + mir };
    })();
    const png = join(TMP, t.id + '.png');
    const dataUrl = await page.evaluate(({ t, waveBottom }) => paintBg(Object.assign({ waveBottom }, t)), { t, waveBottom: geo.bottom });
    writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));

    // 3. compose: real spectrum from the same wav + a dimmed mirror, over the plate
    const mp4 = join(OUTDIR, `${t.id}${TAG ? '-' + TAG : ''}.mp4`);
    const barsH = Math.round(H * 0.38), mirrorH = Math.round(H * 0.115);
    const barsY = Math.round(H * 0.24);
    const hex = '0x' + String(t.accent).replace('#', '');
    // Three things the first pass got wrong:
    //  · stereo in = showfreqs draws one colour PER CHANNEL, so the accent only tinted half of it —
    //    mix to mono for the analysis feed.
    //  · the bars barely left the floor: amplify a COPY of the audio (+14 dB) purely for analysis,
    //    which never touches the audio that gets muxed.
    //  · sqrt amplitude scale keeps quiet passages visible without flattening the loud ones.
    // EVERY viz filter has its own internal `rate`, defaulting to 25 — without setting it the
    // visualiser generates 25 updates/sec and ffmpeg just duplicates frames to hit -r, which is
    // what made the first passes look choppy no matter the output fps.
    let filter, extraInputs = [], pipeFrames = null;
    if (VIZ === 'bars') {
      const bH = geo.h, bY = geo.y;
      const halfW = Math.round(W / 2), halfH = Math.round(bH / 2);
      pipeFrames = barFrames({ wav, fps: FPS, width: halfW, height: halfH, bands: BANDS,
                               accent: t.accent, fromSec: FROM, seconds: SECONDS || 0 });
      extraInputs.push('-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${halfW}x${halfH}`,
                       '-framerate', String(FPS), '-i', 'pipe:0');
      filter = [
        `[1:a]anull[aout]`,
        // point-scale back up: bars are rectangles, so this stays perfectly crisp
        `[2:v]scale=${W}:${bH}:flags=neighbor[bars]`,
        `[bars]split=2[bA][bB]`,
        `[bB]vflip,scale=${W}:${geo.mir},format=rgba,colorchannelmixer=aa=0.22[mir]`,
        `[0:v][bA]overlay=0:${bY}:format=auto[v1]`,
        `[v1][mir]overlay=0:${bY + bH}:format=auto[v]`,
      ].join(';');
    } else if (VIZ === 'scope') {
      // A wave that stays PUT and wiggles — an oscilloscope, not a scrolling timeline.
      // showwaves consumes n*width samples per output frame, so its frame rate is
      // sample_rate/(n*width). To land exactly on FPS we draw at width = sample_rate/FPS with n=1,
      // then scale that up to the frame. Each frame therefore shows sample_rate/FPS samples
      // (~17 ms at 60 fps) in FIXED positions, which is what makes it wave in place.
      const wavesH = Math.round(H * 0.40), wavesY = Math.round(H * 0.27);
      const srcW = Math.max(2, Math.round(44100 / FPS));
      filter = [
        `[1:a]asplit=2[aout][aviz]`,
        `[aviz]aformat=channel_layouts=mono,volume=4dB[avm]`,
        `[avm]showwaves=s=${srcW}x${wavesH}:mode=cline:n=1:draw=full:scale=lin:colors=${hex}[fr0]`,
        `[fr0]scale=${W}:${wavesH}:flags=lanczos[fr]`,
        `[0:v][fr]overlay=0:${wavesY}:format=auto[v]`,
      ].join(';');
    } else if (VIZ === 'waves') {
      const wavesH = Math.round(H * 0.40), wavesY = Math.round(H * 0.27);
      const pxps = W / WINDOW;                       // px per second of audio on screen
      const strip = await page.evaluate(async ({ id, pxps, h, color, sliceMax, pad }) => {
        const buf = window.__lastBuf || (window.__lastBuf = await window.gamekit.music.render(id, { sampleRate: 44100 }));
        return paintStrip(buf, pxps, h, color, sliceMax, pad);
      }, { id: t.id, pxps, h: wavesH, color: t.accent, sliceMax: SLICE_MAX, pad: Math.round(W / 2) });
      // Stack the slices into ONE image up front. Passing them as N looped inputs made ffmpeg decode
      // and hstack ten 8000px PNGs on EVERY frame — minutes of work for a 10s clip.
      const slicePaths = strip.slices.map((d, i) => {
        const p = join(TMP, `${t.id}-strip${i}.png`);
        writeFileSync(p, Buffer.from(d.split(',')[1], 'base64'));
        return p;
      });
      const stripPng = join(TMP, `${t.id}-strip.png`);
      if (slicePaths.length > 1) {
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
          ...slicePaths.flatMap(p => ['-i', p]),
          '-filter_complex', `${slicePaths.map((_, i) => `[${i}:v]`).join('')}hstack=inputs=${slicePaths.length}[o]`,
          '-map', '[o]', '-frames:v', '1', stripPng], { stdio: 'inherit' });
      } else { writeFileSync(stripPng, readFileSync(slicePaths[0])); }
      extraInputs.push('-loop', '1', '-framerate', String(FPS), '-i', stripPng);
      // Inputs: 0 = plate, 1 = wav, 2..N = strip slices. hstack them back into one long image,
      // then crop a moving window: the pixel for time t sits exactly at screen centre, because the
      // strip carries half a screen of padding on each side.
      const n = strip.slices.length;
      const labels = strip.slices.map((_, i) => `[${i + 2}:v]`).join('');
      const dur = b64.secs;
      filter = [
        `[1:a]anull[aout]`,          // the freqs branch makes [aout] via asplit; this one still needs it
        n > 1 ? `${labels}hstack=inputs=${n}[stripfull]` : `[2:v]null[stripfull]`,
        `[stripfull]crop=w=${W}:h=${wavesH}:x='(t+${FROM})/${dur}*${strip.wave}':y=0[wv]`,
        `[0:v][wv]overlay=0:${wavesY}:format=auto[v1]`,
        // fixed centre playhead + a baseline, so the motion reads as "now"
        `[v1]drawbox=x=${Math.round(W / 2) - 1}:y=${wavesY}:w=3:h=${wavesH}:color=white@0.55:t=fill[v]`,
      ].join(';');
    } else {
      filter = [
        `[1:a]asplit=2[aout][aviz]`,
        // aresample to 16k puts Nyquist at 8 kHz, so the bars spread across content that actually
        // exists — at 44.1k the top two-thirds of the width was empty air above our lowpass.
        `[aviz]aformat=channel_layouts=mono,aresample=${RATE},volume=11dB[avm]`,
        // cbrt lifts mid-level bars into the box without peaks clipping flat at the ceiling
        // (sqrt left a low crust, +14 dB linear clipped).
        `[avm]showfreqs=s=${W}x${barsH}:mode=bar:ascale=cbrt:fscale=log:win_size=${WIN}:win_func=hann:averaging=1:rate=${FPS}:colors=${hex}[fr]`,
        `[fr]split=2[frA][frB]`,
        `[frB]vflip,scale=${W}x${mirrorH},format=rgba,colorchannelmixer=aa=0.3[mir]`,
        `[0:v][frA]overlay=0:${barsY}:format=auto[v1]`,
        `[v1][mir]overlay=0:${barsY + barsH}:format=auto[v]`,
      ].join(';');
    }
    const ffArgs = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-loop', '1', '-framerate', String(FPS), '-i', png,
      ...(FROM ? ['-ss', String(FROM)] : []), '-i', wav,
      ...extraInputs,
      '-filter_complex', filter,
      '-map', '[v]', '-map', '[aout]',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart', '-shortest',
      ...(SECONDS ? ['-t', String(SECONDS)] : []),
      mp4,
    ];
    if (pipeFrames) {
      console.log(`  bars   ${BANDS} bands · ${pipeFrames.total} frames, attack/release smoothed`);
      await new Promise((res, rej) => {
        const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
        ff.on('error', rej);
        ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)));
        (async () => {
          for (const fr of pipeFrames.gen()) {
            if (!ff.stdin.write(fr)) await new Promise(r => ff.stdin.once('drain', r));
          }
          ff.stdin.end();
        })().catch(e => { try { ff.stdin.destroy(); } catch {} rej(e); });
      });
    } else {
      execFileSync('ffmpeg', ffArgs, { stdio: 'inherit' });
    }

    const sz = readFileSync(mp4).length;
    console.log(`  video  ${W}x${H} · win ${WIN} (${WIN / 2} bins) · ${(sz / 1048576).toFixed(1)} MB · ${FPS} fps · ${((Date.now() - t0) / 1000).toFixed(1)}s → ${mp4.replace(ROOT, '')}`);
  }

  await browser.close();
  server.close();
  if (!args.includes('--keep-tmp')) rmSync(TMP, { recursive: true, force: true });
  console.log(`\n✓ ${todo.length} video${todo.length > 1 ? 's' : ''} in ${OUT}/\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
