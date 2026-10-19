// 16 weitere Minispiele. build(seed) muss deterministisch sein (Server + Client).
import { mulberry32, hash2, shuffle } from './rng.js';
import { maker, mod, ringSpawns, startArea, finishArea, rollingBalls, pendulum, doorRows } from './mapkit.js';

const TAU = Math.PI * 2;

// ================================================================== RENNEN

function buildHuepfburg() {
  const m = maker(), decor = [];
  const spawns = startArea(m, decor, { w: 24, d: 20, zEnd: 10 });
  m.box(0, -1, 16, 16, 2, 12, { kind: 'floor' });
  for (const x of [-5, 0, 5]) m.cyl(x, 0.15, 20, 1.6, 0.3, { kind: 'pad', pad: 16, padZ: 11 });
  m.box(0, -1, 33, 14, 2, 10, { kind: 'floor' });
  m.cyl(-3, 1, 32, 1, 2, { kind: 'bumper', bounce: 8 });
  m.cyl(3, 1, 32, 1, 2, { kind: 'bumper', bounce: 8 });
  for (const x of [-4, 4]) m.cyl(x, 0.15, 36.5, 1.4, 0.3, { kind: 'pad', pad: 16, padZ: 11 });
  m.box(0, -1, 50, 12, 2, 10, { kind: 'floor' });
  m.cyl(0, 1, 48.5, 0.6, 2, { kind: 'post' });
  m.box(0, 0.5, 48.5, 11, 0.6, 0.6, { kind: 'sweeper', bounce: 6, move: (t, o) => { o.yaw = t * 1.6; } });
  m.cyl(0, 0.15, 53.5, 1.6, 0.3, { kind: 'pad', pad: 18, padZ: 10 });
  m.box(0, 2, 68, 14, 2, 12, { kind: 'floor' });
  m.cyl(0, 4, 67, 1.1, 2, { kind: 'bumper', bounce: 9, move: (t, o) => { o.x = Math.sin(t * 1.3) * 4.5; } });
  for (const x of [-4, 4]) m.cyl(x, 3.15, 72.5, 1.4, 0.3, { kind: 'pad', pad: 15, padZ: 10 });
  const fin = finishArea(m, decor, { w: 18, d: 20, y: 3, zStart: 80 });
  return {
    colliders: m.cols, spawns, decor, ...fin,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 8 },
      { z: 28, at: [0, 0.5, 31], s: 4 },
      { z: 45, at: [0, 0.5, 47.5], s: 3 },
      { z: 62, at: [0, 3.5, 65], s: 4 },
    ],
    botPath: [
      { x: 0, z: 12, s: 5 }, { choices: [-5, 0, 5], z: 20 },
      { x: 0, z: 31, s: 3 }, { choices: [-4, 4], z: 36.5 },
      { x: 0, z: 46.5, s: 2 }, { x: 0, z: 53.5, s: 0.3 },
      { x: 0, z: 66, s: 4 }, { choices: [-4, 4], z: 72.5 },
      { x: 0, z: 92, s: 5 },
    ],
  };
}

function buildRutschpartie(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const spawns = startArea(m, decor, { w: 20, d: 16, y: 10, zEnd: 8 });
  m.ramp(0, 23, 12, 30, 10, 2, { kind: 'ramp' });
  const h = (z) => 10 - ((z - 8) * 8) / 30;
  for (const [x, z] of [[-3, 15], [3, 21], [-2.5, 28], [3.5, 33]]) m.cyl(x, h(z) + 1, z, 1, 4, { kind: 'bumper', bounce: 9 });
  m.box(0, 1, 48, 12, 2, 20, { kind: 'conveyor', conveyor: [0, -4] });
  [44, 52].forEach((z, i) => {
    const ph = rnd() * TAU;
    m.cyl(0, 3, z, 1, 2, { kind: 'bumper', bounce: 9, move: (t, o) => { o.x = Math.sin(t * 1.5 + ph) * 4.2; } });
  });
  m.ramp(0, 70, 10, 24, 2, 8, { kind: 'ramp' });
  rollingBalls(m, seed, { n: 5, interval: 1.1, speed: 8, zTop: 82, zBot: 58, yAt: (z) => (z >= 82 ? 8 : 2 + ((z - 58) * 6) / 24), xMin: -3.5, xMax: 3.5 });
  const fin = finishArea(m, decor, { w: 16, d: 20, y: 8, zStart: 82 });
  return {
    colliders: m.cols, spawns, decor, ...fin,
    checkpoints: [
      { z: -99, at: [0, 10.5, 0], s: 6 },
      { z: 38.5, at: [0, 2.5, 41], s: 4 },
      { z: 58.5, at: [0, 3, 60], s: 3 },
    ],
    botPath: [{ x: 0, z: 6, s: 4 }, { x: 0, z: 37, s: 4 }, { x: 0, z: 57, s: 3 }, { x: 0, z: 82, s: 3 }, { x: 0, z: 94, s: 4 }],
  };
}

function buildPendelpfad(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const spawns = startArea(m, decor, { w: 20, d: 16, zEnd: 8 });
  m.box(0, -1, 24, 3, 2, 32, { kind: 'floor' });
  [16, 26, 36].forEach((z, i) => pendulum(m, decor, { z, ph: i * 2 + rnd(), w: 1.6 + rnd() * 0.3 }));
  m.box(0, -1, 46, 10, 2, 12, { kind: 'floor' });
  m.box(0, -1, 68, 4, 2, 32, { kind: 'floor' });
  [60, 68, 76].forEach((z) => {
    const ph = rnd() * TAU, w = 1.2 + rnd() * 0.5;
    m.box(0, 0.55, z, 4, 0.7, 0.8, { kind: 'sweeper', bounce: 6, noStand: true, move: (t, o) => { o.x = Math.sin(t * w + ph) * 5; } });
  });
  const fin = finishArea(m, decor, { w: 16, d: 22, zStart: 84 });
  return {
    colliders: m.cols, spawns, decor, ...fin,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 6 },
      { z: 40.5, at: [0, 0.5, 45], s: 3 },
      { z: 84.5, at: [0, 0.5, 87], s: 3 },
    ],
    botPath: [{ x: 0, z: 7, s: 2 }, { x: 0, z: 40, s: 0.3 }, { x: 0, z: 47, s: 2 }, { x: 0, z: 84, s: 0.5 }, { x: 0, z: 96, s: 4 }],
  };
}

function buildBlinkbruecke(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const spawns = startArea(m, decor, { w: 24, d: 20, zEnd: 10 });
  const P = 5, ON = 3.8, xs = [-7.5, -2.5, 2.5, 7.5], rows = [14, 20, 26, 32, 38, 44];
  for (const z of rows) for (const x of xs) {
    const ph = rnd() * P;
    m.box(x, -0.5, z, 4, 1, 4, { kind: 'blink', blink: [P, ON, ph], active: (t) => mod(t + ph, P) < ON });
  }
  m.box(0, -1, 52, 20, 2, 8, { kind: 'floor' });
  [61, 69, 77].forEach((z, i) => {
    const ph = rnd() * TAU, w = 0.9 + rnd() * 0.4;
    m.box(0, -0.5, z, 5, 1, 5, { id: 'bb' + i * 2, kind: 'platform', move: (t, o) => { o.x = Math.sin(t * w + ph) * 7; } });
    m.box(0, -0.5, z, 5, 1, 5, { id: 'bb' + (i * 2 + 1), kind: 'platform', move: (t, o) => { o.x = -Math.sin(t * w + ph) * 7; } });
  });
  const fin = finishArea(m, decor, { w: 20, d: 22, zStart: 82 });
  return {
    colliders: m.cols, spawns, decor, ...fin,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 8 },
      { z: 48.5, at: [0, 0.5, 51], s: 6 },
    ],
    botPath: [
      { x: 0, z: 9, s: 6 },
      ...rows.map((z) => ({ choices: xs, z })),
      { x: 0, z: 52, s: 5 },
      { col: 'bb0' }, { col: 'bb2' }, { col: 'bb4' },
      { x: 0, z: 92, s: 5 },
    ],
  };
}

function buildKugelberg(seed) {
  const m = maker(), decor = [];
  const spawns = startArea(m, decor, { w: 20, d: 16, zEnd: 8 });
  m.ramp(0, 28, 14, 40, 0, 10, { kind: 'ramp' });
  m.box(-7.25, 6, 28, 0.5, 14, 40, { kind: 'wall' });
  m.box(7.25, 6, 28, 0.5, 14, 40, { kind: 'wall' });
  rollingBalls(m, seed, { n: 6, interval: 0.9, speed: 9, zTop: 48, zBot: 8, yAt: (z) => ((z - 8) * 10) / 40, xMin: -5.5, xMax: 5.5 });
  m.box(0, 9, 54, 14, 2, 12, { kind: 'floor' });
  m.cyl(-3, 11, 54, 1, 2, { kind: 'bumper', bounce: 8 });
  m.cyl(3, 11, 54, 1, 2, { kind: 'bumper', bounce: 8 });
  m.ramp(0, 76, 14, 32, 10, 18, { kind: 'ramp' });
  m.box(-7.25, 15, 76, 0.5, 14, 32, { kind: 'wall' });
  m.box(7.25, 15, 76, 0.5, 14, 32, { kind: 'wall' });
  rollingBalls(m, seed + 99, { n: 5, interval: 0.85, speed: 9, zTop: 92, zBot: 60, yAt: (z) => 10 + ((z - 60) * 8) / 32, xMin: -5.5, xMax: 5.5 });
  const fin = finishArea(m, decor, { w: 18, d: 20, y: 18, zStart: 92 });
  return {
    colliders: m.cols, spawns, decor, ...fin,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 6 },
      { z: 48.5, at: [0, 10.5, 52], s: 4 },
    ],
    botPath: [{ x: 0, z: 7, s: 3 }, { x: 0, z: 48, s: 4 }, { x: 0, z: 59, s: 3 }, { x: 0, z: 92, s: 4 }, { x: 0, z: 104, s: 4 }],
  };
}

function buildTuerchaos(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const spawns = startArea(m, decor, { w: 24, d: 20, zEnd: 10 });
  m.box(0, -1, 48, 24, 2, 76, { kind: 'floor' });
  m.box(-12.25, 2, 48, 0.5, 6, 76, { kind: 'wall' });
  m.box(12.25, 2, 48, 0.5, 6, 76, { kind: 'wall' });
  const xs = [-10, -6, -2, 2, 6, 10];
  const rows = [20, 32, 44, 56, 68];
  const good = [
    ...doorRows(m, decor, rnd, rows.slice(0, 3), { xs, minReal: 2, maxReal: 3 }),
    ...doorRows(m, decor, rnd, rows.slice(3), { xs, minReal: 1, maxReal: 2 }),
  ];
  for (const [x, z] of [[-6, 26], [6, 26], [0, 38], [-4, 50], [4, 50], [-7, 62], [7, 62], [0, 74]]) m.cyl(x, 1, z, 0.9, 2, { kind: 'bumper', bounce: 8 });
  const fin = finishArea(m, decor, { w: 24, d: 20, zStart: 86 });
  const botPath = [{ x: 0, z: 14, s: 7 }];
  rows.forEach((z, i) => { botPath.push({ choices: xs, good: good[i], z: z + 1.5 }); botPath.push({ x: 0, z: z + 7, s: 7 }); });
  botPath.push({ x: 0, z: 96, s: 6 });
  return {
    colliders: m.cols, spawns, decor, ...fin, botPath,
    checkpoints: [{ z: -99, at: [0, 0.5, 0], s: 8 }],
  };
}

function buildBalkenwald(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const spawns = startArea(m, decor, { w: 20, d: 16, zEnd: 8 });
  m.box(0, -1, 48, 20, 2, 80, { kind: 'floor' });
  [18, 30, 42, 54, 66, 78].forEach((z, i) => {
    const px = i % 2 ? 5 : -5;
    const dir = rnd() < 0.5 ? 1 : -1, w = 1.1 + rnd() * 0.6, ph = rnd() * TAU;
    m.cyl(px, 1.5, z, 0.5, 3, { kind: 'post', noStand: true });
    m.box(px, 0.55, z, 9, 0.7, 0.7, { kind: 'sweeper', bounce: 7, noStand: true, move: (t, o) => { o.yaw = dir * t * w + ph; } });
    if (i % 2) m.box(px, 2.2, z, 9, 0.7, 0.7, { kind: 'sweeper', bounce: 7, noStand: true, move: (t, o) => { o.yaw = -dir * t * w * 0.7 + ph + 1.5; } });
  });
  const fin = finishArea(m, decor, { w: 20, d: 22, zStart: 88 });
  const botPath = [];
  for (let z = 12; z <= 84; z += 12) botPath.push({ x: 0, z, s: 7 });
  botPath.push({ x: 0, z: 98, s: 5 });
  return {
    colliders: m.cols, spawns, decor, ...fin, botPath,
    checkpoints: [{ z: -99, at: [0, 0.5, 0], s: 6 }, { z: 36, at: [0, 0.5, 36], s: 6 }, { z: 60, at: [0, 0.5, 60], s: 6 }],
  };
}

function buildFliessband(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const spawns = startArea(m, decor, { w: 20, d: 16, zEnd: 8 });
  m.box(0, -1, 21, 10, 2, 24, { kind: 'conveyor', conveyor: [3.5, 0] });
  m.box(0, -1, 47, 10, 2, 24, { kind: 'conveyor', conveyor: [-3.5, 0] });
  m.box(0, -1, 73, 10, 2, 24, { kind: 'conveyor', conveyor: [0, -3] });
  for (const [z, side] of [[16, -1], [27, -1], [42, 1], [53, 1]]) {
    const ph = rnd() * TAU, w = 1.4 + rnd() * 0.5;
    m.box(0, 0.75, z, 5, 1.5, 2, { kind: 'hammer', bounce: 7, move: (t, o) => { o.x = side * (7.5 - 5 * (0.5 + 0.5 * Math.sin(t * w + ph))); } });
  }
  for (const [x, z] of [[-2.5, 67], [2.5, 72], [-2.5, 77], [2.5, 82]]) m.cyl(x, 1, z, 1, 2, { kind: 'bumper', bounce: 8 });
  const fin = finishArea(m, decor, { w: 18, d: 20, zStart: 87 });
  return {
    colliders: m.cols, spawns, decor, ...fin,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 6 },
      { z: 35, at: [0, 0.5, 37], s: 2 },
      { z: 61, at: [0, 0.5, 63], s: 2 },
    ],
    botPath: [{ x: 0, z: 7, s: 3 }, { x: -1.5, z: 33, s: 1 }, { x: 1.5, z: 59, s: 1 }, { x: 0, z: 86, s: 1.5 }, { x: 0, z: 96, s: 4 }],
  };
}

// ================================================================== ÜBERLEBEN

function buildSpringseil() {
  const m = maker();
  m.cyl(0, -1, 0, 13, 2, { kind: 'disc' });
  m.cyl(0, 3, 0, 1.2, 6, { kind: 'post', noStand: true });
  m.box(0, 0.5, 0, 26, 0.6, 0.8, { kind: 'sweeper', bounce: 6, noStand: true, move: (t, o) => { const tt = Math.max(0, t); o.yaw = 0.9 * tt + 0.008 * tt * tt; } });
  m.box(0, 0.5, 0, 15, 0.6, 0.8, { kind: 'sweeper', bounce: 6, noStand: true, move: (t, o) => { const tt = Math.max(0, t); o.yaw = -(0.6 * tt + 0.01 * tt * tt) + Math.PI / 2; } });
  return { colliders: m.cols, spawns: ringSpawns(24, 9), decor: [], arenaR: 11 };
}

function buildKugelhagel(seed) {
  const m = maker();
  m.box(0, -1, 0, 26, 2, 26, { kind: 'floor' });
  const P = 7;
  for (let i = 0; i < 10; i++) {
    const off = i * 0.7, start = 2 + i * 5;
    const st = (t) => {
      const cyc = Math.floor((t - off) / P);
      const age = mod(t - off, P);
      const a = hash2(seed + i, cyc) * TAU;
      const spd = 9 + hash2(seed + i * 5, cyc) * 5;
      const lat = (hash2(seed + i * 3, cyc) - 0.5) * 18;
      return { a, spd, lat, age };
    };
    m.sphere(0, 1.5, -30, 1.5, {
      kind: 'ball', bounce: 8,
      move: (t, o) => {
        const s = st(t);
        const dx = Math.sin(s.a), dz = Math.cos(s.a);
        const d = -22 + s.spd * s.age;
        o.x = dx * d + dz * s.lat; o.z = dz * d - dx * s.lat; o.y = 1.5;
      },
      active: (t) => t > start && st(t).age * st(t).spd < 44,
    });
  }
  return { colliders: m.cols, spawns: ringSpawns(24, 8), decor: [], arenaR: 11 };
}

const TILE_COLORS = ['#ff4d6d', '#4cc9f0', '#ffd23f', '#7ed957'];
const TILE_NAMES = ['ROT', 'BLAU', 'GELB', 'GRÜN'];

function buildFarbfeld(seed) {
  const m = maker();
  const rnd = mulberry32(seed);
  const cycles = [];
  for (let k = 0; k < 16; k++) {
    const s = 3 + k * 6.5, warn = k < 5 ? 2.6 : 1.8;
    const cols = shuffle([0, 1, 2, 3], rnd).slice(0, k < 5 ? 1 : 2);
    cycles.push({ s, warnEnd: s + warn, goneEnd: s + warn + 2.2, cols });
  }
  const cycAt = (t) => cycles.find((c) => t >= c.s && t < c.goneEnd);
  const xs = [-10, -6, -2, 2, 6, 10];
  for (const x of xs) for (const z of xs) {
    const ci = Math.floor(rnd() * 4);
    m.box(x, -0.5, z, 3.8, 1, 3.8, {
      kind: 'colortile', color: TILE_COLORS[ci], colorIdx: ci,
      active: (t) => { const c = cycAt(t); return !(c && t >= c.warnEnd && c.cols.includes(ci)); },
      warnAt: (t) => { const c = cycAt(t); return !!(c && t < c.warnEnd && c.cols.includes(ci)); },
    });
  }
  const signal = (t) => { const c = cycAt(t); return c ? c.cols.map((i) => TILE_COLORS[i]) : null; };
  return {
    colliders: m.cols, spawns: ringSpawns(24, 8), arenaR: 11,
    decor: [{ type: 'signal', x: 0, y: 9, z: 0, colorsAt: signal }],
    signalText: (t) => { const c = cycAt(t); return c && t < c.warnEnd ? c.cols.map((i) => TILE_NAMES[i]).join(' + ') + ' verschwindet!' : null; },
  };
}

function buildHammerhalle(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const tiles = [];
  const xs = [-10, -6, -2, 2, 6, 10];
  for (const x of xs) for (const z of xs) tiles.push(m.box(x, -0.5, z, 4, 1, 4, { kind: 'tile', tile: true }));
  const order = tiles.slice().sort((a, b) => Math.hypot(b.x, b.z) + rnd() * 3 - (Math.hypot(a.x, a.z) + rnd() * 3));
  order.forEach((c, i) => { c.fallAt = 20 + i * 2.2 + 1.5; });
  // Zwei Hämmer kreuzen die Mitte, zwei weitere fegen die Außenbahnen – kein sicherer Fleck
  pendulum(m, decor, { x: 0, z: 0, axis: 'z', pivotY: 12, L: 10.5, amp: 0.95, w: 1.3, ph: 0, bounce: 8, gantryW: 25 });
  pendulum(m, decor, { x: 0, z: 0.01, axis: 'x', pivotY: 12.6, L: 11.1, amp: 0.9, w: 1.05, ph: Math.PI / 2, bounce: 8, gantryW: 25 });
  pendulum(m, decor, { x: 0, z: 7, axis: 'x', pivotY: 12, L: 10.5, amp: 0.95, w: 1.45, ph: Math.PI, bounce: 8, gantryW: 25 });
  pendulum(m, decor, { x: 0, z: -7, axis: 'x', pivotY: 12, L: 10.5, amp: 0.95, w: 1.2, ph: 2, bounce: 8, gantryW: 25 });
  const spawns = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const ax of [2.5, 3.9, 5.3]) for (const az of [2.5, 4.2]) spawns.push([sx * ax, 0.2, sz * az, Math.atan2(-sx, -sz)]);
  return { colliders: m.cols, spawns, decor, tileWarn: 1.5, arenaR: 10 };
}

function buildKarussell() {
  const m = maker();
  const yaw = (t) => { const tt = Math.max(0, t); return 0.3 * tt + 0.004 * tt * tt; };
  m.cyl(0, -1, 0, 14, 2, { kind: 'spin', move: (t, o) => { o.yaw = yaw(t); } });
  m.cyl(0, 2, 0, 1.2, 4, { kind: 'post', noStand: true });
  m.box(7.4, 0.5, 0, 12.4, 0.6, 0.8, { kind: 'sweeper', bounce: 5, noStand: true });
  m.box(0, 2.3, -7.4, 0.8, 0.8, 12.4, { kind: 'sweeper', bounce: 6, noStand: true });
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * TAU;
    m.cyl(0, 1, 9, 1, 2, { kind: 'bumper', bounce: 8, move: (t, o) => { const a = yaw(t) + a0; o.x = Math.sin(a) * 9; o.z = Math.cos(a) * 9; } });
  }
  // Spawns abseits vom Balken (x > 0, z ≈ 0) und von den Bumpern
  const spawns = [...ringSpawns(16, 10.5), ...ringSpawns(12, 5.5, 0.2)].filter(([x, , z]) => !(x > 0 && Math.abs(z) < 2.2) && !(z < 0 && Math.abs(x) < 2.2));
  return { colliders: m.cols, spawns, decor: [], arenaR: 10 };
}

// ================================================================== FINALE

function buildSchrumpfinsel(seed) {
  const m = maker();
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const x = i * 3, z = j * 3, d = Math.hypot(x, z);
    if (d > 16.5) continue;
    m.box(x, -0.5, z, 3, 1, 3, { kind: 'tile', tile: true, fallAt: 10 + (16.5 - d) * 5.8 + hash2(seed, i * 31 + j) * 4 + 1.5 });
  }
  m.box(0, 0.5, 0, 26, 0.6, 0.8, { kind: 'sweeper', bounce: 6, noStand: true, move: (t, o) => { o.yaw = Math.max(0, t) * 0.65; } });
  for (let k = 0; k < 2; k++) {
    m.cyl(0, 1, 8, 1.1, 2, { kind: 'bumper', bounce: 9, move: (t, o) => { const a = -t * 0.5 + k * Math.PI; o.x = Math.sin(a) * 8; o.z = Math.cos(a) * 8; } });
  }
  return { colliders: m.cols, spawns: ringSpawns(24, 11), decor: [], tileWarn: 1.5, arenaR: 14 };
}

function buildKronenkletterei(seed) {
  const m = maker(), decor = [];
  const rnd = mulberry32(seed);
  const spawns = startArea(m, decor, { w: 20, d: 16, zEnd: 8 });
  for (let i = 0; i < 10; i++) {
    const top = 0.35 * (i + 1);
    m.box(0, (top - 1) / 2, 8 + 1.2 * i + 0.6, 10, top + 1, 1.2, { kind: 'stairs' });
  }
  m.box(0, 2.5, 26, 12, 2, 12, { kind: 'floor' });
  m.cyl(0, 4.5, 26, 0.6, 2, { kind: 'post', noStand: true });
  m.box(0, 4, 26, 11, 0.6, 0.6, { kind: 'sweeper', bounce: 6, noStand: true, move: (t, o) => { o.yaw = t * 1.5; } });
  [37, 44, 51].forEach((z, i) => {
    const base = 4.5 + i * 1.5, ph = i * 1.2 + rnd();
    m.box(0, base - 0.5, z, 5, 1, 5, { id: 'el' + i, kind: 'platform', move: (t, o) => { o.y = base - 0.5 + Math.sin(t * 1.3 + ph) * 1.2; } });
  });
  m.box(0, 8, 62, 14, 2, 14, { kind: 'floor' });
  m.ramp(0, 82, 10, 26, 9, 15, { kind: 'ramp' });
  rollingBalls(m, seed, { n: 5, interval: 1.1, speed: 8, zTop: 95, zBot: 69, yAt: (z) => 9 + ((z - 69) * 6) / 26, xMin: -3.5, xMax: 3.5 });
  const fin = finishArea(m, decor, { w: 14, d: 18, y: 15, zStart: 95 });
  decor.push({ type: 'crown', x: 0, y: 20, z: fin.finishZ });
  return {
    colliders: m.cols, spawns, decor, ...fin,
    checkpoints: [
      { z: -99, at: [0, 0.5, 0], s: 6 },
      { z: 20.5, at: [0, 4, 23], s: 4 },
      { z: 55.5, at: [0, 9.5, 58], s: 4 },
    ],
    botPath: [
      { x: 0, z: 7, s: 3 }, { x: 0, z: 20, s: 2 }, { x: 0, z: 31, s: 2 },
      { col: 'el0' }, { col: 'el1' }, { col: 'el2' },
      { x: 0, z: 58, s: 2 }, { x: 0, z: 70, s: 3 }, { x: 0, z: 96, s: 3 }, { x: 0, z: 106, s: 3 },
    ],
  };
}

function buildMauersturm(seed) {
  const m = maker();
  m.box(0, -1, 0, 20, 2, 20, { kind: 'floor' });
  const P = 7, offs = [-8, -4, 0, 4, 8];
  for (let s = 0; s < 2; s++) {
    const t0 = 4 + s * 3.5;
    const wave = (t) => {
      const k = Math.floor((t - t0) / P);
      const kk = k * 2 + s;
      const age = mod(t - t0, P);
      const spd = Math.min(12, 6 + kk * 0.35);
      const axis = hash2(seed + 3, kk) < 0.5 ? 'z' : 'x';
      const dir = hash2(seed + 7, kk) < 0.5 ? 1 : -1;
      const gap = Math.floor(hash2(seed + 11, kk) * 5);
      const low = (gap + 1 + Math.floor(hash2(seed + 13, kk) * 4)) % 5;
      return { age, spd, axis, dir, gap, low, pos: dir * (-14 + spd * age) };
    };
    offs.forEach((off, j) => {
      for (const tall of [true, false]) {
        const hgt = tall ? 3.5 : 1.0;
        m.box(0, hgt / 2, -30, 4, hgt, 1, {
          kind: tall ? 'wall' : 'block', bounce: 3,
          move: (t, o) => {
            const w = wave(t);
            if (w.axis === 'z') { o.x = off; o.z = w.pos; o.yaw = 0; }
            else { o.x = w.pos; o.z = off; o.yaw = Math.PI / 2; }
          },
          active: (t) => {
            if (t < t0) return false;
            const w = wave(t);
            if (Math.abs(w.pos) > 14 || j === w.gap) return false;
            return tall ? j !== w.low : j === w.low;
          },
        });
      }
    });
  }
  return { colliders: m.cols, spawns: ringSpawns(24, 6), decor: [], arenaR: 8, ai: 'walls' };
}

const S = (o) => o;
export const EXTRA_MAPS = {
  huepfburg: S({ id: 'huepfburg', name: 'Hüpfburg', type: 'race', icon: '🦘', desc: 'Nur mit den Sprungpads kommst du über die Lücken. Ab in die Luft!', timeLimit: 120, killY: -12, slimeY: -8, build: buildHuepfburg, sky: ['#7ad0ff', '#e8fff4'], slime: '#5cff9d' }),
  rutschpartie: S({ id: 'rutschpartie', name: 'Rutschpartie', type: 'race', icon: '🛝', desc: 'Runter rutschen, gegen das Fließband kämpfen und den Kugeln ausweichen!', timeLimit: 120, killY: -12, slimeY: -8, build: buildRutschpartie, sky: ['#ff9ec7', '#fff1d6'], slime: '#7a5cff' }),
  pendelpfad: S({ id: 'pendelpfad', name: 'Pendelpfad', type: 'race', icon: '🔨', desc: 'Schmale Stege, riesige Hämmer. Timing ist alles!', timeLimit: 120, killY: -12, slimeY: -8, build: buildPendelpfad, sky: ['#9fb8ff', '#ffe6f0'], slime: '#ff5fa2' }),
  blinkbruecke: S({ id: 'blinkbruecke', name: 'Blinkbrücke', type: 'race', icon: '💡', desc: 'Die Platten verschwinden immer wieder – lauf, solange sie da sind!', timeLimit: 130, killY: -12, slimeY: -8, build: buildBlinkbruecke, sky: ['#6b6bff', '#ffc4f2'], slime: '#3dffd5' }),
  kugelberg: S({ id: 'kugelberg', name: 'Kugelberg', type: 'race', icon: '🎳', desc: 'Kämpf dich den Berg hoch, während riesige Kugeln runterrollen!', timeLimit: 130, killY: -12, slimeY: -8, build: buildKugelberg, sky: ['#ffb36b', '#fff4c9'], slime: '#ff6fcf' }),
  tuerchaos: S({ id: 'tuerchaos', name: 'Türchaos', type: 'race', icon: '🚪', desc: 'Fünf Türreihen – nur manche Türen lassen dich durch!', timeLimit: 120, killY: -12, slimeY: -8, build: buildTuerchaos, sky: ['#6ec8ff', '#fde4ff'], slime: '#ffb84d' }),
  balkenwald: S({ id: 'balkenwald', name: 'Balkenwald', type: 'race', icon: '🌀', desc: 'Ein Wald aus Drehbalken – unten drüber springen, oben aufpassen!', timeLimit: 120, killY: -12, slimeY: -8, build: buildBalkenwald, sky: ['#8fe388', '#f3ffd9'], slime: '#9b5dff' }),
  fliessband: S({ id: 'fliessband', name: 'Fließbandfabrik', type: 'race', icon: '🏭', desc: 'Fließbänder schieben dich zur Seite, Stempel hauen dich runter!', timeLimit: 120, killY: -12, slimeY: -8, build: buildFliessband, sky: ['#a7b4c9', '#ffe9d6'], slime: '#ff7a1a' }),
  springseil: S({ id: 'springseil', name: 'Springseil', type: 'survival', icon: '🪢', desc: 'Zwei Balken, die immer schneller werden. Spring im richtigen Moment!', timeLimit: 70, killY: -12, slimeY: -8, build: buildSpringseil, sky: ['#ffd36b', '#fff8e0'], slime: '#4cc9f0' }),
  kugelhagel: S({ id: 'kugelhagel', name: 'Kugelhagel', type: 'survival', icon: '☄️', desc: 'Von allen Seiten rollen Kugeln über die Plattform – lass dich nicht runterschubsen!', timeLimit: 70, killY: -12, slimeY: -8, build: buildKugelhagel, sky: ['#5a6bff', '#ffd2c9'], slime: '#ff3d7f' }),
  farbfeld: S({ id: 'farbfeld', name: 'Farbfeld', type: 'survival', icon: '🎨', desc: 'Achte auf die Anzeige: Diese Farbe verschwindet gleich – stell dich woanders hin!', timeLimit: 75, killY: -12, slimeY: -8, build: buildFarbfeld, sky: ['#ffffff', '#e5e0ff'], slime: '#2a2342' }),
  hammerhalle: S({ id: 'hammerhalle', name: 'Hammerhalle', type: 'survival', icon: '🪓', desc: 'Vier Riesenhämmer und eine Plattform, die zerbröselt. Bleib oben!', timeLimit: 75, killY: -12, slimeY: -9, build: buildHammerhalle, sky: ['#c79bff', '#ffe0f0'], slime: '#5cff9d' }),
  karussell: S({ id: 'karussell', name: 'Karussell', type: 'survival', icon: '🎠', desc: 'Die Scheibe dreht sich immer schneller und trägt dich in die Balken!', timeLimit: 70, killY: -12, slimeY: -8, build: buildKarussell, sky: ['#ff9b9b', '#fff0d0'], slime: '#7a5cff' }),
  schrumpfinsel: S({ id: 'schrumpfinsel', name: 'Schrumpfinsel', type: 'final', final: true, icon: '🏝️', desc: 'Die Insel bröckelt von außen nach innen. Wer zuletzt steht, holt die Krone!', timeLimit: 120, killY: -12, slimeY: -9, build: buildSchrumpfinsel, sky: ['#4fd1ff', '#fff7c2'], slime: '#2ec4b6' }),
  kronenkletterei: S({ id: 'kronenkletterei', name: 'Kronenkletterei', type: 'race', final: true, icon: '🧗', desc: 'Kletter nach oben! Wer zuerst die Krone erreicht, gewinnt!', timeLimit: 150, killY: -12, slimeY: -8, build: buildKronenkletterei, sky: ['#ffb36b', '#ffeefc'], slime: '#9b5dff' }),
  mauersturm: S({ id: 'mauersturm', name: 'Mauersturm', type: 'final', final: true, icon: '🧱', desc: 'Wände rasen über die Plattform. Finde die Lücke oder spring drüber!', timeLimit: 120, killY: -12, slimeY: -8, build: buildMauersturm, sky: ['#ff8a8a', '#ffe8c4'], slime: '#3dffb1' }),
};
