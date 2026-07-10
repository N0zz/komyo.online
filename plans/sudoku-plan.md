# Sudoku — execution plan

Classic 9×9 Sudoku for komyo. `games/sudoku/` · 🔢 · amber `#f0b429` · drafting-desk theme
(slate felt, paper board, ink numerals). Approved 2026-07-09.

## Locked decisions

- **Technique-graded generator** — seeded fill → symmetric dig (every removal keeps the solution
  unique AND within the band) → grade by hardest *required* technique:
  L1 singles = Easy · L2 locked candidates = Medium · L3 pairs/triples = Hard ·
  L4 X-wing/XY-wing = Expert. Deterministic per seed; next puzzle pre-generated in background.
- **Modes:** Easy/Medium/Hard/Expert · **Daily** (date-seeded, same worldwide; difficulty rotates
  Mon–Tue Easy, Wed–Thu Medium, Fri–Sat Hard, Sun Expert) · **Zen** (untimed, no strikes, unscored —
  no `record:` block).
- **3-strikes default** (wrong final entry flashes red + ticks ✗; pencil marks never cost strikes);
  Zen = unlimited.
- **Logical hints** (full version, not reveal-a-digit): the hint engine reuses the grading solver —
  1st tap highlights the technique region + names it, 2nd tap applies the deduction. Hints cost score.
- **Score** = base(difficulty) − time − mistakes×P − hints×P; record carries `time`;
  best labels `Easy…Expert`, `Daily`.

## Steps

- [x] Generator: unique-solution + technique grading, node-validated standalone
- [x] POC: board render + touch input + highlights, local gut-check
- [x] MVP: kit shell — nav, start/pause/end menus, HUD (⏱ ✗ 💡), record/share, __test + layout
- [x] Logical hint engine (technique finder + two-step UI)
- [x] Iterations: pencil UX, digit counts, completion micro-feedback, side-pad landscape layout,
      visual pass (screenshot-reviewed at 390×780 + 1280×800)
- [x] Systems: goodRun bar (1500) + daily goals (sudoku-1/-2), cosmetics (4 board themes +
      3 numeral styles), SFX + reactive `sudoku` track (intensity = board fill), icons,
      root sw.js GAME_SLUGS
- [x] Register: games.js (`added: 2026-07-09`), sitemap.xml, llms.txt, changelog.js entry
- [x] i18n: all keys in i18n.pl.js + incremental translate to cs/es/fr/it/pt/uk (61 keys each)
- [x] Verify: node test.mjs (466) + node games/sudoku/test.mjs (102) green
- [x] User playtest + iteration round (share everywhere incl. zen-time card, ONE in-progress
      board list with miniature cards + per-entry delete, mode in labels, Animals/Shapes digit
      styles, live language switch) — shipped 2026-07-10

## Post-launch follow-ups (open)

- Watch Daily engagement (per-band best buckets) and the goodRun bar (1500) — retune with
  `challenges.js` goal `sudoku-2` in lockstep if needed
- Possible v2: notes auto-fill option, technique-stats screen ("you needed 3 X-wings"),
  daily streak counter
