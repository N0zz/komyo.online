// qr.js — self-contained QR Code generator, NO external deps (repo rule: no CDNs/libraries; and we
// never send URLs to a QR web-service — offline + privacy). Exposes:
//   window.KOMYO_QR.encode(text) -> { size, modules } | null
//     modules[row][col] = 1 (dark) | 0 (light); size = modules per side (no quiet zone).
//     Returns null if `text` is too long for the supported range or the platform lacks basics.
//
// Scope: BYTE mode, error-correction level M, QR versions 1–6 (auto-picked, smallest that fits) —
// enough for komyo deep-link URLs (~100 bytes). The renderer adds its own quiet zone + theming.
// Reusable: any feature that needs a QR (score cards, a future "scan to play", posters) can call it.
// Algorithm adapted from Nayuki's QR Code generator (public domain).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // ---- GF(256) arithmetic (primitive polynomial 0x11D) ----
  var EXP = [], LOG = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ ((x & 0x80) ? 0x11d : 0); } })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[(LOG[a] + LOG[b]) % 255]; }

  // EC level M block info, versions 1–6 (all single-group / equal blocks in this range):
  //   ec = EC codewords per block, blocks = number of blocks, dcb = data codewords per block, total = data codewords
  var CAP = [null,
    { ec: 10, blocks: 1, dcb: 16, total: 16 },
    { ec: 16, blocks: 1, dcb: 28, total: 28 },
    { ec: 26, blocks: 1, dcb: 44, total: 44 },
    { ec: 18, blocks: 2, dcb: 32, total: 64 },
    { ec: 24, blocks: 2, dcb: 43, total: 86 },
    { ec: 16, blocks: 4, dcb: 27, total: 108 }
  ];
  var ALIGN = [0, 0, 18, 22, 26, 30, 34]; // single alignment-pattern centre for v2–6; v1 has none

  function rsDivisor(degree) {
    var result = []; for (var i = 0; i < degree - 1; i++) result.push(0); result.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < result.length; j++) { result[j] = gmul(result[j], root); if (j + 1 < result.length) result[j] ^= result[j + 1]; }
      root = gmul(root, 2);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ result.shift(); result.push(0);
      for (var j = 0; j < divisor.length; j++) result[j] ^= gmul(divisor[j], factor);
    }
    return result;
  }

  function encode(text) {
    try {
      text = String(text == null ? '' : text);
      // UTF-8 bytes
      var data = [];
      for (var i = 0; i < text.length; i++) {
        var cc = text.charCodeAt(i);
        if (cc < 0x80) data.push(cc);
        else if (cc < 0x800) data.push(0xc0 | (cc >> 6), 0x80 | (cc & 0x3f));
        else { data.push(0xe0 | (cc >> 12), 0x80 | ((cc >> 6) & 0x3f), 0x80 | (cc & 0x3f)); }
      }
      // smallest version whose data capacity holds mode(4) + charcount(8) + 8*len bits
      var ver = 0, cap = null;
      for (var v = 1; v <= 6; v++) { if (CAP[v].total * 8 >= 4 + 8 + 8 * data.length) { ver = v; cap = CAP[v]; break; } }
      if (!ver) return null; // too long for v1–6 M

      // ---- bit stream: mode + count + data + terminator + byte-align + pad codewords ----
      var bits = [];
      function put(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
      put(0x4, 4);            // byte mode
      put(data.length, 8);    // char count (v1–9 -> 8 bits)
      for (i = 0; i < data.length; i++) put(data[i], 8);
      var capBits = cap.total * 8;
      for (i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
      while (bits.length % 8 !== 0) bits.push(0);
      var padByte = [0xEC, 0x11], p = 0;
      while (bits.length < capBits) { put(padByte[p % 2], 8); p++; }
      var dataCw = [];
      for (i = 0; i < bits.length; i += 8) { var byte = 0; for (var k = 0; k < 8; k++) byte = (byte << 1) | bits[i + k]; dataCw.push(byte); }

      // ---- split into blocks + Reed–Solomon EC, then interleave ----
      var divisor = rsDivisor(cap.ec), dblocks = [], eblocks = [], off = 0;
      for (var bl = 0; bl < cap.blocks; bl++) { var blk = dataCw.slice(off, off + cap.dcb); off += cap.dcb; dblocks.push(blk); eblocks.push(rsRemainder(blk, divisor)); }
      var out = [];
      for (i = 0; i < cap.dcb; i++) for (bl = 0; bl < cap.blocks; bl++) out.push(dblocks[bl][i]);
      for (i = 0; i < cap.ec; i++) for (bl = 0; bl < cap.blocks; bl++) out.push(eblocks[bl][i]);
      var codeBits = [];
      for (i = 0; i < out.length; i++) for (k = 7; k >= 0; k--) codeBits.push((out[i] >>> k) & 1);
      var remBits = (ver >= 2 && ver <= 6) ? 7 : 0; // remainder bits (v2–6: 7, v1: 0)
      for (i = 0; i < remBits; i++) codeBits.push(0);

      // ---- matrix ----
      var size = ver * 4 + 17;
      var mod = [], fn = [];
      for (i = 0; i < size; i++) { mod.push(new Array(size).fill(0)); fn.push(new Array(size).fill(false)); }
      function setF(r, c, val) { if (r >= 0 && r < size && c >= 0 && c < size) { mod[r][c] = val ? 1 : 0; fn[r][c] = true; } }
      function bit(x, i) { return (x >>> i) & 1; }

      function finder(r, c) {
        for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
          var inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          var dark = inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          setF(r + dr, c + dc, dark);
        }
      }
      finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
      for (i = 0; i < size; i++) { if (!fn[6][i]) setF(6, i, i % 2 === 0); if (!fn[i][6]) setF(i, 6, i % 2 === 0); } // timing
      if (ver >= 2) { var a = ALIGN[ver]; for (var dr2 = -2; dr2 <= 2; dr2++) for (var dc2 = -2; dc2 <= 2; dc2++) setF(a + dr2, a + dc2, Math.max(Math.abs(dr2), Math.abs(dc2)) !== 1); }

      function drawFormat(mask) {
        var d = (0 << 3) | mask; // level M format bits = 0b00
        var rem = d; for (var ii = 0; ii < 10; ii++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        var f = ((d << 10) | rem) ^ 0x5412;
        // setF is (row, col). Copy 1 = the L around the top-left finder:
        for (ii = 0; ii <= 5; ii++) setF(ii, 8, bit(f, ii));
        setF(7, 8, bit(f, 6)); setF(8, 8, bit(f, 7)); setF(8, 7, bit(f, 8));
        for (ii = 9; ii < 15; ii++) setF(8, 14 - ii, bit(f, ii));
        // Copy 2 = row 8 rightward (bits 0–7) + col 8 upward from the bottom (bits 8–14):
        for (ii = 0; ii < 8; ii++) setF(8, size - 1 - ii, bit(f, ii));
        for (ii = 8; ii < 15; ii++) setF(size - 15 + ii, 8, bit(f, ii));
        setF(size - 8, 8, true); // dark module
      }
      drawFormat(0); // reserve the format cells (final value written after mask selection)

      // ---- data placement (zigzag) ----
      var di = 0;
      for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) {
          for (var j2 = 0; j2 < 2; j2++) {
            var col = right - j2, upward = ((right + 1) & 2) === 0, row = upward ? size - 1 - vert : vert;
            if (!fn[row][col] && di < codeBits.length) { mod[row][col] = codeBits[di]; di++; }
          }
        }
      }

      // ---- masking: try all 8, keep the lowest-penalty ----
      function maskAt(m, r, c) {
        switch (m) {
          case 0: return (r + c) % 2 === 0;
          case 1: return r % 2 === 0;
          case 2: return c % 3 === 0;
          case 3: return (r + c) % 3 === 0;
          case 4: return (((r >> 1) + ((c / 3) | 0)) % 2) === 0;
          case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
          case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
          default: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
        }
      }
      function penalty() {
        var s = 0, r, c, run, i2;
        // rule 1: runs of 5+ same colour (rows then cols)
        for (r = 0; r < size; r++) { run = 1; for (c = 1; c < size; c++) { if (mod[r][c] === mod[r][c - 1]) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
        for (c = 0; c < size; c++) { run = 1; for (r = 1; r < size; r++) { if (mod[r][c] === mod[r - 1][c]) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
        // rule 2: 2x2 blocks
        for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) { var v0 = mod[r][c]; if (v0 === mod[r][c + 1] && v0 === mod[r + 1][c] && v0 === mod[r + 1][c + 1]) s += 3; }
        // rule 3: finder-like 1:1:3:1:1 patterns (rows then cols)
        var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
        function match(get, n) { for (var q = 0; q + 11 <= n; q++) { var ok1 = true, ok2 = true; for (var w = 0; w < 11; w++) { var b2 = get(q + w); if (b2 !== pat1[w]) ok1 = false; if (b2 !== pat2[w]) ok2 = false; } if (ok1 || ok2) s += 40; } }
        for (r = 0; r < size; r++) match(function (idx) { return mod[r][idx]; }, size);
        for (c = 0; c < size; c++) match(function (idx) { return mod[idx][c]; }, size);
        // rule 4: dark-module proportion
        var dark = 0; for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (mod[r][c]) dark++;
        var pct = dark * 100 / (size * size);
        s += Math.floor(Math.abs(pct - 50) / 5) * 10;
        return s;
      }

      var best = -1, bestScore = Infinity, snapshot = [];
      for (var m = 0; m < 8; m++) {
        for (var rr = 0; rr < size; rr++) for (var ccc = 0; ccc < size; ccc++) if (!fn[rr][ccc] && maskAt(m, rr, ccc)) mod[rr][ccc] ^= 1;
        drawFormat(m);
        var sc = penalty();
        if (sc < bestScore) { bestScore = sc; best = m; snapshot = mod.map(function (row) { return row.slice(); }); }
        for (rr = 0; rr < size; rr++) for (ccc = 0; ccc < size; ccc++) if (!fn[rr][ccc] && maskAt(m, rr, ccc)) mod[rr][ccc] ^= 1; // undo
      }
      mod = snapshot; // the best-masked matrix (format bits already correct for `best`)
      return { size: size, modules: mod, version: ver, mask: best };
    } catch (e) { return null; }
  }

  window.KOMYO_QR = { encode: encode };
})();
