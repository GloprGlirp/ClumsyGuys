// Bausteine für Level – von maps.js und maps-extra.js genutzt.
import { hash2, shuffle } from './rng.js';

export const mod = (a, b) => ((a % b) + b) % b;

export function maker() {
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

export function gridSpawns(cols, rows, x0, dx, z0, dz, y = 0.2) {
  const s = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s.push([x0 + c * dx, y, z0 + r * dz, 0]);
  return s;
}

export function ringSpawns(n, rad, y = 0.2, cx = 0, cz = 0) {
  const s = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.sin(a) * rad, z = cz + Math.cos(a) * rad;
    s.push([x, y, z, Math.atan2(cx - x, cz - z)]);
  }
  return s;
}

// Startfläche (Oberkante y) von z0-d bis z0, Startbogen am Ende
export function startArea(m, decor, { w = 24, d = 20, y = 0, zEnd = 10 } = {}) {
  m.box(0, y - 1, zEnd - d / 2, w, 2, d, { kind: 'start' });
  decor.push({ type: 'arch', x: 0, y, z: zEnd - 1, w, label: 'START' });
  return gridSpawns(6, 4, -10 * (w / 24), 4 * (w / 24), zEnd - d + 2, 2.4, y + 0.2);
}

// Zielfläche ab zStart, Ziellinie bei zStart + 8
export function finishArea(m, decor, { w = 18, d = 22, y = 0, zStart }) {
  m.box(0, y - 1, zStart + d / 2, w, 2, d, { kind: 'finish' });
  decor.push({ type: 'arch', x: 0, y, z: zStart + 8, w, label: 'ZIEL', finish: true });
  return { finishZ: zStart + 8, finishY: y - 1.5 };
}

// Rollende Kugeln von zTop nach zBot (Höhe über yAt(z))
export function rollingBalls(m, seed, o) {
  const len = o.zTop - o.zBot, life = len / o.speed, P = o.n * o.interval;
  const r = o.r || 1.2;
  for (let i = 0; i < o.n; i++) {
    const age = (t) => mod(t + i * o.interval, P);
    const cyc = (t) => Math.floor((t + i * o.interval) / P);
    m.sphere(0, o.yAt(o.zTop) + r, o.zTop, r, {
      kind: 'ball', bounce: o.bounce ?? 6,
      move: (t, out) => {
        const a = age(t);
        const z = o.zTop - a * o.speed;
        out.z = z;
        out.x = o.xMin + (o.xMax - o.xMin) * hash2(seed + i * 7, cyc(t));
        out.y = o.yAt(z) + r;
      },
      active: (t) => age(t) < life && t > (o.delay || 0),
    });
  }
}

// Pendelhammer, schwingt entlang x oder z
export function pendulum(m, decor, { x = 0, z, axis = 'x', pivotY = 9.5, L = 8, amp = 1.1, w = 1.7, ph = 0, size = [3.2, 3, 2], bounce = 11, gantryW = 15 }) {
  const [sx, sy, sz] = axis === 'x' ? size : [size[2], size[1], size[0]];
  m.box(x, pivotY - L, z, sx, sy, sz, {
    kind: 'hammer', bounce, pivot: [x, pivotY, z], swing: axis,
    move: (t, o) => {
      const th = amp * Math.sin(t * w + ph);
      const off = L * Math.sin(th);
      if (axis === 'x') o.x = x + off; else o.z = z + off;
      o.y = pivotY - L * Math.cos(th);
    },
  });
  decor.push({ type: 'gantry', x, z, w: gantryW, h: pivotY + 0.5, axis });
}

// Reihen aus echten (zerbrechlichen) und falschen (festen) Türen
export function doorRows(m, decor, rnd, rows, { xs = [-10, -6, -2, 2, 6, 10], w = 4, minReal = 2, maxReal = 3 } = {}) {
  const good = [];
  rows.forEach((dz, ri) => {
    const realCount = minReal + Math.floor(rnd() * (maxReal - minReal + 1));
    const real = new Set(shuffle(xs.map((_, i) => i), rnd).slice(0, realCount));
    good.push(xs.filter((_, i) => real.has(i)));
    xs.forEach((x, i) => {
      if (real.has(i)) decor.push({ type: 'door', id: `door${ri}_${i}`, x, y: 1.6, z: dz, w, h: 3.2, d: 0.6 });
      else m.box(x, 1.6, dz, w, 3.2, 0.6, { kind: 'door' });
    });
    decor.push({ type: 'beam', x: 0, y: 3.6, z: dz, w: xs.length * w + 0.5, h: 0.8, d: 0.8 });
  });
  return good;
}
