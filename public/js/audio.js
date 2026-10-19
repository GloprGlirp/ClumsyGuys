// Kleine Synth-Soundeffekte per WebAudio – keine Audiodateien nötig.
let ctx = null;
let muted = localStorage.getItem('cg_muted') === '1';

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  jump: () => tone(380, 0.14, 'sine', 0.1, 260),
  dive: () => tone(260, 0.2, 'triangle', 0.12, -120),
  land: () => tone(120, 0.08, 'sine', 0.12, -40),
  bump: () => { tone(200, 0.25, 'square', 0.06, 300); tone(500, 0.18, 'sine', 0.06, -250); },
  boing: () => tone(220, 0.35, 'sine', 0.14, 600),
  pop: () => tone(900, 0.06, 'sine', 0.06, 200),
  whoosh: () => tone(500, 0.12, 'triangle', 0.08, -300),
  grab: () => { tone(300, 0.08, 'square', 0.05, 100); tone(450, 0.1, 'sine', 0.06); },
  tick: () => tone(1200, 0.025, 'square', 0.035),
  click: () => tone(660, 0.05, 'triangle', 0.06),
  count: () => tone(520, 0.18, 'square', 0.06),
  go: () => { tone(780, 0.35, 'square', 0.07); tone(1040, 0.35, 'sine', 0.06); },
  door: () => { tone(160, 0.2, 'sawtooth', 0.05, -80); tone(90, 0.25, 'square', 0.04, -40); },
  splash: () => tone(300, 0.4, 'sawtooth', 0.06, -250),
  qualify: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 0, i * 0.09)),
  out: () => [440, 370, 311, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.05, 0, i * 0.13)),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.12)),
};

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('cg_muted', muted ? '1' : '0');
  return muted;
}
export const isMuted = () => muted;
export function unlockAudio() { try { ac(); } catch {} }
