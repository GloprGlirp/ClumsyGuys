// Gemeinsame Physik für Client (eigener Spieler) und Server (Bots).
// Spieler = senkrechter Zylinder. Welt = Boxen (mit Drehung um Y), Zylinder, Rampen, Kugeln.

export const PHYS = {
  R: 0.45, // Spielerradius
  H: 1.7, // Spielerhöhe
  gravity: -28,
  maxFall: -40,
  jumpVel: 10.5,
  speed: 8,
  accel: 55,
  airAccel: 16,
  step: 0.42,
  diveSpeed: 11.5,
  diveTime: 0.75,
  diveCooldown: 1.0,
  coyote: 0.11,
  jumpBuffer: 0.13,
};

export const ANIMS = ['idle', 'run', 'jump', 'fall', 'dive', 'stun', 'emote1', 'emote2', 'emote3', 'emote4', 'push', 'grab'];

// Schubsen & Festhalten
export const GRAB = { pushRange: 1.8, grabRange: 1.6, pushCd: 0.8, grabMax: 2.5, grabCd: 1.0, holdSpeed: 0.6, heldSpeed: 0.3, tether: 1.25 };

const CELL = 6;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class World {
  constructor(def) {
    this.def = def;
    this.cols = def.colliders;
    this.byId = new Map();
    this.dynamic = [];
    this.toggles = [];
    this.tiles = [];
    this.grid = new Map();
    this.stamp = 0;
    this.t = 0;
    this.dt = 1 / 60;
    const tmp = { x: 0, y: 0, z: 0, yaw: 0 };
    for (const c of this.cols) {
      c.yaw = c.yaw || 0;
      c.cx = c.px = c.x;
      c.cy = c.py = c.y;
      c.cz = c.pz = c.z;
      c.cyaw = c.pyaw = c.yaw;
      c.on = true;
      c._s = 0;
      if (c.tile) {
        c.fallAt = c.fallAt ?? Infinity;
        this.tiles.push(c);
      }
      if (c.type === 'box' || c.type === 'ramp') c.br = Math.hypot(c.hx, c.hz);
      else c.br = c.r;
      this.byId.set(c.id, c);
      if (c.active) this.toggles.push(c);
      if (c.move) {
        this.dynamic.push(c);
        tmp.x = c.x; tmp.y = c.y; tmp.z = c.z; tmp.yaw = c.yaw;
        c.move(0, tmp);
        c.cx = c.px = tmp.x; c.cy = c.py = tmp.y; c.cz = c.pz = tmp.z; c.cyaw = c.pyaw = tmp.yaw;
      } else {
        this._insert(c);
      }
    }
    this._tmp = tmp;
  }

  _insert(c) {
    const x0 = Math.floor((c.x - c.br) / CELL), x1 = Math.floor((c.x + c.br) / CELL);
    const z0 = Math.floor((c.z - c.br) / CELL), z1 = Math.floor((c.z + c.br) / CELL);
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const k = i * 100003 + j;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(c);
      }
  }

  // Liefert alle Kollider in der Nähe (inkl. inaktiver – Aufrufer prüft c.on).
  query(x, z, rad, out = []) {
    out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor((x - rad) / CELL), x1 = Math.floor((x + rad) / CELL);
    const z0 = Math.floor((z - rad) / CELL), z1 = Math.floor((z + rad) / CELL);
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const a = this.grid.get(i * 100003 + j);
        if (!a) continue;
        for (const c of a) {
          if (c._s === s) continue;
          c._s = s;
          out.push(c);
        }
      }
    for (const c of this.dynamic) {
      const dx = c.cx - x, dz = c.cz - z, rr = c.br + rad;
      if (dx * dx + dz * dz < rr * rr) out.push(c);
    }
    return out;
  }

  update(t) {
    const dt = t - this.t;
    this.dt = dt > 1e-4 ? dt : 1 / 60;
    this.t = t;
    const tc = Math.max(0, t); // vor dem Start (Intro) stehen alle Hindernisse still
    const tmp = this._tmp;
    for (const c of this.dynamic) {
      c.px = c.cx; c.py = c.cy; c.pz = c.cz; c.pyaw = c.cyaw;
      tmp.x = c.x; tmp.y = c.y; tmp.z = c.z; tmp.yaw = c.yaw;
      c.move(tc, tmp);
      c.cx = tmp.x; c.cy = tmp.y; c.cz = tmp.z; c.cyaw = tmp.yaw;
    }
    for (const c of this.toggles) c.on = c.active(tc);
    for (const c of this.tiles) c.on = t < c.fallAt && (!c.active || c.active(tc));
  }

  // Zustand eines Kolliders zu einer beliebigen Zeit (für Vorhersage / Rendering)
  stateAt(c, t, out = {}) {
    out.x = c.x; out.y = c.y; out.z = c.z; out.yaw = c.yaw;
    if (c.move) c.move(Math.max(0, t), out);
    return out;
  }

  // Geschwindigkeit der Kollideroberfläche an Punkt (x,z)
  velAt(c, x, z) {
    if (!c.move) return [0, 0];
    const dt = this.dt;
    let vx = (c.cx - c.px) / dt, vz = (c.cz - c.pz) / dt;
    const w = (c.cyaw - c.pyaw) / dt;
    vx += w * (z - c.cz);
    vz += -w * (x - c.cx);
    return [vx, vz];
  }

  touchTile(id, t, delay) {
    const c = this.byId.get(id);
    if (!c || !c.tile) return false;
    const at = t + delay;
    if (at < c.fallAt) {
      const fresh = c.fallAt === Infinity;
      c.fallAt = at;
      return fresh;
    }
    return false;
  }

  // Höchste Bodenoberfläche bei (x,z) zwischen yMin und yMax (oder null)
  groundAt(x, z, yMax, yMin = -1e9) {
    let best = null;
    const list = this.query(x, z, 0.1, this._q || (this._q = []));
    for (const c of list) {
      if (!c.on) continue;
      const top = surfaceTop(c, x, z);
      if (top === null) continue;
      if (top <= yMax && top >= yMin && (best === null || top > best)) best = top;
    }
    return best;
  }

  solidAt(x, y, z) {
    const list = this.query(x, z, 0.1, this._q || (this._q = []));
    for (const c of list) {
      if (!c.on || c.type === 'sphere') continue;
      const top = surfaceTop(c, x, z);
      if (top === null) continue;
      const bot = c.type === 'ramp' ? Math.min(c.y0, c.y1) - 1 : c.cy - (c.type === 'cyl' ? c.h : c.hy);
      if (y <= top && y >= bot) return true;
    }
    return false;
  }
}

function toLocal(c, x, z) {
  const dx = x - c.cx, dz = z - c.cz;
  const cs = Math.cos(c.cyaw), sn = Math.sin(c.cyaw);
  return [dx * cs - dz * sn, dx * sn + dz * cs];
}

function rampY(c, lz) {
  const f = (clamp(lz, -c.hz, c.hz) + c.hz) / (2 * c.hz);
  return c.y0 + (c.y1 - c.y0) * f + (c.cy - c.y);
}

// Oberkante des Kolliders am Punkt (x,z) oder null, falls der Punkt nicht darüber liegt
export function surfaceTop(c, x, z) {
  if (c.type === 'box') {
    const [lx, lz] = toLocal(c, x, z);
    if (Math.abs(lx) > c.hx || Math.abs(lz) > c.hz) return null;
    return c.cy + c.hy;
  }
  if (c.type === 'cyl') {
    const dx = x - c.cx, dz = z - c.cz;
    if (dx * dx + dz * dz > c.r * c.r) return null;
    return c.cy + c.h;
  }
  if (c.type === 'ramp') {
    const [lx, lz] = toLocal(c, x, z);
    if (Math.abs(lx) > c.hx || Math.abs(lz) > c.hz) return null;
    return rampY(c, lz);
  }
  if (c.type === 'sphere') {
    const dx = x - c.cx, dz = z - c.cz, d2 = dx * dx + dz * dz;
    if (d2 > c.r * c.r) return null;
    return c.cy + Math.sqrt(c.r * c.r - d2);
  }
  return null;
}

export function newPlayer(x = 0, y = 0, z = 0, yaw = 0) {
  return {
    x, y, z, vx: 0, vy: 0, vz: 0, yaw,
    grounded: false, ground: null, coyote: 0, jumpBuf: 0,
    dive: 0, diveCd: 0, stun: 0, bumpCd: 0, airT: 0, emote: 0, emoteT: 0, pushT: 0, grabbing: false,
    events: [],
  };
}

export function resetPlayer(p, x, y, z, yaw = 0) {
  p.x = x; p.y = y; p.z = z; p.yaw = yaw;
  p.vx = p.vy = p.vz = 0;
  p.grounded = false; p.ground = null;
  p.dive = 0; p.stun = 0; p.emote = 0;
}

const _list = [];

export function stepPlayer(p, inp, world, dt) {
  p.events.length = 0;
  const wasGrounded = p.grounded;

  // Von bewegten Plattformen mitnehmen
  const g = p.ground;
  if (wasGrounded && g) {
    if (g.move) {
      const dyaw = g.cyaw - g.pyaw;
      let ox = p.x - g.px, oz = p.z - g.pz;
      if (dyaw) {
        const c = Math.cos(dyaw), s = Math.sin(dyaw);
        const nx = ox * c + oz * s, nz = -ox * s + oz * c;
        ox = nx; oz = nz;
        p.yaw += dyaw;
      }
      p.x = g.cx + ox; p.z = g.cz + oz; p.y += g.cy - g.py;
    }
    if (g.conveyor) {
      const cs = Math.cos(g.cyaw), sn = Math.sin(g.cyaw);
      p.x += (g.conveyor[0] * cs + g.conveyor[1] * sn) * dt;
      p.z += (-g.conveyor[0] * sn + g.conveyor[1] * cs) * dt;
    }
  }

  p.stun = Math.max(0, p.stun - dt);
  p.dive = Math.max(0, p.dive - dt);
  p.diveCd = Math.max(0, p.diveCd - dt);
  p.bumpCd = Math.max(0, p.bumpCd - dt);
  p.pushT = Math.max(0, (p.pushT || 0) - dt);
  p.jumpBuf = Math.max(0, p.jumpBuf - dt);
  p.coyote = wasGrounded ? PHYS.coyote : Math.max(0, p.coyote - dt);
  if (p.emote) { p.emoteT -= dt; if (p.emoteT <= 0) p.emote = 0; }

  let mx = inp.mx || 0, mz = inp.mz || 0;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  if (ml > 0.1) p.emote = 0;

  // Horizontale Bewegung
  const control = p.dive > 0 ? 0 : p.stun > 0 ? 0.12 : 1;
  if (control > 0) {
    const sm = inp.speedMul ?? 1;
    let tx = mx * PHYS.speed * sm, tz = mz * PHYS.speed * sm;
    // In der Luft: Schwung (Sprungpad, Hechtsprung) nicht abbremsen, nur lenken
    if (!wasGrounded && ml > 0.1) {
      const hs = Math.hypot(p.vx, p.vz), ts = Math.hypot(tx, tz);
      if (hs > ts && ts > 0) { tx *= hs / ts; tz *= hs / ts; }
    }
    const rate = (wasGrounded ? PHYS.accel : PHYS.airAccel) * control * dt;
    if (wasGrounded || ml > 0.1) {
      let dvx = tx - p.vx, dvz = tz - p.vz;
      const dl = Math.hypot(dvx, dvz);
      if (dl > rate) { dvx *= rate / dl; dvz *= rate / dl; }
      p.vx += dvx; p.vz += dvz;
    }
  } else if (wasGrounded) {
    // Rutschen nach Hechtsprung / Stolpern
    const f = Math.max(0, 1 - 4 * dt);
    p.vx *= f; p.vz *= f;
  }

  if (ml > 0.1 && p.dive <= 0 && p.stun <= 0) {
    const target = Math.atan2(mx, mz);
    let d = target - p.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.yaw += d * Math.min(1, 14 * dt);
  }

  // Springen
  if (inp.jump) p.jumpBuf = PHYS.jumpBuffer;
  if (p.jumpBuf > 0 && !inp.noJump && (wasGrounded || p.coyote > 0) && p.dive <= 0 && p.stun < 0.2) {
    p.vy = PHYS.jumpVel;
    p.jumpBuf = 0; p.coyote = 0;
    p.grounded = false; p.ground = null;
    p.events.push('jump');
  }

  // Hechtsprung
  if (inp.dive && !inp.noJump && p.dive <= 0 && p.diveCd <= 0 && p.stun <= 0) {
    let dx = mx, dz = mz;
    if (ml < 0.1) { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); }
    else { const l = Math.hypot(dx, dz); dx /= l; dz /= l; p.yaw = Math.atan2(dx, dz); }
    p.vx = dx * PHYS.diveSpeed; p.vz = dz * PHYS.diveSpeed;
    p.vy = Math.max(p.vy, wasGrounded ? 5 : 3);
    p.dive = PHYS.diveTime; p.diveCd = PHYS.diveCooldown;
    p.grounded = false; p.ground = null;
    p.events.push('dive');
  }

  // Schwerkraft
  p.vy = Math.max(PHYS.maxFall, p.vy + PHYS.gravity * dt);

  // Integration mit Substeps
  const sp = Math.hypot(p.vx, p.vy, p.vz) * dt;
  const n = Math.min(6, Math.max(1, Math.ceil(sp / 0.22)));
  const sdt = dt / n;
  const snap = wasGrounded && p.vy <= 0 && !p.events.includes('jump') && !p.events.includes('dive');
  p.grounded = false;
  let landedOn = null;
  for (let i = 0; i < n; i++) {
    p.x += p.vx * sdt; p.y += p.vy * sdt; p.z += p.vz * sdt;
    let probe = 0;
    if (snap && i === n - 1) { probe = 0.18; p.y -= probe; }
    const r = collide(p, world, sdt);
    if (r) landedOn = r;
    if (probe && !p.grounded) p.y += probe;
  }
  if (p.grounded) {
    if (!wasGrounded && p.airT > 0.35) p.events.push('land');
    p.airT = 0;
    p.ground = landedOn;
  } else {
    p.airT += dt;
    p.ground = null;
  }
}

function collide(p, world, dt) {
  const { R } = PHYS;
  const list = world.query(p.x, p.z, R + 0.5, _list);
  let landed = null;
  for (let k = 0; k < list.length; k++) {
    const c = list[k];
    if (!c.on) continue;
    let r = null;
    if (c.type === 'box') r = colBox(p, c, world, dt);
    else if (c.type === 'cyl') r = colCyl(p, c, world, dt);
    else if (c.type === 'ramp') r = colRamp(p, c, world, dt);
    else if (c.type === 'sphere') r = colSphere(p, c, world, dt);
    if (r) landed = r;
  }
  return landed;
}

function landTol(p, c, dt) {
  return Math.max(PHYS.step, -p.vy * dt + 0.08 + Math.max(0, c.cy - c.py));
}

// Rutschige Oberseite: man kann dort nicht stehen und nicht abspringen
function slideOff(p, c, top, nx, nz) {
  p.y = top;
  if (p.vy < 0) p.vy = 0;
  const l = Math.hypot(nx, nz);
  if (l < 0.05) { nx = Math.sin(p.yaw); nz = Math.cos(p.yaw); } else { nx /= l; nz /= l; }
  p.vx = nx * 7; p.vz = nz * 7;
  p.x += nx * 0.05; p.z += nz * 0.05;
  return null;
}

function land(p, c, top) {
  p.y = top;
  if (c.pad) {
    p.vy = c.pad;
    if (c.padZ) p.vz = Math.max(p.vz, c.padZ);
    p.events.push('boing');
    p.stun = 0;
    return null;
  }
  if (p.vy < 0) p.vy = 0;
  p.grounded = true;
  if (c.tile) p.events.push('tile:' + c.id);
  return c;
}

function sideHit(p, c, world, nx, nz, push) {
  p.x += nx * push; p.z += nz * push;
  const vn = p.vx * nx + p.vz * nz;
  if (vn < 0) { p.vx -= nx * vn; p.vz -= nz * vn; }
  const [cvx, cvz] = world.velAt(c, p.x, p.z);
  const along = cvx * nx + cvz * nz;
  if (c.bounce) {
    if (p.bumpCd > 0) return;
    const k = Math.min(14, c.bounce + Math.max(0, along) * 0.55);
    p.vx = nx * k + cvx * 0.25;
    p.vz = nz * k + cvz * 0.25;
    const hv = Math.hypot(p.vx, p.vz);
    if (hv > 12) { p.vx *= 12 / hv; p.vz *= 12 / hv; }
    p.vy = Math.max(p.vy, Math.min(9, 2.5 + k * 0.35));
    p.stun = 0.55; p.dive = 0; p.bumpCd = 0.2;
    p.grounded = false;
    p.events.push('bump');
  } else if (along > 0) {
    p.vx += nx * along; p.vz += nz * along;
  }
}

function headHit(p, c, world, bot) {
  p.y = bot - PHYS.H;
  if (p.vy > 0) p.vy = 0;
  if (c.bounce && p.bumpCd <= 0) {
    const [cvx, cvz] = world.velAt(c, p.x, p.z);
    const l = Math.hypot(cvx, cvz);
    if (l > 0.5) {
      const k = c.bounce;
      p.vx = (cvx / l) * k; p.vz = (cvz / l) * k;
      p.stun = 0.55; p.bumpCd = 0.2;
      p.events.push('bump');
    }
  }
}

function colBox(p, c, world, dt) {
  const { R, H } = PHYS;
  const top = c.cy + c.hy, bot = c.cy - c.hy;
  if (p.y >= top || p.y + H <= bot) return null;
  const [lx, lz] = toLocal(c, p.x, p.z);
  const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz);
  const ddx = lx - qx, ddz = lz - qz;
  const d2 = ddx * ddx + ddz * ddz;
  if (d2 >= R * R) return null;
  if (top - p.y <= landTol(p, c, dt)) {
    if (c.noStand) {
      // entlang der kurzen Achse runterschubsen
      const cs = Math.cos(c.cyaw), sn = Math.sin(c.cyaw);
      const ax = c.hx < c.hz ? (Math.sign(lx) || 1) : 0, az = c.hx < c.hz ? 0 : (Math.sign(lz) || 1);
      return slideOff(p, c, top, ax * cs + az * sn, -ax * sn + az * cs);
    }
    return land(p, c, top);
  }
  if (p.vy > 0 && p.y + H - bot < 0.45 && d2 < 0.01) { headHit(p, c, world, bot); return null; }
  let nx, nz, push;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    nx = ddx / d; nz = ddz / d; push = R - d;
  } else {
    const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz);
    if (ex < ez) { nx = Math.sign(lx) || 1; nz = 0; push = ex + R; }
    else { nx = 0; nz = Math.sign(lz) || 1; push = ez + R; }
  }
  const cs = Math.cos(c.cyaw), sn = Math.sin(c.cyaw);
  sideHit(p, c, world, nx * cs + nz * sn, -nx * sn + nz * cs, push);
  return null;
}

function colCyl(p, c, world, dt) {
  const { R, H } = PHYS;
  const top = c.cy + c.h, bot = c.cy - c.h;
  if (p.y >= top || p.y + H <= bot) return null;
  const dx = p.x - c.cx, dz = p.z - c.cz;
  const d2 = dx * dx + dz * dz, rr = R + c.r;
  if (d2 >= rr * rr) return null;
  if (top - p.y <= landTol(p, c, dt)) return c.noStand ? slideOff(p, c, top, dx, dz) : land(p, c, top);
  const d = Math.sqrt(d2);
  if (p.vy > 0 && p.y + H - bot < 0.45 && d < c.r) { headHit(p, c, world, bot); return null; }
  const nx = d > 1e-6 ? dx / d : 0, nz = d > 1e-6 ? dz / d : 1;
  sideHit(p, c, world, nx, nz, rr - d);
  return null;
}

function colRamp(p, c, world, dt) {
  const { R, H } = PHYS;
  const [lx, lz] = toLocal(c, p.x, p.z);
  if (Math.abs(lx) > c.hx + R || Math.abs(lz) > c.hz + R) return null;
  const sy = rampY(c, lz);
  const bot = Math.min(c.y0, c.y1) - 1 + (c.cy - c.y);
  if (p.y >= sy || p.y + H <= bot) return null;
  const inside = Math.abs(lx) <= c.hx && Math.abs(lz) <= c.hz;
  if (sy - p.y <= Math.max(PHYS.step, landTol(p, c, dt))) {
    if (inside || sy - p.y < 0.2) return land(p, c, sy);
  }
  if (inside && sy - p.y <= 0.9) return land(p, c, sy);
  // Seitlich wegdrücken
  const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz);
  let ddx = lx - qx, ddz = lz - qz, d = Math.hypot(ddx, ddz), nx, nz, push;
  if (d > 1e-6) { nx = ddx / d; nz = ddz / d; push = R - d; }
  else {
    const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz);
    if (ex < ez) { nx = Math.sign(lx) || 1; nz = 0; push = ex + R; }
    else { nx = 0; nz = Math.sign(lz) || 1; push = ez + R; }
  }
  if (push <= 0) return null;
  const cs = Math.cos(c.cyaw), sn = Math.sin(c.cyaw);
  sideHit(p, c, world, nx * cs + nz * sn, -nx * sn + nz * cs, push);
  return null;
}

function colSphere(p, c, world, dt) {
  const { R, H } = PHYS;
  const cy = clamp(c.cy, p.y + R, p.y + H - R);
  const dx = p.x - c.cx, dy = cy - c.cy, dz = p.z - c.cz;
  const d2 = dx * dx + dy * dy + dz * dz, rr = R + c.r;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d, ny = dy / d, nz = dz / d;
  const push = rr - d;
  if (ny > 0.7) {
    p.y += ny * push;
    if (p.vy < 0) p.vy = 0;
    p.grounded = true;
    return c;
  }
  p.y += Math.max(0, ny) * push;
  const hl = Math.hypot(nx, nz) || 1;
  sideHit(p, c, world, nx / hl, nz / hl, push);
  return null;
}

// Spieler auseinanderschieben (weiche Kollision zwischen Bohnen)
export function pushApart(p, ox, oy, oz, strength = 1) {
  const dy = p.y - oy;
  if (Math.abs(dy) > PHYS.H * 0.9) return false;
  const dx = p.x - ox, dz = p.z - oz;
  const d2 = dx * dx + dz * dz, min = PHYS.R * 2;
  if (d2 >= min * min || d2 < 1e-8) return false;
  const d = Math.sqrt(d2);
  const push = (min - d) * 0.5 * strength;
  p.x += (dx / d) * push;
  p.z += (dz / d) * push;
  return true;
}

export function animOf(p) {
  if (p.dive > 0) return 4;
  if (p.stun > 0) return 5;
  if (p.pushT > 0) return 10;
  if (p.grabbing) return 11;
  if (!p.grounded) return p.vy > 0 ? 2 : 3;
  if (Math.hypot(p.vx, p.vz) > 1.2) return 1;
  if (p.emote) return 5 + p.emote;
  return 0;
}

// Wird geschubst: Impuls in Richtung (dx,dz)
export function applyPush(p, dx, dz, strength = 9) {
  const l = Math.hypot(dx, dz) || 1;
  p.vx = (dx / l) * strength;
  p.vz = (dz / l) * strength;
  p.vy = Math.max(p.vy, 4.5);
  p.stun = 0.5;
  p.dive = 0;
  p.grounded = false;
  p.ground = null;
}

// Festgehalten: sanft zum Festhalter ziehen
export function tether(p, gx, gz, dt) {
  const dx = gx - p.x, dz = gz - p.z;
  const d = Math.hypot(dx, dz);
  if (d <= GRAB.tether || d > 4) return;
  const k = Math.min(1, (d - GRAB.tether) * 10 * dt);
  p.x += (dx / d) * (d - GRAB.tether) * k;
  p.z += (dz / d) * (d - GRAB.tether) * k;
}

// Bester Gegner vor dem Spieler (für Schubsen/Festhalten)
export function pickFront(p, others, range) {
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  let best = null, bd = Infinity;
  for (const o of others) {
    const dx = o.x - p.x, dz = o.z - p.z, dy = o.y - p.y;
    const d = Math.hypot(dx, dz);
    if (d > range || Math.abs(dy) > 1.5 || d < 1e-3) continue;
    if ((dx * fx + dz * fz) / d < 0.35) continue;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
