# Printing the score-card QR — sizing & resolution notes

Internal reference for when we print score cards / QR stickers (see the "QR stickers" marketing idea
in ROADMAP.md). The QR is rendered by `game-kit.js` `drawCardQR` using the in-repo `qr.js` encoder.

## The card

- Score card renders at **1200 × 630 px**. The QR panel is **256 px** of that; the actual code
  (excluding the light quiet-zone margin) is ~**190 px**, i.e. modules of ~**4.7–5.7 px** (denser =
  longer URL = smaller modules; keep URLs short).

## Resolution is NOT the limiting factor — physical size is

- 1200 px is plenty of pixels. At the standard **300 DPI** print, the whole card is **~102 × 53 mm**
  (a hair wider than a credit card). To fit an exact credit-card width (85.6 mm) you'd print at
  **~356 DPI** — sharper than the 300 DPI standard. So you never run out of pixels at these sizes.
- **Always print ≥ 300 DPI.** The QR modules are integer-pixel-aligned in the render, so they stay
  crisp; DPI below ~200 is where edges start to soften.

## How big does the QR end up?

Printing the **whole card** scaled to a given width (0.0713 mm/px at credit-card width 85.6 mm):

| Print width | QR panel | Code proper | Module size | Verdict |
|---|---|---|---|---|
| Credit card (85.6 mm) | ~18 mm | ~13–14 mm | ~0.34–0.40 mm | **borderline** |
| ~110 mm (postcard) | ~23 mm | ~17–18 mm | ~0.45–0.5 mm | good |
| ~150 mm | ~32 mm | ~24 mm | ~0.6 mm | very safe |

Rules of thumb: a QR scans from roughly **10× its width** (a 20 mm code → ~20 cm), and modules want
to be **≥ ~0.4 mm**. Our card QR is **inverted + colored**, which cameras find a bit harder than plain
black-on-white, so lean larger.

## Recommendations

- **Credit-card size: risky.** ~13–14 mm code works for short-URL games at close range but I wouldn't
  bank on it for the denser (long-URL) ones. Aim for a **≥ 20 mm** QR → print bigger than a credit
  card, or enlarge/crop just the QR area.
- **Keep the URL short** — fewer QR modules = bigger modules = far more forgiving at small print size.
  (The UTM tags are already short; drop `?mode/diff` for a print-only code if you need more headroom.)
- **Export lossless PNG for print.** The card ships as lossy WebP/JPEG (great for screen/Discord), but
  compression fuzzes QR edges at small print sizes.
- **For dedicated stickers,** don't reuse the stylized inverted card QR — generate a **larger,
  standard high-contrast (dark-on-light), short-URL** QR from `qr.js` and export PNG. (A small
  print-QR export helper is easy to add if/when we do stickers.)
