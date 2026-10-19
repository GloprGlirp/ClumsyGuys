// Baut die 3D-Darstellung eines Levels aus den gemeinsamen Map-Daten.
import * as THREE from 'three';
import { textSprite } from './character.js';

const texCache = new Map();
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  const k = key + repeat.join('x');
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  texCache.set(k, t);
  return t;
}

const checker = (a, b, n = 8) => (g, w, h) => {
  const s = w / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = (x + y) % 2 ? a : b;
    g.fillRect(x * s, y * s, s, s);
  }
};
const stripes = (a, b, n = 8, diag = true) => (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  g.fillStyle = b;
  const s = w / n;
  for (let i = -n; i < n * 2; i += 2) {
    g.beginPath();
    if (diag) { g.moveTo(i * s, 0); g.lineTo((i + 1) * s, 0); g.lineTo((i + 1) * s - h, h); g.lineTo(i * s - h, h); }
    else { g.rect(0, i * s, w, s); }
    g.fill();
  }
};
const tileTop = (base, line) => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.strokeStyle = line; g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.arc(w * 0.3, h * 0.3, w * 0.12, 0, Math.PI * 2); g.fill();
};
const arrows = (g, w, h) => {
  g.fillStyle = '#3b3550'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffd23f';
  for (let i = 0; i < 2; i++) {
    const y = i * h / 2 + h / 4;
    g.beginPath(); g.moveTo(w * 0.2, y + 20); g.lineTo(w / 2, y - 20); g.lineTo(w * 0.8, y + 20); g.lineTo(w * 0.65, y + 20); g.lineTo(w / 2, y); g.lineTo(w * 0.35, y + 20); g.fill();
  }
};

function M(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts });
}

function wedgeGeometry(c) {
  const geo = new THREE.BoxGeometry(c.hx * 2, 1, c.hz * 2, 1, 1, 8);
  const pos = geo.attributes.position;
  const bottom = Math.min(c.y0, c.y1) - 1;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const f = (z + c.hz) / (2 * c.hz);
    pos.setY(i, pos.getY(i) > 0 ? c.y0 + (c.y1 - c.y0) * f : bottom);
  }
  geo.computeVertexNormals();
  return geo;
}

function materialFor(c, map, idx) {
  const k = c.kind;
  const sz = c.type === 'box' ? [Math.max(1, Math.round(c.hx / 2)), Math.max(1, Math.round(c.hz / 2))] : [2, 2];
  switch (k) {
    case 'floor': return M('#ffffff', { map: canvasTex('floor', 128, 128, checker('#fbe6ff', '#ffffff', 2), sz) });
    case 'start': return M('#ffffff', { map: canvasTex('start', 128, 128, checker('#bfe6ff', '#e9f7ff', 2), sz) });
    case 'finish': return M('#ffffff', { map: canvasTex('fin', 128, 128, checker('#ffd23f', '#fff6cf', 2), sz) });
    case 'wall': return M('#ffd1ec');
    case 'door': return M(['#ff5fa2', '#4cc9f0', '#ffd23f', '#7ed957', '#9b5de5', '#ff8a3d'][idx % 6]);
    case 'disc': return M('#ffffff', { map: canvasTex('disc', 256, 256, stripes('#b89cff', '#d9cbff', 16), [1, 1]) });
    case 'spin': return M('#ffffff', { map: canvasTex('spin', 256, 256, stripes('#5ee0c7', '#aef5e6', 12), [1, 1]) });
    case 'post': return M('#ffffff', { map: canvasTex('post', 64, 64, stripes('#ff5fa2', '#ffffff', 4, false), [1, 3]) });
    case 'sweeper': return M('#ffffff', { map: canvasTex('sweep', 128, 32, stripes('#ff3d5a', '#fff2f4', 8), [6, 1]) });
    case 'hammer': return M('#ffffff', { map: canvasTex('hammer', 128, 128, stripes('#ff7a1a', '#ffe0c2', 6), [1, 1]) });
    case 'platform': return M('#ffffff', { map: canvasTex('plat', 128, 128, tileTop('#5aa9ff', '#2f6fd1'), [1, 1]) });
    case 'ball': return M('#ffffff', { map: canvasTex('ball', 128, 64, stripes('#ff8a3d', '#ffffff', 6, false), [1, 1]), roughness: 0.3 });
    case 'conveyor': return M('#ffffff', { map: canvasTex('conv', 128, 128, arrows, [2, 6]) });
    case 'bumper': return M('#ffd23f', { emissive: '#ff9900', emissiveIntensity: 0.15, roughness: 0.3 });
    case 'pad': return M('#7ed957', { emissive: '#3c9a00', emissiveIntensity: 0.3 });
    case 'blink': return M('#ff9be0', { emissive: '#ff4fc1', emissiveIntensity: 0.15 });
    case 'stairs': return M(idx % 2 ? '#ffd1ec' : '#c9f1ff');
    case 'block': return M(['#c9f1ff', '#fff1b8', '#ffd1ec'][idx % 3]);
    case 'ramp': return M('#ffffff', { map: canvasTex('ramp', 128, 128, stripes('#ffe48a', '#fff6cf', 8, false), [1, 4]) });
    case 'tile': return M('#ffffff', { map: canvasTex('tile', 128, 128, tileTop('#64e3c4', '#2bb594'), [1, 1]) });
    default: return M('#e9e4ff');
  }
}

const HEX_COLORS = ['#ff7cc4', '#ffcf4d', '#55d6ff'];

export class Level {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.dyn = [];
    this.toggles = [];
    this.tiles = [];
    this.doors = [];
    this.ropes = [];
    this.hexInst = null;
    this.tmp = {};
    this.build();
  }

  build() {
    const def = this.def;
    let idx = 0;
    const hexes = def.colliders.filter((c) => c.kind === 'hex');
    for (const c of def.colliders) {
      if (c.kind === 'hex') continue;
      let geo;
      if (c.type === 'box') geo = new THREE.BoxGeometry(c.hx * 2, c.hy * 2, c.hz * 2);
      else if (c.type === 'cyl') geo = new THREE.CylinderGeometry(c.r, c.r, c.h * 2, c.kind === 'post' ? 16 : 40);
      else if (c.type === 'ramp') geo = wedgeGeometry(c);
      else if (c.type === 'sphere') geo = new THREE.SphereGeometry(c.r, 24, 16);
      const mat = materialFor(c, def, idx++);
      const mesh = new THREE.Mesh(geo, c.kind === 'blink' || c.kind === 'tile' ? mat.clone() : mat);
      mesh.position.set(c.x, c.type === 'ramp' ? 0 : c.y, c.z);
      mesh.rotation.y = c.yaw || 0;
      mesh.castShadow = c.kind !== 'floor' && c.kind !== 'start' && c.kind !== 'finish';
      mesh.receiveShadow = true;
      this.group.add(mesh);
      c.mesh = mesh;
      if (c.move) this.dyn.push(c);
      if (c.active && !c.move) this.toggles.push(c);
      if (c.tile) this.tiles.push(c);
      if (c.pivot) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), M('#8a7a9c'));
        rope.castShadow = true;
        this.group.add(rope);
        this.ropes.push({ c, rope });
      }
      if (c.kind === 'bumper' || c.kind === 'pad') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(c.r, 0.12, 8, 32), M(c.kind === 'pad' ? '#ffffff' : '#ff5fa2'));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = c.h;
        mesh.add(ring);
      }
    }
    if (hexes.length) this.buildHexes(hexes);
    for (const d of def.decor || []) this.buildDecor(d);
  }

  buildHexes(hexes) {
    const s = hexes[0].hs * 0.96;
    const geo = new THREE.CylinderGeometry(s, s, 0.6, 6);
    geo.rotateY(Math.PI / 6);
    const mat = M('#ffffff', { roughness: 0.35 });
    const inst = new THREE.InstancedMesh(geo, mat, hexes.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    hexes.forEach((c, i) => {
      c.inst = i;
      m4.makeTranslation(c.x, c.y, c.z);
      inst.setMatrixAt(i, m4);
      col.set(HEX_COLORS[c.layer % 3]);
      if ((Math.abs(Math.round(c.x * 3)) + Math.abs(Math.round(c.z * 3))) % 2) col.offsetHSL(0, 0, 0.06);
      inst.setColorAt(i, col);
      c.baseColor = col.clone();
    });
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(inst);
    this.hexInst = inst;
    this.hexes = hexes;
  }

  buildDecor(d) {
    if (d.type === 'arch') {
      const g = new THREE.Group();
      const pm = M('#ffffff', { map: canvasTex('post', 64, 64, stripes('#ff5fa2', '#ffffff', 4, false), [1, 3]) });
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 6, 16), pm);
        p.position.set(s * (d.w / 2 + 0.3), 3, 0);
        p.castShadow = true;
        g.add(p);
      }
      const banner = new THREE.Mesh(new THREE.BoxGeometry(d.w + 1.6, 1.6, 0.5), M(d.finish ? '#ffd23f' : '#4cc9f0'));
      banner.position.y = 6.2;
      banner.castShadow = true;
      g.add(banner);
      const label = textSprite(d.label, { size: 80, height: 1.2, color: '#ffffff' });
      label.position.set(0, 6.25, 0.3);
      g.add(label);
      g.position.set(d.x, d.y, d.z);
      this.group.add(g);
    } else if (d.type === 'door') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, d.d), M(['#ff5fa2', '#4cc9f0', '#ffd23f', '#7ed957', '#9b5de5', '#ff8a3d'][Math.round(d.x + 10) % 6]));
      mesh.position.set(d.x, d.y, d.z);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.doors.push({ d, mesh, broken: false, vel: null });
    } else if (d.type === 'beam') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, d.d), M('#9b5de5'));
      mesh.position.set(d.x, d.y, d.z);
      mesh.castShadow = true;
      this.group.add(mesh);
    } else if (d.type === 'gantry') {
      const mm = M('#d6ccff');
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, d.h, 0.6), mm);
        p.position.set(s * (d.w / 2 + 0.3), d.h / 2 - 0.5, d.z);
        p.castShadow = true;
        this.group.add(p);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(d.w + 1.2, 0.6, 0.8), mm);
      top.position.set(0, 9.6, d.z);
      top.castShadow = true;
      this.group.add(top);
    }
  }

  // Türen zerbrechen, wenn jemand hindurchläuft
  checkDoors(x, y, z) {
    for (const o of this.doors) {
      if (o.broken) continue;
      const d = o.d;
      if (Math.abs(x - d.x) < d.w / 2 + 0.3 && Math.abs(z - d.z) < 0.9 && y < d.y + d.h / 2) {
        o.broken = true;
        o.vel = new THREE.Vector3((Math.random() - 0.5) * 4, 6, 9);
        o.spin = (Math.random() - 0.5) * 8;
        o.mesh.castShadow = false;
        return true;
      }
    }
    return false;
  }

  update(t, world, dt) {
    const st = this.tmp;
    for (const c of this.dyn) {
      world.stateAt(c, t, st);
      const mesh = c.mesh;
      mesh.position.set(st.x, st.y, st.z);
      mesh.rotation.y = st.yaw;
      if (c.active) mesh.visible = c.active(t);
      if (c.kind === 'ball') { mesh.rotation.y = 0; mesh.rotation.x = st.z / c.r; }
      if (c.pivot) {
        const [px, py] = c.pivot;
        const th = Math.atan2(st.x - px, py - st.y);
        mesh.rotation.z = th;
      }
    }
    for (const { c, rope } of this.ropes) {
      const m = c.mesh.position;
      const [px, py, pz] = c.pivot;
      const dx = m.x - px, dy = m.y - py;
      const len = Math.hypot(dx, dy);
      rope.position.set((m.x + px) / 2, (m.y + py) / 2, pz);
      rope.scale.y = len;
      rope.rotation.z = Math.atan2(dx, -dy) + Math.PI;
    }
    for (const c of this.toggles) {
      const on = c.active(t);
      c.mesh.visible = on;
      if (c.blink && on) {
        const [P, ON, ph] = c.blink;
        const left = ON - (((t + ph) % P + P) % P);
        const warn = left < 0.9;
        c.mesh.material.emissiveIntensity = warn ? (Math.sin(t * 40) > 0 ? 0.9 : 0.1) : 0.15;
      }
    }
    // Fallende Platten (Schwingscheibe)
    for (const c of this.tiles) {
      if (c.kind === 'hex') continue;
      const warn = this.def.tileWarn || 1;
      if (c.fallAt === Infinity) continue;
      const mesh = c.mesh;
      if (t < c.fallAt - warn) continue;
      if (t < c.fallAt) {
        mesh.position.set(c.x + Math.sin(t * 50) * 0.06, c.y, c.z + Math.cos(t * 43) * 0.06);
        mesh.material.emissive.set('#ff2a2a');
        mesh.material.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 25);
      } else {
        const ft = t - c.fallAt;
        mesh.position.set(c.x, c.y - 0.5 * 25 * ft * ft, c.z);
        mesh.rotation.x = ft * 1.5;
        mesh.visible = ft < 2;
      }
    }
    // Waben
    if (this.hexInst) {
      const m4 = this.m4 || (this.m4 = new THREE.Matrix4());
      const col = this.col || (this.col = new THREE.Color());
      let dirtyM = false, dirtyC = false;
      for (const c of this.hexes) {
        if (c.fallAt === Infinity) continue;
        if (c.done) continue;
        const warn = this.def.tileWarn || 0.5;
        if (t < c.fallAt) {
          const k = 1 - Math.max(0, c.fallAt - t) / warn;
          m4.makeTranslation(c.x + Math.sin(t * 60 + c.inst) * 0.05 * k, c.y - k * 0.08, c.z);
          col.copy(c.baseColor).lerp(new THREE.Color('#ffffff'), 0.4 + 0.4 * k);
          this.hexInst.setColorAt(c.inst, col);
          dirtyC = true;
        } else {
          const ft = t - c.fallAt;
          if (ft > 1.6) { m4.makeScale(0, 0, 0); c.done = true; }
          else {
            const s = Math.max(0.01, 1 - ft * 0.6);
            m4.makeScale(s, s, s).setPosition(c.x, c.y - 0.5 * 20 * ft * ft, c.z);
          }
        }
        this.hexInst.setMatrixAt(c.inst, m4);
        dirtyM = true;
      }
      if (dirtyM) this.hexInst.instanceMatrix.needsUpdate = true;
      if (dirtyC) this.hexInst.instanceColor.needsUpdate = true;
    }
    for (const o of this.doors) {
      if (!o.broken || !o.mesh.visible) continue;
      o.vel.y -= 25 * dt;
      o.mesh.position.addScaledVector(o.vel, dt);
      o.mesh.rotation.x += o.spin * dt;
      if (o.mesh.position.y < -20) o.mesh.visible = false;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.isSprite) o.material.dispose?.();
    });
  }
}
