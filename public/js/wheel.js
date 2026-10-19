// Glücksrad: dreht sich und bleibt auf dem vom Server gezogenen Spiel stehen.
import { MAPS } from '/shared/maps.js';
import { sfx } from './audio.js';

const SEG_COLORS = ['#ff5fa2', '#4cc9f0', '#ffd23f', '#7ed957', '#9b5de5', '#ff8a3d', '#2ec4b6', '#f15bb5'];
const SPIN_MS = 4300;

export class Wheel {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.label = root.querySelector('.wheel-result');
    this.title = root.querySelector('.wheel-title');
    this.raf = 0;
  }

  // startOffset: wie viele ms der Drehung schon vorbei sind (bei spätem Beitritt)
  spin(wheel, roundNo, startOffset = 0) {
    cancelAnimationFrame(this.raf);
    const opts = wheel.options;
    const n = opts.length;
    const seg = (Math.PI * 2) / n;
    const pickIdx = opts.indexOf(wheel.pick);
    // Zielwinkel: Mitte des gezogenen Segments unter dem Zeiger (oben), plus ein paar Umdrehungen
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = Math.PI * 2 * 6 - (pickIdx + 0.5) * seg + jitter;
    this.title.textContent = wheel.final ? `👑 FINALE – Runde ${roundNo}` : `Runde ${roundNo} – was kommt?`;
    this.label.textContent = '';
    this.label.classList.remove('show');
    this.root.classList.remove('hidden');
    const t0 = performance.now() - startOffset;
    let lastSeg = -1;
    const frame = () => {
      const k = Math.min(1, (performance.now() - t0) / SPIN_MS);
      const e = 1 - Math.pow(1 - k, 4);
      const ang = target * e;
      this.draw(opts, ang, k >= 1 ? pickIdx : -1);
      const cur = Math.floor(((((-ang) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / seg);
      if (cur !== lastSeg && k < 1) { lastSeg = cur; sfx.tick(); }
      if (k < 1) this.raf = requestAnimationFrame(frame);
      else {
        const m = MAPS[wheel.pick];
        this.label.textContent = `${m.icon || '🎲'} ${m.name}`;
        this.label.classList.add('show');
        sfx.qualify();
      }
    };
    frame();
  }

  draw(opts, ang, winner) {
    const c = this.canvas, g = this.ctx;
    const W = c.width, R = W / 2 - 14, cx = W / 2, cy = W / 2;
    const n = opts.length, seg = (Math.PI * 2) / n;
    g.clearRect(0, 0, W, W);
    g.save();
    g.translate(cx, cy);
    // Außenring
    g.beginPath(); g.arc(0, 0, R + 10, 0, Math.PI * 2); g.fillStyle = '#2a2342'; g.fill();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath(); g.arc(Math.cos(a) * (R + 5), Math.sin(a) * (R + 5), 3.5, 0, Math.PI * 2);
      g.fillStyle = i % 2 ? '#ffd23f' : '#ffffff'; g.fill();
    }
    g.rotate(ang - Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const a0 = i * seg;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a0 + seg); g.closePath();
      g.fillStyle = SEG_COLORS[i % SEG_COLORS.length];
      if (n % SEG_COLORS.length === 1 && i === n - 1) g.fillStyle = SEG_COLORS[1];
      if (winner >= 0 && i !== winner) g.globalAlpha = 0.35;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.stroke();
      const m = MAPS[opts[i]];
      g.save();
      g.rotate(a0 + seg / 2);
      g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      const fs = n > 12 ? 15 : n > 8 ? 18 : 22;
      g.font = `900 ${fs}px Nunito, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(42,35,66,0.55)';
      const txt = `${m.name} ${m.icon || ''}`;
      g.strokeText(txt, R - 14, 0);
      g.fillText(txt, R - 14, 0);
      g.restore();
    }
    g.restore();
    // Nabe
    g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#2a2342'; g.stroke();
    g.font = '28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🎲', cx, cy + 2);
    // Zeiger oben
    g.beginPath(); g.moveTo(cx - 18, 4); g.lineTo(cx + 18, 4); g.lineTo(cx, 40); g.closePath();
    g.fillStyle = '#ff4d6d'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#2a2342'; g.stroke();
  }

  hide() {
    cancelAnimationFrame(this.raf);
    this.root.classList.add('hidden');
  }
}
