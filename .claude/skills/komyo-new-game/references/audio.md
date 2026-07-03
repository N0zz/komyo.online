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

## Music — `KIT.music.play('theme')`

Procedural generative engine, one call. Start it when the game/menu opens (it auto-begins on the
first tap/key — a no-op at page load). Valid theme keys (from `THEMES` in `game-kit.js`):

`space` · `neon` · `synthwave` · `meadow` · `candy` · `pastel` · `tactical` · `castle`
and the Keep-Defender per-map set: `kd_grass` · `kd_ice` · `kd_lava` · `kd_desert` · `kd_dungeon`
· `kd_marsh`.

Pick the theme that fits the game's visual mood (a puzzle → `pastel`/`candy`, a shooter → `space`/
`tactical`, neon arcade → `neon`/`synthwave`). Pass `music:` to `gamekit.nav({ slug, music: 'neon' })`
so the nav sound menu wires it, or call `KIT.music.play('neon')` directly.
`KIT.music.stop()` / `KIT.music.current()` exist; a game with its own engine uses
`KIT.music.subscribe(s => applyGain(s.gain))` instead (asteroids only).

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
