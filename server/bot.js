// Einfache Bot-KI: folgt Wegpunkten, springt an Kanten/Hindernissen, weicht Balken aus.
import { PHYS, surfaceTop } from '../shared/physics.js';

export const BOT_NAMES = [
  'Wackelpudding', 'Bohnenkönig', 'Purzelbaum', 'Stolperstein', 'Gummibärchen', 'Kartoffelpuffer',
  'Sockenschuss', 'Plumpsack', 'Wurstbrot', 'Hüpfdohle', 'Knallerbse', 'Brezelbube',
  'Torkeltante', 'Schwabbelbacke', 'Rumpelbohne', 'Zappelphilipp', 'Schnitzelfan', 'Plattfuß',
  'Wirbelwind', 'Kugelblitz', 'Pudding-Paul', 'Kichererbse', 'Dödel-Doris', 'Krawallo',
];

export function createAI(rnd) {
  return {
    rnd, i: 0, choice: -1, off: rnd() * 2 - 1,
    skill: 0.35 + rnd() * 0.55,
    lastX: 0, lastZ: 0, checkT: 0, waitT: 0, jumpCd: 0,
    target: null, retargetT: 0, hopT: 0,
  };
}

export function resetPathIndex(ai, def, world, z) {
  const path = def.botPath || [];
  let i = 0;
  while (i < path.length) {
    const wp = path[i];
    const wz = wp.col ? world.byId.get(wp.col).z : wp.z;
    if (wz > z + 0.5) break;
    i++;
  }
  ai.i = Math.max(0, i);
  ai.choice = -1;
}

const tmpS = {};
function overlapsAt(c, st, x, y, z) {
  const R = PHYS.R + 0.25, H = PHYS.H;
  if (c.type === 'box') {
    if (y >= st.y + c.hy || y + H <= st.y - c.hy) return false;
    const dx = x - st.x, dz = z - st.z, cs = Math.cos(st.yaw), sn = Math.sin(st.yaw);
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
    return (lx - qx) ** 2 + (lz - qz) ** 2 < R * R;
  }
  if (c.type === 'sphere') {
    const cy = Math.max(y + R, Math.min(y + H - R, st.y));
    return (x - st.x) ** 2 + (cy - st.y) ** 2 + (z - st.z) ** 2 < (R + c.r) ** 2;
  }
  if (c.type === 'cyl') {
    if (y >= st.y + c.h || y + H <= st.y - c.h) return false;
    return (x - st.x) ** 2 + (z - st.z) ** 2 < (R + c.r) ** 2;
  }
  return false;
}

// Gefahr in Kürze? Liefert 'jump' (überspringbar), 'block' (ausweichen) oder null
function danger(world, p, t, look, ax = p.x, az = p.z) {
  for (const c of world.dynamic) {
    if (!c.bounce || !c.on) continue;
    const dx = c.cx - ax, dz = c.cz - az, rr = c.br + 3;
    if (dx * dx + dz * dz > rr * rr) continue;
    world.stateAt(c, t + look, tmpS);
    if (c.active && !c.active(t + look)) continue;
    if (overlapsAt(c, tmpS, ax, p.y, az)) {
      const top = tmpS.y + (c.type === 'box' ? c.hy : c.type === 'cyl' ? c.h : c.r);
      return top < p.y + 1.6 ? 'jump' : 'block';
    }
  }
  return null;
}

// Finale (Wabenfall): nur über frische Waben laufen, über Löcher springen
const qArr = [];
function freshTile(world, x, z, y, t) {
  for (const c of world.query(x, z, 0.1, qArr)) {
    if (!c.tile || !c.on || c.fallAt - t < 0.35) continue;
    if (Math.abs(c.cy + c.h - y) > 1.2) continue;
    if (surfaceTop(c, x, z) !== null) return c;
  }
  return null;
}

function finalInput(b, world, t, dt, inp) {
  const ai = b.ai, p = b.p, rnd = ai.rnd;
  ai.retargetT -= dt;
  const tg = ai.target;
  const bad = !tg || ai.retargetT <= 0 || Math.hypot(tg.x - p.x, tg.z - p.z) < 1.0 || !tg.c.on || tg.c.fallAt - t < 0.6;
  if (bad && p.grounded) {
    let best = null, leapBest = null;
    for (let k = 0; k < 40; k++) {
      const c = world.tiles[Math.floor(rnd() * world.tiles.length)];
      if (!c.on || c.fallAt !== Infinity || Math.abs(c.cy + c.h - p.y) > 1.2) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < 2 || d > 7.5) continue;
      let clear = true;
      for (let s = 1.2; s < d - 0.8; s += 1.0) {
        const f = s / d;
        if (!freshTile(world, p.x + (c.x - p.x) * f, p.z + (c.z - p.z) * f, p.y, t)) { clear = false; break; }
      }
      if (clear) { best = c; if (rnd() < 0.5) break; }
      else if (!leapBest && d < 5.5) leapBest = c;
    }
    const c = best || leapBest;
    ai.target = c ? { x: c.x, z: c.z, c } : null;
    ai.retargetT = 1.2 + rnd() * 1.8;
  }
  if (!ai.target) return inp;
  let dx = ai.target.x - p.x, dz = ai.target.z - p.z;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  const sp = 0.85 + ai.skill * 0.15;
  inp.mx = dx * sp; inp.mz = dz * sp;
  if (p.grounded && ai.jumpCd <= 0) {
    if (!freshTile(world, p.x + dx * 1.1, p.z + dz * 1.1, p.y, t) && l < 6.5) {
      if (rnd() < 0.4 + ai.skill * 0.5) { inp.jump = true; ai.jumpCd = 0.3; }
    } else {
      ai.hopT -= dt;
      if (ai.hopT <= 0) { ai.hopT = 0.5 + rnd(); if (rnd() < ai.skill * 0.6) { inp.jump = true; ai.jumpCd = 0.3; } }
    }
  }
  return inp;
}

export function botInput(b, world, def, t, dt) {
  const ai = b.ai, p = b.p, rnd = ai.rnd;
  const inp = { mx: 0, mz: 0, jump: false, dive: false };
  ai.jumpCd = Math.max(0, ai.jumpCd - dt);
  let tx = p.x, tz = p.z;

  if (def.type === 'race') {
    const wp = (def.botPath || [])[ai.i];
    if (!wp) { tz = p.z + 10; }
    else if (wp.col) {
      const c = world.byId.get(wp.col);
      tx = c.cx; tz = c.cz;
      if (p.grounded && p.ground === c) { ai.i++; ai.choice = -1; }
    } else if (wp.choices) {
      if (ai.choice < 0) {
        let x;
        if (wp.good && rnd() < ai.skill * 0.6) x = wp.good[Math.floor(rnd() * wp.good.length)];
        else x = wp.choices[Math.floor(rnd() * wp.choices.length)];
        ai.choice = wp.choices.indexOf(x);
      }
      tx = wp.choices[ai.choice]; tz = wp.z;
      if (p.z > tz - 0.3 && Math.abs(p.x - tx) < 2.5) { ai.i++; ai.choice = -1; ai.off = rnd() * 2 - 1; }
    } else {
      tx = wp.x + ai.off * (wp.s || 0); tz = wp.z;
      if (Math.hypot(tx - p.x, tz - p.z) < 1.5 || p.z > tz + 0.5) { ai.i++; ai.off = rnd() * 2 - 1; }
    }
  } else if (def.type === 'survival' || def.type === 'lobby') {
    ai.retargetT -= dt;
    const tg = ai.target;
    const bad = !tg || ai.retargetT <= 0 || Math.hypot(tg.x - p.x, tg.z - p.z) < 1.2 || (tg.c && (!tg.c.on || tg.c.fallAt - t < 3));
    if (bad) {
      let best = null, bd = Infinity;
      const tiles = world.tiles.length ? world.tiles : world.cols;
      for (let k = 0; k < 7; k++) {
        const c = tiles[Math.floor(rnd() * tiles.length)];
        if (!c.on || (c.tile && c.fallAt - t < 4)) continue;
        if (Math.hypot(c.x, c.z) > 11.5) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < bd) { bd = d; best = c; }
      }
      ai.target = best ? { x: best.x, z: best.z, c: best } : { x: 0, z: 4 };
      ai.retargetT = 2 + rnd() * 4;
    }
    tx = ai.target.x; tz = ai.target.z;
  } else if (def.type === 'final') {
    return finalInput(b, world, t, dt, inp);
  }

  let dx = tx - p.x, dz = tz - p.z;
  const l = Math.hypot(dx, dz);
  if (l > 0.3) {
    const sp = 0.8 + ai.skill * 0.2;
    dx /= l; dz /= l;
    inp.mx = dx * sp; inp.mz = dz * sp;
  } else { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); }

  if (p.grounded && l > 0.3) {
    // Kante voraus?
    const ahead = world.groundAt(p.x + dx * 1.0, p.z + dz * 1.0, p.y + 0.6, p.y - 2.5);
    if (ahead === null) {
      let canLand = false;
      for (const d of [2.5, 3.5, 4.5, 5.5]) {
        const gy = world.groundAt(p.x + dx * d, p.z + dz * d, p.y + 1.6, p.y - 3);
        if (gy !== null) { canLand = true; break; }
      }
      if (canLand && (def.type === 'race' || def.type === 'lobby')) {
        if (rnd() < 0.3 + ai.skill * 0.5) inp.jump = true;
        ai.waitT = 0;
      } else {
        ai.waitT += dt;
        if (def.type === 'race' && ai.waitT > 4 + rnd()) { inp.jump = true; ai.waitT = 0; }
        else { inp.mx = -dx * 0.25; inp.mz = -dz * 0.25; if (def.type !== 'race') ai.retargetT = 0; }
      }
    }
    // Niedriges Hindernis voraus?
    if (world.solidAt(p.x + dx * 0.8, p.y + 0.6, p.z + dz * 0.8) && !world.solidAt(p.x + dx * 0.8, p.y + 2.3, p.z + dz * 0.8)) {
      if (ai.jumpCd <= 0 && rnd() < 0.5) { inp.jump = true; ai.jumpCd = 0.4; }
    }
  }

  // Balken & Kugeln
  if (p.grounded && ai.jumpCd <= 0) {
    const dg = danger(world, p, t, 0.22 + (1 - ai.skill) * 0.08);
    if (dg === 'jump' && rnd() < 0.35 + ai.skill * 0.6) { inp.jump = true; ai.jumpCd = 0.5; }
    else if (dg === 'block' && rnd() < ai.skill) { inp.mx = -inp.mx; inp.mz = -inp.mz; }
    else if (def.type === 'race' && l > 0.3) {
      const da = danger(world, p, t, 0.5, p.x + dx * 1.8, p.z + dz * 1.8);
      if (da === 'block' && rnd() < ai.skill) { inp.mx = 0; inp.mz = 0; }
    }
  }

  // Feststecken?
  ai.checkT += dt;
  if (ai.checkT > 1.0) {
    const moved = Math.hypot(p.x - ai.lastX, p.z - ai.lastZ);
    if (moved < 0.7 && l > 1.5 && ai.waitT === 0) {
      const wp = (def.botPath || [])[ai.i];
      if (def.type === 'race' && wp && wp.choices) {
        let n = ai.choice;
        while (n === ai.choice && wp.choices.length > 1) n = Math.floor(rnd() * wp.choices.length);
        ai.choice = n;
      } else {
        ai.off = rnd() * 2 - 1;
        ai.retargetT = 0;
        inp.jump = true;
      }
    }
    ai.checkT = 0; ai.lastX = p.x; ai.lastZ = p.z;
  }

  // Ab und zu ein Hechtsprung Richtung Ziel
  if (def.type === 'race' && p.grounded && l > 6 && rnd() < 0.002) inp.dive = true;
  return inp;
}
