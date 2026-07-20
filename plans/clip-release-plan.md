# Clip Release Plan — every trailer/short goes to all 5 channels

Status: **decided 2026-07-20** (channels, formats, per-platform renders, UTM scheme). Sibling to
`plans/marketing_plan.md` (channel strategy/schedule) and `plans/promo-content-plan.md` (asset
production). This one = **the release runbook**: when a clip exists, what files to render, what to
paste where, and how each platform wants it. The `komyo-game-trailer` skill produces the inputs
(trailer pair + metadata); this plan defines the full 5-channel kit it should emit.

## Channels & formats (settled 2026-07-20)

| Channel   | Post as                | Video file        | Link in text?                          |
| --------- | ---------------------- | ----------------- | -------------------------------------- |
| TikTok    | regular video post     | `*-tt.mp4`        | no (plain `komyo.online/games/<slug>`) |
| YouTube   | **Short**              | `*-yt.mp4`        | bare domain only for now (see below)   |
| Instagram | **Reel** (never feed)  | `*-ig.mp4`        | no — "link in bio"                     |
| Facebook  | **Reel** (page)        | `*-fb.mp4`        | not clickable in Reels; feed posts yes |
| Discord   | auto-post of YT upload | — (YT link embed) | clickable YT link                      |

Why Reels on IG/FB: Reels are the only format either platform recommends to **non-followers**
(Reels tab / Explore); feed posts reach ~only existing followers — useless for new accounts. Reels
are natively 9:16 full-screen; **no 1:1 versions** (they'd letterbox inside the same 9:16 player).
One 9:16 master per clip serves everything.

- **YouTube caveat:** Shorts descriptions don't carry clickable external links (and new channels
  gate links behind "advanced features"). Use bare `komyo.online/games/<slug>` text — no `https://`,
  no UTM (untypeable text). Revisit if/when the channel unlocks links.
- **Discord = community, not acquisition.** Standing mechanism: auto-mirror every YouTube upload
  (videos + Shorts) into a #clips channel via the channel's RSS feed
  (`https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`) — either **MonitoRSS** (hosted bot,
  zero code) or a small **GitHub Action cron** posting to our existing Discord webhook (same infra
  as the changelog poster). Native video upload in Discord only for big moments (site launch,
  major game). No separate Discord render.

## Per-platform renders (QR carries the platform)

Android's screen-context search (Circle to Search) scans QR codes straight off a playing video —
tested, works — so the trailer QR is a real per-platform click path. Renders are cheap (the skill
renders them; ~a minute each), so:

- **4 renders per trailer variant** (tt/yt/ig/fb) × 2 variants (V2 stage + V3 hype) = 8 files per
  game. The ONLY difference between platform renders is the QR payload — visuals identical.
- **Filenames are the mix-up defense** (identical-looking files):
  `finals-games/game-v2-stage-9x16-<slug>-tt.mp4`, `…-yt.mp4`, `…-ig.mp4`, `…-fb.mp4` (same for v3).
  The release kit lists file→platform explicitly; never upload a file whose suffix doesn't match
  the platform.

## UTM scheme (QR and caption links tell the same story)

Platform lives in `source`, scan-vs-click in `medium`, clip identity in `campaign`:

- **QR (in-video):** `?utm_source=<tt|yt|ig|fb>&utm_medium=qr&utm_campaign=<v2|v3>-<slug>`
  on `https://komyo.online/games/<slug>` (short URL = low QR version = scannable).
- **Caption links (where clickable):** same `utm_source`, `utm_medium=video`, same campaign —
  FB *feed* posts now, YT descriptions once links unlock. Discord posts are YT links, so their
  clicks attribute to YouTube (fine).
- **Bio links (set once):** IG bio → `https://komyo.online?utm_source=ig&utm_medium=bio`;
  same idea for the TikTok bio (`utm_source=tt`).

This replaces the old per-template-only tagging (`utm_source=tr-v2`) — template version moves into
`utm_campaign`, so GA4 still answers "which trailer style converts" AND "which platform".

## Per-platform metadata templates (the release kit's paste blocks)

The skill already emits TikTok + YT Shorts blocks (SKILL.md step 7); IG/FB extend the same pattern.
All captions: verify every claim against games.js + the footage (no invented features), count-free
strengths only (*free · no ads · no accounts · works offline · kid-safe*).

- **YouTube Shorts** — Title ≤100 chars (hook + game name + "free browser game"); description =
  1–2 hook sentences, then `Play free in your browser (no ads, no accounts, works offline):` +
  bare `komyo.online/games/<slug>`, hashtags starting `#Shorts` + genre tags.
- **TikTok** — one caption: hook (POV/question style), plain `komyo.online/games/<slug>`,
  hashtags incl. genre + `#fyp`.
- **Instagram Reel** — caption: hook + one strengths line + `🔗 link in bio` + hashtags
  (genre + `#indiegames #browsergames`; IG rewards ~5–10 relevant tags, skip #fyp).
- **Facebook Reel** — caption: hook + strengths line + plain `komyo.online/games/<slug>`
  (not clickable in Reels; still shows the destination). For launches, add a separate **feed
  post** with the clickable UTM link on top of the Reel.
- **Discord** — automated (YT mirror). For native launch posts: casual one-liner + the game link
  (`utm_source=dc&utm_medium=video`), no marketing voice.

## Cadence (extends tools/RECORDING.md rules)

- **YT Shorts are winner-take-all:** ONE at a time, 3–5 days apart (sequential A/B of V2 vs V3).
- **TikTok:** both variants, staggered by hours/a day.
- **IG + FB mirror the TikTok timing** (both variants, staggered). Never two uploads per day per
  platform. 1 game = a week of content, not a one-day dump.

## IG↔FB auto-share (optional accelerator — do NOT depend on it)

Meta Business Suite can cross-post IG Reels to the FB page automatically. Current attempts error —
almost always Accounts Center linking (IG account and FB page must sit in the same Business
Portfolio / be properly paired). Worth one more setup attempt. If it works: upload IG only, FB gets
the Reel automatically — accepting that FB then shows the **ig-tagged QR** (platform attribution
blends; acceptable trade for halving uploads). The release kit always contains the separate FB
caption + `-fb.mp4`, so manual fallback is one paste.

## Release checklist (the per-clip runbook)

1. Run the `komyo-game-trailer` skill → 8 platform renders + the 5-channel metadata kit.
2. User eyeballs the renders locally (nothing is published by the skill).
3. Post per cadence: TikTok both variants (staggered) · YT one Short (other in 3–5 days) ·
   IG Reel + FB Reel mirroring TikTok timing (or IG-only if auto-share works).
4. Discord mirrors YT automatically — nothing to do (native post only for launches).
5. Log what went out (date/platform/variant) in the marketing tracker sheet (marketing_plan §7).

## Work items

- [ ] **Trailer templates:** platform param (e.g. `PF` in the config block) that changes ONLY the
      QR payload → `utm_source=<pf>&utm_medium=qr&utm_campaign=<ver>-<slug>` (V2 + V3 game templates).
- [ ] **`komyo-game-trailer` skill:** render the 4-platform matrix per variant with `-tt/-yt/-ig/-fb`
      filenames; emit the IG + FB metadata blocks; reference this plan in step 7.
- [ ] **Bio links:** set IG + TikTok bio URLs with their UTM (see scheme above).
- [ ] **Meta Business Suite:** retry IG↔FB pairing (Accounts Center → same Business Portfolio).
- [ ] **Discord auto-post:** wire YT channel RSS → #clips (MonitoRSS, or GH Action cron + webhook).
- [ ] **YT links:** check periodically whether the channel unlocked clickable description links;
      when it does, add the UTM link line to the YT template.
