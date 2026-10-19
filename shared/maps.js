// Alle Level. build(seed) muss auf Server und Client exakt dasselbe liefern.
import { mulberry32, hash2, shuffle } from './rng.js';

function maker() {
  let n = 0;
  const cols = [];
  const add = (type, o) => {
    const c = { id: 'c' + n++, type, ...o };
    cols.push(c);
    return c;
  };
  return {
    cols,
    box: (x, y, z, w, h, d, o = {}) => add('box', { x, y, z, hx: w / 2, hy: h / 2, hz: d / 2, ...o }),
    cyl: (x, y, z, r, h, o = {}) => add('cyl', { x, y, z, r, h: h / 2, ...o }),
    ramp: (x, z, w, d, y0, y1, o = {}) => add('ramp', { x, y: (y0 + y1) / 2, z, hx: w / 2, hz: d / 2, y0, y1, ...o }),
    sphere: (x, y, z, r, o = {}) => add('sphere', { x, y, z, r, ...o }),
  };
}

const mod = (a, b) => ((a % b) + b) % b;

function gridSpawns(cols, rows, x0, dx, z0, dz, y = 0.2) {
  const s = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s.push([x0 + c * dx, y, z0 + r * dz, 0]);
  return s;
}

function ringSpawns(n, rad, y = 0.2, cx = 0, cz = 0) {
  const s = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.sin(a) * rad, z = cz + Math.cos(a) * rad;
    s.push([x, y, z, Math.atan2(cx - x, cz - z)]);
  }
  return s;
}

// ------------------------------------------------------------------ Lobby
function buildLobby() {
  const m = maker();
  m.box(0, -1, 0, 44, 2, 44, { kind: 'floor' });
  m.cyl(-12, 0.15, -12, 1.6, 0.3, { kind: 'pad', pad: 17 });
  m.cyl(-16, 0.15, -4, 1.6, 0.3, { kind: 'pad', pad: 14 });
  m.cyl(10, 1, -10, 1.2, 2, { kind: 'bumper', bounce: 10 });
  m.cyl(15, 1, -6, 1.2, 2, { kind: 'bumper', bounce: 10 });
  m.cyl(13, 1, -15, 1.2, 2, { kind: 'bumper', bounce: 10 });
  m.box(14, 1.5, 14, 8, 5, 8, { kind: 'block' });
  m.ramp(14, 5, 4, 10, 0, 4, { kind: 'ramp' });
  m.cyl(-12, 1, 12, 0.6, 2, { kind: 'post' });
  m.box(-12, 0.55, 12, 11, 0.7, 0.7, { kind: 'sweeper', bounce: 7, move: (t, o) => { o.yaw = t * 1.4; } });
  m.box(0, 0.4, -16, 6, 0.8, 1.5, { kind: 'block' });
  m.box(0, 0.9, -18, 6, 1.8, 1.5, { kind: 'block' });
  m.box(0, 1.4, -20, 6, 2.8, 1.5, { kind: 'block' });
  return {
    colliders: m.cols,
    spawns: ringSpawns(16, 5),
    respawn: [0, 0.5, 0],
    decor: [{ type: 'arch', x: 0, y: 0, z: 8, w: 12, label: 'CLUMSY GUYS' }],
  };
}

// ------------------------------------------------------------------ Rennen 1: Wackelweg
function buildWackelweg(seed) {
  const rnd = mulberry32(seed);
  const m = maker();
  const decor = [];
  m.box(0, -1, 0, 24, 2, 24, { kind: 'start' });
  // Türen-Abschnitt
  m.box(0, -1, 32, 24, 2, 40, { kind: 'floor' });
  m.box(-12.25, 2, 32, 0.5, 6, 40, { kind: 'wall' });
  m.box(12.25, 2, 32, 0.5, 6, 40, { kind: 'wall' });
  const doorXs = [-10, -6, -2, 2, 6, 10];
  const good = [];
  for (const [ri, dz] of [[0, 24], [1, 40]]) {
    const realCount = 2 + Math.floor(rnd() * 2);
    const real = new Set(shuffle([0, 1, 2, 3, 4, 5], rnd).slice(0, realCount));
    good.push(doorXs.filter((_, i) => real.has(i)));
    doorXs.forEach((x, i) => {
      if (real.has(i)) decor.push({ type: 'door', id: `door${ri}_${i}`, x, y: 1.6, z: dz, w: 4, h: 3.2, d: 0.6 });
      else m.box(x, 1.6, dz, 4, 3.2, 0.6, { kind: 'door' });
    });
    decor.push({ type: 'beam', x: 0, y: 3.6, z: dz, w: 24.5, h: 0.8, d: 0.8 });
  }
  // Drehscheibe mit Balken
  m.cyl(0, -1, 64, 13, 2, { kind: 'disc' });
  m.cyl(0, 1.25, 64, 1, 2.5, { kind: 'post' });
  m.box(0, 0.55, 64, 25, 0.7, 0.8, { kind: 'sweeper', bounce: 8, move: (t, o) => { o.yaw = t * 1.15; } });
  m.box(0, -1, 82, 12, 2, 12, { kind: 'floor' });
  // Bewegte Plattformen über Schleim
  for (let i = 0; i < 4; i++) {
    const ph = rnd() * Math.PI * 2, sp = 0.85 + i * 0.12;
    m.box(0, -0.5, 93 + 8 * i, 6, 1, 6, { id: 'mp' + i, kind: 'platform', move: (t, o) => { o.x = Math.sin(t * sp + ph) * 6; } });
  }
  // Hammer-Gang
  m.box(0, -1, 140, 14, 2, 36, { kind: 'floor' });
  [130, 140, 150].forEach((z, i) => {
    const ph = i * 2.1 + rnd() * 0.5;
    m.box(0, 1.5, z, 3.2, 3, 2, {
      kind: 'hammer', bounce: 11, pivot: [0, 9.5, z],
      move: (t, o) => {
        const th = 1.1 * Math.sin(t * 1.7 + ph);
        o.x = 8 * Math.sin(th);
        o.y = 9.5 - 8 * Math.cos(th);
      },
    });
    decor.push({ type: 'gantry', x: 0, z, w: 15, h: 10 });
  });
  // Rampe mit rollenden Kugeln
  m.ramp(0, 170, 12, 24, 0, 6, { kind: 'ramp' });
  const N = 6, interval = 1.0, speed = 9, len = 32, life = len / speed, P = N * interval;
  for (let i = 0; i < N; i++) {
    const cyc = (t) => Math.floor((t + i * interval) / P);
    const age = (t) => mod(t + i * interval, P);
    m.sphere(0, 7.2, 184, 1.2, {
      kind: 'ball', bounce: 6,
      move: (t, o) => {
        const a = age(t);
        const z = 184 - a * speed;
        o.z = z;
        o.x = -4.5 + 9 * hash2(seed + i, cyc(t));
        o.y = (z >= 182 ? 6 : z <= 158 ? 0 : ((z - 158) / 24) * 6) + 1.2;
      },
      active: (t) => age(t) < life,
    });
  }
  m.box(0, 5, 194, 16, 2, 24, { kind: 'finish' });
  decor.push({ type: 'arch', x: 0, y: 6, z: 192, w: 16, label: 'ZIEL', finish: true });
  decor.push({ type: 'arch', x: 0, y: 0, z: 11, w: 24, label: 'START' });

  const dz = (x) => x;
  return {
    colliders: m.cols,
    spawns: gridSpawns(6, 4, -10, 4, -9, 2.6),
    finishZ: 192, finishY: 4.5,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 8 },
      { z: 52, at: [0, 0.5, 47], s: 6 },
      { z: 76.5, at: [0, 0.5, 82], s: 4 },
      { z: 122, at: [0, 0.5, 125], s: 4 },
      { z: 158.5, at: [0, 0.5, 155], s: 4 },
    ],
    botPath: [
      { x: 0, z: 14, s: 8 },
      { choices: doorXs, good: good[0], z: dz(25.5) },
      { x: 0, z: 32, s: 6 },
      { choices: doorXs, good: good[1], z: 41.5 },
      { x: 0, z: 51, s: 2 },
      { x: 0, z: 57, s: 2 },
      { x: -3, z: 64, s: 1 },
      { x: 0, z: 77, s: 2 },
      { x: 0, z: 87, s: 2 },
      { col: 'mp0' }, { col: 'mp1' }, { col: 'mp2' }, { col: 'mp3' },
      { x: 0, z: 124, s: 3 },
      { x: 0, z: 158, s: 4 },
      { x: 0, z: 183, s: 4 },
      { x: 0, z: 198, s: 5 },
    ],
    decor,
  };
}

// ------------------------------------------------------------------ Rennen 2: Kreiselchaos
function buildKreiselchaos(seed) {
  const rnd = mulberry32(seed);
  const m = maker();
  const decor = [];
  m.box(0, -1, 0, 24, 2, 20, { kind: 'start' });
  decor.push({ type: 'arch', x: 0, y: 0, z: 9, w: 24, label: 'START' });
  m.box(0, -1, 22, 10, 2, 24, { kind: 'conveyor', conveyor: [0, -3.2] });
  m.cyl(-2.5, 1, 16, 1, 2, { kind: 'bumper', bounce: 9 });
  m.cyl(2.5, 1, 22.5, 1, 2, { kind: 'bumper', bounce: 9 });
  m.cyl(-2.5, 1, 29, 1, 2, { kind: 'bumper', bounce: 9 });
  [[41, 0.7], [55, -0.85], [69, 1.0]].forEach(([z, w], i) => {
    const ph = rnd() * 6;
    m.cyl(0, -1, z, 6.5, 2, { id: 'disc' + i, kind: 'spin', move: (t, o) => { o.yaw = t * w + ph; } });
    m.box(0, 0.4, z, 12, 0.6, 0.6, { kind: 'sweeper', bounce: 5, move: (t, o) => { o.yaw = t * w + ph; } });
  });
  m.box(0, -1, 78.5, 16, 2, 6, { kind: 'floor' });
  // Blinkplatten
  const P = 4.5, ON = 3.0;
  [85, 91, 97, 103].forEach((z) => {
    [-5, 0, 5].forEach((x) => {
      const ph = rnd() * P;
      m.box(x, -0.5, z, 4, 1, 4, { kind: 'blink', blink: [P, ON, ph], active: (t) => mod(t + ph, P) < ON });
    });
  });
  // Balken-Arena
  m.box(0, -1, 121, 20, 2, 28, { kind: 'floor' });
  m.cyl(0, 1.5, 115, 0.7, 3, { kind: 'post' });
  m.cyl(0, 1, 127, 0.7, 2, { kind: 'post' });
  m.box(0, 0.5, 115, 18, 0.7, 0.7, { kind: 'sweeper', bounce: 8, move: (t, o) => { o.yaw = t * 1.3; } });
  m.box(0, 2.3, 115, 18, 0.8, 0.8, { kind: 'sweeper', bounce: 8, move: (t, o) => { o.yaw = t * 0.7 + 1.5; } });
  m.box(0, 0.5, 127, 18, 0.7, 0.7, { kind: 'sweeper', bounce: 8, move: (t, o) => { o.yaw = -t * 1.5 + 1; } });
  // Treppe ins Ziel
  for (let i = 0; i < 10; i++) {
    const top = 0.35 * (i + 1);
    m.box(0, (top - 1) / 2, 135 + 1.2 * i + 0.6, 10, top + 1, 1.2, { kind: 'stairs' });
  }
  m.box(0, 2.5, 159, 20, 2, 24, { kind: 'finish' });
  m.cyl(-4, 4.5, 153, 1, 2, { kind: 'bumper', bounce: 8 });
  m.cyl(4, 4.5, 153, 1, 2, { kind: 'bumper', bounce: 8 });
  decor.push({ type: 'arch', x: 0, y: 3.5, z: 162, w: 20, label: 'ZIEL', finish: true });
  return {
    colliders: m.cols,
    spawns: gridSpawns(6, 4, -10, 4, -8, 2.4),
    finishZ: 162, finishY: 2,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 8 },
      { z: 34.5, at: [0, 0.5, 32], s: 3 },
      { z: 75.5, at: [0, 0.5, 78.5], s: 5 },
      { z: 107, at: [0, 0.5, 109], s: 6 },
      { z: 135.2, at: [0, 0.9, 136], s: 3 },
    ],
    botPath: [
      { x: 0, z: 8, s: 6 },
      { x: 0, z: 34, s: 2.5 },
      { x: 0, z: 41, s: 1 }, { x: 0, z: 47.5, s: 0.5 },
      { x: 0, z: 55, s: 1 }, { x: 0, z: 61.5, s: 0.5 },
      { x: 0, z: 69, s: 1 }, { x: 0, z: 76.5, s: 2 },
      { choices: [-5, 0, 5], z: 85 }, { choices: [-5, 0, 5], z: 91 },
      { choices: [-5, 0, 5], z: 97 }, { choices: [-5, 0, 5], z: 103 },
      { x: 0, z: 108, s: 3 }, { x: 0, z: 121, s: 3 }, { x: 0, z: 134, s: 3 },
      { x: 0, z: 147, s: 2 }, { x: 0, z: 166, s: 6 },
    ],
    decor,
  };
}

// ------------------------------------------------------------------ Überleben: Schwingscheibe
function buildSchwingscheibe(seed) {
  const rnd = mulberry32(seed);
  const m = maker();
  const tiles = [];
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 10; j++) {
      const x = -13.5 + i * 3, z = -13.5 + j * 3;
      if (Math.hypot(x, z) > 14.6) continue;
      tiles.push(m.box(x, -0.5, z, 3, 1, 3, { kind: 'tile', tile: true }));
    }
  const order = shuffle(tiles.filter((c) => Math.hypot(c.x, c.z) > 3), rnd);
  order.forEach((c, i) => { c.fallAt = 18 + i * 1.8 + 1.5; });
  m.cyl(0, 3, 0, 1.5, 6, { kind: 'post', noStand: true });
  m.box(0, 0.55, 0, 31, 0.7, 0.9, { kind: 'sweeper', bounce: 6, noStand: true, move: (t, o) => { const tt = Math.max(0, t); o.yaw = 0.75 * tt + 0.006 * tt * tt; } });
  m.box(0, 2.35, 0, 31, 1.0, 0.9, { kind: 'sweeper', bounce: 7, noStand: true, move: (t, o) => { const tt = Math.max(0, t); o.yaw = -(0.45 * tt + 0.004 * tt * tt) + Math.PI / 2; } });
  return { colliders: m.cols, spawns: ringSpawns(24, 9), decor: [], tileWarn: 1.5 };
}

// ------------------------------------------------------------------ Finale: Wabenfall
function buildWabenfall() {
  const m = maker();
  const N = 7, s = 1.8, layers = [0, -8, -16];
  layers.forEach((ly, L) => {
    for (let q = -N; q <= N; q++)
      for (let r = Math.max(-N, -q - N); r <= Math.min(N, -q + N); r++) {
        const x = s * 1.5 * q, z = s * Math.sqrt(3) * (r + q / 2);
        m.cyl(x, ly - 0.3, z, 1.56, 0.6, { kind: 'hex', tile: true, layer: L, hs: s });
      }
  });
  return { colliders: m.cols, spawns: ringSpawns(24, 6.5), decor: [], touchTiles: true, tileDelay: 0.55, tileWarn: 0.55, layers };
}

export const MAPS = {
  lobby: { id: 'lobby', name: 'Spielwiese', type: 'lobby', desc: 'Lauf rum, chatte und warte auf den Start!', killY: -12, slimeY: -8, build: buildLobby, sky: ['#7fd3ff', '#d9f3ff'], slime: '#ff7ad9' },
  wackelweg: { id: 'wackelweg', name: 'Wackelweg', type: 'race', desc: 'Finde die echten Türen, spring über den Balken, weich den Hämmern aus – ab ins Ziel!', timeLimit: 150, killY: -12, slimeY: -8, build: buildWackelweg, sky: ['#6ec8ff', '#ffe3f5'], slime: '#ff6fcf' },
  kreiselchaos: { id: 'kreiselchaos', name: 'Kreiselchaos', type: 'race', desc: 'Fließband, Drehscheiben und Blinkplatten. Schnell ins Ziel!', timeLimit: 150, killY: -12, slimeY: -8, build: buildKreiselchaos, sky: ['#ffb36b', '#fff1c9'], slime: '#9b5dff' },
  schwingscheibe: { id: 'schwingscheibe', name: 'Schwingscheibe', type: 'survival', desc: 'Spring über den unteren Balken – aber nicht in den oberen! Die Platten fallen nach und nach.', timeLimit: 75, killY: -12, slimeY: -9, build: buildSchwingscheibe, sky: ['#8a7dff', '#ffd1f0'], slime: '#3dffb1' },
  wabenfall: { id: 'wabenfall', name: 'Wabenfall', type: 'final', desc: 'Waben fallen, sobald du drauftrittst. Wer als Letzter steht, gewinnt die Krone!', timeLimit: 180, killY: -26, slimeY: -23, build: buildWabenfall, sky: ['#ff8fb8', '#ffe9b0'], slime: '#ff3d7f' },
};

export const RACES = ['wackelweg', 'kreiselchaos'];
export const SURVIVALS = ['schwingscheibe'];
export const FINALS = ['wabenfall'];

export function buildMap(id, seed) {
  const meta = MAPS[id];
  const def = meta.build(seed >>> 0);
  return { ...meta, ...def, seed };
}

// Respawn-Punkt fürs Rennen anhand des erreichten Checkpoints
export function checkpointIndex(def, z, cur) {
  let i = cur || 0;
  const cps = def.checkpoints || [];
  while (i + 1 < cps.length && z > cps[i + 1].z) i++;
  return i;
}
