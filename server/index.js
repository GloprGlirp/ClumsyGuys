import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Room, MAX_HUMANS } from './room.js';
import { sanitizeLook, sanitizeName, randomLook } from '../shared/looks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(root, 'public')));
app.use('/shared', express.static(path.join(root, 'shared')));
app.use('/vendor/three', express.static(path.join(root, 'node_modules/three/build')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let c;
  do c = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  while (rooms.has(c));
  return c;
}

function createRoom(isPublic) {
  const code = newCode();
  const room = new Room(io, code, isPublic, (r) => rooms.delete(r.code));
  rooms.set(code, room);
  return room;
}

function leaveCurrent(socket) {
  const r = socket.data.room;
  if (r) r.removeHuman(socket.id);
}

function joinRoom(socket, room) {
  if (room.humans.size >= MAX_HUMANS) return socket.emit('err', 'Der Raum ist voll.');
  leaveCurrent(socket);
  room.addHuman(socket);
}

io.on('connection', (socket) => {
  socket.data.name = sanitizeName('');
  socket.data.look = sanitizeLook(randomLook());

  const room = () => socket.data.room;

  socket.on('hello', (d) => {
    socket.data.name = sanitizeName(d?.name);
    socket.data.look = sanitizeLook(d?.look);
    const r = room();
    if (r) {
      const p = r.humans.get(socket.id);
      if (p) {
        p.name = socket.data.name;
        p.look = socket.data.look;
        r.broadcastRoom();
      }
    }
  });

  socket.on('quick', () => {
    let target = null;
    for (const r of rooms.values()) {
      if (r.isPublic && r.phase === 'lobby' && r.humans.size < MAX_HUMANS && (!target || r.humans.size > target.humans.size)) target = r;
    }
    joinRoom(socket, target || createRoom(true));
  });

  socket.on('create', () => joinRoom(socket, createRoom(false)));

  socket.on('join', (code) => {
    const r = rooms.get(String(code || '').toUpperCase().trim());
    if (!r) return socket.emit('err', 'Raum nicht gefunden. Code prüfen!');
    joinRoom(socket, r);
  });

  socket.on('leave', () => leaveCurrent(socket));
  socket.on('chat', (t) => room()?.chat(socket.id, t));
  socket.on('start', () => room()?.startGame(socket.id));
  socket.on('settings', (s) => room()?.setSettings(socket.id, s));
  socket.on('st', (s) => room()?.onState(socket.id, s));
  socket.on('finish', () => room()?.onFinish(socket.id));
  socket.on('fell', () => room()?.onFell(socket.id));
  socket.on('tile', (id) => room()?.onTile(socket.id, id));
  socket.on('emote', (n) => room()?.onEmote(socket.id, n));
  socket.on('tping', (_t, cb) => typeof cb === 'function' && cb(Date.now()));
  socket.on('disconnect', () => leaveCurrent(socket));
});

setInterval(() => {
  for (const r of rooms.values()) {
    try { r.tick(); } catch (e) { console.error('Tick-Fehler in Raum', r.code, e); }
  }
}, 50);

server.listen(PORT, () => console.log(`Clumsy Guys läuft auf http://localhost:${PORT}`));
