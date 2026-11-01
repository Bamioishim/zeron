// Tile maps for the town hub and the dungeon levels. Pure data + helpers (no DOM).
export const TS = 16
export type Kind = 'market' | 'forge' | 'arena' | 'board' | 'names' | 'gate' | 'talk'
export interface Npc { kind: Kind; sprite: string; label: string; x: number; y: number; stall?: string; line?: string }
export interface Foe { idx: number; sprite: string; x: number; y: number; room: [number, number, number, number]; boss: boolean }
export interface MapDef { theme: 'town' | 'dungeon'; w: number; h: number; tiles: string[][]; start: { x: number; y: number }; npcs: Npc[]; foes: Foe[]; lock?: { x: number; y: number } }

// Market town: stalls are generated around each keeper (awning row above, shelves beside, counter in front).
// Legend: # wall, F torch, B banner, D dungeon gate, . cobbles, , flagstones, ~ fountain, l lamp post, f flower box, c crate, b barrel
const TOWN = [
  '##B##F####B###F#####B##F##B#',
  '#...........f...f.........f#',
  '#..........................#',
  '#...A....P....W.....H...cbc#',
  '#..........................#',
  '#...............v..........#',
  '#..........,,,,,...........#',
  '#......l...,~~~,....l......#',
  '#f......v..,~~~,...........#',
  '#..........,~~~,....v.....f#',
  '#..........,,,,,...........#',
  '#......l............l......#',
  '#...R....N...........S.....#',
  '#bc........................#',
  '#...........G...........v..#',
  '#.........................b#',
  '#############DD#############',
]
const NPCS: Record<string, [Kind, string, string, string?]> = {
  A: ['market', 'merchant', 'Armory', 'armory'], P: ['market', 'alchemist', 'Apothecary', 'potions'], W: ['market', 'tailor', 'Tailor', 'tailor'],
  H: ['forge', 'smith', 'Forge', 'forge'], R: ['arena', 'guard', 'PvP Arena', 'arena'], N: ['names', 'namekeeper', '@Names & Post', 'post'],
  S: ['board', 'scribe', 'Notice Board', 'board'], G: ['gate', 'gatekeeper', 'Dungeon Gate'],
}
const LINES = ['Fresh pumpkins! Well... fresh-ish.', 'The King Slime wobbles before he hits. Wait for it.', 'My cousin went below and came back with hide. And a limp.', 'Parry at the last moment. That is the whole trick.']
export function townMap(): MapDef {
  const npcs: Npc[] = []; let vi = 0
  const tiles = TOWN.map((row) => [...row])
  tiles.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === 'v') { npcs.push({ kind: 'talk', sprite: 'v' + (vi % 5), label: 'Villager', x, y, line: LINES[vi++ % LINES.length] }); row[x] = '.' }
    else if (NPCS[ch]) { const [kind, sprite, label, stall] = NPCS[ch]; npcs.push({ kind, sprite, label, x, y, stall }); row[x] = '.'
      if (stall) { for (const dx of [-1, 0, 1]) { tiles[y - 1][x + dx] = 'Y'; tiles[y + 1][x + dx] = 'T' } tiles[y][x - 1] = 'Y'; tiles[y][x + 1] = 'Y' } }
  }))
  return { theme: 'town', w: tiles[0].length, h: tiles.length, tiles, start: { x: 13, y: 12 }, npcs, foes: [] }
}

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/** start room + one room per enemy; the last enemy is the boss, behind a gate that opens when the minions are down */
export function dungeonMap(seed: number, sprites: string[]): MapDef {
  const r = rng(seed * 31 + 7)
  const H = 15, rooms: [number, number, number, number][] = []
  let x = 1
  for (let i = 0; i <= sprites.length; i++) {
    const boss = i === sprites.length
    const w = boss ? 9 : 6 + Math.floor(r() * 3), h = boss ? 9 : 5 + Math.floor(r() * 3)
    const y = 1 + Math.floor(r() * (H - h - 2))
    rooms.push([x, y, x + w - 1, y + h - 1]); x += w + 3 + Math.floor(r() * 2)
  }
  const W = x + 1
  const t: string[][] = Array.from({ length: H }, () => Array(W).fill(' '))
  const carve = (cx: number, cy: number) => { t[cy][cx] = '.' }
  for (const [x0, y0, x1, y1] of rooms) for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) carve(xx, yy)
  let lock: { x: number; y: number } | undefined
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i], b = rooms[i + 1]
    const ay = Math.floor((a[1] + a[3]) / 2), by = Math.floor((b[1] + b[3]) / 2), mx = a[2] + 2
    for (let xx = a[2]; xx <= mx; xx++) carve(xx, ay)
    for (let yy = Math.min(ay, by); yy <= Math.max(ay, by); yy++) carve(mx, yy)
    for (let xx = mx; xx < b[0]; xx++) carve(xx, by)
    if (i === rooms.length - 2) { lock = { x: b[0] - 1, y: by }; t[by][b[0] - 1] = 'X' }
  }
  // walls around floor
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (t[yy][xx] === ' ') {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = t[yy + dy]?.[xx + dx]; if (c === '.' || c === 'X') { t[yy][xx] = '#'; dy = 2; break } }
  }
  const s = rooms[0]
  const foes: Foe[] = sprites.map((sp, i) => { const rm = rooms[i + 1]; return { idx: i, sprite: sp, boss: i === sprites.length - 1,
    x: Math.floor((rm[0] + rm[2]) / 2) + (i === sprites.length - 1 ? 0 : 1), y: Math.floor((rm[1] + rm[3]) / 2), room: rm } })
  // torches + banners on the back wall, props in room corners (corridors enter mid-height, so corners never block)
  const PROPS = ['c', 'h', 'o', 'k', 'g', 'c', 'k']
  rooms.forEach(([x0, y0, x1, y1], i) => {
    if (t[y0 - 1]?.[x0 + 1] === '#') t[y0 - 1][x0 + 1] = 'F'; if (t[y0 - 1]?.[x1 - 1] === '#') t[y0 - 1][x1 - 1] = 'F'
    const mx = Math.floor((x0 + x1) / 2); if (t[y0 - 1]?.[mx] === '#' && r() < 0.6) t[y0 - 1][mx] = 'B'
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) if (r() < 0.6 && !(i === 0 && cx === x0 + 1)) t[cy][cx] = PROPS[Math.floor(r() * PROPS.length)]
    // dress the back row and floor: barrels, crates, candles, a statue, rubble, grates, a door in the wall
    const back = ['b', 'c', 'n', 'b', 'n', 'c']
    for (let xx = x0 + 1; xx <= x1 - 1; xx++) if (xx !== mx && r() < 0.45) t[y0][xx] = back[Math.floor(r() * back.length)]
    if (i > 0 && i < rooms.length - 1 && r() < 0.5) t[y0][mx] = 'u'
    if (t[y0 - 1]?.[x1 - 2] === '#' && r() < 0.5) t[y0 - 1][x1 - 2] = 'd'
    for (let k = 0; k < 2; k++) { const fx = x0 + 1 + Math.floor(r() * (x1 - x0 - 1)), fy = y0 + 2 + Math.floor(r() * Math.max(1, y1 - y0 - 2)); if (t[fy][fx] === '.') t[fy][fx] = r() < 0.6 ? 'r' : 'g' }
    if (i === rooms.length - 1) { t[y0][mx] = 'o'; t[y0][x0 + 1] = 'o'; t[y0][x1 - 1] = 'o' }
  })
  return { theme: 'dungeon', w: W, h: H, tiles: t, start: { x: s[0] + 1, y: Math.floor((s[1] + s[3]) / 2) }, npcs: [], foes, lock }
}

export const blocked = (m: MapDef, x: number, y: number, locked: boolean) => {
  const c = m.tiles[y]?.[x]
  if (c === undefined || c === '#' || c === ' ' || c === '~' || c === 'F' || c === 'B' || c === 'c' || c === 'h' || c === 'o' || c === 'd' || c === 'b' || c === 'n' || c === 'u' || c === 'Y' || c === 'T' || c === 'l' || c === 'f') return true
  if (c === 'X' && locked) return true
  return m.npcs.some((n) => n.x === x && n.y === y)
}
/** BFS path for tap-to-walk */
export function path(m: MapDef, from: { x: number; y: number }, to: { x: number; y: number }, locked: boolean, stopAdjacent = false) {
  const key = (x: number, y: number) => y * m.w + x
  const prev = new Map<number, number>(); const q = [key(from.x, from.y)]; prev.set(q[0], -1)
  const goal = (x: number, y: number) => stopAdjacent ? Math.abs(x - to.x) + Math.abs(y - to.y) === 1 : x === to.x && y === to.y
  while (q.length) {
    const k = q.shift()!; const x = k % m.w, y = Math.floor(k / m.w)
    if (goal(x, y)) { const out: { x: number; y: number }[] = []; let c = k; while (prev.get(c) !== -1) { out.unshift({ x: c % m.w, y: Math.floor(c / m.w) }); c = prev.get(c)! } return out }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny)
      if (prev.has(nk) || blocked(m, nx, ny, locked)) continue
      prev.set(nk, k); q.push(nk)
    }
  }
  return null
}
