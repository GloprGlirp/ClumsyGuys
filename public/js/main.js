// Clumsy Guys – Client: Menü, Netzwerk, Spielschleife, Kamera, HUD und Chat.
import * as THREE from 'three';
import { createScene } from './scene.js';
import { Character } from './character.js';
import { Level } from './level.js';
import { Input } from './input.js';
import { sfx, toggleMute, isMuted, unlockAudio } from './audio.js';
import { World, newPlayer, stepPlayer, resetPlayer, pushApart, animOf, applyPush, tether, pickFront, GRAB } from '/shared/physics.js';
import { buildMap, MAPS, checkpointIndex } from '/shared/maps.js';
import { COLORS, PATTERNS, EYES, HATS, ACCS, sanitizeLook, randomLook, sanitizeName } from '/shared/looks.js';

const $ = (id) => document.getElementById(id);
const DT = 1 / 60;
const INTERP_MS = 110;
const TYPE_LABEL = { race: 'RENNEN', survival: 'ÜBERLEBEN', final: 'FINALE', lobby: 'LOBBY' };
const EMOJI = { 1: '👋', 2: '💃', 3: '🎉', 4: '😂' };

const canvas = $('game');
const G = createScene(canvas);
const input = new Input(canvas);
const socket = io({ transports: ['websocket', 'polling'] });

// ------------------------------------------------------------------ Profil
function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('cg_profile') || 'null');
    if (p) return { name: p.name || '', look: sanitizeLook(p.look) };
  } catch {}
  return { name: '', look: sanitizeLook(randomLook()) };
}
const profile = loadProfile();
function saveProfile() { localStorage.setItem('cg_profile', JSON.stringify(profile)); }
function sendHello() { socket.emit('hello', { name: profile.name || sanitizeName(''), look: profile.look }); }

// ------------------------------------------------------------------ Uhr-Sync
let clockOffset = 0;
const now = () => Date.now() + clockOffset;
function syncClock() {
  const samples = [];
  let n = 0;
  const one = () => {
    const t0 = Date.now();
    socket.emit('tping', t0, (s) => {
      const t1 = Date.now();
      samples.push({ off: s - (t0 + t1) / 2, rtt: t1 - t0 });
      if (++n < 6) setTimeout(one, 120);
      else {
        samples.sort((a, b) => a.rtt - b.rtt);
        clockOffset = samples[0].off;
      }
    });
  };
  one();
}

// ------------------------------------------------------------------ Zustand
const S = {
  mode: 'menu',
  room: null,
  myId: null,
  def: null, world: null, level: null, mapId: null,
  startAt: 0, endAt: 0, round: null, roomPhase: 'lobby',
  me: newPlayer(0, 0, 0), meChar: null, active: false,
  prev: { x: 0, y: 0, z: 0, yaw: 0 },
  ents: new Map(),
  status: new Map(),
  cp: 0, finishSent: false, fellSent: false,
  simT: 0, acc: 0, lastSend: 0,
  spectate: null, countdownShown: null, introHidden: false,
  winners: new Set(),
  showroom: null,
  editingLook: false,
  pushCd: 0, grabCd: 0, grab: null, heldBy: null, heldUntil: 0,
};

function roundTime() { return (now() - S.startAt) / 1000; }
const inGame = () => S.round && S.def && S.def.type !== 'lobby';

// ------------------------------------------------------------------ Menü-UI
function buildMenu() {
  $('nameInput').value = profile.name;
  $('nameInput').addEventListener('input', (e) => {
    profile.name = e.target.value.slice(0, 16);
    saveProfile();
  });
  $('nameInput').addEventListener('change', () => { if (S.mode === 'room') sendHello(); });
  const sw = (el, key) => {
    el.innerHTML = '';
    for (const c of COLORS) {
      const b = document.createElement('button');
      b.className = 'sw' + (profile.look[key] === c ? ' on' : '');
      b.style.background = c;
      b.onclick = () => setLook({ [key]: c });
      el.appendChild(b);
    }
    const custom = document.createElement('label');
    custom.className = 'sw custom-color' + (!COLORS.includes(profile.look[key]) ? ' on' : '');
    const ci = document.createElement('input');
    ci.type = 'color';
    ci.value = profile.look[key];
    ci.oninput = (e) => setLook({ [key]: e.target.value }, false);
    ci.onchange = (e) => setLook({ [key]: e.target.value });
    custom.appendChild(ci);
    el.appendChild(custom);
  };
  const chips = (el, list, key) => {
    el.innerHTML = '';
    for (const o of list) {
      const b = document.createElement('button');
      b.className = 'chip' + (profile.look[key] === o.id ? ' on' : '');
      b.textContent = o.name;
      b.onclick = () => setLook({ [key]: o.id });
      el.appendChild(b);
    }
  };
  sw($('colors'), 'color');
  sw($('colors2'), 'color2');
  chips($('patterns'), PATTERNS, 'pattern');
  chips($('eyes'), EYES, 'eyes');
  chips($('hats'), HATS, 'hat');
  chips($('accs'), ACCS, 'acc');
}

let lookTimer = 0;
function setLook(patch, rebuild = true) {
  profile.look = sanitizeLook({ ...profile.look, ...patch });
  saveProfile();
  if (rebuild) buildMenu();
  clearTimeout(lookTimer);
  lookTimer = setTimeout(() => {
    rebuildShowroom();
    if (S.mode === 'room') { sendHello(); rebuildMyChar(); }
  }, rebuild ? 0 : 80);
  sfx.click();
}

function rebuildShowroom() {
  if (S.showroom) { G.scene.remove(S.showroom.group); S.showroom.dispose(); }
  S.showroom = new Character(profile.look);
  S.showroom.group.position.set(0, 0, -6);
  S.showroom.group.visible = S.mode === 'menu';
  G.scene.add(S.showroom.group);
}

function menuError(t) { $('menuErr').textContent = t || ''; }

$('btnRandom').onclick = () => setLook(randomLook());
$('btnQuick').onclick = () => { unlockAudio(); ensureName(); sendHello(); socket.emit('quick'); };
$('btnCreate').onclick = () => { unlockAudio(); ensureName(); sendHello(); socket.emit('create'); };
$('btnJoin').onclick = () => {
  unlockAudio();
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length !== 4) return menuError('Der Code hat 4 Zeichen.');
  ensureName(); sendHello(); socket.emit('join', code);
};
$('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('codeInput').value.length === 4 ? $('btnJoin') : $('btnQuick')).click(); });

function ensureName() {
  if (!profile.name.trim()) {
    profile.name = sanitizeName('');
    $('nameInput').value = profile.name;
    saveProfile();
  }
}

const invite = new URLSearchParams(location.search).get('r');
if (invite) {
  $('codeInput').value = invite.toUpperCase().slice(0, 4);
  $('btnJoin').textContent = `Raum ${$('codeInput').value} beitreten`;
  $('btnJoin').classList.add('big');
}

// ------------------------------------------------------------------ Raum-UI
$('btnLeave').onclick = () => { socket.emit('leave'); history.replaceState(null, '', '/'); toMenu(); };
$('btnStart').onclick = () => { socket.emit('start'); sfx.click(); };
$('botRange').oninput = (e) => { $('botVal').textContent = e.target.value; };
$('botRange').onchange = (e) => socket.emit('settings', { bots: +e.target.value });
$('btnCopy').onclick = async () => {
  const url = `${location.origin}/?r=${S.room.code}`;
  try { await navigator.clipboard.writeText(url); feed('Link kopiert! 📋', 'q'); }
  catch { prompt('Einladungslink:', url); }
};
$('btnLook').onclick = () => openLookEditor(true);
$('btnLookDone').onclick = () => openLookEditor(false);
$('btnMute').onclick = () => { $('btnMute').textContent = toggleMute() ? '🔇' : '🔊'; };
$('btnMute').textContent = isMuted() ? '🔇' : '🔊';
$('btnEmote').onclick = () => $('emoteMenu').classList.toggle('hidden');
for (const b of document.querySelectorAll('#emoteMenu button')) b.onclick = () => { doEmote(+b.dataset.e); $('emoteMenu').classList.add('hidden'); };
input.onEmote = (n) => doEmote(n);

function openLookEditor(on) {
  S.editingLook = on;
  $('customPanel').classList.toggle('hidden', !on && S.mode !== 'menu');
  $('btnLookDone').classList.toggle('hidden', !on);
  input.enabled = !on;
}

function toMenu() {
  S.mode = 'menu';
  S.room = null;
  S.round = null;
  $('menu').classList.remove('hidden');
  $('customPanel').classList.remove('hidden');
  $('btnLookDone').classList.add('hidden');
  $('hud').classList.add('hidden');
  for (const id of ['intro', 'results', 'gameover']) $(id).classList.add('hidden');
  clearEntities();
  if (S.meChar) S.meChar.group.visible = false;
  input.wantLock = false;
  document.exitPointerLock?.();
  loadMap({ mapId: 'lobby', seed: 1, startAt: now(), round: null, tiles: [] });
  if (S.showroom) S.showroom.group.visible = true;
}

function toRoom() {
  if (S.mode === 'room') return;
  S.mode = 'room';
  $('menu').classList.add('hidden');
  $('customPanel').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('chatLog').innerHTML = '';
  if (S.showroom) S.showroom.group.visible = false;
  input.wantLock = true;
  menuError('');
  rebuildMyChar();
}

function rebuildMyChar() {
  if (S.meChar) { G.scene.remove(S.meChar.group); S.meChar.dispose(); }
  S.meChar = new Character(profile.look, profile.name || 'Du', { self: true });
  if (S.winners.has(S.myId)) S.meChar.setCrown(true);
  G.scene.add(S.meChar.group);
}

function renderRoster() {
  const r = S.room;
  if (!r) return;
  $('roomCode').textContent = r.code;
  const list = $('playerList');
  list.innerHTML = '';
  const humans = r.players.filter((p) => !p.bot);
  for (const p of humans) {
    const d = document.createElement('div');
    d.className = 'pl' + (p.id === S.myId ? ' me' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.look.color;
    const n = document.createElement('span');
    n.textContent = (p.id === r.hostId ? '👑 ' : '') + p.name;
    d.append(dot, n);
    if (p.status === 'spectator') { const t = document.createElement('span'); t.className = 'tag'; t.textContent = 'schaut zu'; d.append(t); }
    list.appendChild(d);
  }
  const isHost = r.hostId === S.myId;
  const lobby = r.phase === 'lobby';
  $('roomBox').classList.toggle('hidden', !lobby);
  $('hostControls').classList.toggle('hidden', !isHost || !lobby);
  if (document.activeElement !== $('botRange')) {
    $('botRange').value = r.settings.bots;
    $('botVal').textContent = r.settings.bots;
  }
  const fill = Math.max(0, r.settings.bots - humans.length);
  let wait = isHost ? (fill ? `+ ${fill} Bots` : 'Ohne Bots') : 'Warte, bis der Host startet …';
  if (r.autoStartAt) wait = `Automatischer Start in <b id="autoT"></b> s`;
  $('waitMsg').innerHTML = wait;
}

// ------------------------------------------------------------------ Chat
const chatInput = $('chatInput');
function openChat() {
  $('chat').classList.add('open');
  input.enabled = false;
  chatInput.focus();
  document.exitPointerLock?.();
}
function closeChat() {
  $('chat').classList.remove('open');
  chatInput.blur();
  input.enabled = !S.editingLook;
}
addEventListener('keydown', (e) => {
  if (S.mode !== 'room') return;
  if (e.target === chatInput) {
    if (e.key === 'Enter') {
      const t = chatInput.value.trim();
      if (t) socket.emit('chat', t);
      chatInput.value = '';
      closeChat();
    } else if (e.key === 'Escape') closeChat();
    e.stopPropagation();
    return;
  }
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter' || e.key === 't' || e.key === 'T') { e.preventDefault(); openChat(); }
  if (e.key === 'm' || e.key === 'M') $('btnMute').click();
});
$('btnChatT').addEventListener('click', () => ($('chat').classList.contains('open') ? closeChat() : openChat()));

function addChat(m) {
  const d = document.createElement('div');
  d.className = 'msg' + (m.sys ? ' sys' : '');
  if (m.sys) d.textContent = m.text;
  else {
    const b = document.createElement('b');
    b.textContent = m.name + ':';
    b.style.color = m.color;
    d.append(b, document.createTextNode(m.text));
  }
  const log = $('chatLog');
  log.appendChild(d);
  while (log.children.length > 60) log.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 9000);
  if (!m.sys) {
    const ent = m.id === S.myId ? { char: S.meChar } : S.ents.get(m.id);
    ent?.char?.bubble(m.text);
    if (m.id !== S.myId) sfx.pop();
  }
}

// ------------------------------------------------------------------ Meldungen
let msgTimer = 0;
function bigMsg(text, cls = '', sub = '', ms = 1800) {
  const c = $('center');
  c.innerHTML = '';
  const d = document.createElement('div');
  d.className = 'big-msg ' + cls;
  d.textContent = text;
  c.appendChild(d);
  if (sub) { const s = document.createElement('div'); s.className = 'sub-msg'; s.textContent = sub; c.appendChild(s); }
  clearTimeout(msgTimer);
  if (ms) msgTimer = setTimeout(() => (c.innerHTML = ''), ms);
}
function feed(text, cls = '') {
  const d = document.createElement('div');
  d.className = 'feed-item ' + cls;
  d.textContent = text;
  $('feed').appendChild(d);
  while ($('feed').children.length > 5) $('feed').firstChild.remove();
  setTimeout(() => d.remove(), 3500);
}

function nameOf(id) {
  if (id === S.myId) return profile.name || 'Du';
  return S.room?.players.find((p) => p.id === id)?.name || '???';
}

// ------------------------------------------------------------------ Entitäten (andere Spieler & Bots)
function ensureEnt(id) {
  let e = S.ents.get(id);
  const info = S.room?.players.find((p) => p.id === id);
  if (!info) return e || null;
  const key = info.name + JSON.stringify(info.look);
  if (!e || e.key !== key) {
    if (e) { G.scene.remove(e.char.group); e.char.dispose(); }
    const char = new Character(info.look, info.name);
    if (S.winners.has(id)) char.setCrown(true);
    G.scene.add(char.group);
    e = { id, char, buf: e?.buf || [], key, seen: 0, bot: info.bot };
    S.ents.set(id, e);
  }
  return e;
}

function clearEntities() {
  for (const e of S.ents.values()) { G.scene.remove(e.char.group); e.char.dispose(); }
  S.ents.clear();
}

function sampleEnt(e, t) {
  const b = e.buf;
  if (!b.length) return null;
  if (t <= b[0].t) return b[0];
  for (let i = b.length - 1; i >= 0; i--) {
    if (b[i].t <= t) {
      const a = b[i], c = b[i + 1];
      if (!c) return a;
      const k = (t - a.t) / (c.t - a.t);
      let dy = c.yaw - a.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k, yaw: a.yaw + dy * k, a: k < 0.5 ? a.a : c.a };
    }
  }
  return b[0];
}

// ------------------------------------------------------------------ Level laden
function loadMap(p) {
  if (S.level) S.level.dispose();
  S.mapId = p.mapId;
  S.def = buildMap(p.mapId, p.seed);
  S.world = new World(S.def);
  S.level = new Level(G.scene, S.def);
  G.setTheme(MAPS[p.mapId]);
  for (const [id, fallAt] of p.tiles || []) {
    const c = S.world.byId.get(id);
    if (c) c.fallAt = Math.min(c.fallAt, fallAt);
  }
  S.startAt = p.startAt;
  S.endAt = p.endAt || 0;
  S.round = p.round;
  S.roomPhase = p.phase;
  S.simT = roundTime();
  S.world.update(S.simT);
  S.cp = 0; S.finishSent = false; S.fellSent = false;
  S.countdownShown = null; S.introHidden = false;
  S.spectate = null;
  for (const e of S.ents.values()) { e.buf.length = 0; e.char.group.visible = false; }
  $('center').innerHTML = '';
  for (const id of ['results', 'gameover']) $(id).classList.add('hidden');

  if (S.mode !== 'room') return;
  if (p.mapId === 'lobby') {
    S.winners.clear();
    rebuildMyChar();
    for (const e of [...S.ents.values()]) { G.scene.remove(e.char.group); e.char.dispose(); }
    S.ents.clear();
    const s = S.def.spawns[Math.floor(Math.random() * S.def.spawns.length)];
    resetPlayer(S.me, s[0] + (Math.random() - 0.5) * 2, s[1], s[2], s[3]);
    S.active = true;
    S.status.clear();
    $('intro').classList.add('hidden');
    for (const id of ['roundInfo', 'timer', 'goal']) $(id).classList.add('hidden');
    input.camYaw = S.me.yaw + Math.PI;
  } else {
    S.status.clear();
    for (const id of Object.keys(p.round.spawns)) S.status.set(id, 'playing');
    const sp = p.round.spawns[S.myId];
    S.active = !!sp;
    if (sp) {
      resetPlayer(S.me, sp[0], sp[1], sp[2], sp[3]);
      input.camYaw = sp[3] + Math.PI;
      input.camPitch = 0.3;
    }
    const meta = MAPS[p.mapId];
    $('introType').textContent = `RUNDE ${p.round.no} · ${TYPE_LABEL[meta.type]}`;
    $('introName').textContent = meta.name;
    $('introDesc').textContent = meta.desc;
    $('introGoal').textContent = goalText(true);
    $('intro').classList.toggle('hidden', roundTime() > -3);
    $('roundInfo').textContent = `${TYPE_LABEL[meta.type]} · ${meta.name}`;
    for (const id of ['roundInfo', 'timer', 'goal']) $(id).classList.remove('hidden');
  }
  if (S.meChar) S.meChar.group.visible = S.active;
  S.prev = { x: S.me.x, y: S.me.y, z: S.me.z, yaw: S.me.yaw };
}

function countStatus(st) { let n = 0; for (const v of S.status.values()) if (v === st) n++; return n; }

function goalText(intro = false) {
  const r = S.round;
  if (!r) return '';
  const type = S.def.type;
  if (type === 'race') return intro ? `Die ersten ${r.qualifyCount} von ${r.total} kommen weiter!` : `✅ ${countStatus('qualified')} / ${r.qualifyCount}`;
  const alive = countStatus('playing');
  if (type === 'survival') return intro ? (r.target ? `Überlebe, bis nur noch ${r.target} übrig sind!` : 'Überlebe bis zum Schluss!') : `👥 ${alive} übrig${r.target ? ` · Ziel ${r.target}` : ''}`;
  return intro ? (r.target ? 'Der Letzte, der steht, gewinnt die Krone!' : 'Überlebe bis die Zeit abläuft!') : `👥 ${alive} übrig`;
}

// ------------------------------------------------------------------ Socket-Events
socket.on('connect', () => {
  S.myId = socket.id;
  $('loading').classList.add('hidden');
  syncClock();
  sendHello();
  if (S.mode === 'room') { toMenu(); menuError('Verbindung war kurz weg – bitte neu beitreten.'); }
});
socket.on('disconnect', () => { if (S.mode === 'room') bigMsg('Verbindung verloren …', 'e', 'Versuche neu zu verbinden', 0); });
setInterval(() => socket.connected && syncClock(), 15000);

socket.on('err', (t) => { menuError(t); if (S.mode === 'room') feed(t, 'e'); });

socket.on('room', (r) => {
  const first = !S.room;
  S.room = r;
  for (const p of r.players) S.status.set(p.id, p.status);
  if (first) toRoom();
  renderRoster();
  for (const e of S.ents.values()) ensureEnt(e.id);
  if (first) {
    history.replaceState(null, '', `/?r=${r.code}`);
  }
});

socket.on('map', (p) => loadMap(p));

socket.on('chatlog', (log) => { $('chatLog').innerHTML = ''; log.forEach(addChat); });
socket.on('chat', addChat);

socket.on('snap', (s) => {
  if (S.mode !== 'room') return;
  for (const [id, x, y, z, yaw, a] of s.e) {
    if (id === S.myId) continue;
    const e = ensureEnt(id);
    if (!e) continue;
    e.buf.push({ t: s.t, x, y, z, yaw, a });
    if (e.buf.length > 30) e.buf.shift();
    e.seen = s.t;
  }
});

socket.on('status', ({ id, status, place }) => {
  S.status.set(id, status);
  const n = nameOf(id);
  if (status === 'qualified') {
    feed(`${n} ist ${place ? `#${place} ` : ''}im Ziel!`, 'q');
    if (id === S.myId) { bigMsg('QUALIFIZIERT!', 'q', place ? `Platz ${place}` : ''); sfx.qualify(); goSpectate(); }
  } else if (status === 'eliminated') {
    feed(`${n} ist raus!`, 'e');
    if (id === S.myId) { bigMsg('AUSGESCHIEDEN', 'e', 'Du kannst weiter zuschauen', 2500); sfx.out(); goSpectate(); }
  }
});

socket.on('tile', ([id, fallAt]) => {
  const c = S.world?.byId.get(id);
  if (c) c.fallAt = Math.min(c.fallAt, fallAt);
});

socket.on('emote', ({ id, n }) => {
  if (id === S.myId) return;
  S.ents.get(id)?.char.bubble(EMOJI[n] || '❓', 2.5);
});

socket.on('roundEnd', (r) => {
  for (const id of r.qualified) S.status.set(id, 'qualified');
  for (const id of r.eliminated) S.status.set(id, 'eliminated');
  const me = r.qualified.includes(S.myId) ? 'q' : r.eliminated.includes(S.myId) ? 'e' : null;
  const wasPlaying = S.active || S.finishSent || S.fellSent;
  S.active = false;
  if (S.meChar) S.meChar.group.visible = false;
  if (me === 'q' && S.def.type !== 'race' && wasPlaying) { bigMsg(r.final ? 'GEWONNEN!' : 'ÜBERLEBT!', 'q', '', 2200); sfx.qualify(); }
  else if (me === 'e' && S.def.type === 'race' && wasPlaying && !S.finishSent) { bigMsg('AUSGESCHIEDEN', 'e', 'Nicht rechtzeitig im Ziel', 2200); sfx.out(); }
  setTimeout(() => {
    if (S.roomPhase === 'lobby') return;
    $('resTitle').textContent = r.final ? 'Finale vorbei!' : 'Runde vorbei!';
    const fill = (el, ids) => {
      el.innerHTML = '';
      for (const id of ids) {
        const d = document.createElement('div');
        d.className = 'pl' + (id === S.myId ? ' me' : '');
        const info = S.room?.players.find((p) => p.id === id);
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = info?.look.color || '#ccc';
        const n = document.createElement('span');
        n.textContent = nameOf(id);
        d.append(dot, n);
        el.appendChild(d);
      }
      if (!ids.length) el.innerHTML = '<div class="muted">niemand</div>';
    };
    fill($('resQ'), r.qualified);
    fill($('resE'), r.eliminated);
    $('results').classList.remove('hidden');
  }, 1800);
});

socket.on('gameOver', ({ winners }) => {
  $('results').classList.add('hidden');
  S.winners = new Set(winners.map((w) => w.id));
  const iWon = S.winners.has(S.myId);
  $('goTitle').textContent = winners.length ? (iWon ? 'DU HAST GEWONNEN!' : `${winners.map((w) => w.name).join(' & ')} gewinnt!`) : 'Kein Gewinner';
  $('goSub').textContent = winners.length ? (iWon ? 'Die Krone gehört dir! 👑' : 'Nächstes Mal holst du die Krone!') : 'Alle sind rausgeflogen 🙈';
  $('gameover').classList.remove('hidden');
  if (iWon) sfx.win(); else sfx.out();
  for (const id of S.winners) S.ents.get(id)?.char.setCrown(true);
  if (iWon) S.meChar?.setCrown(true);
  const w = winners.find((x) => x.id !== S.myId && S.ents.has(x.id));
  if (w) S.spectate = w.id;
});

// ------------------------------------------------------------------ Aktionen
function doEmote(n) {
  if (S.mode !== 'room' || !S.active) return;
  S.me.emote = n;
  S.me.emoteT = 3;
  S.meChar?.bubble(EMOJI[n], 2.5);
  socket.emit('emote', n);
}

function goSpectate() {
  S.active = false;
  if (S.meChar) S.meChar.group.visible = false;
  nextSpectate();
}

function visibleEnts() {
  const t = now();
  return [...S.ents.values()].filter((e) => e.buf.length && t - e.seen < 600 && S.status.get(e.id) === 'playing');
}

function nextSpectate() {
  const list = visibleEnts();
  if (!list.length) { S.spectate = null; return; }
  const i = list.findIndex((e) => e.id === S.spectate);
  S.spectate = list[(i + 1) % list.length].id;
}
canvas.addEventListener('click', () => { if (S.mode === 'room' && !S.active && inGame()) nextSpectate(); });
addEventListener('keydown', (e) => { if (e.code === 'Space' && S.mode === 'room' && !S.active && inGame() && e.target.tagName !== 'INPUT') nextSpectate(); });

// ------------------------------------------------------------------ Schubsen (E) & Festhalten (F)
function entPos(id) {
  const e = S.ents.get(id);
  if (!e || !e.char.group.visible) return null;
  return sampleEnt(e, now() - INTERP_MS);
}

function interactables() {
  const out = [];
  for (const e of S.ents.values()) {
    if (!e.char.group.visible) continue;
    const st = S.status.get(e.id);
    if (st !== 'playing' && st !== 'lobby') continue;
    const s = sampleEnt(e, now() - INTERP_MS);
    if (s) out.push({ id: e.id, x: s.x, y: s.y, z: s.z });
  }
  return out;
}

function releaseMyGrab(tell = true) {
  if (!S.grab) return;
  if (tell) socket.emit('grab', null);
  S.grab = null;
  S.grabCd = GRAB.grabCd;
}

function handleHands(me, inp, frozen) {
  const canAct = !frozen && S.roomPhase !== 'results' && S.roomPhase !== 'gameover';
  S.pushCd = Math.max(0, S.pushCd - DT);
  S.grabCd = Math.max(0, S.grabCd - DT);
  if (S.heldBy && performance.now() > S.heldUntil) S.heldBy = null;

  if (input.takePush() && canAct && S.pushCd <= 0 && me.stun <= 0 && me.dive <= 0) {
    S.pushCd = GRAB.pushCd;
    me.pushT = 0.3;
    releaseMyGrab();
    const t = pickFront(me, interactables(), GRAB.pushRange);
    if (t) { socket.emit('push', t.id); S.ents.get(t.id)?.char.hit(); sfx.bump(); }
    else sfx.whoosh();
  }

  const holding = input.grabHeld() && canAct && me.stun <= 0;
  if (S.grab) {
    const g = entPos(S.grab.target);
    const tooFar = !g || Math.hypot(g.x - me.x, g.z - me.z) > 3.2;
    if (!holding || tooFar || performance.now() - S.grab.start > GRAB.grabMax * 1000) releaseMyGrab();
  } else if (holding && S.grabCd <= 0) {
    const t = pickFront(me, interactables(), GRAB.grabRange);
    if (t) {
      S.grab = { target: t.id, start: performance.now() };
      socket.emit('grab', t.id);
      sfx.grab();
    }
  }
  me.grabbing = holding;
  if (S.heldBy) { inp.speedMul = GRAB.heldSpeed; inp.noJump = true; }
  else if (S.grab) inp.speedMul = GRAB.holdSpeed;
}

socket.on('pushed', ({ dx, dz }) => {
  if (!S.active) return;
  applyPush(S.me, dx, dz);
  releaseMyGrab();
  S.meChar?.hit();
  sfx.bump();
});
socket.on('grabbed', ({ by, on }) => {
  if (on) {
    S.heldBy = by;
    S.heldUntil = performance.now() + GRAB.grabMax * 1000 + 500;
    if (S.active) bigMsg('GEPACKT!', 'y', `${nameOf(by)} hält dich fest`, 1000);
  } else if (S.heldBy === by) S.heldBy = null;
});
socket.on('grabEnd', () => releaseMyGrab(false));
socket.on('shove', ({ from, to }) => {
  if (to !== S.myId) S.ents.get(to)?.char.hit();
});

// ------------------------------------------------------------------ Physik-Schritt
function physicsStep() {
  const t = roundTime();
  if (Math.abs(S.simT - t) > 0.25) S.simT = t;
  else S.simT += DT;
  const world = S.world;
  world.update(S.simT);
  if (!S.active || S.mode !== 'room') return;
  const me = S.me, def = S.def;
  S.prev.x = me.x; S.prev.y = me.y; S.prev.z = me.z; S.prev.yaw = me.yaw;
  const frozen = inGame() && (S.simT < 0 || S.roomPhase === 'results');
  const inp = frozen ? (input.read(), { mx: 0, mz: 0 }) : input.read();
  handleHands(me, inp, frozen);
  stepPlayer(me, inp, world, DT);
  if (S.heldBy) {
    const g = entPos(S.heldBy);
    if (g) tether(me, g.x, g.z, DT);
  }
  for (const ev of me.events) {
    if (ev === 'jump') sfx.jump();
    else if (ev === 'dive') sfx.dive();
    else if (ev === 'land') { sfx.land(); S.meChar?.landed(); }
    else if (ev === 'bump') { sfx.bump(); S.meChar?.hit(); }
    else if (ev === 'boing') sfx.boing();
    else if (ev.startsWith('tile:') && def.touchTiles && S.simT >= 0) {
      const id = ev.slice(5);
      const c = world.byId.get(id);
      if (c && c.fallAt === Infinity) { world.touchTile(id, S.simT, def.tileDelay); socket.emit('tile', id); }
    }
  }
  const rt = now() - INTERP_MS;
  for (const e of S.ents.values()) {
    if (!e.char.group.visible) continue;
    const s = sampleEnt(e, rt);
    if (s) pushApart(me, s.x, s.y, s.z, 1);
  }
  if (S.level.checkDoors(me.x, me.y, me.z)) sfx.door();
  if (def.type === 'race' && me.grounded) S.cp = checkpointIndex(def, me.z, S.cp);

  if (me.y < def.killY) {
    if (def.type === 'race') {
      const cp = def.checkpoints[S.cp];
      const sp = cp.s || 3;
      resetPlayer(me, cp.at[0] + (Math.random() * 2 - 1) * sp, cp.at[1] + 0.5, cp.at[2], 0);
      input.camYaw = Math.PI;
      sfx.splash();
      bigMsg('PLATSCH!', 'y', 'Zurück zum Checkpoint', 1100);
    } else if (def.type === 'lobby') {
      resetPlayer(me, (Math.random() - 0.5) * 6, 1, (Math.random() - 0.5) * 6, 0);
      sfx.splash();
    } else if (!S.fellSent && S.roomPhase !== 'results') {
      S.fellSent = true;
      socket.emit('fell');
      sfx.splash();
      goSpectate();
    }
  }
  if (def.type === 'race' && !S.finishSent && me.z >= def.finishZ && me.y >= def.finishY && S.simT > 0) {
    S.finishSent = true;
    socket.emit('finish', [me.x, me.y, me.z, me.yaw, animOf(me)]);
    bigMsg('IM ZIEL!', 'q', '', 1500);
    setTimeout(() => { if (S.active && S.finishSent) goSpectate(); }, 1500);
  }
}

// ------------------------------------------------------------------ Kamera
const camPos = new THREE.Vector3(0, 6, -10);
const camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3();
let introCamT = 0;

function updateCamera(dt, focus) {
  const cam = G.camera;
  const rt = roundTime();
  if (S.mode === 'menu') {
    const a = Math.sin(performance.now() / 4000) * 0.25;
    const mobile = innerWidth < 820;
    tmpV.set(Math.sin(a) * 5.4 + (mobile ? 1.0 : 0), 1.7, -6 - Math.cos(a) * 5.4);
    camPos.lerp(tmpV, 1 - Math.exp(-dt * 3));
    cam.position.copy(camPos);
    cam.lookAt(mobile ? 0.9 : 0, 1.0, -6);
    return;
  }
  if (inGame() && rt < -3) {
    // Kamerafahrt über die Strecke
    const k = Math.min(1, (rt + 7) / 4);
    const def = S.def;
    if (def.type === 'race') {
      const z = (def.finishZ + 10) * (1 - k) - 8;
      tmpV.set(16, 18, z - 12);
      camLook.set(0, 0, z + 8);
    } else {
      const a = k * Math.PI * 0.8 + 0.4;
      tmpV.set(Math.sin(a) * 30, 18, Math.cos(a) * 30);
      camLook.set(0, -2, 0);
    }
    camPos.copy(tmpV);
    cam.position.copy(camPos);
    cam.lookAt(camLook);
    introCamT = 1;
    return;
  }
  const d = input.zoom;
  const p = input.camPitch;
  tmpV.set(Math.sin(input.camYaw) * Math.cos(p) * d, Math.sin(p) * d + 1.4, Math.cos(input.camYaw) * Math.cos(p) * d).add(focus);
  if (tmpV.y < (S.def?.slimeY ?? -8) + 1) tmpV.y = (S.def?.slimeY ?? -8) + 1;
  const k = introCamT ? 1 - Math.exp(-dt * 3) : 1 - Math.exp(-dt * 14);
  camPos.lerp(tmpV, k);
  if (introCamT && camPos.distanceTo(tmpV) < 0.5) introCamT = 0;
  cam.position.copy(camPos);
  camLook.set(focus.x, focus.y + 1.3, focus.z);
  cam.lookAt(camLook);
}

// ------------------------------------------------------------------ HUD-Updates
let hudT = 0;
function updateHud() {
  if (S.mode !== 'room') return;
  if (S.room?.autoStartAt && $('autoT')) {
    $('autoT').textContent = Math.max(0, Math.ceil((S.room.autoStartAt - now()) / 1000));
  }
  if (!inGame()) return;
  const rt = roundTime();
  if (rt >= -3 && !S.introHidden) { S.introHidden = true; $('intro').classList.add('hidden'); }
  const left = Math.max(0, (S.endAt - now()) / 1000);
  const tm = rt < 0 ? (S.endAt - S.startAt) / 1000 : left;
  $('timer').textContent = `${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`;
  $('timer').classList.toggle('low', rt > 0 && left < 15 && S.roomPhase !== 'results');
  $('goal').textContent = goalText();
  const spec = !S.active && S.roomPhase !== 'results' && S.roomPhase !== 'gameover' && rt > 0;
  $('spectate').classList.toggle('hidden', !spec);
  if (spec) $('spectate').textContent = S.spectate ? `👀 Zuschauen: ${nameOf(S.spectate)} · Klick = Wechseln` : '👀 Zuschauen';
}

function updateCountdown() {
  if (!inGame()) return;
  const rt = roundTime();
  if (rt < -3 || rt > 1.2) return;
  const n = rt < 0 ? Math.ceil(-rt) : 0;
  if (n === S.countdownShown) return;
  S.countdownShown = n;
  if (n > 0) { bigMsg(String(n), 'y', '', 900); sfx.count(); }
  else { bigMsg('LOS!', 'q', '', 900); sfx.go(); }
}

// ------------------------------------------------------------------ Hauptschleife
let last = performance.now();
const focus = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const t = performance.now();
  let dt = Math.min(0.1, (t - last) / 1000);
  last = t;

  if (S.world) {
    S.acc += dt;
    let n = 0;
    while (S.acc >= DT && n < 8) { S.acc -= DT; physicsStep(); n++; }
    if (n === 8) S.acc = 0;
  }
  const rt = roundTime();
  if (S.level) S.level.update(rt, S.world, dt);

  if (S.mode === 'menu') {
    if (S.showroom) {
      const sr = S.showroom;
      sr.group.rotation.y = Math.PI + Math.sin(t / 1600) * 0.5;
      const em = Math.floor(t / 4000) % 5;
      sr.update(dt, em === 2 ? 7 : em === 4 ? 6 : 0);
    }
    focus.set(0, 0, 0);
  } else {
    // Eigener Spieler
    const me = S.me, mc = S.meChar;
    if (mc) {
      const a = S.acc / DT;
      const px = S.prev.x + (me.x - S.prev.x) * a, py = S.prev.y + (me.y - S.prev.y) * a, pz = S.prev.z + (me.z - S.prev.z) * a;
      mc.group.position.set(px, py, pz);
      mc.group.rotation.y = me.yaw;
      mc.group.visible = S.active || S.roomPhase === 'gameover' && S.winners.has(S.myId);
      mc.update(dt, animOf(me), Math.hypot(me.vx, me.vz) / 8);
      if (S.active) focus.set(px, py, pz);
    }
    // Andere
    const rtime = now() - INTERP_MS;
    for (const e of S.ents.values()) {
      const s = sampleEnt(e, rtime);
      const vis = !!s && now() - e.seen < 600;
      e.char.group.visible = vis;
      if (!vis) continue;
      const g = e.char.group;
      const dx = s.x - g.position.x, dz = s.z - g.position.z;
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.yaw;
      e.char.update(dt, s.a, Math.hypot(dx, dz) / dt / 8);
      if (S.level.doors.length && S.level.checkDoors(s.x, s.y, s.z)) sfx.door();
    }
    if (!S.active) {
      let tgt = S.spectate && S.ents.get(S.spectate);
      if (!tgt || !tgt.char.group.visible) { if (inGame() && S.roomPhase === 'playing') nextSpectate(); tgt = S.spectate && S.ents.get(S.spectate); }
      if (tgt && tgt.char.group.visible) focus.copy(tgt.char.group.position);
      else if (S.roomPhase === 'gameover' && S.winners.has(S.myId) && mc) focus.copy(mc.group.position);
    }
    // Zustand senden
    if (S.active && t - S.lastSend > 50) {
      S.lastSend = t;
      socket.emit('st', [me.x, me.y, me.z, me.yaw, animOf(me)]);
    }
    updateCountdown();
    if (t - hudT > 200) { hudT = t; updateHud(); }
  }
  updateCamera(dt, focus);
  G.tick(t / 1000, focus);
  G.renderer.render(G.scene, G.camera);
}

// Phase-Wechsel aus Raum-Updates mitnehmen
socket.on('room', (r) => {
  S.roomPhase = r.phase;
});

// ------------------------------------------------------------------ Start
buildMenu();
rebuildShowroom();
toMenu();
openLookEditor(false);
$('customPanel').classList.remove('hidden');
frame();
