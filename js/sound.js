// Every sound is synthesised here. No samples, no borrowed music.
let ctx = null, master = null, on = true, drone = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
export function setOn(v) { on = v; if (!v) stopDrone(); }
export function preview(k) { if (!on || !ac()) return; STINGS[k] ? play(k, ctx.currentTime + .05) : stab(); }
export const stingNames = () => Object.keys(STINGS);
export function isOn() { return on; }

function noiseBuf(len = 0.2) {
  const a = ac(); const b = a.createBuffer(1, a.sampleRate * len, a.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
}

// A tape spine clicking past on the rack.
export function tick(pitch = 1) {
  if (!on || !ac()) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf(0.03);
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2200 * pitch; f.Q.value = 3;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  s.connect(f).connect(g).connect(master); s.start(t);
}

// The VCR swallowing a tape.
export function clunk() {
  if (!on || !ac()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = "square"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600;
  o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.2);
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(0.08);
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.18, t + 0.05); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  s.connect(g2).connect(master); s.start(t + 0.05);
}

// The synth stab when the film lands: a dark minor chord through a closing filter.
export function stab() {
  if (!on || !ac()) return;
  const t = ctx.currentTime;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 6;
  f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(260, t + 1.6);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  const dl = ctx.createDelay(); dl.delayTime.value = 0.32; const fb = ctx.createGain(); fb.gain.value = 0.32;
  f.connect(g); g.connect(master); g.connect(dl); dl.connect(fb).connect(dl); dl.connect(master);
  for (const hz of [110, 130.81, 164.81, 220]) for (const det of [-7, 7]) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz; o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + 2.5);
  }
}

// A low hum while the tapes flick past.
export function startDrone() {
  if (!on || !ac() || drone) return;
  const t = ctx.currentTime;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.4);
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 420;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35; const lg = ctx.createGain(); lg.gain.value = 160; lfo.connect(lg).connect(f.frequency); lfo.start(t);
  const os = [55, 55.4, 82.4].map(hz => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz; o.connect(f); o.start(t); return o; });
  f.connect(g).connect(master);
  drone = { g, os, lfo };
}
export function stopDrone() {
  if (!drone || !ctx) return;
  const t = ctx.currentTime, d = drone; drone = null;
  d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  setTimeout(() => { d.os.forEach(o => o.stop()); d.lfo.stop(); }, 700);
}

// The neon sign buzzing on.
export function buzz() {
  if (!on || !ac()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 100;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  [0, .08, .12, .3, .34, .6].forEach((dt, i) => g.gain.setValueAtTime(i % 2 ? 0.0001 : 0.05, t + dt));
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 400;
  o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 1.2);
}

// ---------- genre stings ----------
// Each genre gets its own instrument and idea when a film lands on the telly. All original, all synthesised.
function o(type, hz, t, dur, g, dest, opts = {}) {
  const x = ctx.createOscillator(); x.type = type; x.frequency.setValueAtTime(hz, t);
  if (opts.to) x.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || dur));
  if (opts.det) x.detune.value = opts.det;
  const v = ctx.createGain(); v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(g, t + (opts.atk || 0.01));
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  x.connect(v).connect(dest); x.start(t); x.stop(t + dur + 0.05);
  return v;
}
function bus(lp = 4000, echo = 0) {
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp;
  f.connect(master);
  if (echo) { const d = ctx.createDelay(); d.delayTime.value = echo; const fb = ctx.createGain(); fb.gain.value = .3; f.connect(d); d.connect(fb).connect(d); d.connect(master); }
  return f;
}
function pluck(hz, t, dur = 1.2, g = .3, dest = master) {
  const sr = ctx.sampleRate, n = Math.round(sr / hz), len = Math.round(sr * dur);
  const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  for (let i = n; i < len; i++) d[i] = (d[i - n] + d[i - n + 1]) * 0.497;
  const s = ctx.createBufferSource(); s.buffer = b; const v = ctx.createGain(); v.gain.value = g; s.connect(v).connect(dest); s.start(t);
}
function hit(t, g = .5, dest = master) { // kick-ish thump
  o("sine", 140, t, .35, g, dest, { to: 40, glide: .3 });
}
function snare(t, g = .25) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(.2);
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1500;
  const v = ctx.createGain(); v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.001, t + .16);
  s.connect(f).connect(v).connect(master); s.start(t);
}
const N = m => 440 * Math.pow(2, (m - 69) / 12);

// Little instruments built from oscillators and noise.
function noise(t, dur, g, type = "bandpass", hz = 1000, to = 0, q = 1, dest = master) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(dur + .05);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(hz, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const v = ctx.createGain(); v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f).connect(v).connect(dest); s.start(t); s.stop(t + dur + .05);
}
function vib(hz, t, dur, g, dest, rate = 6, depth = 12, type = "sine", atk = .08) { // wobbly voice: theremin, whistle, muted horn
  const x = ctx.createOscillator(); x.type = type; x.frequency.setValueAtTime(hz, t);
  const l = ctx.createOscillator(); l.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = depth; l.connect(lg).connect(x.frequency);
  const v = ctx.createGain(); v.gain.setValueAtTime(.0001, t); v.gain.exponentialRampToValueAtTime(g, t + atk); v.gain.setValueAtTime(g, t + dur * .7); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  x.connect(v).connect(dest); x.start(t); l.start(t); x.stop(t + dur + .05); l.stop(t + dur + .05);
  return x;
}
function bell(hz, t, dur, g, dest = master) { // glassy: fundamental plus an inharmonic partial
  o("sine", hz, t, dur, g, dest); o("sine", hz * 2.76, t, dur * .5, g * .4, dest); o("sine", hz * 5.4, t, dur * .25, g * .2, dest);
}
function xylo(hz, t, g = .12, dest = master) { o("sine", hz, t, .25, g, dest); o("sine", hz * 4, t, .06, g * .5, dest); }
function brass(notes, t, dur, g, dest, open = 2400) { // stacked saws through a filter that opens: a horn section
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(open, t + .08); f.frequency.exponentialRampToValueAtTime(open * .4, t + dur);
  f.connect(dest); notes.forEach(n => { o("sawtooth", N(n), t, dur, g, f, { det: -5, atk: .04 }); o("sawtooth", N(n), t, dur, g * .8, f, { det: 6, atk: .04 }); });
}
function fuzz(dest) { // overdrive for the rock guitar
  const w = ctx.createWaveShaper(), c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * 6); }
  w.curve = c; w.connect(dest); return w;
}
const thump = (t, g = .5, hz = 70) => o("sine", hz * 2, t, .25, g, master, { to: hz * .6, glide: .2 });

const STINGS = {
  // Carpenter night: low 5/4 ostinato with a cold bell. Kept from before.
  night(t) {
    const b = bus(1800, .38), seq = [45, 45, 48, 45, 43, 45, 45, 48, 45, 50];
    seq.forEach((n, i) => o("sawtooth", N(n), t + i * .16, .15, .16, b, { det: i % 2 ? 6 : -6 }));
    o("triangle", N(81), t, 1.6, .12, b); o("triangle", N(82), t + .8, 1.4, .06, b);
  },
  // Horror: a door creaks open, then a low piano cluster slams in the dark.
  horror(t) {
    for (let i = 0; i < 9; i++) noise(t + i * .07, .09, .09, "bandpass", 500 + i * 70, 0, 18);
    const b = bus(700, .55);
    [28, 29, 31, 34].forEach(n => { o("triangle", N(n), t + .75, 2.4, .2, b); o("sawtooth", N(n), t + .75, .5, .06, b); });
    thump(t + .75, .7, 50);
  },
  // Thriller: a heartbeat that speeds up under a rising string, then cuts dead.
  thriller(t) {
    [0, .42, .8, 1.1, 1.36, 1.58].forEach(d => { thump(t + d, .45, 55); thump(t + d + .13, .3, 55); });
    const b = bus(2600); o("sawtooth", N(64), t, 1.8, .05, b, { to: N(76), glide: 1.75, atk: .9 }); o("sawtooth", N(64), t, 1.8, .05, b, { to: N(76.5), glide: 1.75, atk: .9 });
  },
  // Mystery: a music box tiptoes down a whole-tone scale while a theremin wonders aloud.
  mystery(t) {
    const b = bus(5000, .3);
    [84, 82, 80, 78, 76, 74].forEach((n, i) => bell(N(n), t + i * .16, .8, .06, b));
    const x = vib(N(69), t + .3, 1.8, .07, b, 5.5, 14); x.frequency.exponentialRampToValueAtTime(N(75), t + 1.8);
  },
  // Crime: finger snaps, a walking bass, and a muted horn with a bit of swagger.
  crime(t) {
    [0, .5].forEach(d => noise(t + d, .05, .4, "bandpass", 2600, 0, 4));
    [40, 43, 45, 46, 47].forEach((n, i) => pluck(N(n), t + .1 + i * .25, .5, .5));
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1100; f.Q.value = 3; f.connect(master);
    [[67, .7, .3], [70, 1.05, .2], [69, 1.3, .55]].forEach(([n, d, len]) => vib(N(n), t + d, len, .18, f, 5, 8, "sawtooth", .03));
  },
  // Action: a huge low brass hit, two taiko drums, then the hit again a step higher.
  action(t) {
    thump(t, .8, 45); brass([31, 38, 43], t, .9, .07, master, 1600);
    thump(t + .55, .6, 60); thump(t + .72, .6, 60);
    thump(t + .95, .9, 45); brass([33, 40, 45], t + .95, 1.3, .08, master, 2000); noise(t + .95, .6, .12, "highpass", 5000);
  },
  // Drama: a soft piano chord, the top note held.
  drama(t) {
    const b = bus(2200, .35);
    [48, 55, 60, 63, 67].forEach((n, i) => { pluck(N(n), t + i * .03, 2.2, .22, b); o("sine", N(n), t + i * .03, 1.8, .03, b); });
    o("sine", N(75), t + .6, 1.8, .05, b, { atk: .3 });
  },
  // Romance: a harp sweeps up and a soft chord blooms.
  romance(t) {
    const b = bus(4000, .3);
    [60, 64, 67, 71, 72, 76, 79, 83, 84].forEach((n, i) => pluck(N(n), t + i * .055, 1.2, .2, b));
    [60, 64, 67, 71].forEach(n => o("sine", N(n), t + .55, 1.6, .05, b, { atk: .35 }));
  },
  // Comedy: a slide whistle, a boing, and a rimshot.
  comedy(t) {
    const x = vib(N(72), t, .45, .1, master, 7, 10); x.frequency.exponentialRampToValueAtTime(N(88), t + .4);
    o("sine", N(60), t + .55, .35, .18, master, { to: N(48), glide: .3 });
    thump(t + .95, .4, 90); noise(t + 1.07, .07, .3, "bandpass", 1800, 0, 2); noise(t + 1.2, .5, .18, "highpass", 7000);
  },
  // Sci-fi: a laser zap, then a twinkling arpeggio over a deep pad.
  scifi(t) {
    o("square", 2400, t, .25, .05, master, { to: 120, glide: .22 });
    const b = bus(3000, .27);
    [57, 64, 69, 72, 76, 81, 76, 72].forEach((n, i) => o("sawtooth", N(n), t + .3 + i * .08, .18, .06, b, { det: 8 }));
    o("sine", N(45), t + .3, 1.8, .15, b, { atk: .4 });
  },
  // Western: a twangy guitar, a lonesome whistle and a whip crack.
  western(t) {
    [64, 62, 59, 57, 52].forEach((n, i) => pluck(N(n), t + i * .16, 1.4, .35));
    const b = bus(4000, .35); vib(N(79), t + .9, .9, .06, b, 5, 10); 
    noise(t + 1.75, .12, .5, "highpass", 2500);
  },
  // Animation and family: a bouncy xylophone that ends on a boing.
  animation(t) {
    [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => xylo(N(n), t + i * .08));
    o("sine", N(84), t + .62, .4, .1, master, { to: N(60), glide: .35 });
  },
  // War: a military snare roll and a lone bugle call.
  war(t) {
    for (let i = 0; i < 12; i++) snare(t + i * .05, .08 + i * .012);
    const b = bus(2200, .3);
    [[55, .7, .25], [60, .95, .25], [64, 1.2, .25], [67, 1.45, .9]].forEach(([n, d, len]) => vib(N(n), t + d, len, .1, b, 5, 4, "triangle", .03));
  },
  // History: a harpsichord flourish.
  history(t) {
    const b = bus(5000, .2);
    [74, 72, 71, 72, 74, 76, 74, 72, 71, 67].forEach((n, i) => { o("square", N(n), t + i * .085, .12, .04, b); pluck(N(n), t + i * .085, .4, .12, b); });
  },
  // Documentary: a film projector clatters into life.
  documentary(t) {
    for (let i = 0; i < 22; i++) noise(t + i * .045, .025, .14, "bandpass", 3200, 0, 6);
    o("sine", 1000, t + .2, .8, .03, master);
    const b = bus(1600, .3); [48, 55, 60].forEach(n => o("triangle", N(n), t + 1.05, 1.1, .06, b, { atk: .2 }));
  },
  // Music: a drum fill into a fuzzy power chord.
  music(t) {
    [0, .12, .24, .36].forEach((d, i) => { thump(t + d, .35, 90 - i * 12); }); snare(t + .48, .3);
    thump(t + .6, .6, 50);
    const f = fuzz(bus(3200, .15)); [40, 47, 52].forEach(n => o("sawtooth", N(n), t + .6, 1.1, .12, f));
    noise(t + .6, .8, .1, "highpass", 6000);
  },
  // Adventure: a dotted heroic fanfare.
  adventure(t) {
    [[55, 0, .2], [55, .22, .1], [60, .34, .5], [64, .9, .2], [67, 1.12, .9]].forEach(([n, d, len]) => brass([n, n - 12], t + d, len, .05, master, 2800));
    thump(t + .34, .4, 60); thump(t + 1.12, .5, 55);
  },
  // Fantasy: a shimmer of chimes over a harp.
  fantasy(t) {
    const b = bus(7000, .4);
    [79, 83, 86, 90, 91, 95].forEach((n, i) => bell(N(n), t + i * .09, 1.2, .035, b));
    [55, 59, 62, 67].forEach((n, i) => pluck(N(n), t + .5 + i * .12, 1.4, .18, b));
  },
};
// Evens out the loudness so a horror slam and a xylophone land at roughly the same volume.
const LEVEL = { night: 1.8, horror: .75, thriller: 1, mystery: 1.2, crime: .75, action: .85, drama: 1.3, romance: 1.6, comedy: 1.8, scifi: 1.8, western: 1.1,
  animation: 2.4, war: 1.2, history: 2.1, documentary: 2.8, music: .6, adventure: 1.7, fantasy: 1.6 };
function play(k, t) {
  const keep = master, g = ctx.createGain(); g.gain.value = LEVEL[k] || 1; g.connect(keep); master = g;
  try { STINGS[k](t); } finally { master = keep; }
}
const GENRE_STING = { Horror: "horror", Comedy: "comedy", "Science Fiction": "scifi", Action: "action", Drama: "drama", Romance: "romance",
  Crime: "crime", Thriller: "thriller", Mystery: "mystery", Western: "western", Animation: "animation", Family: "animation",
  War: "war", History: "history", Documentary: "documentary", Music: "music", Fantasy: "fantasy", Adventure: "adventure" };

export function sting(m) {
  if (!on || !ac()) return;
  const t = ctx.currentTime + .05;
  const late = new Date().getHours() < 5;
  let k = (m.dir || []).includes("John Carpenter") ? "night" : null;
  if (!k) k = GENRE_STING[(m.g || [])[0]] || null;
  if (k === "horror" && late) k = "night";
  if (!k) return stab();
  play(k, t);
}
// A soft click for switching shelves.
export function click() {
  if (!on || !ac()) return;
  o("square", 900, ctx.currentTime, .03, .05, master);
}

// Coin drop for the arcade.
export function coin() {
  if (!on || !ac()) return;
  const t = ctx.currentTime;
  o("square", 988, t, .08, .07, master); o("square", 1319, t + .08, .25, .07, master);
}

// Renders every sting back to back into a buffer (used to check levels and make a demo reel).
export async function renderReel(keys, gap = 3.2) {
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!Off) return null;
  const keep = [ctx, master, on];
  ctx = new Off(1, 44100 * Math.ceil(keys.length * gap + 1), 44100); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); on = true;
  ctx.resume = () => Promise.resolve();
  keys.forEach((k, i) => play(k, i * gap + .2));
  const buf = await ctx.startRendering();
  [ctx, master, on] = keep;
  return buf;
}
