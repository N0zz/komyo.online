# komyo Roadmap

**Open work only, one line per item.** This file is a todo list, not a design doc — if an item needs a
paragraph, the paragraph goes in a plan file and the roadmap keeps the one-liner.

| Where | What |
| --- | --- |
| [`ROADMAP-archive.md`](ROADMAP-archive.md) | shipped · dropped · parked · the **decision guards** ("don't re-propose") — read the guards before proposing anything new |
| [`plans/games-queue.md`](plans/games-queue.md) | the games build pool (the roadmap never names games) |
| [`plans/backlog-notes.md`](plans/backlog-notes.md) | detail for backlog items with no plan file of their own |
| `plans/*-plan.md` | per-initiative execution plans with `- [ ]` steps |

Item shape: `- **Title** *(status)* — one-line gist. → link`.
Statuses: *idea* · *planned* · *in progress* · *blocked*.
When something ships, move it to the archive and leave one open line behind for any leftover.

Per-game feel/balance polish is continuous and not tracked here. Retuning challenges, targets and game
balance from real data + feedback is how we work — not a roadmap item.

*The old numbered "Path to launch" track is complete and archived (§ Path to launch — the steps that
completed). `plans/progress-save-api-plan.md` still references "#5" = the progress-save API.*

## Now

Dev and marketing run in parallel; top item first within each.

- **Persistent-game lifecycle** *(planned — top dev item)* — timestamp-based offline accrual +
  no-wipe-on-loss on top of `gamekit.progress`; gates every saved-state game. →
  `plans/progress-save-api-plan.md`
- **Safari/iOS storage-loss warning** *(planned — ship with the lifecycle)* — ITP wipes localStorage
  after 7 unused days; `navigator.storage.persist()` + a nudge to install or export. →
  `plans/backlog-notes.md`
- **More games** *(continuous)* — triage the idea pool, then build in small batches through the
  dev-process gate. → `plans/games-queue.md` · `plans/viral-shots-plan.md`
- **Clip drip across the 5 socials** *(in progress — under review)* — 100–900 views/clip, but <3 s
  retention and ~no site traffic; keep running a few weeks, then keep-or-kill. →
  `plans/clip-release-plan.md`
- **Reddit drip — AI + parents lanes next** *(in progress)* — indie/sideproject/gaming side is done.
  The AI lane carries the "publicly AI-made" branding risk (weigh before posting); held one-shots:
  r/InternetIsBeautiful, Show HN, Product Hunt. → `plans/marketing_plan.md`

## Next — dev

- **Triage the game idea pool** *(planned)* — pick the next batch before starting any build. →
  `plans/games-queue.md`
- **Type Siege — math mode** *(idea)* — enemies carry sums instead of words; the only Type Siege
  content that needs no translation. A MODE, never a second game. → `plans/backlog-notes.md`
- **i18n leftovers** *(open)* — native QA pass + mobile QA across languages × orientations. →
  `plans/i18n-plan.md`
- **Sitemap: add the static pages** *(open)* — `tos.html` / `privacy.html`; cross-check `llms.txt` +
  `robots.txt`. → `plans/backlog-notes.md`
- **Discord Activity polish** *(open)* — fix the proxied-feedback "network error", verify webhook + GA4
  in-Activity. → `plans/backlog-notes.md`
- **In-run new-best pulse: all 18 viable games wired** *(open — awaiting local review + push)* — 4 games
  deliberately have no live bar (reasons in the note). → `plans/backlog-notes.md`
- **Review local Claude memories about komyo** *(open)* — prune stale entries so future sessions don't
  act on outdated context.

## Next — marketing & growth

- **Marketing plan → tl;dr** *(planned)* — cut the 339-line research doc down to where-to-post /
  what-to-post / red flags. Fold in: portals dropped, AI+parents as the next lanes, the local lane
  below, and that streamer outreach never started. → `plans/marketing_plan.md`
- **Local lane: score-card stickers + flyers** *(planned)* — cooperation with local RPG/boardgame
  groups (Alienated Shark, Dzingwin, others). Blocked on the promo graphic + two decisions: site accent
  and flyer dimensions. → `plans/promo-content-plan.md`
- **Streamer / YouTuber outreach — first batch** *(planned)* — researched leads, never contacted (Graf,
  the GeoGuessr PL/CS/DE/FR channels, Jupiter Hadley). Cheapest untried lane. →
  `plans/marketing_plan.md`
- **LinkedIn build-in-public series** *(planned — starts ~2026-08-01)* — origin story first, then AI
  workflow / solo QA / i18n / honest marketing numbers. → `plans/marketing_plan.md`
- **Facebook groups — parents + PL gaming** *(idea)* — join, participate, then post; the
  no-ads/no-accounts/kid-safe pitch is exactly the parent concern. → `plans/marketing_plan.md`

## Big projects

One line each; the real content is in the linked plan.

- **Achievements** *(designed, not started)* — evergreen auto-unlocking goals (per-game + site-wide)
  that pay 🏆; needs a cumulative-tally store the kit doesn't have. → `plans/achievements-plan.md`
- **Procedural music v3** *(idea)* — from ~8 distinct flavors to hundreds of per-game/biome/daily-seed
  tracks; stays zero-asset. → `plans/audio-music-plan.md`
- **Replay system** *(idea)* — (B) kit-owned 15 s clip capture, ships alone; (A) deterministic
  input-replay in IndexedDB. → `plans/replay-plan.md`
- **TV + gamepad + a11y** *(designed, not started)* — spatial focus nav → `gamekit.input` → per-game
  controls badges + filters → 10-foot polish. → `plans/backlog-notes.md`
- **Twitch chat integration** *(idea — top-ranked integration)* — client-side IRC-WS, viewers affect the
  game; best organic-reach lever. → `plans/backlog-notes.md`
- **Discord Activity** *(idea)* — play komyo inside a voice channel; strong architectural fit. →
  `plans/backlog-notes.md`
- **Google Play via PWA wrap** *(idea)* — TWA of the catalogue; no backend, no ads. →
  `plans/backlog-notes.md`
- **Dedupe reused UI into kit components** *(refactor)* — one factory + one CSS class per widget; the
  pills already drifted twice. → `plans/backlog-notes.md`
- **Menu backdrops render the real game engine** *(refactor — someday)* — kill the hand-written
  re-derivations. → `plans/backlog-notes.md`
- **Staging env + CDN in front of Pages** *(idea)* — `staging.komyo.online` with all side effects
  isolated. → `plans/backlog-notes.md`

## Backlog

Small or unscheduled; each is one line, detail in `plans/backlog-notes.md` unless linked.

- **🎲 Tinder-deck game picker** *(idea — later/if-ever)* — swipe-deck behind the existing 🎲 Random
  button, never a new button. → `plans/discover-plan.md`
- **Tips & tricks widget** *(idea)* — rotating tips on the home page, dismissable bubble.
- **Welcome speech bubble from the mascot** *(idea)* — "welcome" rotating across all 8 languages.
- **Top-bar button labels on desktop** *(undecided)* — icon + label ≥~900px.
- **Tile blurbs behind an (i)** *(parked — start with mocks)* — small gray (i) next to the tile ★.
- **Backdrop-truth pass** *(opportunistic)* — asteroids-plus / snake / breakout still imitate their own
  game art.
- **Render-interpolation leftovers** *(low priority)* — Keep Defender, Bubble Pop, Range, asteroids
  pair; all low-visibility motion.
- **More share targets + story card** *(idea)* — WhatsApp/Telegram/Bluesky/Mastodon/Threads intents +
  a vertical story score-card.
- **Per-game OG/Twitter cards** *(idea)* — static per-game share images.
- **Changelog inside games** *(idea)* — a 🗒️ item in the kit's ☰ so a game can carry the "new release"
  dot too; today the modal is catalogue-only.
- **Challenge-link duel** *(idea)* — "beat my 4,320, same seed" via URL params; the zero-infra stand-in
  for a live duel lobby.
- **Cloud-sync the Export blob** *(idea)* — opt-in OAuth to the player's own Drive/Dropbox; no komyo
  backend.
- **Mascot refresh + attire shop** *(far out)* — current chibi fox-girl is the keeper; spec-first,
  freeze-once approach if ever revisited.
- **Marketing experiments** *(idea)* — mascot QR stickers, merch, a hand-made plushie, the
  "repo IS the ad" AI-channel post.

## Parked / decided no

Full reasoning in [`plans/backlog-notes.md`](plans/backlog-notes.md) § Evaluated and closed, and in the
archive's decision guards.

- **Game portals (itch.io, Newgrounds, GameJolt…)** — tried, ~0 traffic; our recognizable clones can't
  win generic-tag browse. Site-only; revisit as cheap backlinks only if originals earn a landing page.
- **Ad portals (Poki / CrazyGames / GameDistribution)** — their SDK + ads collide with the identity.
- **3D / three.js** — the renderer can't run in our headless harness; no genre needs a real 3D camera.
- **QR save import/export** — needs `qr.js` past v6, blob compression, and a decoder we don't have.
- **Parental lock beyond the PIN** — the shipped PIN is enough; the word-check gate is dropped.
- **Backend-gated** — global leaderboards, a live on-site scores feed, per-score OG images,
  Discord-role economy + real anti-cheat, P2P duel lobbies, Twitch Extensions, a webhook relay.
