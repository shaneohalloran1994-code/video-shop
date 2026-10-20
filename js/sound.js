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
