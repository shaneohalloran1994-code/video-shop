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

// ---------- 2a: genre stings ----------
// Each genre gets its own short sting when a film lands on the telly. All original, all synthesised.
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

const STINGS = {
  // Low ostinato in 5/4 with a cold bell on the one. Carpenter-flavoured, our own notes.
  night(t) {
    const b = bus(1800, .38), seq = [45, 45, 48, 45, 43, 45, 45, 48, 45, 50];
    seq.forEach((n, i) => o("sawtooth", N(n), t + i * .16, .15, .16, b, { det: i % 2 ? 6 : -6 }));
    o("triangle", N(81), t, 1.6, .12, b); o("triangle", N(82), t + .8, 1.4, .06, b);
  },
  horror(t) {
    const b = bus(900, .5);
    o("sawtooth", N(33), t, 2.6, .22, b, { atk: .6 }); o("sawtooth", N(34), t, 2.6, .18, b, { atk: .6 });
    o("sine", N(84), t + .9, 1.8, .08, b); o("sine", N(85), t + .9, 1.8, .07, b);
    hit(t + 1.6, .6);
  },
  comedy(t) {
    const b = bus(5000);
    [43, 47, 50, 55].forEach((n, i) => o("square", N(n), t + i * .11, .12, .12, b));
    [67, 71, 74].forEach(n => o("sawtooth", N(n), t + .5, .35, .09, b, { atk: .02 }));
    [69, 72, 76].forEach(n => o("sawtooth", N(n), t + .9, .5, .09, b, { atk: .02 }));
  },
  scifi(t) {
    const b = bus(3000, .27);
    [57, 64, 69, 72, 76, 81, 76, 72].forEach((n, i) => o("sawtooth", N(n), t + i * .09, .2, .07, b, { det: 8 }));
    o("sine", N(45), t, 2, .15, b, { atk: .4 });
  },
  action(t) {
    const b = bus(2500);
    [0, .28, .56].forEach((d, i) => { hit(t + d, .55); [38, 45, 50].forEach(n => o("sawtooth", N(n + (i === 2 ? 2 : 0)), t + d, .22, .08, b)); });
    snare(t + .84, .3); [40, 47, 52].forEach(n => o("sawtooth", N(n), t + .84, .7, .1, b));
  },
  drama(t) {
    const b = bus(1600, .33);
    [48, 55, 59, 64, 67].forEach((n, i) => o("triangle", N(n), t + i * .05, 2.4, .07, b, { atk: .5 }));
  },
  romance(t) {
    const b = bus(3500, .3);
    [60, 64, 67, 71, 72].forEach((n, i) => { o("sine", N(n), t + i * .14, 1.4, .1, b); o("sine", N(n + 12), t + i * .14, .5, .03, b); });
  },
  crime(t) {
    const b = bus(1400, .3);
    for (let i = 0; i < 6; i++) o("square", 1200, t + i * .2, .02, .05, master);
    [45, 48, 52, 51].forEach((n, i) => o("sawtooth", N(n), t + .2 + i * .3, .28, .12, b));
  },
  western(t) {
    [64, 62, 59, 57, 52].forEach((n, i) => pluck(N(n), t + i * .18, 1.4, .35));
    const b = bus(3000, .35); o("sine", N(76), t + 1.0, .9, .06, b, { to: N(71), glide: .8 });
  },
  animation(t) {
    const b = bus(6000);
    [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => o("square", N(n), t + i * .07, .08, .06, b));
  },
  war(t) {
    for (let i = 0; i < 10; i++) snare(t + i * .06, .12 + i * .01);
    const b = bus(1200); [36, 43, 48].forEach(n => o("sawtooth", N(n), t + .6, 1.4, .1, b, { atk: .1 }));
  },
  music(t) {
    [0, .25, .5, .625, .75].forEach(d => hit(t + d, .45)); [.25, .75].forEach(d => snare(t + d, .25));
    const b = bus(3000); [55, 59, 62].forEach(n => o("sawtooth", N(n), t + 1, .4, .08, b));
  },
  adventure(t) {
    const b = bus(4000, .25);
    [55, 60, 64, 67].forEach((n, i) => o("sawtooth", N(n), t + i * .13, .5, .08, b, { atk: .03 }));
    [60, 64, 67, 72].forEach(n => o("sawtooth", N(n), t + .6, 1.1, .07, b, { atk: .05 }));
  },
};
const GENRE_STING = { Horror: "horror", Comedy: "comedy", "Science Fiction": "scifi", Action: "action", Drama: "drama", Romance: "romance",
  Crime: "crime", Thriller: "crime", Mystery: "crime", Western: "western", Animation: "animation", Family: "animation",
  War: "war", History: "war", Documentary: "drama", Music: "music", Fantasy: "adventure", Adventure: "adventure" };

export function sting(m) {
  if (!on || !ac()) return;
  const t = ctx.currentTime + .05;
  const late = new Date().getHours() < 5;
  let k = (m.dir || []).includes("John Carpenter") ? "night" : null;
  if (!k) k = GENRE_STING[(m.g || [])[0]] || null;
  if (k === "horror" && late) k = "night";
  if (!k) return stab();
  STINGS[k](t);
}
// A soft click for switching shelves.
export function click() {
  if (!on || !ac()) return;
  o("square", 900, ctx.currentTime, .03, .05, master);
}
