# Backlog notes

Detail for `ROADMAP.md` items that don't have their own `plans/*-plan.md`. The roadmap carries one
line per item; the reasoning, specs and caveats live here so the roadmap stays a todo list.

Shipped / dropped / decision-guard material does **not** belong here — that's `ROADMAP-archive.md`.

## Kit & catalogue

### Safari/iOS storage-loss warning

Safari's ITP evicts **ALL script-writable storage** (every localStorage save: bests, trophies,
cosmetics, game progress) after **7 days of Safari use without visiting the site**. Installed
home-screen PWAs are exempt.

Plan: detect Safari/iOS and weight the notice up once the player has meaningful progress (any
progress-based game state), then show a clear, non-nagging notice — "install the app or export a
backup, or your progress can be lost after inactivity" — linking straight to the Install flow + Data
Export. Also request **`navigator.storage.persist()`** (Safari 15.2+, Chrome grants heuristically) as
the silent first line of defense on every engaged device.

Matters ×10 once the saved-state lane ships — sequence it with that lane at the latest.

### Dedupe reused UI into shared kit components (refactor)

The same widget is hand-written in several places with its own markup+CSS, so they drift and we keep
hand-syncing them. The trophies + Collection **pills** already bit us twice (challenges drawer vs
profile vs the in-game 🏆 panel). Other candidates: the collection/progress bar, the good-run bonus
line, the points pill, buttons.

Fix pattern: extract one kit factory (e.g. `gamekit.cosmeticPills(opts)`) + one shared CSS class in
`game-kit.css`, used by BOTH the catalogue (`index.html`) and the in-game panel (`game-kit.js`).

Task: sweep `index.html` + `game-kit.js` for every element rendered in ≥2 places, list them, extract
the DOM ones into shared kit helpers. Caveat — the **canvas** share/score/profile cards can't reuse
DOM/CSS (they're pixels); for those share only the DATA/label formatting (one function) so text can't
drift, and accept that the draw code is re-implemented. Moderate effort, not a rewrite.

### Menu backdrops should render the real game engine (refactor)

Each menu's animated `cfg.backdrop` is a **hand-written re-derivation** of the game's look
(starfield, meadow, neon snake, TD map…), so any change to a game's visuals must be duplicated in its
backdrop and can drift. Rework so a backdrop renders a **live idle frame of the actual game** (factor
each game's scene draw into a shared `drawScene(frame)` the menu can call) — one source of truth.
Bigger refactor (needs ambient motion in a non-playing state); deferred.

**Interim: backdrop-truth pass (opportunistic).** Three backdrops still imitate in-game objects with
menu-local code — **asteroids-plus** (`mbRock` + fake enemies), **snake** (menu-local snake/grid),
**breakout** (imitation brick wall). When next touching each game visually, fold its backdrop onto the
real painters (forcefield's retarget pattern). Don't sweep them for their own sake. See the backdrop
knob in `game-design-knobs.md`.

### Render-interpolation for the remaining linear movers

`gamekit.loopAlpha()` cures fixed-step judder; applied where visible: Meadow Flyer (everything),
Brick Breaker (ball + power-ups, via its own accumulator), Forcefield (dome sweep + ricochets).

Remaining candidates, all LOW visibility (motion is slow, brief, eased or masked): **Keep Defender**
walkers (0.4–2 px/step + bob), **Bubble Pop** flying shot (sub-second), **Range** drifting targets
(slow), **Asteroids / Asteroids+** (own loops, rotating drift — handle-with-care pair, only touch if
someone notices). Pattern + the all-or-none layer rule are documented in the komyo-new-game skill
(`gamekit-api.md`).

### Top-bar button labels on desktop (undecided)

At ≥~900px show icon + short label on the right cluster (`📱 Install · Language · ⚙️ Settings ·
⛶ Fullscreen`); icon-only below (today's look). ☰ stays bare. Static label text (no "Exit fullscreen"
swap — state lives in the icon); only "Install" needs a new i18n key ×7; eyeball label widths per
locale (uk/pt/it run long).

### Tile blurbs behind an (i) — parked, start with mocks

Hide the always-on tile description. Preferred direction: a small gray (i) next to the tile's ★
(tap/hover → blurb popover). Rejected: whole-tile hover tooltip. Blurb length is test-capped meanwhile
(source ≤120 chars, translations ≤170) so descriptions stay tile-sized either way.

### CI check: the `updated` badge stays honest

A GitHub Action that fails when a game's OWN files changed but its `updated` date in `games.js` wasn't
bumped, so the UPDATED badge never goes stale/missing.

**Crucial nuance:** shared changes (`game-kit.js/css`, `challenges.js`, …) affect every game and must
**NOT** require bumping any game's `updated` — a minor kit tweak shouldn't mark all games "updated"
when the games themselves didn't change. So "game changed" = a diff under `games/<slug>/` (probably
excluding deploy-stamped `sw.js` VERSION churn); shared/kit diffs are exempt.

### Custom error pages

Verify what GitHub Pages actually allows. A root **`404.html`** *is* supported → build a branded one
(mascot + search / back-to-catalogue). Other codes (403 / 5xx) are served by GitHub/Fastly and
**aren't** customizable on a static Pages site — confirm the limits and document what we can't do.

### Sitemap coverage — the static pages

`sitemap.xml` lists only the catalogue + each live game, not `tos.html` / `privacy.html` (nor future
standalone pages). Likely **yes, add them** with a low `<priority>` so search engines can discover
them; also cross-check that `llms.txt` and `robots.txt` list what we intend. One-time audit + the
CLAUDE.md "when a page goes live" step already covers new pages going forward.

### Tips & tricks widget (idea)

There are no loading screens, so surface rotating tips on the home page (e.g. bottom-right corner),
cycling continuously; dismissable and re-openable via a small bubble button. Content: how-to-play
nuggets, feature callouts (challenges, Collection, offline install, languages), keyboard shortcuts.
Unobtrusive + reduced-motion-safe.

### Welcome speech bubble from the mascot (idea)

The header mascot says "welcome" in a random rotation across all supported languages (a little i18n
flex). Subtle, brief bubble on load / occasional, reduced-motion-safe. Pairs with mascot work.

### Infra: staging env + CDN

Staging (`staging.komyo.online`) **+ consider a Cloudflare CDN in front of GH Pages** (bandwidth
headroom past ~100 GB/mo + an escape hatch). Staging must isolate side effects: `noindex` + robots
disallow, **no prod GA4**, **no prod Discord webhook**, **no real Kit signups**. DNS: `staging` CNAME
→ `n0zz.github.io` in OVH; keep the two `CNAME` files straight.

## Mascot & cards

The chibi fox-girl placeholder **stays for the foreseeable future** — it's good enough and redoing it
carries a re-upload tax (the logo lives on socials, Discord, itch, BuyMeACoffee, …). Notes for
whenever a refresh is actually revisited:

- Character: chibi fox-girl (Holo-ish, red/orange hair, fox ears); reused on social, stickers, 404,
  newsletter, empty states.
- **Approach idea (2026-07-14, unconfirmed):** artists are expensive/slow → consider a **gen-AI
  bridge, one-and-done, not many iterations**. Do it **spec-first** (converge on a written character
  spec cheaply, then generate once and freeze). **Split the freeze-once avatar/logo (goes everywhere)
  from the on-site mascot illustration (iterate freely — redeploys are free).** The **logo should be
  derived from the mascot** (a simplified mark of the same character), not a separate abstract emblem.
- When real art lands: swap the placeholder everywhere + **mascot art refresh** of `buildScoreCard` /
  `buildProfileCard` around it + a **mascot attire shop** (spend trophies on logo / score-card /
  profile mascot cosmetics).

**Card/share spec the shipped cards reuse:** on-screen can animate (glints/particles); the **shared**
card must be a **static PNG** (animation can't survive an image), so bake the glow/gradient/halo into
the still (particles won't serialize into the DOM snapshot + Safari taints → drawn-card fallback;
gradient + glow do reach the bar). **Sharing = image-first, text only as fallback** — native Web Share
/ Discord webhook / download-copy take the image; **X / Reddit intents are link+text only** (can't
attach a local PNG), so better previews there would need pre-generated per-game/score **OG images**
(server-side → parked).

## Platforms

### TV & controller support

Android/Google TV · remote · gamepad. Full design at `~/komyo-tv-controller-design.md`. a11y, remote
and gamepad for **all viable games** (the a11y/keyboard win alone justifies it); non-viable games get
**Steam-style badges** (🎮/⌨️/📺), not forced support.

Steps: (1) keyboard **focus + spatial nav** for catalogue/menus, (2) kit **`gamekit.input`** layer
(keyboard+gamepad+touch), (3) per-game `controls` capability map → badges **+ catalogue filters**,
(4) 10-foot polish. GitHub Pages can't install as a TV app — target browser play.

## Distribution & integrations

Filter for all of these: **does it keep the no-server / no-ads / no-accounts identity?**

### Discord Activity (play inside a voice channel)

Register a Discord app with **Activities** enabled (Embedded App SDK) so people launch komyo inside a
voice channel and play together on the server. Our games are static, self-contained, same-origin, no
external deps — exactly what the sandboxed Activity iframe wants (the chore is routing requests
through Discord's `/.proxy/` URL mapping + the CSP). Bonus: the SDK exposes the Discord user, so we
could auto-set the display name for the score post. Needs a public, approved app.

Known polish item: fix the proxied-feedback "network error" + verify webhook/GA4 in-Activity.

Also needed if it ships: a **video preview** clip for the directory — hard limits **640×360 · 16:9 ·
mp4 · ≤0.5 MB · 10 s**, downscaled from the same source footage as the trailers.

### Twitch chat (client-side, no backend) — the standout integration

A streamer logs in with Twitch; the game connects to **Twitch chat over IRC-WebSocket from the
browser** (no server) and viewers affect/play via chat: vote the next wave, spawn a boss, names
on-screen, emoji/message-spam thresholds spawning monsters or firing effects (per-game opt-in). Fits
"self-contained"; streamer + chat is the best organic-reach lever. Suits Keep Defender / Asteroids.

**"Chat plays komyo"** variant — chat votes what game to play next and then makes the moves (command
voting per turn/tick); realistic for turn-based or genuinely slow games (Sudoku / Trap the Cat / a
future Floodgate, or a slowed-down Snake), hopeless for reflex games.

Deeper hooks (channel-point EventSub, a published Twitch **Extension** panel) need an Extension
Backend Service → parked.

### Google Play via PWA wrap

Games are already PWAs; Bubblewrap / PWABuilder wraps the catalogue (or a game) as a TWA → real Play
Store presence, no backend, no ads. Best app-store route. iOS needs a wrapper + Apple review — harder.

### Discord auto-post at scale (decided)

Keep posts **client-side**, shard by **one channel + one webhook per game** — each game is then an
independent ~30/min bucket (the ceiling is keyed to channel *and/or* webhook, and per-game makes both
unique, so it works either way). No practical per-server cap; Discord's global ~50 req/s is **per
origin IP** and client posts come from each player's own browser, so that never bites. Gate volume
with a **filter + adjustable threshold** — only post scores above a tunable level (records / notable
runs). The realistic wall is a *single game* getting >~30 finishers/minute (a great problem, far off).

*Not doing — batching* (needs a server to aggregate across players; pointless per-player — see the
archive's decision guards). *Parked — a relay* in front of the webhook (the client-embedded webhook is
an open spam target; a relay would hide + rate-limit it, but that's a Cloudflare-Worker route we're
avoiding).

Optional, cheap: an opt-in toggle for the score auto-post.

### Shared scores feed = Discord

The score auto-post *is* the games-log. A live **on-site** feed needs an off-GitHub backend (Pages is
static): **(a)** a scheduled Action scrapes Discord → static `scores.json` (stopgap, near-live,
one-way, GitHub-native — preferred), or **(b)** Cloudflare Worker + KV (`POST /score` → capped list,
`GET /recent`; truly live — parked). Filter to good scores / records only; a public `POST` has the same
abuse surface as the webhook. **Defer** until real traffic — an empty live feed looks deader than none.

### Cloud-sync the Export/Import blob (idea)

Let a player connect a personal storage provider (Google Drive / Dropbox / OneDrive) so the base64
export auto-syncs (backup + carry between devices) without manual export/import. Client-side OAuth to
the *user's own* drive — no komyo backend, no accounts on our side. Watch: OAuth needs registered app
credentials + redirect handling on a static site, plus token storage; strictly opt-in. A nice step up
from manual Export/Import once profiles matter to people.

### Challenge-points economy — the backend-gated part

Shipped client-side already: titles + the per-game cosmetics shop (trophies). What's left is
backend-gated:

- **Discord roles/titles** bought with trophies — a real status carrot, but needs a Discord bot +
  OAuth (link account → grant role).
- **The hard part = anti-cheat.** On-device points are trivially forged (export → bump → import), so
  any reward with *external* value must verify the **whole history** (plays, records, challenge log),
  not the number: recompute expected points and reject/flag mismatches (a jokey "cheater" role). Be
  honest though — a determined cheater can craft a *consistent* fake history offline, so client
  verification only raises the bar. **True** integrity needs server-side authoritative recording,
  a real departure from the no-backend / no-accounts / device-only model. Decide whether the status
  payoff justifies that before building.
- **Mascot-skin shop** (buy mascot skins with trophies; the mascot is the logo + shows on score cards,
  so a skin is visible and worth chasing) is client-only and doable — gated on real mascot art.

### Duel / tournament mode (feasibility TBD)

Join a P2P lobby with friends, pick ~3–5 games+modes, everyone plays for the highest score; best score
takes the game, most games won takes the match. Honest issues: (a) **"no servers" is only half-true
for P2P** — WebRTC data channels are serverless for the match, but pairing needs signaling (manual
room-code blobs are clunky; a tiny relay is the usual answer → collides with the no-backend stance);
(b) **cheating is trivial** — scores are client-reported, so a duel is honor-system only (fine for
friends, meaningless for strangers). Cheap near-term substitute: a **challenge-link mode** ("beat my
4,320 in Asteroids — same seed") sharing a target via URL params, async, zero infra.

### Cheap share wins

- **More share targets** — WhatsApp / Telegram / Bluesky / Mastodon / Threads intents (just URL
  schemes) + a **vertical "story" score-card** for IG/TikTok Stories.
- **Per-game OG/Twitter cards** — static per-game share images so a shared *game* link looks good, not
  just the homepage.

### Changelog inside games (idea, 2026-07-28)

The 🗒️ Changelog modal is catalogue-only, so the "a release you haven't read" dot (shipped 2026-07-28 on
the home page's ☰ + its Changelog row) can't exist in a game — a dot there would point at nothing
openable. To extend it: add a 🗒️ item to the kit's ☰ panel (`more` in `game-kit.js`'s `nav()`), lift the
modal's renderer out of `index.html` into the kit so both surfaces share one implementation, then reuse
the same `arcade_cl_seen` key and light `#gamekitMore`. Deliberately NOT done at the time: a player deep
in a game is the one audience we don't interrupt, and it means a second dot source on a button that
carries the game menu. Worth it only if release notes turn out to be something players actively chase.

### Ranked pick if/when we act on integrations

Twitch chat → richer share targets + story card → Play Store via PWA. Everything else is post-launch
or parked.

## Games

### Type Siege — math mode (agreed, undesigned)

A fourth mode where the enemy carries an arithmetic problem (`7 × 8`) instead of a word and you type
the answer. Agreed 2026-07-27 as a **mode inside Type Siege**, not a separate game — see the archive
guard, and read it before anyone re-pitches the spin-off.

**Why it's worth doing:** it is the only content in Type Siege that costs **zero translation**. The word
banks are ~1400 words × 8 locales and each new language is a real job; `7 × 8` reads the same in
all eight. It is generated rather than authored, so it is infinite, seedable for a daily board, and free in
storage. It also gives the catalogue a genuine kids/practice angle (🐣 Easy picks, a KIDS tag) that
fits the "kid-safe" promise.

**Why it is NOT a re-skin of `words.js` — three things break:**

- **Auto-lock dies.** Targeting comes from the first keystroke. In a 10-symbol alphabet `56`, `54` and
  `5` collide constantly, where 26 letters rarely do. Likely fix: Enter-to-submit (type the digits,
  press Enter, resolve against whichever live enemy matches), which costs the incremental cut-down
  feedback. The alternative — generating live answers with distinct leading digits — caps concurrent
  enemies at <10 and gets worse as waves grow.
- **Difficulty scales on the wrong axis.** Word difficulty is length, which is also typing time, so
  `crossSteps` tunes off it directly. A hard sum is the same two keystrokes as an easy one but ten
  times the thinking. Timing has to derive from the operation, not the answer's digit count.
- **Fewer, slower enemies.** Three lanes of simultaneous arithmetic is unpleasant rather than hard.
  Two live problems, slower.

**Discoverability without a second tile:** bump `updated:` in games.js when it ships (UPDATED badge +
the ✨ What's new shelf), add a `MATH` tag (and consider KIDS) beside TYPING/ACTION, put it in the tile
blurb, and add it to `seo.type-siege.howto` + the `#gk-about` section so the crawler and LLM surfaces
carry it. Search traffic for "math game" then lands on the Type Siege page, which is the honest
destination.

**One cost that is not free to undo:** bests are stored per mode label in `gamekit_pb` and a shipped
mode is announced in the changelog. If it were ever promoted to its own game, the mode either stays
(duplicate) or is dropped and orphans entries in players' profiles. So pick the mode label
deliberately the first time rather than something worth renaming later.

**Next step:** write the mode design — problem generation (solvable-by-construction, distinct answers
among live enemies, tiers from +/− within 20 up to mixed × ÷), the timing model, and the input
contract — and react to it before any code. Then it follows the normal dev-process gate (POC first; if
arithmetic-under-pressure is stressful rather than fun, stop there).

## Marketing experiments

- **Score-card stickers + flyers, local cooperation** — the printed score card is the brand visual
  language; the real lane is cooperation with local RPG/boardgame groups (Alienated Shark, Dzingwin
  and others in the area). Blocked on the promo graphic + two decisions (site-level accent, flyer
  dimensions). QR-at-print-size caveats and templates: `plans/promo-content-plan.md`,
  `plans/qr-print-notes.md`.
- **Mascot QR stickers** — high-boredom-with-phone spots (bus stops, cafés, queues); tracked URL
  (GA4) + a reason to scan (pair with the Daily Challenge). Small measurable side-experiment.
- **Merch** — mascot on stickers/tees/mugs/pins (print-on-demand). Brand + fun, not revenue; gate
  behind some audience.
- **Hand-made komyo plushie** — one-off passion/brand object; giveaway / hero photo.
- **AI-channel marketing — the repo IS the ad** *(risky, considerable)* — promote the **GitHub repo**
  as the artifact in AI / genAI / vibecoding communities (r/ClaudeCode, r/ClaudeAI, r/vibecoding, Show
  HN, AI-dev X/YouTube): a whole product built AI-first with the full development history public
  (CLAUDE.md-driven workflow, per-game test harnesses, the create-a-game skill). People check what the
  repo *produces* → discover komyo.online. Upside: rare content, and that audience IS the HN/curator
  crowd that features browser games; a second acquisition lane that doesn't compete on game keywords.
  Risks: publicly brands the site "AI-made" (skepticism sticks to the brand, not just the post), the
  audience is devs not players, and it spotlights the repo for cloners. Mitigation: lead with the
  games' polish, frame AI as the *how*, and do it as one deliberate post — not the identity. The
  disclose-first playbook that already won a mod approval is in `plans/marketing_plan.md`.

## Evaluated and closed

Kept here (not in the archive) because they're "no for now, with conditions" rather than shipped or
dropped outright.

- **3D / three.js — stay no-deps** *(2026-07-11)*. Zero-build IS officially supported (importmap +
  self-hosted files) and vendorable in-repo, but costs **~188 KB gz** un-tree-shaken; **WebGL2 is the
  hard minimum** (~97 % support). The dealbreaker: **the renderer can't run in our headless harness**
  (headless-gl is WebGL1-only/stale), so `__test.step(n)` + the mocked-canvas contract — our
  regression net — doesn't carry over; only scene-graph/math is Node-testable. And no genre we want
  needs a true 3D camera: outrun-style pseudo-3D, isometric, sprite-scaling and starfields are
  canvas-2D tricks. If one game ever truly needs it: **OGL** (~8 KB gz, three-like, Unlicense) or raw
  WebGL2 for that ONE game, model-is-truth fully testable with render untested — a deliberate
  exception, not a kit direction.
- **QR-based save import/export — blocked.** Turning the Export blob into a scannable QR needs (a)
  extending `qr.js` past **v6 (~106 bytes)** to v7+ (version-info blocks + multiple alignment
  patterns), (b) compressing the blob (exports are hundreds of bytes+), and (c) a **decoder** (camera
  scan) we don't have. Park until there's demand. The score-card QR only needs a short URL, so it
  stays on v1–6.
- **Ad portals (Poki / CrazyGames / GameDistribution) — no.** Real volume, but they inject their ads +
  want their SDK, which collides with "no ads · plays offline". A separate, deliberate decision later
  if ever.
- **Portals in general — downgraded to no-op** *(2026-07-26)*. itch.io was tried (Asteroids+ listed,
  ~0 views): generic-tag browse is hopeless for recognizable clones, so portals are neither a
  discovery engine nor worth the upload labor. Revisit **only** as cheap SEO backlinks once we have
  originals worth their own landing page. Newgrounds already dropped. Tooling exists if we return:
  `scripts/package-game.mjs <slug>` + image/trailer templates in `~/komyo-promo/itch-assets/`.
