# komyo i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire komyo site (catalogue + shared kit + 9 games + legal pages) translatable, with a live language picker, and ship it in 5 languages: **English, Polish, Spanish (neutral), Portuguese (pt-BR), French**.

**Architecture:** Add a central `gamekit.t(key, params)` translation function + plural engine + language state to `game-kit.js` (the one file loaded everywhere). Message data lives in a single new `i18n.js` (`window.KOMYO_I18N = { en, pl, es, pt, fr }`), loaded in the atomic `<head>` and every `sw.js` SHELL in lockstep, exactly like `challenges.js`/`cosmetics.js`. UI strings are keyed into `i18n.js`; registry data (games.js/cosmetics.js/challenges.js) keeps its English in place and is translated by id via a `def:` fallback, minimizing churn. No build step — client-side language selection via `?lang=` + `navigator.language` + a persisted picker.

**Tech Stack:** Vanilla ES5-style JS (matches the repo — no modules, no deps), `Intl.PluralRules` for plural category selection, `Intl.NumberFormat`/`toLocaleString` for numbers (already partly used). Node test harness (`test-harness.mjs`) for regression.

## Global Constraints

Copied verbatim from `CLAUDE.md` — every task implicitly includes these:

- **No external dependencies / assets.** No build, no CDNs/fonts/images. `i18n.js` is an in-repo same-origin file like `challenges.js`.
- **Atomic `<head>` order** (NOT `defer`): `analytics.js` · `game-kit.css` · `version.js` · `game-kit.js` · `challenges.js` · `cosmetics.js`. **`i18n.js` is added to this unit, after `cosmetics.js`.** `window.gamekit` must exist before the inline game script runs.
- **SW SHELL lockstep.** Every game's `sw.js` SHELL (and the root `sw.js`) must list `i18n.js` — a missing one silently kills translations offline. 10 SHELLs total (catalogue + 9 games).
- **The slug is the ONE identity.** i18n keys for game data use the slug: `game.<slug>.title`, `game.<slug>.blurb`.
- **Headless-safe.** `t()`, plural, and language detection must not throw in the mocked DOM (guard `navigator`, `localStorage`, `Intl`). Must boot in tests without a real browser.
- **`record:` in the end menu is the ONLY way results are recorded** — do not touch recording logic; only wrap display strings.
- **Keep all suites green:** `node test.mjs` + `node games/<slug>/test.mjs` for every game after every task.
- **Brand tokens stay untranslated:** `Komyo`, `Komyo Games`, `komyo`, `komyo.online`, emoji, numbers, `2P`/`2–4P`, version SHA. Never sweep these into the string table.

---

## File Structure

**New file:**
- `i18n.js` — `window.KOMYO_I18N = { en:{...}, pl:{...}, es:{...}, pt:{...}, fr:{...} }`. Each locale is a flat `key → string` or `key → {one, few, many, other}` (plural) map. English (`en`) is the reference. Organized in commented sections mirroring the source areas (nav, menu, catalogue, faq, legal, games, challenges, cosmetics). Loaded like `challenges.js`.

**Modified — infrastructure:**
- `game-kit.js` — add the i18n engine (language state, `t()`, plural, picker helpers) to the IIFE + expose on the `api` object (~L2638); convert the kit's own ~120 strings to `t()`.
- `game-kit.css` — add `[dir="rtl"]` no-op note (only if RTL is ever added — not in this plan); add a `.gk-lang` picker style if the picker isn't reusing existing menu styles.

**Modified — content (English → keys / translate-by-id):**
- `index.html` — catalogue: ~310 strings + `<head>` meta + hreflang + a language picker in Settings.
- `games.js` — 41 title/blurb pairs translated by id via `def:` fallback.
- `challenges.js` — 28 goal titles + 9 title ranks translated by id.
- `cosmetics.js` — 70 name+desc pairs + 14 set labels translated by id.
- `privacy.html`, `tos.html` — static content pages, keyed + hreflang.
- `games/<slug>/index.html` (×9) — inline strings → `t()`; each also gets `i18n.js` in `<head>` + `sw.js` SHELL.
- `sitemap.xml`, `llms.txt` — per-`?lang=` alternates (optional, SEO).
- `changelog.js` — **excluded** (historical; leave English).

**Modified — SW shells:**
- `sw.js` (root) + `games/<slug>/sw.js` (×9) — add `i18n.js` to SHELL.

**Modified — tests:**
- `test.mjs`, `test-harness.mjs`, `games/<slug>/test.mjs` — harness preloads `i18n.js`; add an i18n section (fallback, plural, missing-key behavior, no-throw headless).

---

## Phase 0 — Decisions locked (no task; reference)

- **Languages:** `en` (base), `pl`, `es` (neutral, one file for Spain+LatAm), `pt` (pt-BR — Brazil), `fr` (neutral).
- **Lang code normalization:** map `pt-*` → `pt`, `es-*` → `es`, `fr-*` → `fr`, `pl-*` → `pl`, else first 2 chars; anything not in the supported set → `en`.
- **Selection order:** `?lang=` query param → `localStorage.gamekit_lang` → `navigator.language` (normalized) → `en`.
- **SEO approach (no-build):** single URL per page + `?lang=xx`; JS injects translated `<title>`/meta on load; `<link rel="alternate" hreflang>` for each language; sitemap lists `?lang=` variants. Full path-based/pre-rendered SEO is out of scope (would need a build step) — revisit post-launch if organic traffic warrants it.
- **Registry-data rule:** English for `games.js`/`cosmetics.js`/`challenges.js` **stays in those files** (source of truth for authors). i18n.js carries only `pl/es/pt/fr` for those ids. Render calls `t(key, {def: <englishFromData>})`.
- **UI-string rule:** English for `index.html`/`game-kit.js`/per-game/legal **moves into `i18n.js` `en`**; code calls `t('key')`.
- **Language switch:** `setLang(code)` persists + updates `<html lang>` + fires `onLang` subscribers; the picker then calls `location.reload()` for a clean, correct re-render (documented as the baseline; live re-render is optional polish, not required).

---

## Phase 1 — The i18n engine (game-kit.js + i18n.js)

### Task 1: Create `i18n.js` skeleton + load it everywhere

**Files:**
- Create: `i18n.js`
- Modify: `index.html` (`<head>` — after `cosmetics.js`), `privacy.html`, `tos.html`, `games/<slug>/index.html` (×9)
- Modify: `sw.js`, `games/<slug>/sw.js` (×9) — add `i18n.js` to SHELL
- Test: `test-harness.mjs` (preload), `test.mjs`

**Interfaces:**
- Produces: `window.KOMYO_I18N = { en:{}, pl:{}, es:{}, pt:{}, fr:{} }` (empty maps for now; populated in later tasks).

- [ ] **Step 1: Create `i18n.js` with the registry shell**

```js
/* komyo i18n message catalogue. English (en) is the reference.
   Plural entries are objects: { one, few, many, other } — see game-kit t(). */
window.KOMYO_I18N = {
  en: {},
  pl: {},
  es: {},
  pt: {},
  fr: {}
};
```

- [ ] **Step 2: Add `i18n.js` to the atomic `<head>`** of `index.html`, `privacy.html`, `tos.html`, and all 9 `games/<slug>/index.html`, immediately after the `cosmetics.js` (or `challenges.js` on pages without cosmetics) `<script src>`. Match the existing non-`defer` script style.

- [ ] **Step 3: Add `i18n.js` to every SW SHELL** — root `sw.js` and all 9 `games/<slug>/sw.js`, in the same relative position as `cosmetics.js`/`challenges.js` in each SHELL array. Bump each affected `sw.js` `VERSION`.

- [ ] **Step 4: Preload `i18n.js` in the harness** — in `test-harness.mjs` `bootGame`, load `i18n.js` alongside the existing kit/challenges/cosmetics preloads so `window.KOMYO_I18N` exists in tests.

- [ ] **Step 5: Run the full suite**

Run: `node test.mjs`
Expected: PASS (no behavior change yet — just files loaded).

- [ ] **Step 6: Commit**

```bash
git add i18n.js index.html privacy.html tos.html games/*/index.html sw.js games/*/sw.js test-harness.mjs
git commit -m "feat(i18n): add empty i18n.js catalogue, wire into head + SW shells + harness"
```

---

### Task 2: The translation engine in `game-kit.js`

**Files:**
- Modify: `game-kit.js` (inside the IIFE; expose on the `api` object near L2638)
- Test: `test.mjs` (game-kit section)

**Interfaces:**
- Produces:
  - `gamekit.t(key, params?) → string` — returns translated string for the active language; falls back to `en`, then to `params.def`, then to the key itself. Interpolates `{name}` tokens from `params`. If the entry is a plural object, selects the form by `params.count` via `Intl.PluralRules`.
  - `gamekit.lang() → string` — active 2-letter code (lazy-detected once).
  - `gamekit.setLang(code) → void` — validates, persists to `gamekit_lang`, sets `document.documentElement.lang`, fires subscribers.
  - `gamekit.onLang(fn) → unsubscribe` — subscribe to language changes.
  - `gamekit.langs() → [{code,label}]` — supported languages for the picker (`[{code:'en',label:'English'},{code:'pl',label:'Polski'},{code:'es',label:'Español'},{code:'pt',label:'Português'},{code:'fr',label:'Français'}]`).

- [ ] **Step 1: Write the failing tests** (add to `test.mjs` game-kit section)

```js
section('i18n engine');
{
  const h = await bootGame('games/breakout/index.html', {});
  const K = h.win.gamekit;
  // seed a tiny catalogue
  h.win.KOMYO_I18N = {
    en: { hi: 'Hello', bye: 'Bye {name}', apples: { one: '{count} apple', other: '{count} apples' } },
    pl: { hi: 'Cześć', apples: { one: '{count} jabłko', few: '{count} jabłka', many: '{count} jabłek', other: '{count} jabłka' } },
    es: {}, pt: {}, fr: {}
  };
  K.setLang('en');
  ok(K.t('hi') === 'Hello', 'basic lookup');
  ok(K.t('bye', { name: 'Fox' }) === 'Bye Fox', 'interpolation');
  ok(K.t('apples', { count: 1 }) === '1 apple', 'plural one (en)');
  ok(K.t('apples', { count: 3 }) === '3 apples', 'plural other (en)');
  ok(K.t('missing', { def: 'D' }) === 'D', 'def fallback');
  ok(K.t('nope') === 'nope', 'key fallback');
  K.setLang('pl');
  ok(K.t('hi') === 'Cześć', 'pl lookup');
  ok(K.t('bye', { name: 'Fox' }) === 'Bye Fox', 'pl falls back to en for missing key');
  ok(K.t('apples', { count: 5 }) === '5 jabłek', 'pl plural many');
  ok(K.t('apples', { count: 2 }) === '2 jabłka', 'pl plural few');
  ok(K.lang() === 'pl', 'lang() reflects setLang');
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node test.mjs`
Expected: FAIL (`gamekit.t is not a function`).

- [ ] **Step 3: Implement the engine** — inside the `game-kit.js` IIFE (before the `api` object literal):

```js
// ---- i18n ------------------------------------------------------------
var I18N_SUPPORTED = { en: 1, pl: 1, es: 1, pt: 1, fr: 1 };
var I18N_LANGS = [
  { code: 'en', label: 'English' }, { code: 'pl', label: 'Polski' },
  { code: 'es', label: 'Español' }, { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' }
];
var _lang = null, _langSubs = [];
function normLang(c) {
  c = String(c || '').toLowerCase();
  if (c.indexOf('pt') === 0) return 'pt';
  var two = c.slice(0, 2);
  return I18N_SUPPORTED[two] ? two : (I18N_SUPPORTED[c] ? c : 'en');
}
function detectLang() {
  var q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (q && I18N_SUPPORTED[normLang(q)]) return normLang(q);
  try { var s = localStorage.getItem('gamekit_lang'); if (s && I18N_SUPPORTED[s]) return s; } catch (e) {}
  var nav = 'en';
  try { nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'; } catch (e) {}
  return normLang(nav);
}
function lang() { if (!_lang) _lang = detectLang(); return _lang; }
function setLang(code) {
  code = I18N_SUPPORTED[code] ? code : 'en';
  _lang = code;
  try { localStorage.setItem('gamekit_lang', code); } catch (e) {}
  try { document.documentElement.lang = code; } catch (e) {}
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
```

- [ ] **Step 4: Expose on the `api` object** (near L2638), alongside `cosmetics`, `challengeEval`, etc.:

```js
t: t, lang: lang, setLang: setLang, onLang: onLang, langs: function () { return I18N_LANGS.slice(); },
```

- [ ] **Step 5: Run to verify pass**

Run: `node test.mjs`
Expected: PASS (all i18n-engine asserts green).

- [ ] **Step 6: Commit**

```bash
git add game-kit.js test.mjs
git commit -m "feat(i18n): add gamekit.t/lang/setLang/onLang engine + Intl.PluralRules"
```

---

### Task 3: Language picker UI (kit ☰ menu + catalogue Settings)

**Files:**
- Modify: `game-kit.js` (☰ game menu, near the version/reset rows ~L1314; add a language row)
- Modify: `index.html` (Settings modal — add a language selector)
- Modify: `game-kit.css` (if a dedicated `.gk-lang` style is needed)
- Test: `test.mjs`

**Interfaces:**
- Consumes: `gamekit.langs()`, `gamekit.lang()`, `gamekit.setLang()`.
- Produces: a `<select>` (or button row) in both places; changing it calls `setLang(code)` then `location.reload()`.

- [ ] **Step 1: Write the failing test** — assert the ☰ menu builds a language control reflecting the active language.

```js
section('i18n picker');
{
  const h = await bootGame('games/breakout/index.html', {});
  const K = h.win.gamekit;
  K.setLang('en');
  ok(typeof K.langs === 'function' && K.langs().length === 5, 'langs() lists 5');
  ok(K.langs()[0].code === 'en', 'en first');
}
```

- [ ] **Step 2: Run to verify it fails / passes engine-only**

Run: `node test.mjs`
Expected: PASS on `langs()` (added in Task 2). The picker DOM is verified by local browser eyeball (headless can't assert the select reliably); keep this test to the API surface.

- [ ] **Step 3: Implement the ☰ menu language row** in `game-kit.js` — a `<select>` populated from `gamekit.langs()`, current value `gamekit.lang()`, `onchange` → `gamekit.setLang(v); location.reload();`. Label it with a 🌐 glyph (glyph stays outside the translatable slot). Place it above the "↺ Reset game data" row.

- [ ] **Step 4: Implement the catalogue Settings language selector** in `index.html` Settings modal — same `<select>` pattern, same `onchange`.

- [ ] **Step 5: Run suite + local browser check**

Run: `node test.mjs` (PASS), then `cd ~/arcade && python3 -m http.server 8765` and verify the picker appears + switches (will show untranslated text until Phase 2+; the switch + persistence + reload is what to verify).

- [ ] **Step 6: Commit**

```bash
git add game-kit.js index.html game-kit.css
git commit -m "feat(i18n): language picker in the kit ☰ menu + catalogue Settings"
```

---

## Phase 2 — Extract the shared kit (game-kit.js)

> Pattern for every extraction task below: (1) add the English string(s) to `i18n.js` `en` under a namespaced key; (2) replace the literal in code with `gamekit.t('key', {params})`; (3) for concatenation/interpolation, convert to a parameterized template (`'Reached wave ' + w` → `t('game.line.reachedWave', {wave: w})` with `en: 'Reached wave {wave}'`); (4) for embedded HTML, keep the tags in code and put only the text in the slot; (5) run the suite; (6) local eyeball; (7) commit. This is mechanical, not a placeholder — the transformation, the file, and the verification are fully specified.

### Task 4: Kit key namespace + static button/label/aria strings

**Files:** Modify `game-kit.js`, `i18n.js` (`en` section). Test: `test.mjs`.

- [ ] **Step 1:** Add the kit's static strings to `i18n.js` `en` under keys `nav.*`, `menu.*`, `sound.*`, `controls.*`, `share.*`, `shop.*`, `update.*`, `confirm.*`. Example subset:

```js
// i18n.js  en:
'nav.menu': '‹ Menu', 'nav.leave': 'Leave',
'menu.resume': 'Resume', 'menu.playAgain': 'Play again', 'menu.close': 'Close',
'menu.cancel': 'Cancel', 'menu.ok': 'OK',
'kit.embed': '⧉ Embed this game', 'kit.reset': '↺ Reset game data',
'kit.upToDate': '✓ Up to date', 'kit.updateNow': '🔆 Update now',
'kit.updating': '⟳ Updating…', 'kit.checking': '⟳ Checking…', 'kit.offline': '⚠ Offline — can\'t check',
'confirm.leave': "Leave this run? You'll lose your progress.",
'confirm.reset': "Reset your saved scores for this game?",
'controls.title': 'Controls', 'controls.keyboard': '⌨️ Keyboard', 'controls.mouse': '🖱️ Mouse', 'controls.touch': '👆 Touch',
'share.share': 'Share', 'share.copy': 'Copy', 'share.copied': '✓ Copied!',
// …aria labels: 'aria.pause':'Pause','aria.sound':'Sound settings', etc.
```

- [ ] **Step 2:** Replace each literal in `game-kit.js` with `gamekit.t('key')`. Keep emoji glyphs outside the slot where practical (`'🏆 ' + t('challenges.title')`). Move `.toUpperCase()` display transforms to CSS `text-transform:uppercase` on the relevant class, or drop them, so uppercasing is locale-safe.
- [ ] **Step 3:** Run `node test.mjs` → PASS.
- [ ] **Step 4:** Commit `feat(i18n): key the kit's static labels, buttons, aria strings`.

### Task 5: Kit interpolated/plural strings + sentence builders

**Files:** Modify `game-kit.js`, `i18n.js` (`en`). Test: `test.mjs`.

- [ ] **Step 1:** Add parameterized + plural keys for the concatenated strings. Examples:

```js
// i18n.js en:
'shop.buy': 'BUY {name} · 🏆 {price}', 'shop.equip': 'EQUIP {name}',
'shop.progress': '{owned} / {total} unlocked · {pct}%',
'grb.line': '⚡ Good-run bonus: {count}/{cap} today · +{per} 🏆 each',
'grb.receipt': '✓ Good run · +{per} 🏆 ({count}/{cap} today)',
'menu.best': 'Best: {score}', 'menu.newBest': '★ New best!',
'cat.trophies': { one: '{count} trophy', other: '{count} trophies' },
'cat.goodRuns': { one: '{count} good run', other: '{count} good runs' },
'cat.plays': { one: '{count} play', other: '{count} plays' },
'share.line': 'I {verb} {score} {unit} in {game}',  // word-order slot for translators
```

- [ ] **Step 2:** Rewrite `shareText()` (~L1517), the good-run receipts (~L2483), shop cells (~L1019), progress line (~L1007), `chEval` random-pick title, and the `plural()` helper usages to call `t()` with params. Replace the English `plural(n,w)` helper with `t('cat.<thing>', {count:n})`.
- [ ] **Step 3:** Add tests asserting `shareText` output for `en` and that a `pl` plural resolves correctly through the kit path. Run `node test.mjs` → PASS.
- [ ] **Step 4:** Commit `feat(i18n): parameterize kit interpolated + plural strings`.

### Task 6: Canvas card text (score/profile/share cards)

**Files:** Modify `game-kit.js` (card renderers ~L1560–1740). Test: local browser (canvas text can't be asserted headlessly).

- [ ] **Step 1:** Replace card `fillText` literals (`SCORE`/`TIME`, `PLAY ON`, `🎨 COLLECTION`, `anonymous`, wordmark stays `KOMYO`/`GAMES`=brand, untranslated) with `t()`.
- [ ] **Step 2:** Re-check `measureText`/ellipsize logic (the 590px clamp ~L1608) with the longest language (German-length proxy: use a long PL/FR string) so card text doesn't overflow. Adjust font-size-fit or wrap if needed.
- [ ] **Step 3:** Local browser: generate a score card in each language, eyeball overflow in portrait + landscape.
- [ ] **Step 4:** Commit `feat(i18n): translate canvas score/profile card text + refit measurement`.

---

## Phase 3 — Extract registry data (translate-by-id, English stays in the data file)

### Task 7: Game names as one shared set

**Files:** Modify `game-kit.js` or `i18n.js` (define `game.<slug>.title` keys), and the readers in `games.js`/`challenges.js`/`cosmetics.js` render paths. Test: `test.mjs`.

- [ ] **Step 1:** In `i18n.js` `en`, add `game.<slug>.title` for all games, English matching `games.js`. (Single source for the display name; challenges/cosmetics reference the same key instead of re-stating names.)
- [ ] **Step 2:** Where challenges.js goal titles and cosmetics.js `COSMETICS.games` currently embed a game name, change the render to compose from `t('game.<slug>.title')`.
- [ ] **Step 3:** Run suite → PASS. Commit `feat(i18n): unify game display names into one keyed set`.

### Task 8: games.js titles + blurbs

**Files:** Modify `index.html` (tile render reads title/blurb), `i18n.js` (`en` + later langs). Test: `test.mjs` catalogue section.

- [ ] **Step 1:** Add `game.<slug>.blurb` to `i18n.js` `en` (copy from `games.js`). Titles already added (Task 7).
- [ ] **Step 2:** In `index.html` `tileEl`, render `t('game.'+g.slug+'.title', {def:g.title})` and `t('game.'+g.slug+'.blurb', {def:g.blurb})`. `games.js` keeps its English as the `def` fallback (no churn to the manifest).
- [ ] **Step 3:** Non-translatable titles (`2048`, `Sudoku`, `Minesweeper`, `Asteroids`) → set their `en`/all-lang value identical (or omit key so `def` passes English through).
- [ ] **Step 4:** Run suite → PASS. Local eyeball catalogue. Commit `feat(i18n): key catalogue tile titles + blurbs`.

### Task 9: challenges.js goal titles + title ranks

**Files:** Modify `challenges.js` render consumers in `game-kit.js` (`challengesPanel`, `challengePick`) + `index.html` (challenges drawer), `i18n.js`. Test: `test.mjs`.

- [ ] **Step 1:** Add `challenge.goal.<id>` and `title.<rank>` keys to `i18n.js` `en`. Goal titles with a number+game become templates: `challenge.goal.snakeScore150: 'Score {n} in {game}'` composed with `t('game.snake.title')`. Cross-game count titles use plural: `challenge.goal.play2games: { one:'Play {n} game today', other:'Play {n} different games today' }`.
- [ ] **Step 2:** Change the challenge/title render paths to `t()`. Keep the `goodRun`/`randomSlug`/id structure untouched (they carry no display text).
- [ ] **Step 3:** Run suite → PASS. Commit `feat(i18n): key challenge goals + title ranks`.

### Task 10: cosmetics.js names + descs + set labels

**Files:** Modify the cosmetics render in `game-kit.js` (`shopPanel`), `i18n.js`. Test: `test.mjs`.

- [ ] **Step 1:** Add `cos.<id>.name`, `cos.<id>.desc` (70 each) and `cos.set.<key>` (14) + the `desktop only` note to `i18n.js` `en` (copy from `cosmetics.js`).
- [ ] **Step 2:** In `shopPanel`, render names/descs/labels via `t('cos.'+id+'.name', {def:item.name})` etc. `cosmetics.js` keeps English as `def`.
- [ ] **Step 3:** Run suite → PASS. Local eyeball the shop. Commit `feat(i18n): key cosmetic names, descriptions, set labels`.

---

## Phase 4 — Extract the catalogue (index.html)

### Task 11: Catalogue static HTML + attributes

**Files:** Modify `index.html`, `i18n.js`. Test: `test.mjs`.

- [ ] **Step 1:** Add keys for header/filters, footer, drawers, and all modal bodies (FAQ 16, Settings 18, About, Legal, Data, Feedback, Newsletter, Name/Welcome, cookie banner) to `i18n.js` `en`. Namespace: `cat.*`, `faq.q1`/`faq.a1`…, `settings.*`, `about.*`, `data.*`, `feedback.*`, `news.*`, `cookie.*`.
- [ ] **Step 2:** Two application strategies:
  - **Static text/attr nodes:** tag them `data-t="key"` (text) / `data-t-aria="key"`, `data-t-title`, `data-t-ph` (attributes) and add a boot pass `document.querySelectorAll('[data-t]').forEach(el => el.textContent = gamekit.t(el.dataset.t))` (+ attr variants). This keeps the HTML readable and avoids hand-wiring 200 nodes.
  - **JS-rendered strings** (profile, titles, challenges cards, form statuses, tiles): replace literals with `gamekit.t()` at the call site.
- [ ] **Step 3:** Replace the hardcoded `['Jan'…'Dec']` month array (history view ~L2078) with `Intl.DateTimeFormat(gamekit.lang(), {month:'short'})` or a keyed month set.
- [ ] **Step 4:** Run suite → PASS. Local eyeball every modal in `en`. Commit `feat(i18n): key catalogue static UI + attributes via data-t pass`.

### Task 12: Catalogue JS-built strings + plurals

**Files:** Modify `index.html`, `i18n.js`. Test: `test.mjs`.

- [ ] **Step 1:** Replace the inline `plural()` (L1637) and inline `+s` copies (stat chips, `plays`/`play`, `trophy`/`trophies`, `'Show N more…'`) with `t('cat.*', {count})` plural keys (reuse the `cat.trophies`/`cat.plays` keys from Task 5). Add `cat.showMore: 'Show {n} more…'`, `cat.noMatch: 'No games match.'`, form statuses (`Sending…`, `Thanks! Feedback sent. ✓`, etc.), profile panel strings, titles ladder (`✓ Worn`, `Wear`), version row states.
- [ ] **Step 2:** Convert interpolated aria (`'Favorite '+g.title`) to `t('cat.favorite', {game})`.
- [ ] **Step 3:** Run suite → PASS. Commit `feat(i18n): key catalogue JS strings + plurals`.

### Task 13: Catalogue `<head>` meta + hreflang + SEO

**Files:** Modify `index.html`, `privacy.html`, `tos.html`, `sitemap.xml`, `llms.txt`, `i18n.js`. Test: local (view-source).

- [ ] **Step 1:** Add `meta.title`/`meta.desc`/`meta.ogTitle`/`meta.ogDesc`/`meta.ogAlt`/`meta.twTitle`/`meta.twDesc` keys per page to `i18n.js` `en`. On boot, set `document.title` + the meta tag contents via `gamekit.t()` for the active language.
- [ ] **Step 2:** Add `<link rel="alternate" hreflang="x" href="…?lang=x">` for `en/pl/es/pt/fr` + `x-default` to each page `<head>`.
- [ ] **Step 3:** Add `?lang=` alternates to `sitemap.xml` (or `xhtml:link` hreflang entries) and note languages in `llms.txt`.
- [ ] **Step 4:** Local view-source check; regenerate `og-image.png?v=` only if the OG image itself gains text (it doesn't — skip). Commit `feat(i18n): translated <title>/meta + hreflang alternates + sitemap`.

---

## Phase 5 — Extract the 9 games

> One task per game (Tasks 14–22). Same pattern each time. Order lightest→heaviest to build momentum: flappy → stacker → asteroids → breakout → aim-trainer → snake → bubbles → tower-defense → asteroids-plus.

### Task 14–22: Per-game extraction (template — repeat per game)

**Files (per game `<slug>`):** Modify `games/<slug>/index.html`, `i18n.js` (`en` — namespace `game.<slug>.*`), `games/<slug>/test.mjs` (if it asserts on any now-keyed string). Test: `node games/<slug>/test.mjs`.

- [ ] **Step 1:** Add the game's inline strings to `i18n.js` `en` under `game.<slug>.*` — menu/mode labels, mode descriptions/hints, HUD labels, share fragments, controls block, and (asteroids-plus) upgrade name+desc registry / custom splash prose, (tower-defense) map/tower/drop/targeting descriptions. Numbers baked in prose become params: `game.td.map.frost.desc: 'Enemies slide {pct}% faster. Frost is potent (+{frost}%).'`.
- [ ] **Step 2:** Replace inline literals with `KIT.t('game.<slug>.key', {params})`. Convert every `'…' + value + '…'` concatenation (`'Reached wave '+w`, `'Score '+s+' · level '+l`) to a parameterized template. Route game share fragments through the keyed `share.line` slot.
- [ ] **Step 3:** For canvas `fillText` HUD text (bubbles, stacker, td, asteroids-plus), key the string; verify no overflow with a long language locally.
- [ ] **Step 4:** Verify `i18n.js` is in this game's `<head>` + `sw.js` SHELL (done in Task 1 — re-confirm). Bump the game's `sw.js` `VERSION`.
- [ ] **Step 5:** Run `node games/<slug>/test.mjs` → PASS. Update any test asserting a raw English string to assert via `gamekit.t(...)` or the key.
- [ ] **Step 6:** Local browser eyeball this game (start/pause/end screens, controls) in `en`.
- [ ] **Step 7:** Commit `feat(i18n): key <slug> strings`.

*(Repeat Steps 1–7 for each of the 9 games. asteroids-plus and tower-defense are the heaviest — budget the most care there: description registries + numbers-in-prose + custom splash.)*

---

## Phase 6 — Translate (populate pl / es / pt / fr)

### Task 23: Machine-translate the `en` catalogue into 4 languages

**Files:** Modify `i18n.js` (`pl`, `es`, `pt`, `fr` sections). Test: `node test.mjs`.

- [ ] **Step 1:** Extract every key from `i18n.js` `en` (including plural objects). For each of `pl/es/pt/fr`, produce translations. Preserve `{param}` tokens exactly (do not translate token names). Keep brand tokens + emoji verbatim.
- [ ] **Step 2:** Author **plural forms per language**: `pl` needs `{one, few, many, other}`; `es`/`pt`/`fr` need `{one, other}`. Only the plural keys (`cat.trophies`, `cat.goodRuns`, `cat.plays`, `cat.showMore`, `challenge.goal.play*games`, any "N lives/games") need this — a bounded set (~15 keys).
- [ ] **Step 3:** Sanity test: assert no missing keys vs `en` (a small test that iterates `en` keys and checks each lang has them; missing → falls back to `en`, which is acceptable but flag count).

```js
section('i18n coverage');
{
  const I = /* load i18n.js */; const base = Object.keys(I.en);
  ['pl','es','pt','fr'].forEach(l => {
    const missing = base.filter(k => !(k in I[l]));
    ok(missing.length === 0, l + ' complete (' + missing.length + ' missing)');
  });
}
```

- [ ] **Step 4:** Run `node test.mjs` → PASS (or a known, logged missing-count). Commit `feat(i18n): populate pl/es/pt/fr translations`.

### Task 24: Native / careful review pass

**Files:** Modify `i18n.js` (corrections). Test: local browser.

- [ ] **Step 1:** Polish reviewed by the author (native). Spanish/Portuguese/French: review MT for tone (kid-friendly, playful — matches the English voice), plural correctness, and false friends. Fix in place.
- [ ] **Step 2:** Verify game names / brand stay correct (untranslated where intended; `Neon Snake` etc. — decide per name whether to localize the *common* nouns, e.g. keep `Asteroids`, translate descriptive blurbs).
- [ ] **Step 3:** Commit `fix(i18n): translation review corrections`.

---

## Phase 7 — QA & ship

### Task 25: Rendering QA across languages × orientations

**Files:** Fixes as needed across CSS/games. Test: local browser (device mode).

- [ ] **Step 1:** For each language, load the catalogue + each game in **portrait (390×780), landscape (780×390), desktop (1280×800)** (per the repo's layout-suite viewports). Look for: text overflow in tiles/buttons/HUD/menu cards, wrapped nav, clipped canvas card text, truncated challenge/cosmetic descriptions.
- [ ] **Step 2:** Fix overflows via CSS (`min-width`, wrapping, font-fit) — not by shortening translations unless a string is genuinely too long for a fixed control.
- [ ] **Step 3:** Re-run **all** suites: `node test.mjs` + every `node games/<slug>/test.mjs` → all PASS.
- [ ] **Step 4:** Commit `fix(i18n): rendering fixes for longer-string languages`.

### Task 26: Changelog + docs + roadmap

**Files:** Modify `changelog.js` (one new player-facing entry), `CLAUDE.md` (document the i18n system + the `i18n.js` head/SHELL rule + `data-t` convention + "new games must key strings"), `ROADMAP.md` (mark i18n done), `README.md`.

- [ ] **Step 1:** Prepend a `changelog.js` entry (player-facing): "New: play komyo in Polish, Spanish, Portuguese & French — pick your language in Settings / the ☰ menu." (One entry, one push — the Discord poster diffs it.)
- [ ] **Step 2:** Update `CLAUDE.md`: add `i18n.js` to the atomic head order + SW SHELL list; document `gamekit.t()`/`lang()`/`setLang()`; add to "Adding a game" that new games must key strings via `t()` and that the "Create a game" skill should emit `t()` calls.
- [ ] **Step 3:** Update `ROADMAP.md` (i18n → Done) and `README.md` (languages supported).
- [ ] **Step 4:** Run all suites → PASS. Commit `docs(i18n): changelog, CLAUDE.md, roadmap, readme`.
- [ ] **Step 5:** **Batch push** all commits together (GH Pages soft-limits builds). Hard-refresh to verify live; re-check the picker + a couple of languages on the deployed site.

---

## Self-Review notes (gaps to watch during execution)

- **`data-t` boot pass timing:** it must run after `game-kit.js` defines `t()` and after `i18n.js` loads — both are non-`defer` in the atomic head, so the inline boot script at end-of-body is safe. Verify no FOUC of English before the pass (acceptable; content is same-origin instant).
- **Missing-key policy:** `t()` returns the key (dev-visible) or `def`. Ship-blocking only if the coverage test (Task 23) shows gaps in `en`; other langs falling back to `en` is acceptable.
- **`?lang=` vs picker precedence:** `?lang=` wins on first load (deep-link/share); once a user picks, `gamekit_lang` persists and future visits without `?lang=` honor it. Confirm this order matches Task 2's `detectLang`.
- **Export/Import:** add `gamekit_lang` to the Export/Import blob (it's a `gamekit_*` pref) so language rides device transfer — verify in the Data modal.
- **Share links:** consider appending `?lang=` to shared URLs so a shared score card opens in the sharer's language (optional; default is recipient's own detection).
- **Registry `def:` fallback** means a *new* game/cosmetic/challenge added later shows English until keyed — acceptable, and the coverage test will flag it.
