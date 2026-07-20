// Render komyo's procedural game music offline to WAV.
// Boots game-kit.js in the repo's own test sandbox, hands it a wrapped
// OfflineAudioContext with a controllable currentTime, captures the music
// scheduler's setInterval callback, and pumps it across the whole duration.
//
// usage: node render-music.mjs <track> <seconds> <out.wav> [intensityScript]
//   intensityScript: comma list of t:target pairs, e.g. "0:0.55,4:0.85,8:1"
import { makeSandbox } from '/Users/kkolodziejczyk/arcade/test-harness.mjs';
import { OfflineAudioContext } from 'node-web-audio-api';
import fs from 'node:fs';

const [track, secsArg, outPath, intScript] = process.argv.slice(2);
if (!track || !secsArg || !outPath) {
  console.error('usage: node render-music.mjs <track> <seconds> <out.wav> [t:target,...]');
  process.exit(1);
}
const DUR = +secsArg;
const SR = 44100;
const intensityPlan = (intScript || '0:1').split(',').map(p => {
  const [t, v] = p.split(':').map(Number);
  return { t, v };
}).sort((a, b) => a.t - b.t);

const offline = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);

// Wrapper the kit sees: controllable currentTime, always 'running'.
let fakeNow = 0;
const acWrap = {
  get currentTime() { return fakeNow; },
  get state() { return 'running'; },
  get sampleRate() { return offline.sampleRate; },
  get destination() { return offline.destination; },
  resume() { return Promise.resolve(); },
};
for (const m of ['createGain', 'createOscillator', 'createBiquadFilter', 'createConvolver',
  'createDelay', 'createStereoPanner', 'createBuffer', 'createBufferSource',
  'createDynamicsCompressor', 'createWaveShaper', 'createPanner', 'createAnalyser',
  'createChannelMerger', 'createChannelSplitter', 'createConstantSource', 'createPeriodicWave']) {
  if (typeof offline[m] === 'function') acWrap[m] = (...a) => offline[m](...a);
}
function FakeAC() { return acWrap; }

let schedulerCb = null;
const g = makeSandbox({
  extra: {
    AudioContext: FakeAC,
  },
});
// kit calls bare setInterval when the scheduler starts — capture the callback
g.sandbox.setInterval = (cb) => { schedulerCb = cb; return 1; };
g.sandbox.clearInterval = () => { schedulerCb = null; };

const kitSrc = fs.readFileSync('/Users/kkolodziejczyk/arcade/game-kit.js', 'utf8');
g.run(kitSrc, 'game-kit.js');
if (g.errors.length) { console.error('kit boot errors:', g.errors); process.exit(1); }

const music = g.win.gamekit.music;
const T = music.tracks[track];
if (!T) { console.error('unknown track', track, '— have:', Object.keys(music.tracks).join(', ')); process.exit(1); }

// preview() creates the AC (our wrapper), unmutes, and starts the scheduler
music.preview(track);
if (!schedulerCb) { console.error('scheduler did not start'); process.exit(1); }

// Pump: advance fake time in the same 25ms grid the browser would, applying the
// intensity plan; the scheduler fills WebAudio events up to fakeNow + 0.14s.
let planIdx = 0;
for (let t = 0; t < DUR + 0.2; t += 0.025) {
  fakeNow = t;
  while (planIdx < intensityPlan.length && intensityPlan[planIdx].t <= t) {
    music.intensity(intensityPlan[planIdx].v);
    planIdx++;
  }
  schedulerCb();
}

const buf = await offline.startRendering();

// beat map: scheduler anchors step 0 at 0.06s; 16th-note steps of 60/bpm/4 (modern) or /2 (remaster)
const spb = T.kind === 'remaster' ? 60 / T.bpm / 2 : 60 / T.bpm / 4;
const stepsPerBeat = T.kind === 'remaster' ? 2 : 4;
const beatDur = spb * stepsPerBeat;
const beats = [];
for (let b = 0; 0.06 + b * beatDur < DUR; b++) beats.push(+(0.06 + b * beatDur).toFixed(4));
fs.writeFileSync(outPath.replace(/\.wav$/, '.beats.json'), JSON.stringify({
  track, bpm: T.bpm, firstBeat: 0.06, beatDur: +beatDur.toFixed(6), barDur: +(beatDur * 4).toFixed(6), beats,
}, null, 1));

// WAV (PCM16 stereo)
const n = buf.length, ch0 = buf.getChannelData(0), ch1 = buf.getChannelData(1);
// peak check
let peak = 0;
for (let i = 0; i < n; i++) { const a = Math.abs(ch0[i]), b = Math.abs(ch1[i]); if (a > peak) peak = a; if (b > peak) peak = b; }
const norm = peak > 0 ? 0.94 / peak : 1;
const data = Buffer.alloc(44 + n * 4);
data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8);
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(ch0[i] * norm * 32767))), 44 + i * 4);
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(ch1[i] * norm * 32767))), 46 + i * 4);
}
fs.writeFileSync(outPath, data);
console.log(`rendered ${track} ${DUR}s → ${outPath} (peak ${peak.toFixed(3)}, norm x${norm.toFixed(2)}, bpm ${T.bpm})`);
