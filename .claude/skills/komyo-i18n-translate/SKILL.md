---
name: komyo-i18n-translate
description: >-
  Add a new language to komyo, or fill in/extend an existing one. Use this
  WHENEVER the user asks to translate the site into a language, add language
  support, fix a half-translated locale, or update the changelog's language
  coverage. Explains the i18n.js/i18n.<code>.js/game-kit.js system, how to
  split a ~1400-key translation into parallel-safe chunks, run a
  consistency-review pass across those chunks, and merge the result back into
  the locale's i18n.<code>.js file without corrupting it. Also covers the
  incremental case: adding a batch of NEW keys
  (e.g. a new game's strings) to every already-complete locale. Triggers on
  "translate komyo into <language>", "add <language> support", "we're missing
  translations for X", "the changelog isn't translated in <language>",
  "translate the new <game> strings / new keys into all languages".
---

# Translate komyo into a new (or incomplete) language

komyo's i18n catalogue is **split per language**: `i18n.js` is a small LOADER +
the `en` (def-source) dict + `window.KOMYO_I18N_AVAILABLE` (the list of language
codes that ship a file); **every other locale lives in its own root-level file
`i18n.<code>.js`** (e.g. `i18n.pl.js`), shaped:

```js
window.KOMYO_I18N = window.KOMYO_I18N || {};
window.KOMYO_I18N.pl = { 'key': 'value', ... };
```

All files populate the one `window.KOMYO_I18N` map read by
`gamekit.t()`/`lang()` in `game-kit.js` (the loader sync-loads the active
language via `document.write`, then lazy-loads the rest after load). **Never
hardcode or assume the locale set** — discover the currently-configured locales
at runtime by evaluating `i18n.js` PLUS every `i18n.<code>.js` into one sandbox
(the way `extract-parts.mjs` and `test-harness.mjs` do), and treat every
populated non-`en` locale as a required target for any new key:

```bash
cd ~/arcade && node -e "const fs=require('node:fs'),vm=require('node:vm');const sb={window:{}};sb.globalThis=sb;for(const f of ['i18n.js'].concat(fs.readdirSync('.').filter(f=>/^i18n\.[a-z]{2}\.js$/.test(f)).sort()))vm.runInNewContext(fs.readFileSync(f,'utf8'),sb,{filename:f});for(const[k,v]of Object.entries(sb.window.KOMYO_I18N))console.log(k,Object.keys(v).length)"
```

Read `~/arcade/CLAUDE.md`'s i18n section and `~/arcade/plans/i18n-plan.md` first —
this skill operationalizes the "S7 · Translate" step of that plan for any
language, not just the original launch set.

## The system, in brief

- **`pl` (Polish) is the reference locale — it lives in `i18n.pl.js`.**
  `test.mjs`'s `testI18nCoverage` requires `pl` to contain **every** key the
  site actually uses (scanned from `data-t*` attrs and
  `t('key', ...)`/`T('key', ...)` calls, plus every
  `game.<slug>.title/.blurb`, `cos.<id>.name/.desc`, `cos.set.<id>`, and every
  `changelog.eN.title/.bM`). Every *other* locale must be **empty (not
  started) or a complete superset matching `pl`'s key set** — no
  half-translated locale ships. This means: to see the exact, current,
  complete key surface for a new language, read `pl` (`i18n.pl.js`), not `en`
  (`en` is sparse — most English text lives as inline `def:` fallbacks in the
  source files, not in `i18n.js`'s `en` dict).
- **Changelog keys are `changelog.eN.title` / `changelog.eN.bM`, where N is a
  REVERSE index** — distance from the END of `window.CHANGELOG` (in
  `changelog.js`), not the entry's current array position. New entries are
  only ever *prepended*, so an entry's distance-from-the-end never changes as
  newer entries get added above it — unlike a forward index, which would
  silently orphan every existing translation on every release. See the
  `ei = CHANGELOG.length - 1 - CHANGELOG.indexOf(rel)` computation in
  `index.html`'s changelog renderer and the matching logic in
  `test.mjs`'s `testI18nCoverage`. **Never key changelog translations by
  forward array index.**
- **Plural values** are objects selected via `Intl.PluralRules` — a plural key
  in the target locale needs **every category `Intl.PluralRules(code)` can
  return** for that language (Slavic languages like pl/cs/uk need
  `one`/`few`/`many` (+`other`); most Romance/Germanic ones use
  `one`/`other`). Whether a given key is plural is a structural fact of `pl`
  (or another live locale) — mirror plural-vs-string from `pl`, but take the
  category set from the TARGET language, don't copy pl's blindly.
- **Brand tokens never translate:** `Komyo`, `Komyo Games`, `komyo`,
  `komyo.online`, emoji, raw numbers, `2P`/`2–4P`, version hashes. Game/mode
  names are a per-name judgment call — check what the target-adjacent locales
  already did for that name and follow the established convention, don't
  invent a new one.

## Adding a brand-new language (engine wiring, before any translation)

Do this part yourself (not via subagents) — it's a handful of precise,
low-volume edits:

1. `game-kit.js`: add the code to `I18N_SUPPORTED`, an entry to `I18N_LANGS`
   (`{code, label}`, label in the language's own script), and a flag SVG to
   `I18N_FLAG_SVG` (inline, no external assets — a simple 2-3 colour
   rect/path is enough, see the existing entries). With ONLY this wired, the
   language renders as "soon" in the picker and is not selectable (see
   `langReady()` in `game-kit.js`) — a real, safe intermediate state.
2. Create the locale's own root-level file `i18n.xx.js`, shaped like the
   existing ones (see `i18n.pl.js`):
   ```js
   window.KOMYO_I18N = window.KOMYO_I18N || {};
   window.KOMYO_I18N.xx = { ... };
   ```
   It may sit with an empty map while translation is in flight.
3. **Register + ship the file — do this when it's populated** (typically the
   same push as the merge, step 4 below), because `langReady()` treats a code
   listed in `KOMYO_I18N_AVAILABLE` as selectable even before its dictionary
   loads — never list an untranslated language:
   - `i18n.js`: add `'xx'` to `window.KOMYO_I18N_AVAILABLE`.
   - **The root `sw.js` SHELL** — append `'./i18n.xx.js'` to the shared-files
     list in the ONE site-wide service worker (there are no per-game `sw.js`
     files — the root SHELL serves the catalogue AND every game). This is the
     silent-offline-kill step: a SHELL that misses the file means that
     language simply never works offline, with no error (the SHELL⇄locale
     lockstep test in `node test.mjs` catches it).
4. `test.mjs`: bump the `K.langs().length === N` assertion in `testI18n()`.
   (`testI18nCoverage()` needs NO edit — it discovers the locale set from the
   i18n files at runtime.)
5. `index.html` + `sitemap.xml`: add an `hreflang="xx"` alternate link /
   `xhtml:link` next to the existing ones.
6. `plans/i18n-plan.md`: update the language count/list in the goal line and
   Phase 0 decisions.
7. Run `node test.mjs` — should stay green (the new locale is legitimately
   empty; nothing regresses).

## Incremental mode — new keys into all existing locales (the common case)

Once every locale is complete, the recurring job is NOT a full translation —
it's "a new game/feature added N keys to `pl`; add them to every other
populated locale" (the coverage test requires each populated locale to stay a
complete superset of `pl`, so this is mandatory, not optional). For that:

1. Discover the populated locales (snippet above).
2. Per target locale, extract only what it's missing:
   ```
   node .claude/skills/komyo-i18n-translate/scripts/extract-parts.mjs <scratch-dir>/<code> --missing <code>
   ```
   Same part files, filtered to keys present in `pl` but absent in that
   locale; parts with nothing missing are skipped. A new game's strings
   usually land in one or two small files.
3. Translate: at this size skip the 6-part fan-out — dispatch **one agent per
   locale** (or one agent for ALL locales when it's only a few keys), reusing
   the prompt template's source-hunting + output-format rules. Each locale is
   its own file now, so per-locale agents are parallel-safe across locales
   (never two writers per FILE still holds). Consistency
   still matters: tell the agent to grep the neighbouring keys already in
   that locale's `i18n.<code>.js` and reuse its established terms (no separate
   review pass needed at this size).
4. Merge per locale into its `i18n.<code>.js` (same mechanics as step 4
   below): insert ONLY keys the locale doesn't already have — a re-added key
   must never end up twice in the map — re-parse the file, then
   `node test.mjs`.

## Translating a language (new or backfilling gaps)

A full site translation is ~1400 keys — too much for one subagent call to do
accurately and too much for you to hand-translate. Split it, translate the
parts in parallel, reconcile terminology across parts, then merge.

### 1 · Split into parts

Run:
```
node .claude/skills/komyo-i18n-translate/scripts/extract-parts.mjs <scratch-dir> [--missing <locale>]
```
This reads the current `pl` locale (merged from `i18n.js` + every root
`i18n.<code>.js`) + `changelog.js` and writes 6 files to
`<scratch-dir>`: `part1_kit.keys.txt` … `part5_cosmetics.keys.txt` (one key
per line) and `part6_changelog.keys.txt` (`key<TAB>English text` pairs — the
only part with the source text already inlined, since changelog English
doesn't live in `i18n.js` at all). With `--missing <locale>` it emits only
the keys that locale lacks (the incremental mode above). Re-run this any
time the site's key surface changes — never hand-maintain a stale key list.

Why these 6 buckets and not some other split: `game.*` (~595 keys) and `cos.*`
(~177) dwarf everything else, so they get their own part(s); the heaviest
games (the script's `HEAVY_GAMES` list — currently tower-defense,
asteroids-plus, asteroids, bubbles, each ~100+ keys of numbers-in-prose
upgrade/map text) are split out from the other games into "heavy" vs "rest" to
keep every part roughly 150-330 keys — big enough to be worth a subagent call,
small enough for one agent to get right and for you to sanity-check.

### 2 · Translate each part with a subagent — in parallel

Dispatch one Agent per (language × part) — for a single new language that's
6 agents in one message (parallel). Each agent must:

- Read its assigned `partN.keys.txt` (or, for part 6, translate the English
  already in the file directly).
- Find the actual English source per key — **not** from `i18n.js`'s `en`
  block (too sparse), but from where the string actually lives:
  - `game.<slug>.title`/`.blurb` → `games.js`'s `GAMES` array.
  - other `game.<slug>.*` → `games/<slug>/index.html`, grep the key inside
    `t('KEY', ...)`/`T('KEY', ...)`/`KIT.t('KEY', ...)` calls.
  - `cos.<id>.name`/`.desc` → `cosmetics.js`'s `COSMETICS.items`; `cos.set.*`
    → `COSMETICS.sets`.
  - everything else (kit chrome, catalogue, legal) → `game-kit.js` /
    `index.html` / `tos.html` / `privacy.html`, via `data-t*` attributes or
    `t()`/`T()` calls.
- Use the live `pl` map in `i18n.pl.js` **only** as a structural/tone
  reference (plural shape, whether a proper noun is translated) — translating
  from Polish text instead of the real English is a game of telephone that
  compounds errors.
- Write ONLY object-entry lines (`'key': 'value',` or
  `'key': { one: '...', other: '...' },`) to a dedicated scratch file — no
  markdown fences, no commentary. Keep `{param}` tokens verbatim, escape `'`
  as `\'`.

See `references/agent-prompt-template.md` for the full prompt text this
project has used successfully (fill in language + part + scratch paths).

**Never have two agents write to the same FILE concurrently.** All 6 part
agents of one language would land in that language's single `i18n.<code>.js`,
so within a language it's scratch files first, always. Across languages the
per-locale split makes concurrency safe: agents each merging a DIFFERENT
locale's `i18n.<code>.js` may run at the same time.

### 3 · Consistency-review pass (one agent per language)

Independent translators drift: the same concept ("good run", "trophy", a
game's display name, changelog "New:"/"Fix:" prefixes) gets rendered
differently in different parts. Dispatch one review agent per language that:

1. Reads all 6 of that language's part files.
2. Builds a glossary of recurring terms and picks one consistent rendering
   for each — cross-checking against the game's *actual* title/HUD strings
   (not just guessing) where a game/mode name is involved.
3. Edits the part files in place to apply it, without adding/removing keys.
4. Re-verifies `{param}` tokens are all still present and every line still
   matches the expected format.

This step matters — in practice it has caught real bugs every time (a game
translated under two different names across parts, a dropped `{param}`
token, mismatched formal/informal register between a shared kit string and a
game's override).

### 4 · Merge into the locale's `i18n.<code>.js`

Do this yourself, via a script — not by having an agent `Edit` the live file,
and not by reading all ~1400 translated lines into your own context (you
don't need to; only the *merge mechanics* need automating):

1. Validate each part file parses as a JS object literal (wrap in `({...})`
   and `vm.runInNewContext`), that no part key falls outside `pl`'s key set +
   the changelog key set (no extras/typos), and that **the target locale's
   existing keys plus the parts' keys form a complete superset of `pl`** —
   fail loudly if not, before touching `i18n.<code>.js`. (Only a
   from-scratch run reduces to "parts' union === `pl`'s key set"; an
   incremental run's parts cover just the keys the locale was missing.)
2. Concatenate the parts, **drop any key the locale already has** (a
   re-merged key must never appear twice in the map), indent, and splice
   into that locale's `i18n.<code>.js` — filling the empty
   `window.KOMYO_I18N.xx = { ... }` map for a new language, or inserting the
   remaining new lines before the map's closing `};` if it already has
   content (an incremental or changelog-only backfill for an established
   locale).
3. Re-parse the whole `i18n.<code>.js` file to confirm it's still valid JS.
4. **New language only:** register the now-populated file — add the code to
   `KOMYO_I18N_AVAILABLE` in `i18n.js` and append the file to the root
   `sw.js` SHELL (the ONE site-wide service worker — no per-game `sw.js`
   exists) — see the wiring section's step 3; a missing SHELL entry silently
   kills that language offline.
5. Run `node test.mjs`. It should go fully green — if `testI18nCoverage`
   fails, it will tell you exactly which keys are missing.

### 5 · Changelog: new-language announcement entry

When a language ships, prepend a `changelog.js` entry announcing it (see the
existing new-language announcement entries for the pattern: `title` is
written *in* the newly-announced language as a flourish, e.g. `'komyo parla
anche italiano! 🇮🇹'`; the body bullet is English, describing the feature).
Give it the next unused reverse index (`CHANGELOG.length` before you
prepend), then translate that one new title+bullet into every other populated
locale — the keys go into each locale's own `i18n.<code>.js` (discover the
set as above — a handful of short strings, fine to do by hand, no need for
subagents at this size).

## Common failure modes (all hit at least once building this)

- **Bulk-regexing MORE files than you meant to.** Each locale is its own
  `i18n.<code>.js` now, which contains the blast radius of a bad regex to one
  language — but a glob like `sed -i ... i18n.*.js` still hits every locale
  at once. Scope any bulk delete/rewrite to the ONE file you're fixing, and
  re-merge any locale you touched by accident.
- **Dangling double commas** after removing/inserting lines near the map's
  last key — always re-parse the whole `i18n.<code>.js` with
  `vm.runInNewContext` after any bulk edit, don't eyeball it.
- **Editing a locale file with the `Edit` tool right after a
  `Bash`/`node`-script write to the same file** can fail with "file modified
  since read" — prefer doing the actual merge via a `node -e` script in the
  first place instead of interleaving `Edit` calls with script writes to the
  same file.
- **Forgetting the root SW SHELL append for a new language.** The site works
  online, but the new language never loads offline — nothing errors at
  runtime. `grep -l 'i18n.xx.js' sw.js` should hit after the register step
  (and the SHELL⇄locale lockstep test in `node test.mjs` fails if it
  doesn't).
