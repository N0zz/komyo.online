# Translator agent prompt template

Fill in `{{LANGUAGE}}` (e.g. "Czech"), `{{CODE}}` (e.g. "cs"), `{{PLURAL_NOTE}}`
(e.g. "one, few, many, other — mirror pl's shape"), `{{KEYS_PATH}}`,
`{{OUTPUT_PATH}}`, and the part-specific `{{SOURCE_GUIDANCE}}` block below.
One agent per (language, part) — dispatch all of a language's (or a whole
batch's) part-agents in a single message so they run in parallel.

```
Repo: ~/arcade (komyo, a browser-game arcade site). It has a client-side i18n
system: window.KOMYO_I18N in i18n.js holds per-locale key→string maps, loaded
by game-kit.js's t()/lang() engine. The `pl` locale (Polish) is fully
translated and is the reference for which keys exist and their shape (plain
string vs plural object {one,few,many,other}).

TASK: produce {{LANGUAGE}} ("{{CODE}}") translations for the exact list of
keys in this file (one key per line):
{{KEYS_PATH}}

{{SOURCE_GUIDANCE}}

Use the existing `pl` block in ~/arcade/i18n.js (grep `  pl: {` then the
relevant lines) ONLY as a structural/tone reference: which keys are plural
objects vs plain strings, how {param} placeholders are used, and whether a
given proper noun/game name is translated or kept as-is in Polish — mirror
the SAME choice for {{LANGUAGE}}, but always translate from the actual
English source you find in code, not from the Polish text (avoid
double-translation drift).

{{LANGUAGE}} plural categories via Intl.PluralRules: {{PLURAL_NOTE}}.

OUTPUT FORMAT — critical: for EVERY key in the list, produce exactly one line:
  'KEY': 'TRANSLATED TEXT',
or for plural keys:
  'KEY': { one: '...', other: '...' },
Rules:
- Keep every {param} placeholder (e.g. {name}, {count}, {score}) exactly as-is.
- Keep brand tokens untranslated: Komyo, Komyo Games, komyo, komyo.online,
  emoji, raw numbers, '2P'/'2–4P', version hashes.
- Escape literal single-quotes inside values as \' (single-quoted JS strings).
- Match the site's voice: playful, warm, kid-friendly, concise.
- Every key in the list must appear exactly once; don't skip any, don't add extras.
- Output ONLY the object-entry lines — no markdown fences, no commentary.

Write your output with the Write tool to exactly this path:
{{OUTPUT_PATH}}

When done, reply with ONLY: "wrote N keys" (N = the count you produced).
```

## `{{SOURCE_GUIDANCE}}` per part

- **part1 (kit/UI chrome):** "primarily ~/arcade/game-kit.js — grep for each
  key as a literal inside calls like `t('KEY', ...)` / `T('KEY', ...)`; the
  English original is the def:/2nd-arg text. A few keys (challenge.*,
  title.*) are rendered from ~/arcade/challenges.js's goal/title-ladder data
  via game-kit.js. lang.*/crt.*/badge.*/tag.* may live in either file."
- **part2 (catalogue/legal):** "~/arcade/index.html — most are
  `data-t="KEY"`/`data-t-aria="KEY"`/`data-t-title="KEY"`/`data-t-ph="KEY"`
  attributes (the element's current English text/attribute IS the source),
  or `t('KEY', 'English…')` calls. legal.* — also check tos.html/privacy.html."
- **part3/4 (games):** "For game.<slug>.title/.blurb: ~/arcade/games.js's
  GAMES array. For everything else: ~/arcade/games/<slug>/index.html — grep
  the key inside `KIT.t('KEY', ...)`/`t('KEY', ...)`/`T('KEY', ...)` calls."
- **part5 (cosmetics):** "~/arcade/cosmetics.js — COSMETICS.items[].name/.desc
  for cos.<id>.name/.desc; COSMETICS.sets[setId] for cos.set.<setId>."
- **part6 (changelog):** none needed — the keys file is
  `key<TAB>English text` pairs already, translate directly. Swap the whole
  prompt body for the changelog variant (see the skill's step 2 — it skips
  the source-hunting instructions entirely since the text is inlined).

## Consistency-review agent prompt template

```
Repo: ~/arcade (komyo, a browser-game arcade site with a client-side i18n
system in i18n.js). Six different translators independently produced
{{LANGUAGE}} ("{{CODE}}") translations for six different chunks of the
site's UI strings, each writing to its own file:
{{PART1_PATH}}  (kit/UI chrome — nav, menus, sound, sharing, shop, challenges, titles…)
{{PART2_PATH}}  (catalogue/site pages — filters, FAQ, settings, legal, feedback, newsletter…)
{{PART3_PATH}}  (4 heaviest games: tower-defense, asteroids-plus, asteroids, bubbles)
{{PART4_PATH}}  (remaining games + "coming soon" titles/blurbs)
{{PART5_PATH}}  (cosmetic item names/descriptions)
{{PART6_PATH}}  (changelog release notes)

Because they worked independently, the SAME recurring concept may have been
translated differently in different files (e.g. "trophy"/"trophies", "good
run", "best score", "challenge", the "New:"/"Fix:"/"Improved:" changelog
prefixes, common menu words like "Play again"/"Resume"/"Pause", plural
phrasing, or whether a given game name is translated or kept in English).
Your job:

1. Read all 6 files.
2. Build a glossary of recurring terms and pick ONE consistent rendering for
   each (favor the most natural/idiomatic phrasing, matching the site's
   playful, warm, kid-friendly tone).
3. Edit each file in place to apply that glossary everywhere, without
   changing anything else (no reformatting, no key additions/removals).
4. Sanity-check: every line still matches `'key': 'value',` or the plural
   shape, quotes single-quoted with internal ' escaped as \', every {param}
   token still present verbatim.
5. Do NOT change the SET of keys in any file — only the translated VALUES.

When done, reply with a short summary (under 150 words) of what glossary
choices you standardized on and what, if anything, you fixed.
```
