// Simuliert Bots auf allen Maps ohne Netzwerk und prüft, ob die Level spielbar sind.
import { World, newPlayer, stepPlayer, resetPlayer, pushApart } from '../shared/physics.js';
import { buildMap, checkpointIndex } from '../shared/maps.js';
import { createAI, botInput, resetPathIndex } from '../server/bot.js';
import { mulberry32 } from '../shared/rng.js';

const DT = 1 / 60;
let failed = false;

function simulate(mapId, seed, nBots, seconds) {
  const def = buildMap(mapId, seed);
  const world = new World(def);
  const rnd = mulberry32(seed);
  const bots = [];
  for (let i = 0; i < nBots; i++) {
    const s = def.spawns[i];
    const p = newPlayer(s[0], s[1], s[2], s[3]);
    bots.push({ p, ai: createAI(mulberry32((rnd() * 2 ** 32) >>> 0)), cp: 0, alive: true, done: false, falls: 0, tileTouches: 0 });
  }
  let t = 0, finished = 0;
  const finishTimes = [];
  const deaths = [];
  const t0 = performance.now();
  for (let step = 0; step < seconds * 60; step++) {
    t += DT;
    world.update(t);
    for (const b of bots) {
      if (!b.alive || b.done) continue;
      const inp = botInput(b, world, def, t, DT);
      stepPlayer(b.p, inp, world, DT);
      for (const ev of b.p.events) if (ev.startsWith('tile:') && def.touchTiles) { world.touchTile(ev.slice(5), t, def.tileDelay); b.tileTouches++; }
      for (const o of bots) if (o !== b && o.alive && !o.done) pushApart(b.p, o.p.x, o.p.y, o.p.z, 0.5);
      if (def.type === 'race' && b.p.grounded) b.cp = checkpointIndex(def, b.p.z, b.cp);
      if (b.p.y < def.killY) {
        b.falls++;
        if (def.type === 'race') {
          const cp = def.checkpoints[b.cp];
          resetPlayer(b.p, cp.at[0], cp.at[1], cp.at[2]);
          resetPathIndex(b.ai, def, world, cp.at[2]);
        } else { b.alive = false; deaths.push(t.toFixed(0)); }
      }
      if (def.type === 'race' && b.p.z >= def.finishZ && b.p.y >= def.finishY) { b.done = true; finished++; finishTimes.push(t.toFixed(1)); }
      if (!Number.isFinite(b.p.x + b.p.y + b.p.z)) { console.error('NaN-Position!'); failed = true; return; }
    }
  }
  const ms = performance.now() - t0;
  const alive = bots.filter((b) => b.alive).length;
  const falls = bots.reduce((a, b) => a + b.falls, 0);
  const prog = bots.map((b) => b.p.z.toFixed(0)).join(',');
  console.log(`${mapId.padEnd(15)} ${def.type.padEnd(8)} bots=${nBots} ${def.type === 'race' ? `im Ziel=${finished} (${finishTimes.slice(0, 5).join('s, ')}s)` : `überlebt=${alive}`} stürze=${falls}${deaths.length ? ' tode@' + deaths.join(',') : ''} cpu=${(ms / seconds).toFixed(2)}ms/s z=[${prog}]`);
  return { finished, alive };
}

// Einzelner Spieler: fällt auf den Boden und steht still?
{
  const def = buildMap('wackelweg', 1);
  const w = new World(def);
  const p = newPlayer(0, 3, 0);
  for (let i = 0; i < 120; i++) { w.update(i * DT); stepPlayer(p, { mx: 0, mz: 0 }, w, DT); }
  const ok = p.grounded && Math.abs(p.y) < 0.01;
  console.log('Landung auf Start:', ok ? 'OK' : 'FEHLER', p.y.toFixed(3), p.grounded);
  if (!ok) failed = true;
  // vorwärts laufen bis zur ersten Türreihe
  for (let i = 0; i < 180; i++) { w.update(2 + i * DT); stepPlayer(p, { mx: 0, mz: 1 }, w, DT); }
  console.log('Nach 3s laufen z =', p.z.toFixed(2), 'y =', p.y.toFixed(2));
  // Sprunghöhe
  const q = newPlayer(0, 0, 0);
  let maxY = 0;
  for (let i = 0; i < 90; i++) { w.update(i * DT); stepPlayer(q, { mx: 0, mz: 0, jump: i === 10 }, w, DT); maxY = Math.max(maxY, q.y); }
  console.log('Max. Sprunghöhe:', maxY.toFixed(2));
  // Rampe hoch
  const r = newPlayer(0, 0.5, 156);
  for (let i = 0; i < 240; i++) { w.update(30 + i * DT); stepPlayer(r, { mx: 0, mz: 1 }, w, DT); }
  console.log('Rampe: z =', r.z.toFixed(1), 'y =', r.y.toFixed(2));
  // Treppe (Kreiselchaos)
  const d2 = buildMap('kreiselchaos', 3), w2 = new World(d2);
  const s = newPlayer(0, 0, 133.5);
  for (let i = 0; i < 180; i++) { w2.update(i * DT); stepPlayer(s, { mx: 0, mz: 1 }, w2, DT); }
  console.log('Treppe: z =', s.z.toFixed(1), 'y =', s.y.toFixed(2), s.y > 3 ? 'OK' : 'FEHLER');
  if (s.y <= 3) failed = true;
}

// Keine sicheren Verstecke: auf Säule/Balken darf man nicht stehen bleiben
{
  for (const [name, x, y, z] of [['Säule', 0, 7, 0], ['oberer Balken', 0, 4, 6], ['unterer Balken', 6, 2, 0]]) {
    const w = new World(buildMap('schwingscheibe', 1));
    const p = newPlayer(x, y, z);
    let onIt = 0;
    for (let i = 0; i < 180; i++) {
      w.update(i * DT);
      stepPlayer(p, { mx: 0, mz: 0, jump: i % 20 === 0 }, w, DT);
      if (p.grounded && p.ground && p.ground.kind !== 'tile') onIt++;
    }
    const ok = onIt === 0;
    console.log(`Kein Stehen auf ${name}:`, ok ? 'OK' : `FEHLER (${onIt} Frames)`);
    if (!ok) failed = true;
  }
  // Höchster erreichbarer Punkt im Finale = oberste Wabenebene
  const def = buildMap('wabenfall', 1);
  const above = def.colliders.filter((c) => c.y + (c.h || c.hy || 0) > 0.01);
  console.log('Wabenfall – Kollider über der obersten Ebene:', above.length === 0 ? 'keine (OK)' : above.length);
  if (above.length) failed = true;
}

for (const seed of [11, 22]) {
  simulate('wackelweg', seed, 20, 150);
  simulate('kreiselchaos', seed, 20, 150);
  simulate('schwingscheibe', seed, 20, 75);
  simulate('wabenfall', seed, 20, 180);
}
if (failed) process.exit(1);
