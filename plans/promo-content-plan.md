# Promo Content Plan — marketing assets (graphics · video · flyers)

Status: **planning** (decided the approach 2026-07-09; execution waits on the weekly token reset +
a capture session). Sibling to `plans/marketing_plan.md` (that one = *where/what to post*; this one =
*the assets to post*). Feeds Path-to-launch #5 (LAUNCH + marketing) in `ROADMAP.md`.

Audience anchor: **parents / families / teachers** (per the marketing re-aim) — so every asset leads
with the **strengths** pitch (*free · no ads · no accounts · kid-safe · works offline*), NOT feature
depth. Challenges/trophies/cosmetics are secondary; a parent scanning cares that it's safe + free.

## Core decision: the score card IS the brand visual language

We like the current "neon marquee" score card, and printed real score cards will double as marketing
(a player's result + scan-to-play QR = social proof + CTA). So every marketing asset is **derived from
the score card's design language** for instant brand recognition.

- **Share the design *language*, not the layout.** Ports across formats: the `#0a0f17→#121a28` dark
  gradient, silhouette frame + glow pair, perspective grid floor, white→accent gradient type, baked
  sparkles, mascot + `KOMYO / GAMES` lockup, QR + `www.komyo.online` footer. The *composition* is
  re-laid-out per format (card is landscape; flyer portrait; shorts 9:16). Draw code to transcribe
  verbatim: `buildScoreCard` in `game-kit.js` (accent, frame glows, grid, sparkles, wordmark lockup).
- **Content slot changes:** the card's hero (big gradient number) becomes the flyer's hero
  (**headline + strengths line**, games grid below).
- **Printed real score cards** are nearly free — they already look right; just verify the QR at print
  size.

## Open decisions (need before mocking)

- [ ] **Site-level accent.** Recommended: a **house accent** for frame/wordmark/CTA (one anchor) +
  the **games collage in each tile's own accent** (unmistakably komyo *and* shows the range). Confirm
  vs. a single house color throughout.
- [ ] **Flyer dimensions** (A6 / A5 / sticker size) — drives the portrait layout; can't guess it.

## Approach (settled)

- **Two formats:** (a) a **promo graphic** — reusable everywhere (Reddit image, flyer, itch.io, a
  refreshed OG image, video end-card); (b) **video** — one **30–60s trailer** + **15–30s 9:16 shorts**
  per game/feature as an ongoing drip (frequency > polish for the algorithm).
- **Sequence, don't parallelize:** **graphic first** (cheapest, most reusable, unblocks Reddit AND the
  flyers) → **trailer** → **shorts as a drip**.
- **Capture = manual, once. No capture scripting.** Both video *and* stills need a curated "fun" game
  state (mid-action, busy, dramatic), and creating + judging that is a human/eye call — a scripted run
  looks robotic, headless renders nothing (rAF is a no-op), and per-game state setup is nearly as much
  work as video for uncertain quality. So: play each game to its fun moment, record it, and pull the
  **promo-graphic stills as frames from that same footage**. One effort, both outputs. (Static UI —
  catalogue / a score card / settings — just screenshot by hand; no fun-state needed.)
- **Shorts framing:** 9:16 vertical. Portrait-friendly games (Flappy, Stacker, Frog Bonk) fill it
  natively; landscape games (Snake, Breakout, Asteroids) need a framed vertical layout (game centered,
  branding + QR top/bottom). Per-game procedural music = on-brand audio for free.

## Print caveats (the neon-on-dark look is built for screens)

- Dark full-bleed backgrounds eat ink / can band/muddy on cheap stock.
- Neon accents fall outside CMYK gamut → expect them to dull.
- The accent-tinted-modules-on-dark QR scanned fine on-screen; at small print size verify contrast +
  size. Carry the on-screen lesson: **short URL, big modules, low QR version** (a dense v6 didn't scan
  at ~15–18mm; v5 did). Give each **flyer batch its own UTM/QR** so GA4 tells you which run converted.
- Likely need a **print-tuned variant** of the design (lighter coverage / higher-contrast QR). The
  printer-sample test catches this — test at the *smallest* size you'll print.

## Todo (by owner)

**You — capture (one focused session; high quality, fixed window size, grab more than you think):**
- [ ] Gameplay screenshots + video, each game played to a *fun moment*
- [ ] Feature screenshots + video: cosmetics/collection, titles, Discord auto-post, challenges, share
  sheet, offline/PWA install, languages
- [ ] Static UI grabs: catalogue, a score card, settings

**You — flyer/print track (parallel):**
- [ ] Research local printers, get samples, verify the QR scans at the *smallest* print size
- [ ] Confirm flyer dimensions

**Me — mocks/components (can start now with placeholders; drop real frames in later):**
- [ ] Promo-graphic mock (`plans/*.html`, on-brand, in the score-card language: strengths → games
  collage → a feature; doubles as refreshed OG)
- [ ] 9:16 shorts template (branding + QR end-card + caption style)
- [ ] Copy: graphic headline/strengths line, short captions, Reddit post text
- [ ] Print-tuned variant of the graphic (once dimensions + sample results are in)

**Together — assemble:**
- [ ] Glue mocks + graphics + screenshots + recordings → final flyer, promo graphic, trailer, shorts

## Trailer (~60s target; also cut a 30s social version)

**The origin story IS the pitch.** komyo was born from three real, specific frustrations every
parent/casual player feels — lead with these, they're the strongest asset:
- Hunting dozens of sites just to find a simple clean game (e.g. Asteroids) with no ads / no pay-to-win.
- The "**your kid wants to buy something — allow?**" purchase-nag from kids' accounts.
- Game sites with more ads on screen than game.

**Craft rules (decided 2026-07-09):**
- **First 3 seconds decide everything** — open with the juiciest gameplay moment OR the pain stated
  punchily. NOT a website tour.
- **Front-load the differentiators** — don't spread "no ads / no payments / no accounts" across
  separate beats. "Another browser-games site" is dismissed in ~5s; say why it's different *now*.
- **Kinetic captions over continuing gameplay, NOT full-stop text panels.** Slam "NO ADS." on-screen
  while the action keeps playing. Reserve a full-screen card for at most one hero line. Multiple
  read-stops kill momentum.
- **Group the strengths into one punchy anaphora hit:** *No ads. No paywalls. No accounts. No "your
  kid wants to buy something." Works offline.*
- **Elevate the kid-purchase nag into its own beat** — specific > generic; for the parent audience this
  may be the most persuasive 5s in the trailer.
- **Community = invite, not oversell** — the Discord is nascent at launch; "join us," don't show a
  thriving-community that isn't there yet (empty-room problem).
- **Weight time by strength priority:** most footage on the anti-ads/payments/accounts ethos +
  **breadth** (look how many real games); languages/challenges/features stay quick.
- **CTA lingers** — `komyo.online` on screen a beat longer than everything else.

**Beat structure (tightened from an 11-beat draft to ~7):**
1. **Hook** — killer gameplay burst *or* the pain + "Free browser games." (0–4s)
2. **The "No…" hit** — differentiators hammered over action, incl. the kid-nag beat (4–15s)
3. **Breadth montage** — many games, intense action (15–30s)
4. **Features quick** — challenges / collection / profile (30–40s)
5. **Any device + offline** — desktop→mobile transition, then airplane-mode-still-plays (40–52s)
6. **Future + community (light)** — "more games coming · join us" (52–58s)
7. **CTA** — `komyo.online` big, held a beat longer (58–60s)

30s social cut = beats 1 · 2 · 3 · 7.

**To draft before capture (so the shot list is known):** a **beat sheet** (per-beat shot list +
on-screen copy) + **tagline candidates** drawn from the three pains. Production order stays
theme/template/text-styles first, then fill with clips.

## Flyer (static graphic) — translating the trailer to one glance

A trailer delivers beats over **time**; a flyer delivers the same in a **2-second glance**, so sequence
becomes **spatial hierarchy** — you rank and stack, you can't pace. A printed flyer is seen *in passing*
(bus stop / café), so it's even harsher than the trailer: one headline readable from ~2 m, a few
scannable strengths, proof, a scan target. Everything else is cut.

**Beat → flyer mapping (7 beats collapse to ~4 zones):**
- Hook → **fused into the headline** (no room for a separate hook beat).
- "No ads/payments/accounts" hit → **the scannable heart**: a strengths badge row.
- Breadth montage → **the hero visual**: a games collage.
- Features (challenges/collection/profile) → **cut** (static can't show them; parent audience doesn't care).
- Any device + offline → **one small line** + a phone/desktop glyph.
- Community / future → **cut** (never oversell a nascent community on print).
- CTA → **the functional payload**: big URL + QR ("scan to play").

**Vertical layout (portrait A6/A5, top→bottom):**
1. **Brand + headline** — wordmark/mascot + the promise, fusing hook + differentiator
   (e.g. *"Free games. No ads. No nonsense."*). Big, high-contrast, room-readable.
2. **Strengths badge row** — 🚫 No ads · 🔒 No accounts · 💳 No payments · 📶 Offline · 🧒 Kid-safe
   (parent-pain, phrased warm). The scannable core.
3. **Games collage (hero)** — grid of game tiles in their own accents (multi-accent motif); doubles as
   the breadth + gameplay beats; the biggest visual pull. (A tiny "phone · tablet · laptop — even
   offline" line tucks below it.)
4. **CTA block** — `komyo.online` large + the QR + "scan to play." The whole reason print exists.

**Flyer-specific constraints (override trailer thinking):**
- **QR = the conversion, not decoration** — prominent, and it must scan: short URL, big modules, low
  version, per-batch UTM; test at the smallest print size.
- **Print-tune the neon** — dark backgrounds eat ink / band; neon accents dull in CMYK → likely a
  lighter-coverage variant vs. the screen graphic.
- **Ruthless text economy** — headline + ~5 badge words + URL. Reads like a paragraph = failed.
- Same **score-card design language** (frame glow, wordmark lockup, accent tiles, QR treatment) so it's
  unmistakably komyo and matches the video/cards.

**Variant choice:** **strengths-forward** (badges dominate — best for parent/family channels, the
default for local distribution) vs **games-forward** (collage dominates — for casual-player spots).
Same template, swapped emphasis.
