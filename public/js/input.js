// Tastatur, Maus (Pointer-Lock) und Touch-Steuerung.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.zoom = 9;
    this.jumpPressed = false;
    this.divePressed = false;
    this.enabled = true;
    this.touch = { active: false, x: 0, y: 0, id: null, camId: null, lx: 0, ly: 0 };
    this.joy = { x: 0, y: 0 };
    this.onEmote = null;
    this.isTouch = matchMedia('(pointer: coarse)').matches;

    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { if (!e.repeat) this.jumpPressed = true; e.preventDefault(); }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') && !e.repeat) this.divePressed = true;
      if (/^Digit[1-4]$/.test(e.code) && this.onEmote) this.onEmote(+e.code.slice(5));
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (!this.isTouch && this.enabled && this.wantLock && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.camYaw -= e.movementX * 0.0032;
        this.camPitch = Math.max(-0.35, Math.min(1.25, this.camPitch + e.movementY * 0.0028));
      } else if (this.dragging) {
        this.camYaw -= (e.clientX - this.dragX) * 0.006;
        this.camPitch = Math.max(-0.35, Math.min(1.25, this.camPitch + (e.clientY - this.dragY) * 0.005));
        this.dragX = e.clientX; this.dragY = e.clientY;
      }
    });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 2 || !this.wantLock) { this.dragging = true; this.dragX = e.clientX; this.dragY = e.clientY; } });
    addEventListener('mouseup', () => (this.dragging = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.zoom = Math.max(4, Math.min(16, this.zoom + e.deltaY * 0.01)); }, { passive: true });

    if (this.isTouch) this.setupTouch();
  }

  setupTouch() {
    const pad = document.getElementById('touch');
    pad.classList.remove('hidden');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const R = 55;
    const onStart = (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest('.tbtn') || t.target.closest('#chat') || t.target.closest('.panel')) continue;
        if (t.clientX < innerWidth * 0.45 && this.touch.id === null) {
          this.touch.id = t.identifier; this.touch.x = t.clientX; this.touch.y = t.clientY;
          stick.style.left = t.clientX - 70 + 'px'; stick.style.top = t.clientY - 70 + 'px';
          stick.classList.add('on');
        } else if (this.touch.camId === null) {
          this.touch.camId = t.identifier; this.touch.lx = t.clientX; this.touch.ly = t.clientY;
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          let dx = t.clientX - this.touch.x, dy = t.clientY - this.touch.y;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx *= R / l; dy *= R / l; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.joy.x = dx / R; this.joy.y = dy / R;
        } else if (t.identifier === this.touch.camId) {
          this.camYaw -= (t.clientX - this.touch.lx) * 0.008;
          this.camPitch = Math.max(-0.35, Math.min(1.25, this.camPitch + (t.clientY - this.touch.ly) * 0.006));
          this.touch.lx = t.clientX; this.touch.ly = t.clientY;
        }
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          this.touch.id = null; this.joy.x = this.joy.y = 0;
          knob.style.transform = ''; stick.classList.remove('on');
        }
        if (t.identifier === this.touch.camId) this.touch.camId = null;
      }
    };
    this.canvas.addEventListener('touchstart', onStart, { passive: true });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    this.canvas.addEventListener('touchend', onEnd);
    this.canvas.addEventListener('touchcancel', onEnd);
    document.getElementById('btnJump').addEventListener('touchstart', (e) => { this.jumpPressed = true; e.preventDefault(); });
    document.getElementById('btnDive').addEventListener('touchstart', (e) => { this.divePressed = true; e.preventDefault(); });
  }

  // Bewegungsrichtung in Weltkoordinaten (relativ zur Kamera)
  read() {
    let f = 0, s = 0;
    if (this.enabled) {
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) s += 1;
      if (k.has('KeyD') || k.has('ArrowRight')) s -= 1;
      if (this.joy.x || this.joy.y) { f = -this.joy.y; s = -this.joy.x; }
    }
    // Kamera schaut Richtung (sin(camYaw+π), cos(camYaw+π))
    const fy = this.camYaw + Math.PI;
    const fx = Math.sin(fy), fz = Math.cos(fy);
    const sx = Math.sin(fy + Math.PI / 2), sz = Math.cos(fy + Math.PI / 2);
    const r = { mx: fx * f + sx * s, mz: fz * f + sz * s, jump: this.enabled && this.jumpPressed, dive: this.enabled && this.divePressed };
    this.jumpPressed = false;
    this.divePressed = false;
    return r;
  }
}
