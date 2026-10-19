import { World, newPlayer, stepPlayer, resetPlayer, pushApart, animOf } from '../shared/physics.js';
import { buildMap, MAPS, RACES, SURVIVALS, FINALS, checkpointIndex } from '../shared/maps.js';
import { mulberry32, shuffle } from '../shared/rng.js';
import { randomLook, sanitizeLook } from '../shared/looks.js';
import { BOT_NAMES, createAI, botInput, resetPathIndex } from './bot.js';

export const MAX_HUMANS = 20;
export const MAX_TOTAL = 24;
const INTRO_MS = 7000;
const RESULTS_MS = 5500;
const GAMEOVER_MS = 9000;
const DT = 1 / 60;

const r2 = (v) => Math.round(v * 100) / 100;

export class Room {
  constructor(io, code, isPublic, onEmpty) {
    this.io = io;
    this.code = code;
    this.isPublic = isPublic;
    this.onEmpty = onEmpty;
    this.humans = new Map(); // socketId -> player
    this.bots = new Map();
    this.hostId = null;
    this.settings = { bots: isPublic ? 12 : 8 };
    this.chatLog = [];
    this.autoStartAt = 0;
    this.toLobby();
  }

  get channel() { return 'room:' + this.code; }

  emit(ev, data) { this.io.to(this.channel).emit(ev, data); }

  // ---------------------------------------------------------------- Spieler
  addHuman(socket) {
    const p = {
      id: socket.id, socket, bot: false,
      name: socket.data.name, look: socket.data.look,
      status: this.phase === 'lobby' ? 'lobby' : 'spectator',
      st: null, chatTimes: [], cp: 0, z: 0,
    };
    this.humans.set(socket.id, p);
    socket.join(this.channel);
    socket.data.room = this;
    if (!this.hostId) this.hostId = socket.id;
    this.sys(`${p.name} ist beigetreten`);
    this.updateAutoStart();
    this.broadcastRoom();
    socket.emit('chatlog', this.chatLog);
    socket.emit('map', this.mapPayload());
    return p;
  }

  removeHuman(id) {
    const p = this.humans.get(id);
    if (!p) return;
    this.humans.delete(id);
    p.socket.leave(this.channel);
    p.socket.data.room = null;
    if (this.hostId === id) this.hostId = this.humans.keys().next().value || null;
    if (this.humans.size === 0) { this.destroy(); return; }
    this.sys(`${p.name} hat den Raum verlassen`);
    this.updateAutoStart();
    this.broadcastRoom();
  }

  destroy() {
    clearTimeout(this.timer);
    this.dead = true;
    this.onEmpty(this);
  }

  participants() {
    return [...this.humans.values(), ...this.bots.values()].filter((e) => e.status === 'playing' || e.status === 'qualified');
  }

  roster() {
    return [...this.humans.values(), ...this.bots.values()].map((e) => ({
      id: e.id, name: e.name, look: e.look, bot: e.bot, status: e.status,
    }));
  }

  broadcastRoom() {
    this.emit('room', {
      code: this.code, isPublic: this.isPublic, hostId: this.hostId, phase: this.phase,
      settings: this.settings, players: this.roster(), autoStartAt: this.autoStartAt, now: Date.now(),
    });
  }

  updateAutoStart() {
    if (this.isPublic && this.phase === 'lobby' && this.humans.size >= 2) {
      if (!this.autoStartAt) this.autoStartAt = Date.now() + 30000;
    } else this.autoStartAt = 0;
  }

  // ---------------------------------------------------------------- Chat
  sys(text) { this.pushChat({ sys: true, text }); }

  pushChat(msg) {
    msg.ts = Date.now();
    this.chatLog.push(msg);
    if (this.chatLog.length > 40) this.chatLog.shift();
    this.emit('chat', msg);
  }

  chat(id, text) {
    const p = this.humans.get(id);
    if (!p) return;
    text = String(text ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 140);
    if (!text) return;
    const now = Date.now();
    p.chatTimes = p.chatTimes.filter((t) => now - t < 6000);
    if (p.chatTimes.length >= 5) { p.socket.emit('chat', { sys: true, text: 'Nicht so schnell! 🐌', ts: now }); return; }
    p.chatTimes.push(now);
    this.pushChat({ id, name: p.name, color: p.look.color, text });
  }

  // ---------------------------------------------------------------- Phasen
  toLobby() {
    clearTimeout(this.timer);
    this.phase = 'lobby';
    this.bots.clear();
    for (const p of this.humans.values()) { p.status = 'lobby'; p.st = null; }
    this.mapId = 'lobby';
    this.seed = 1;
    this.startAt = Date.now();
    this.def = buildMap('lobby', 1);
    this.world = new World(this.def);
    this.round = null;
    this.updateAutoStart();
  }

  mapPayload() {
    const tiles = [];
    for (const c of this.world.tiles) if (c.fallAt !== Infinity && this.def.touchTiles) tiles.push([c.id, c.fallAt]);
    return {
      mapId: this.mapId, seed: this.seed, phase: this.phase, startAt: this.startAt,
      endAt: this.round ? this.round.endAt : 0, now: Date.now(),
      round: this.round ? {
        no: this.round.no, type: this.def.type, qualifyCount: this.round.qualifyCount,
        target: this.round.target, total: this.round.total, spawns: this.round.spawns,
      } : null,
      tiles,
    };
  }

  setSettings(id, s) {
    if (id !== this.hostId || this.phase !== 'lobby') return;
    const b = Math.round(Number(s?.bots));
    if (Number.isFinite(b)) this.settings.bots = Math.max(0, Math.min(MAX_TOTAL, b));
    this.broadcastRoom();
  }

  startGame(id) {
    if (this.phase !== 'lobby') return;
    if (id && id !== this.hostId) return;
    const rnd = mulberry32((Math.random() * 2 ** 32) >>> 0);
    this.bots.clear();
    const fill = Math.min(MAX_TOTAL, this.settings.bots) - this.humans.size;
    const names = shuffle(BOT_NAMES, rnd);
    for (let i = 0; i < fill; i++) {
      const id2 = 'bot' + i;
      this.bots.set(id2, {
        id: id2, bot: true, name: names[i % names.length], look: sanitizeLook(randomLook(rnd)),
        status: 'playing', p: newPlayer(), ai: createAI(mulberry32((rnd() * 2 ** 32) >>> 0)), cp: 0,
      });
    }
    for (const p of this.humans.values()) p.status = 'playing';
    this.startCount = this.humans.size + this.bots.size;
    this.solo = this.startCount === 1;
    this.plan = process.env.CG_PLAN ? process.env.CG_PLAN.split(',') : [...shuffle(RACES, rnd), ...shuffle(SURVIVALS, rnd), FINALS[0]];
    this.roundNo = 0;
    this.autoStartAt = 0;
    this.sys('Das Spiel beginnt! Viel Glück 🍀');
    this.nextRound();
  }

  nextRound() {
    const alive = this.participants();
    for (const e of alive) e.status = 'playing';
    let mapId = this.plan.shift();
    if (!this.solo && alive.length <= 2 && MAPS[mapId].type !== 'final') mapId = FINALS[0];
    const meta = MAPS[mapId];
    const n = alive.length;
    let qualifyCount = 0, target = 0;
    if (meta.type === 'race') qualifyCount = n >= 4 ? Math.ceil(n * 0.6) : n;
    else if (meta.type === 'survival') target = this.solo ? 0 : n >= 4 ? Math.ceil(n * 0.5) : Math.max(1, n - 1);
    else target = this.solo ? 0 : 1;

    this.roundNo++;
    this.mapId = mapId;
    this.seed = (Math.random() * 2 ** 31) >>> 0;
    this.def = buildMap(mapId, this.seed);
    this.world = new World(this.def);
    this.simT = -INTRO_MS / 1000;
    const now = Date.now();
    this.startAt = now + INTRO_MS;
    const spawns = {};
    const order = shuffle(alive, mulberry32(this.seed));
    order.forEach((e, i) => {
      const s = this.def.spawns[i % this.def.spawns.length];
      spawns[e.id] = s;
      e.cp = 0; e.z = s[2];
      e.st = null;
      if (e.bot) {
        resetPlayer(e.p, s[0], s[1], s[2], s[3]);
        e.ai.i = 0; e.ai.choice = -1; e.ai.target = null; e.ai.waitT = 0;
      }
    });
    this.round = {
      no: this.roundNo, qualifyCount, target, total: n, spawns,
      endAt: this.startAt + meta.timeLimit * 1000,
      qualified: [], eliminated: [], humansDoneAt: 0, ended: false,
    };
    this.phase = 'intro';
    this.emit('map', this.mapPayload());
    this.broadcastRoom();
  }

  roundTime(now = Date.now()) { return (now - this.startAt) / 1000; }

  qualify(e) {
    if (e.status !== 'playing' || this.phase !== 'playing') return;
    e.status = 'qualified';
    this.round.qualified.push(e.id);
    this.emit('status', { id: e.id, status: 'qualified', place: this.round.qualified.length });
  }

  eliminate(e) {
    if (e.status !== 'playing') return;
    e.status = 'eliminated';
    this.round.eliminated.push(e.id);
    this.emit('status', { id: e.id, status: 'eliminated' });
  }

  endRound(reason) {
    if (this.round.ended) return;
    this.round.ended = true;
    const type = this.def.type;
    const r = this.round;
    const playing = this.participants().filter((e) => e.status === 'playing');
    const rnd = Math.random;

    if (type === 'race') {
      // Bei vorzeitigem Ende (nur noch Bots) die besten Bots nach Fortschritt nachrücken lassen
      const byProgress = playing.slice().sort((a, b) => (b.bot ? b.p.z : b.z) - (a.bot ? a.p.z : a.z));
      if (reason === 'bots') {
        while (r.qualified.length < r.qualifyCount && byProgress.length) {
          const e = byProgress.shift();
          e.status = 'qualified'; r.qualified.push(e.id);
        }
      }
      if (r.qualified.length === 0 && byProgress.length) {
        const e = byProgress[0];
        e.status = 'qualified'; r.qualified.push(e.id);
      }
      for (const e of this.participants()) if (e.status === 'playing') { e.status = 'eliminated'; r.eliminated.push(e.id); }
    } else {
      let surv = playing.slice();
      if (reason === 'bots' && !this.solo) {
        const keep = Math.max(1, r.target);
        surv = shuffle(surv, rnd);
        while (surv.length > keep) {
          const e = surv.pop();
          e.status = 'eliminated'; r.eliminated.push(e.id);
        }
      }
      for (const e of surv) { e.status = 'qualified'; r.qualified.push(e.id); }
    }

    this.phase = 'results';
    const isFinal = type === 'final';
    const remaining = this.participants().filter((e) => e.status === 'qualified');
    const over = isFinal || remaining.length === 0 || (!this.solo && remaining.length <= 1) || (this.solo && this.plan.length === 0);
    this.emit('roundEnd', { qualified: r.qualified, eliminated: r.eliminated, final: isFinal, over });
    this.broadcastRoom();
    this.timer = setTimeout(() => {
      if (this.dead) return;
      if (over) this.gameOver(remaining);
      else this.nextRound();
    }, RESULTS_MS);
  }

  gameOver(winners) {
    this.phase = 'gameover';
    const w = winners.map((e) => ({ id: e.id, name: e.name, look: e.look, bot: e.bot }));
    this.emit('gameOver', { winners: w });
    if (w.length) this.sys(`👑 ${w.map((x) => x.name).join(', ')} ${w.length > 1 ? 'gewinnen' : 'gewinnt'} die Krone!`);
    else this.sys('Diesmal gibt es keinen Gewinner …');
    this.timer = setTimeout(() => {
      if (this.dead) return;
      this.toLobby();
      this.emit('map', this.mapPayload());
      this.broadcastRoom();
    }, GAMEOVER_MS);
  }

  // ---------------------------------------------------------------- Netzwerk-Eingaben
  onState(id, s) {
    const p = this.humans.get(id);
    if (!p || !Array.isArray(s) || s.length < 5) return;
    for (let i = 0; i < 5; i++) if (!Number.isFinite(s[i])) return;
    if (p.status !== 'playing' && p.status !== 'lobby') return;
    p.st = [r2(s[0]), r2(s[1]), r2(s[2]), r2(s[3]), s[4] | 0];
    p.z = s[2];
    if (this.phase === 'playing' && this.def.type !== 'race' && s[1] < this.def.killY - 3) this.eliminate(p);
  }

  onFinish(id) {
    const p = this.humans.get(id);
    if (!p || this.phase !== 'playing' || this.def.type !== 'race') return;
    if (!p.st || p.st[2] < this.def.finishZ - 8) return;
    if (this.roundTime() < 8) return;
    this.qualify(p);
  }

  onFell(id) {
    const p = this.humans.get(id);
    if (!p || this.phase !== 'playing' || this.def.type === 'race') return;
    this.eliminate(p);
  }

  onTile(id, tileId) {
    if (!this.def.touchTiles || this.phase !== 'playing') return;
    const p = this.humans.get(id);
    if (!p || p.status !== 'playing') return;
    this.touch(String(tileId), this.roundTime());
  }

  touch(tileId, t) {
    if (this.world.touchTile(tileId, t, this.def.tileDelay)) {
      this.emit('tile', [tileId, this.world.byId.get(tileId).fallAt]);
    }
  }

  onEmote(id, n) {
    const p = this.humans.get(id);
    if (!p) return;
    n = n | 0;
    if (n < 1 || n > 4) return;
    this.emit('emote', { id, n });
  }

  // ---------------------------------------------------------------- Simulation
  tick() {
    const now = Date.now();
    if (this.phase === 'lobby' && this.autoStartAt && now >= this.autoStartAt) { this.startGame(null); return; }
    if (this.phase === 'intro' && now >= this.startAt) { this.phase = 'playing'; this.broadcastRoom(); }

    if (this.phase === 'intro' || this.phase === 'playing' || this.phase === 'results') {
      const t = this.roundTime(now);
      let steps = 0;
      while (this.simT + DT <= t && steps < 12) {
        this.simT += DT;
        steps++;
        this.world.update(this.simT);
        this.stepBots(this.simT);
      }
      if (steps === 12) this.simT = t;
      if (this.phase === 'playing') this.checkRoundEnd(now);
    } else if (this.phase === 'lobby') {
      this.world.update((now - this.startAt) / 1000);
    }
    this.sendSnapshot(now);
  }

  stepBots(t) {
    const def = this.def;
    const active = this.phase === 'playing';
    const humans = [...this.humans.values()].filter((h) => h.status === 'playing' && h.st);
    const bots = [...this.bots.values()].filter((b) => b.status === 'playing');
    for (const b of bots) {
      const inp = active ? botInput(b, this.world, def, t, DT) : { mx: 0, mz: 0 };
      stepPlayer(b.p, inp, this.world, DT);
      for (const ev of b.p.events) {
        if (ev.startsWith('tile:') && def.touchTiles && active) this.touch(ev.slice(5), t);
      }
      for (const h of humans) pushApart(b.p, h.st[0], h.st[1], h.st[2], 1);
      for (const o of bots) if (o !== b) pushApart(b.p, o.p.x, o.p.y, o.p.z, 0.5);
      if (def.type === 'race' && b.p.grounded) b.cp = checkpointIndex(def, b.p.z, b.cp);
      b.z = b.p.z;
      if (b.p.y < def.killY) {
        if (def.type === 'race') {
          const cp = def.checkpoints[b.cp];
          const s = cp.s || 3;
          resetPlayer(b.p, cp.at[0] + (b.ai.rnd() * 2 - 1) * s, cp.at[1], cp.at[2], 0);
          resetPathIndex(b.ai, def, this.world, cp.at[2]);
        } else if (active) this.eliminate(b);
        else resetPlayer(b.p, 0, 1, 0, 0);
      }
      if (active && def.type === 'race' && b.p.z >= def.finishZ && b.p.y >= def.finishY) this.qualify(b);
    }
  }

  checkRoundEnd(now) {
    const r = this.round;
    const def = this.def;
    const playing = this.participants().filter((e) => e.status === 'playing');
    const humansPlaying = playing.some((e) => !e.bot);
    if (def.type === 'race') {
      if (r.qualified.length >= r.qualifyCount) return this.endRound('done');
      if (playing.length === 0) return this.endRound('done');
    } else {
      if (playing.length <= r.target) return this.endRound('done');
    }
    if (now >= r.endAt) return this.endRound('time');
    if (!humansPlaying) {
      if (!r.humansDoneAt) r.humansDoneAt = now;
      else if (now - r.humansDoneAt > 3000) return this.endRound('bots');
    }
  }

  sendSnapshot(now) {
    const e = [];
    for (const p of this.humans.values()) {
      if (!p.st) continue;
      if (p.status !== 'playing' && p.status !== 'lobby') continue;
      e.push([p.id, ...p.st]);
    }
    for (const b of this.bots.values()) {
      if (b.status !== 'playing') continue;
      const p = b.p;
      e.push([b.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), animOf(p)]);
    }
    this.emit('snap', { t: now, e });
  }
}
