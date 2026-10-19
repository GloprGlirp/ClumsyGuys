// Bohnen-Charakter: Körper, Gesicht, Hüte, Accessoires und Animationen.
import * as THREE from 'three';

const texCache = new Map();
const matCache = new Map();

function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0, ...opts });
    matCache.set(key, m);
  }
  return m;
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function patternTexture(look) {
  const key = `${look.pattern}|${look.color}|${look.color2}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = look.color;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = look.color2;
  switch (look.pattern) {
    case 'stripes':
      for (let i = 0; i < 8; i += 2) g.fillRect(0, i * 32 + 8, 256, 26);
      break;
    case 'dots':
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.beginPath(); g.arc(x * 32 + (y % 2 ? 16 : 0) + 8, y * 32 + 16, 7, 0, Math.PI * 2); g.fill();
      }
      break;
    case 'split':
      g.fillRect(64, 0, 128, 256);
      break;
    case 'zigzag':
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        const y0 = 50 + k * 70;
        g.moveTo(0, y0);
        for (let x = 0; x <= 256; x += 16) g.lineTo(x, y0 + (x / 16) % 2 * 18);
        g.lineTo(256, y0 + 14); g.lineTo(0, y0 + 14);
        g.lineWidth = 10; g.strokeStyle = look.color2; g.stroke();
      }
      break;
    case 'stars':
      for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) star(g, x * 44 + (y % 2 ? 22 : 0) + 10, y * 52 + 26, 12);
      break;
    case 'belly':
      g.beginPath(); g.ellipse(0, 120, 60, 80, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(256, 120, 60, 80, 0, 0, Math.PI * 2); g.fill();
      break;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const G = {
  body: new THREE.CapsuleGeometry(0.45, 0.8, 8, 20),
  visor: new THREE.SphereGeometry(1, 24, 16),
  eye: new THREE.SphereGeometry(0.065, 12, 8),
  shine: new THREE.SphereGeometry(0.022, 8, 6),
  arm: new THREE.CapsuleGeometry(0.095, 0.26, 4, 10),
  leg: new THREE.CapsuleGeometry(0.12, 0.16, 4, 10),
  smile: new THREE.TorusGeometry(0.055, 0.014, 6, 14, Math.PI),
};

function m(geo, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function buildEyes(look, face) {
  const black = mat('#1d1b2c');
  const white = mat('#ffffff');
  const add = (o) => { face.add(o); return o; };
  const eyePair = (sy = 1) => {
    for (const s of [-1, 1]) {
      const e = add(m(G.eye, black, s * 0.11, 1.3, 0.455));
      e.scale.set(1, 1.25 * sy, 0.6);
      add(m(G.shine, white, s * 0.11 + 0.02, 1.33, 0.49));
    }
  };
  switch (look.eyes) {
    case 'happy':
      for (const s of [-1, 1]) {
        const a = add(m(G.smile, black, s * 0.11, 1.29, 0.46));
        a.scale.setScalar(0.9);
      }
      break;
    case 'angry': {
      eyePair();
      for (const s of [-1, 1]) {
        const b = add(m(new THREE.BoxGeometry(0.14, 0.03, 0.03), black, s * 0.11, 1.42, 0.45));
        b.rotation.z = s * 0.45;
      }
      break;
    }
    case 'sleepy':
      for (const s of [-1, 1]) {
        const e = add(m(G.eye, black, s * 0.11, 1.28, 0.455));
        e.scale.set(1.1, 0.35, 0.6);
      }
      break;
    case 'cool': {
      const lens = new THREE.BoxGeometry(0.17, 0.1, 0.04);
      for (const s of [-1, 1]) add(m(lens, mat('#14121e', { roughness: 0.1, metalness: 0.4 }), s * 0.11, 1.31, 0.47));
      add(m(new THREE.BoxGeometry(0.08, 0.02, 0.03), black, 0, 1.33, 0.47));
      break;
    }
    case 'cyclops': {
      const w = add(m(new THREE.SphereGeometry(0.11, 16, 12), white, 0, 1.31, 0.43));
      w.scale.z = 0.6;
      add(m(new THREE.SphereGeometry(0.06, 12, 8), black, 0, 1.31, 0.49));
      add(m(G.shine, white, 0.025, 1.34, 0.52));
      break;
    }
    default:
      eyePair();
  }
  if (look.acc !== 'mustache') {
    const sm = add(m(G.smile, black, 0, 1.17, 0.455));
    sm.rotation.z = Math.PI;
    sm.scale.set(0.8, 0.7, 0.6);
  }
}

function buildHat(look, head) {
  const c2 = mat(look.color2);
  const dark = mat('#26233a');
  const add = (o) => { head.add(o); return o; };
  switch (look.hat) {
    case 'cap': {
      const dome = add(m(new THREE.SphereGeometry(0.43, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c2, 0, 1.5, 0));
      dome.scale.y = 0.75;
      const brim = add(m(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), c2, 0, 1.52, 0.3));
      brim.scale.z = 1.3;
      add(m(new THREE.SphereGeometry(0.05, 8, 6), mat('#ffffff'), 0, 1.83, 0));
      break;
    }
    case 'tophat':
      add(m(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), dark, 0, 1.62, 0));
      add(m(new THREE.CylinderGeometry(0.26, 0.28, 0.48, 24), dark, 0, 1.86, 0));
      add(m(new THREE.CylinderGeometry(0.285, 0.285, 0.08, 24), c2, 0, 1.69, 0));
      break;
    case 'party': {
      const cone = add(m(new THREE.ConeGeometry(0.2, 0.5, 20), c2, 0.05, 1.86, 0));
      cone.rotation.z = -0.15;
      add(m(new THREE.SphereGeometry(0.07, 10, 8), mat('#ffffff'), 0.09, 2.11, 0));
      break;
    }
    case 'beanie': {
      const b = add(m(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c2, 0, 1.43, 0));
      b.scale.y = 0.85;
      add(m(new THREE.TorusGeometry(0.44, 0.06, 8, 24), mat('#ffffff'), 0, 1.45, 0)).rotation.x = Math.PI / 2;
      add(m(new THREE.SphereGeometry(0.11, 12, 8), mat('#ffffff'), 0, 1.84, 0));
      break;
    }
    case 'horns':
      for (const s of [-1, 1]) {
        const h = add(m(new THREE.ConeGeometry(0.07, 0.32, 12), mat('#fff6e0'), s * 0.26, 1.78, 0));
        h.rotation.z = -s * 0.5;
      }
      break;
    case 'halo': {
      const h = add(m(new THREE.TorusGeometry(0.28, 0.035, 8, 28), mat('#ffd84d', { emissive: '#ffb800', emissiveIntensity: 0.8 }), 0, 1.95, 0));
      h.rotation.x = Math.PI / 2;
      h.castShadow = false;
      break;
    }
    case 'propeller': {
      const dome = add(m(new THREE.SphereGeometry(0.43, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c2, 0, 1.5, 0));
      dome.scale.y = 0.7;
      add(m(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6), dark, 0, 1.86, 0));
      const prop = new THREE.Group();
      prop.position.set(0, 1.94, 0);
      for (const s of [-1, 1]) {
        const blade = m(new THREE.BoxGeometry(0.34, 0.015, 0.08), mat(s > 0 ? '#ff5fa2' : '#4cc9f0'), s * 0.17, 0, 0);
        prop.add(blade);
      }
      head.add(prop);
      head.userData.propeller = prop;
      break;
    }
    case 'chef': {
      const w = mat('#ffffff');
      add(m(new THREE.CylinderGeometry(0.3, 0.32, 0.3, 20), w, 0, 1.75, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(m(new THREE.SphereGeometry(0.17, 12, 8), w, Math.cos(a) * 0.17, 1.98, Math.sin(a) * 0.17));
      }
      add(m(new THREE.SphereGeometry(0.18, 12, 8), w, 0, 2.04, 0));
      break;
    }
    case 'antenna':
      add(m(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6), dark, 0, 1.88, 0));
      add(m(new THREE.SphereGeometry(0.08, 12, 8), mat(look.color2, { emissive: look.color2, emissiveIntensity: 0.6 }), 0, 2.1, 0));
      break;
  }
}

function buildAcc(look, root, char) {
  const c2 = mat(look.color2);
  switch (look.acc) {
    case 'bowtie':
      for (const s of [-1, 1]) {
        const b = m(new THREE.ConeGeometry(0.09, 0.16, 4), c2, s * 0.08, 0.98, 0.43);
        b.rotation.z = s * Math.PI / 2;
        root.add(b);
      }
      root.add(m(new THREE.SphereGeometry(0.04, 8, 6), c2, 0, 0.98, 0.45));
      break;
    case 'scarf': {
      const t = m(new THREE.TorusGeometry(0.43, 0.08, 8, 24), c2, 0, 1.02, 0);
      t.rotation.x = Math.PI / 2;
      root.add(t);
      const end = m(new THREE.BoxGeometry(0.14, 0.38, 0.06), c2, 0.2, 0.82, 0.42);
      end.rotation.z = 0.15;
      root.add(end);
      break;
    }
    case 'cape': {
      const geo = new THREE.CylinderGeometry(0.42, 0.62, 1.1, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8);
      const cape = m(geo, mat(look.color2, { side: THREE.DoubleSide }), 0, 0.85, -0.05);
      root.add(cape);
      char.cape = cape;
      break;
    }
    case 'mustache':
      for (const s of [-1, 1]) {
        const mu = m(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), mat('#3b2a20'), s * 0.08, 1.17, 0.46);
        mu.rotation.z = Math.PI / 2 + s * 0.35;
        root.add(mu);
      }
      break;
    case 'backpack': {
      const bp = m(new THREE.BoxGeometry(0.5, 0.55, 0.25), c2, 0, 0.9, -0.45);
      root.add(bp);
      root.add(m(new THREE.BoxGeometry(0.36, 0.2, 0.08), mat('#ffffff'), 0, 0.78, -0.59));
      break;
    }
  }
}

export function makeCrown() {
  const g = new THREE.Group();
  const gold = mat('#ffcc33', { metalness: 0.6, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.3 });
  g.add(m(new THREE.CylinderGeometry(0.3, 0.27, 0.16, 20, 1, true), gold));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sp = m(new THREE.ConeGeometry(0.06, 0.18, 6), gold, Math.cos(a) * 0.28, 0.16, Math.sin(a) * 0.28);
    g.add(sp);
    g.add(m(new THREE.SphereGeometry(0.035, 8, 6), mat(['#ff3d7f', '#4cc9f0', '#7ed957'][i % 3]), Math.cos(a) * 0.28, 0.27, Math.sin(a) * 0.28));
  }
  g.position.y = 1.78;
  return g;
}

function textSprite(text, opts = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `${opts.weight || 800} ${opts.size || 44}px Nunito, sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w; c.height = (opts.size || 44) + 28;
  g.font = font;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (opts.bg) {
    g.fillStyle = opts.bg;
    const r = 18;
    g.beginPath(); g.roundRect(2, 2, w - 4, c.height - 4, r); g.fill();
  }
  g.lineWidth = 8; g.strokeStyle = opts.stroke || 'rgba(30,20,60,0.85)';
  if (!opts.bg) g.strokeText(text, w / 2, c.height / 2);
  g.fillStyle = opts.color || '#fff';
  g.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const h = opts.height || 0.32;
  sp.scale.set((h * c.width) / c.height, h, 1);
  sp.renderOrder = 10;
  return sp;
}

export class Character {
  constructor(look, name = null, opts = {}) {
    this.look = look;
    this.group = new THREE.Group();
    this.root = new THREE.Group(); // kippt beim Hechtsprung
    this.group.add(this.root);
    this.t = Math.random() * 10;
    this.anim = 0;
    this.squash = 0;
    const bodyMat = new THREE.MeshStandardMaterial({ map: patternTexture(look), roughness: 0.4 });
    this.bodyMat = bodyMat;
    const body = m(G.body, bodyMat, 0, 0.85, 0);
    this.body = body;
    this.root.add(body);
    const visor = m(G.visor, mat('#ffeedd', { roughness: 0.3 }), 0, 1.28, 0.3);
    visor.scale.set(0.3, 0.2, 0.17);
    this.root.add(visor);
    this.face = new THREE.Group();
    this.root.add(this.face);
    buildEyes(look, this.face);
    this.head = new THREE.Group();
    this.root.add(this.head);
    buildHat(look, this.head);
    buildAcc(look, this.root, this);

    const limbMat = mat(look.color);
    this.arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.47, 1.08, 0);
      const a = m(G.arm, limbMat, 0, -0.2, 0);
      pivot.add(a);
      this.root.add(pivot);
      return pivot;
    });
    this.legs = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.19, 0.3, 0);
      const l = m(G.leg, limbMat, 0, -0.2, 0);
      pivot.add(l);
      this.root.add(pivot);
      return pivot;
    });
    if (name) {
      this.tag = textSprite(name, { size: 40, height: 0.3, color: opts.self ? '#ffe45c' : '#ffffff' });
      this.tag.position.y = 2.45;
      this.group.add(this.tag);
    }
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  setCrown(on) {
    if (on && !this.crown) {
      this.crown = makeCrown();
      this.head.visible = false;
      this.root.add(this.crown);
    }
  }

  bubble(text, dur = 5) {
    if (this.bubbleSprite) this.group.remove(this.bubbleSprite);
    const short = text.length > 40 ? text.slice(0, 38) + '…' : text;
    this.bubbleSprite = textSprite(short, { size: 36, height: 0.36, bg: 'rgba(255,255,255,0.95)', color: '#2a2342', weight: 700 });
    this.bubbleSprite.position.y = 2.9;
    this.group.add(this.bubbleSprite);
    this.bubbleUntil = performance.now() + dur * 1000;
  }

  hit() { this.squash = -0.35; }
  landed() { this.squash = 0.3; }

  // anim: 0 idle 1 run 2 jump 3 fall 4 dive 5 stun 6-9 emotes
  update(dt, anim, speed = 1) {
    this.t += dt;
    const t = this.t;
    const k = Math.min(1, dt * 14);
    const L = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    let armX = 0, armZ = 0.15, legX = 0, rootX = 0, rootY = 0, rootZ = 0, bob = 0, twist = 0;
    const [aL, aR] = this.arms, [lL, lR] = this.legs;
    let aLx = 0, aRx = 0, aLz = 0.15, aRz = -0.15, lLx = 0, lRx = 0;
    switch (anim) {
      case 1: {
        const w = t * 13 * Math.max(0.6, speed);
        lLx = Math.sin(w) * 0.9; lRx = -lLx;
        aLx = -lLx * 0.8; aRx = lLx * 0.8;
        bob = Math.abs(Math.sin(w)) * 0.07;
        rootX = 0.12;
        break;
      }
      case 2:
        aLz = 2.6; aRz = -2.6; lLx = -0.6; lRx = 0.3;
        break;
      case 3:
        aLz = 2.0 + Math.sin(t * 20) * 0.5; aRz = -2.0 - Math.cos(t * 20) * 0.5;
        lLx = Math.sin(t * 15) * 0.5; lRx = -lLx;
        break;
      case 4:
        rootX = 1.45; aLx = -2.9; aRx = -2.9; lLx = 0.3; lRx = 0.3; rootY = -0.35;
        break;
      case 5:
        rootZ = Math.sin(t * 18) * 0.25; aLz = 1.4 + Math.sin(t * 25); aRz = -1.4 - Math.cos(t * 25);
        twist = t * 6;
        break;
      case 6: // winken
        aRz = -2.6 + Math.sin(t * 12) * 0.4; aRx = 0;
        break;
      case 7: // tanzen
        bob = Math.abs(Math.sin(t * 8)) * 0.18;
        rootZ = Math.sin(t * 8) * 0.18;
        aLz = 1.2 + Math.sin(t * 8) * 0.8; aRz = -1.2 + Math.sin(t * 8) * 0.8;
        lLx = Math.sin(t * 8) * 0.4; lRx = -lLx;
        break;
      case 8: // jubeln
        bob = Math.abs(Math.sin(t * 9)) * 0.3;
        aLz = 2.8; aRz = -2.8;
        break;
      case 9: // lachen
        rootX = -0.25 + Math.sin(t * 22) * 0.06;
        aLx = -0.6; aRx = -0.6; aLz = 0.6; aRz = -0.6;
        break;
      default:
        bob = Math.sin(t * 2.5) * 0.015;
        aLz = 0.15 + Math.sin(t * 2.5) * 0.04; aRz = -aLz;
    }
    L(aL.rotation, 'x', aLx); L(aR.rotation, 'x', aRx);
    L(aL.rotation, 'z', aLz); L(aR.rotation, 'z', aRz);
    L(lL.rotation, 'x', lLx); L(lR.rotation, 'x', lRx);
    L(this.root.rotation, 'x', rootX);
    L(this.root.rotation, 'z', rootZ);
    this.root.rotation.y = anim === 5 ? Math.sin(twist) * 0.4 : this.root.rotation.y * (1 - k);
    L(this.root.position, 'y', rootY + bob);
    // Squash & Stretch
    this.squash *= Math.max(0, 1 - dt * 8);
    const s = this.squash;
    this.root.scale.set(1 + s * 0.4, 1 - s * 0.6, 1 + s * 0.4);
    if (this.head.userData.propeller) this.head.userData.propeller.rotation.y += dt * (anim === 2 || anim === 3 ? 30 : 8);
    if (this.cape) this.cape.rotation.x = -0.1 - (anim === 1 ? 0.35 : 0) - (anim === 3 ? 0.5 : 0) + Math.sin(t * 5) * 0.04;
    if (this.bubbleSprite && performance.now() > this.bubbleUntil) {
      this.group.remove(this.bubbleSprite);
      this.bubbleSprite.material.map.dispose();
      this.bubbleSprite = null;
    }
  }

  dispose() {
    this.bodyMat.dispose();
    if (this.tag) this.tag.material.map.dispose();
    if (this.bubbleSprite) this.bubbleSprite.material.map.dispose();
  }
}

export { textSprite };
