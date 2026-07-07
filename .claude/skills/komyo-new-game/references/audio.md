# Audio — SFX + music for a new game

All audio is procedural Web Audio, kit-owned, and headless-inert (guarded — no-ops with no
`AudioContext`, so tests never throw). A game defines its own SFX names and picks a music theme; it
never builds its own audio graph.

```js
const KIT = window.gamekit;
const SND = KIT.sound;   // SFX channel
// KIT.music — music channel
```

---

## SFX — `SND.define({ name: c => … })` + `SND.play('name')`

`SND.define` registers named effects; `SND.play('name')` fires one (no-op when muted or headless).
The callback receives a context `c` with these voices:

| voice | signature | what it is |
|-------|-----------|------------|
| `c.tone(f, d, type, g)` | freq Hz, dur s, osc type, gain | quick bare oscillator beep. |
| `c.noise(d, g)` | dur s, gain | quick lowpassed noise burst. |
| `c.voice(o)` | rich opts object | the workhorse tuned oscillator (see opts). |
| `c.noiseHit(o)` | rich opts object | rich noise burst (same opts as voice, noise source). |
| `c.seq(arr, gap, fn)` | array, ms gap, `fn(x, i)` | schedules `fn` per element `gap` ms apart — arpeggios/sequences. |
| `c.now()` | → AudioContext time | schedule base for `t:` offsets. |
| `c.play(name)` | — | fire another defined SFX (incl. a kit stinger — see the hard rule). |

### `voice` / `noiseHit` opts

`{ f, dur, type, gain, attack, slideTo, detune, vibrato, vibratoDepth, filter, cutoff, cutoffTo,
q, reverb, t }` — `f` freq, `dur` seconds, `type` osc wave (`sine`/`square`/`sawtooth`/`triangle`),
`gain` ~0.05–0.2 (already scaled by the user's SFX volume), `attack` ramp-in s, `slideTo` glide the
pitch to this freq over `dur`, `filter` (`lowpass`/`highpass`/…) with `cutoff`→`cutoffTo` sweep and
`q` resonance, `reverb` 0–~0.5 send, `t` start time (use `c.now() + offset`).

### Recipes

```js
SND.define({
  // pickup blip — short bright rising ping
  pickup: c => c.voice({ f: 660, slideTo: 990, dur: 0.12, type: 'triangle', gain: 0.12, filter: 'lowpass', cutoff: 3000 }),

  // hit / thud — low filtered noise punch
  thud: c => c.noiseHit({ dur: 0.16, gain: 0.16, filter: 'lowpass', cutoff: 700, cutoffTo: 200 }),

  // level-up arpeggio via seq — four rising notes 70 ms apart
  chime: c => { const t = c.now(); c.seq([523, 659, 784, 1047], 70,
    f => c.voice({ f, dur: 0.22, type: 'square', gain: 0.1, filter: 'lowpass', cutoff: 2600, reverb: 0.28 })); },

  // lose sound — descending sawtooth slides
  fail: c => { const t = c.now(); [330, 247, 165].forEach((f, i) =>
    c.voice({ f, slideTo: f * 0.82, dur: 0.4, type: 'sawtooth', gain: 0.12, filter: 'lowpass', cutoff: 1400, cutoffTo: 300, t: t + i * 0.16 })); },
});
```

---

## Music — reactive generative engine (v2)

Procedural, kit-owned. Each game plays a **track** (a full song spec) and **feeds gameplay intensity**
so the music builds and calms with the action. Everything lives in `game-kit.js` (`TRACKS` registry +
`enhStep`/`snakeStep` schedulers); a game just calls `KIT.music.play(...)` and `KIT.music.intensity(...)`.

### 1) Play a track
```js
KIT.music.play('<trackId>');   // start/seamless-swap; auto-begins on the first tap/key (no-op at page load)
KIT.music.stop(); KIT.music.current();
```
Track ids are per-game: `snake, snakebanger, asteroids, asteroidsplus, forcefield, range, breakout,
bubbles, frogbonk, keep, meadow, stacker` + Keep-Defender biomes `kd_grass/kd_ice/kd_lava/kd_desert/
kd_dungeon/kd_marsh`. **Old theme names still work as aliases** (`neon→snake`, `space→asteroids`,
`synthwave→breakout`, `candy→bubbles`, `pastel→stacker`, `tactical→range`, `castle→keep`), so existing
`play('neon')`-style calls keep working. (A game with its OWN engine follows the gain instead:
`KIT.music.subscribe(s => applyGain(s.gain))` — asteroids only.)

### 2) Give a NEW game its own track — add to `TRACKS` in `game-kit.js`
A track = **theme params** (musical) + **palette** (sound). Add one entry keyed by your slug:
```js
myslug: { kind:'modern', bpm:110, root:174.61, scale:[0,2,4,5,7,9,11], prog:[0,3,5,4,0,5,3,4],
          cutoff:2200, kit:'electronic', groove:'banger', pad:'triangle', bass:'triangle',
          lead:'triangle', pluck:true, detune:8, kf0:150, kf1:52, prod:'dance' },
```
- **`kind`** — `'modern'` (the full engine) or `'remaster'` (the 8-step Snake-style renderer).
- **Musical:** `bpm`, `root` (Hz), `scale` (semitone offsets), `prog` (8 chord-root scale degrees,
  one/bar — **make this UNIQUE**, see §5), `cutoff`.
- **`kit`** (drum kit): `electronic` (crisp) · `techno` (four-floor) · `soft` (shaker, no snare) ·
  `synthwave` (half-time gated snare) · `epic` (taikos, no hats) · `tactical` (military).
- **`groove`/`prod`** (arrangement family): `banger` (rolling bass + square arp) · `rave` (pumping
  sidechain + supersaw arp) · `trance` (offbeat roll + uplift arp) · `tactical` (dry staccato) ·
  or `prod:` `epic` (choir + toms) · `lush` (swells) · `synthwave` (half-time).
- **Timbres/flags:** `pad`/`bass`/`lead` osc waves, `pluck`, `softLead`, `vibrato`, `detune`,
  `bassSuper`/`leadSuper` (supersaw), `choir`, `riser`, `halftime`, `swing`, `kf0`/`kf1` (kick pitch).

Then in the game: `KIT.music.play('myslug')`. Pick a kit+groove that fits the mood, but see §5 —
**don't reuse another game's progression/key/kit combo** or they'll sound alike.

### 3) Intensity — make it react to gameplay (REQUIRED for a new game)
`KIT.music.intensity(v)` sets a target 0..1; the kit **smooths** it and **fades layers in/out** at
thresholds (~0.25 kick · ~0.45 snare/hats/lead · ~0.65 open hats/doubles · ~0.85 fills). Compute it
from live state every frame in `update()`:
```js
if (KIT && KIT.music) KIT.music.intensity(Math.max(0, Math.min(1, v)));
```
Map your game's tension to `v`: enemies on screen, score/speed ramp, board fill, combo/streak, low
lives, etc. Conventions: **calm base ~0.3** on menu / pre-start / game-over; **zen/gentle modes bias
low** (cap ~0.4). Example (tower-defense): `0.4 + 0.35·(enemies/10) + 0.15·(wave/12) + 0.25·(1−hp/30)`.
Headless-inert — guard with `if (KIT && KIT.music)`. Note: `epic`/`lush` tracks already swell their
pads + choir with intensity, so the same 0.3→1.0 range reads clearly on them too.

### 4) Alternate tracks as a cosmetic (optional)
Offer extra tracks in the Collection: add a `<slug>.track` set in `cosmetics.js` with items carrying a
`music:'<trackId>'` field (free default at price 0 + paid alts), e.g. Snake's `snake.track` = `Neon`
(free) + `Neon Banger` (🏆 100). The shop shows a **▶ preview** automatically (`music.preview()` /
`stopPreview()`), and equipping swaps the track live in-game. Read the selection when starting music:
```js
KIT.music.play(KIT.cosmetics.selected('<slug>.track') === '<slug>.track.<alt>' ? '<altTrackId>' : '<slug>');
```
Add `cos.*` name/desc keys for the new items in every locale (the i18n coverage test enforces it).

### 5) Keep tracks distinct — run the linter
`node plans/audio-lint.mjs` reads the registry and flags tracks that overlap too much (shared
progression / key / kit / groove). Distinctness is limited by the **style×kit vocabulary**, not by
progressions — but a **unique progression per game** is the cheapest lever. Design/compare tracks in
the **Audio Lab** mock `plans/audio-lab.html` before wiring them in. (Deeper background + the "scale to
hundreds" path: `plans/audio-music-plan.md`.)

---

## HARD RULE — never shadow a kit stinger

The kit pre-defines these stinger names and plays them itself (end screens, unlocks):

**`victory` · `newbest` · `levelup` · `gameover` · `lose`**

**Never `SND.define` a name that collides with one** — your definition replaces the kit's, and since
the kit's own code calls `SND.play('lose')`, your override self-recurses into silence.

To *reuse* a stinger, define your **own** name that calls it:

```js
SND.define({
  crash: c => c.play('lose'),   // ✓ play the kit's lose stinger under a game-specific name
});
```
