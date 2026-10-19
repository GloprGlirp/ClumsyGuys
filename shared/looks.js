// Alle Optionen für die Charakter-Anpassung (von Client-UI und Server-Validierung genutzt).
export const COLORS = [
  '#ff5fa2', '#ff8a3d', '#ffd23f', '#7ed957', '#2ec4b6', '#4cc9f0',
  '#4361ee', '#9b5de5', '#f15bb5', '#ffffff', '#3a3a4a', '#c97b4a',
];

export const PATTERNS = [
  { id: 'solid', name: 'Uni' },
  { id: 'stripes', name: 'Streifen' },
  { id: 'dots', name: 'Punkte' },
  { id: 'split', name: 'Zweiteilig' },
  { id: 'zigzag', name: 'Zickzack' },
  { id: 'stars', name: 'Sterne' },
  { id: 'belly', name: 'Bäuchlein' },
];

export const EYES = [
  { id: 'normal', name: 'Normal' },
  { id: 'happy', name: 'Fröhlich' },
  { id: 'angry', name: 'Grimmig' },
  { id: 'sleepy', name: 'Müde' },
  { id: 'cool', name: 'Sonnenbrille' },
  { id: 'cyclops', name: 'Zyklop' },
];

export const HATS = [
  { id: 'none', name: 'Keiner' },
  { id: 'cap', name: 'Kappe' },
  { id: 'tophat', name: 'Zylinder' },
  { id: 'party', name: 'Partyhut' },
  { id: 'beanie', name: 'Bommelmütze' },
  { id: 'horns', name: 'Hörner' },
  { id: 'halo', name: 'Heiligenschein' },
  { id: 'propeller', name: 'Propeller' },
  { id: 'chef', name: 'Kochmütze' },
  { id: 'antenna', name: 'Antenne' },
];

export const ACCS = [
  { id: 'none', name: 'Nichts' },
  { id: 'bowtie', name: 'Fliege' },
  { id: 'scarf', name: 'Schal' },
  { id: 'cape', name: 'Umhang' },
  { id: 'mustache', name: 'Schnurrbart' },
  { id: 'backpack', name: 'Rucksack' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const ids = (list) => list.map((x) => x.id);

export function sanitizeLook(l) {
  l = l && typeof l === 'object' ? l : {};
  const pick = (v, list, def) => (ids(list).includes(v) ? v : def);
  return {
    color: HEX.test(l.color) ? l.color.toLowerCase() : COLORS[0],
    color2: HEX.test(l.color2) ? l.color2.toLowerCase() : '#ffffff',
    pattern: pick(l.pattern, PATTERNS, 'solid'),
    eyes: pick(l.eyes, EYES, 'normal'),
    hat: pick(l.hat, HATS, 'none'),
    acc: pick(l.acc, ACCS, 'none'),
  };
}

export function randomLook(rnd = Math.random) {
  const r = (list) => list[Math.floor(rnd() * list.length)];
  let c2 = r(COLORS);
  const c1 = r(COLORS);
  if (c2 === c1) c2 = '#ffffff';
  return {
    color: c1,
    color2: c2,
    pattern: r(PATTERNS).id,
    eyes: r(EYES).id,
    hat: rnd() < 0.3 ? 'none' : r(HATS).id,
    acc: rnd() < 0.5 ? 'none' : r(ACCS).id,
  };
}

export function sanitizeName(n) {
  n = String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return n || 'Bohne' + Math.floor(Math.random() * 900 + 100);
}
