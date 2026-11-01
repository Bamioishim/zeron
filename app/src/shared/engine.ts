// Pure, deterministic daily dungeon. Used by the browser (to play) and by the server (to re-check a run).
export type Move = 'A' | 'D' | 'P' | 'S' | 'F' | 'N' // attack, defend, potion, weapon special, finisher, energy potion
export type ItemId = 1 | 2 | 3 | 4
export const ITEMS: Record<ItemId, { name: string; blurb: string }> = {
  1: { name: 'Potion', blurb: 'Drink in a fight: +15 HP. Unused potions are kept.' },
  2: { name: 'Whetstone', blurb: '+3 attack for one run. Consumed.' },
  3: { name: 'Ward Charm', blurb: '+2 defence for one run. Consumed.' },
  4: { name: 'Energy Potion', blurb: 'Drink any time: +40 EP for weapon specials. Unused ones are kept.' },
}
export type Special = 'charge' | 'heal' | 'shell' | 'double' | 'mixed' | 'split' | 'summon' | 'bone' | 'fire' | 'raise' | 'slam' | 'grab'
export interface EnemyDef { key: string; name: string; hp: number; atk: number; def: number; gold: number; special?: Special; blurb?: string; move?: string }
const BESTIARY: EnemyDef[] = [
  { key: 'slime', name: 'Flat Slime', hp: 14, atk: 3, def: 0, gold: 8 },
  { key: 'bat', name: 'Cave Bat', hp: 10, atk: 5, def: 0, gold: 10 },
  { key: 'skull', name: 'Rattle Skull', hp: 20, atk: 4, def: 2, gold: 14 },
  { key: 'golem', name: 'Moss Golem', hp: 28, atk: 5, def: 3, gold: 20 },
]
const BOSS: EnemyDef = { key: 'boss', name: 'The Edge Warden', hp: 44, atk: 8, def: 2, gold: 60 }
export const ROOMS = 5
export const MAX_TURNS = 80
export const BASE = { hp: 60, atk: 6, def: 1 }

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/* ---------- level progression: 8 levels, each its own enemy family; the boss is a big version of that family ---------- */
export interface LevelDef { name: string; family: string; minions: [string, string][]; boss: EnemyDef }
export const LEVELS: LevelDef[] = [
  { name: 'The Mudflats', family: 'Slimes', minions: [['slime', 'Mud Slime'], ['slime2', 'Swamp Slime'], ['slug', 'Sludge Slug']],
    boss: { key: 'kslime', name: 'King Slime', hp: 46, atk: 7, def: 1, gold: 60, special: 'split', move: 'splits and reforms', blurb: 'Splits off blobs to heal itself. Hit it while it wobbles; parry the belly-slam.' } },
  { name: 'Goblin Warrens', family: 'Goblins', minions: [['goblin', 'Goblin'], ['goblin', 'Goblin Cutter'], ['goblin2', 'Goblin Sneak']],
    boss: { key: 'gchief', name: 'Goblin Chief', hp: 54, atk: 9, def: 2, gold: 70, special: 'summon', move: 'summons a goblin', blurb: 'Whistles for help: a summoned goblin swings right after him. Block twice.' } },
  { name: 'Bone Crypt', family: 'Skeletons', minions: [['skull', 'Skeleton'], ['skull', 'Skeleton Guard'], ['skull2', 'Bone Archer']],
    boss: { key: 'slord', name: 'Skeleton Lord', hp: 64, atk: 9, def: 4, gold: 80, special: 'bone', move: 'throws a bone', blurb: 'Hurls a huge bone. Block it or parry at the last moment.' } },
  { name: 'Orc Barracks', family: 'Orcs', minions: [['orc', 'Orc Grunt'], ['orc2', 'Masked Orc'], ['orc3', 'Orc Shaman']],
    boss: { key: 'owar', name: 'Orc Warlord', hp: 74, atk: 10, def: 3, gold: 90, special: 'charge', move: 'CHARGES', blurb: 'Lowers his head and charges. A parry stops him cold.' } },
  { name: 'Ember Pit', family: 'Demons', minions: [['imp', 'Imp'], ['chort', 'Chort'], ['imp', 'Fire Imp']],
    boss: { key: 'demon', name: 'The Demon', hp: 86, atk: 11, def: 4, gold: 100, special: 'fire', move: 'breathes fire', blurb: 'Fire breath burns for extra damage unless you block it.' } },
  { name: 'Grave Chapel', family: 'Necromancers', minions: [['necro', 'Acolyte'], ['necro', 'Necromancer'], ['zombie0', 'Risen Corpse']],
    boss: { key: 'nlord', name: 'The Necromancer', hp: 92, atk: 12, def: 4, gold: 110, special: 'raise', move: 'raises the dead', blurb: 'Raises the dead to mend himself. Interrupt the glow.' } },
  { name: 'Ogre Den', family: 'Ogres', minions: [['ogre', 'Ogre'], ['ogre', 'Ogre Brute'], ['ogre', 'Ogre Bruiser']],
    boss: { key: 'bogre', name: 'Big Ogre', hp: 104, atk: 13, def: 5, gold: 120, special: 'slam', move: 'SLAMS the ground', blurb: 'Ground slams hit hard and keep coming. Armor and potions.' } },
  { name: 'The Rot', family: 'Zombies', minions: [['zombie', 'Zombie'], ['zombie2', 'Ice Zombie'], ['zombie', 'Ghoul']],
    boss: { key: 'bzombie', name: 'Big Zombie', hp: 116, atk: 14, def: 5, gold: 140, special: 'grab', move: 'GRABS you', blurb: 'A grab drains your energy. Block, then strike back.' } },
]
export const MAX_LEVEL = LEVELS.length
/** the quest contract records level clears up to 6; 7 and 8 are endgame levels (WIF only) */
export const ONCHAIN_MAX_LEVEL = 6
export function levelDungeon(L: number): EnemyDef[] {
  if (L < 1 || L > MAX_LEVEL) throw new Error('bad level')
  const lv = LEVELS[L - 1]
  const rooms: EnemyDef[] = lv.minions.map(([key, name], i) => ({ key, name, hp: 10 + 6 * L + 2 * i, atk: 2 + L + (i === 2 ? 1 : 0), def: Math.floor((L - 1) / 2), gold: 6 + 3 * L + i }))
  rooms.push({ ...lv.boss })
  return rooms
}
/** crafting materials dropped by a boss clear (iron, hide, glow) */
export function lootFor(L: number) { return { iron: 1 + Math.floor(L / 2), hide: 1 + Math.floor((L - 1) / 2), glow: L >= 3 ? L - 2 : 0 } }
export interface Gear { level: number; sword: number; armor: number; charm: number }
export const NOGEAR: Gear = { level: 0, sword: 0, armor: 0, charm: 0 }
/** same formula as WifQuest.stats() */
export function statsFor(g: Gear) { return { atk: 6 + 2 * g.sword + g.level, def: 1 + g.armor, hp: 60 + 8 * g.charm + 4 * g.level } }
export const RECIPES = [
  { kind: 0, name: 'Sword', stat: '+2 ATK / tier', cost: (t: number) => ({ iron: 2 * t, hide: 0, glow: 0 }) },
  { kind: 1, name: 'Armor', stat: '+1 DEF / tier', cost: (t: number) => ({ iron: 0, hide: 2 * t, glow: 0 }) },
  { kind: 2, name: 'Charm', stat: '+8 HP / tier', cost: (t: number) => ({ iron: 1, hide: 0, glow: t }) },
]
export type Mode = { kind: 'daily'; day: number } | { kind: 'level'; level: number; salt?: number } | { kind: 'event'; salt?: number }
/** Halloween event: two lantern imps, then the Pumpkin King */
export const PUMPKIN_KING: EnemyDef = { key: 'pking', name: 'The Pumpkin King', hp: 70, atk: 10, def: 3, gold: 99, special: 'mixed', blurb: 'Feints, double slashes and a glowing heal. Parry the big one.' }
export function eventDungeon(): EnemyDef[] {
  return [{ key: 'pumpkin', name: 'Lantern Imp', hp: 22, atk: 5, def: 1, gold: 12 }, { key: 'pumpkin', name: 'Lantern Imp', hp: 26, atk: 6, def: 2, gold: 14 }, { ...PUMPKIN_KING }]
}
export function roomsFor(m: Mode) { return m.kind === 'daily' ? dungeonFor(m.day) : m.kind === 'event' ? eventDungeon() : levelDungeon(m.level) }
const seedOf = (m: Mode) => (m.kind === 'daily' ? m.day : m.kind === 'event' ? 9_000_000 + ((m.salt ?? 0) % 1000) : 7_000_000 + m.level * 1000 + ((m.salt ?? 0) % 1000))

export function dayNow(nowMs = Date.now()) { return Math.floor(nowMs / 86400000) }

export function dungeonFor(day: number): EnemyDef[] {
  const r = mulberry(day * 7919 + 17)
  const rooms: EnemyDef[] = []
  for (let i = 0; i < ROOMS - 1; i++) {
    const pool = BESTIARY.slice(0, Math.min(BESTIARY.length, 2 + i))
    const e = pool[Math.floor(r() * pool.length)]
    const bump = Math.floor(r() * 3)
    rooms.push({ ...e, hp: e.hp + bump * 2 + i * 2, atk: e.atk + (i >= 3 ? 1 : 0) })
  }
  rooms.push({ ...BOSS, hp: BOSS.hp + Math.floor(r() * 6) })
  return rooms
}

export interface RunState {
  mode: Mode; day: number; bossDef: number; room: number; hp: number; maxHp: number; atk: number; def: number; ethers: number; ethersUsed: number
  enemyHp: number; potions: number; kills: number; gold: number; turn: number
  charging: boolean; dead: boolean; cleared: boolean; done: boolean; log: string[]; potionsUsed: number
}

export function start(mode: Mode | number, loadout: ItemId[], gear: Gear = NOGEAR): RunState {
  if (typeof mode === 'number') mode = { kind: 'daily', day: mode }
  const st = statsFor(gear)
  const potions = loadout.filter((i) => i === 1).length, ethers = loadout.filter((i) => i === 4).length
  const atk = st.atk + (loadout.includes(2) ? 3 : 0)
  const def = st.def + (loadout.includes(3) ? 2 : 0)
  const d = roomsFor(mode)
  const intro = mode.kind === 'level' ? `Level ${mode.level}: ${LEVELS[mode.level - 1].name}.` : mode.kind === 'event' ? 'The pumpkin patch glows…' : 'You enter the Depths.'
  return { mode, day: seedOf(mode), bossDef: 0, room: 0, hp: st.hp, maxHp: st.hp, atk, def, ethers, ethersUsed: 0, enemyHp: d[0].hp, potions, kills: 0, gold: 0, turn: 0,
    charging: false, dead: false, cleared: false, done: false, log: [`${intro} Room 1: ${d[0].name}.`], potionsUsed: 0 }
}

export function step(s0: RunState, m: Move): RunState {
  if (s0.done) return s0
  const s: RunState = { ...s0, log: [...s0.log] }
  const rooms = roomsFor(s.mode)
  const e0 = rooms[s.room]
  const e = { ...e0, def: e0.def + (s.room === rooms.length - 1 ? s.bossDef : 0) }
  const sp = e.special || (e.key === 'boss' ? 'charge' : undefined)
  const r = mulberry(s.day * 104729 + s.turn * 31 + s.room * 7 + 1)
  s.turn++
  let defending = false
  if (m === 'P') {
    if (s.potions <= 0) { s.log.push('No potions left. You fumble.') }
    else { s.potions--; s.potionsUsed++; const h = Math.min(15, s.maxHp - s.hp); s.hp += h; s.log.push(`You drink a potion (+${h} HP).`) }
  } else if (m === 'D') { defending = true; s.log.push('You raise your guard.') }
  else {
    const crit = r() < 0.12
    let dmg = Math.max(1, s.atk + Math.floor(r() * 3) - e.def); if (crit) dmg *= 2
    s.enemyHp -= dmg; s.log.push(`You hit ${e.name} for ${dmg}${crit ? ' (crit!)' : ''}.`)
  }
  if (s.enemyHp <= 0) {
    s.kills++; s.gold += e.gold; s.log.push(`${e.name} falls. +${e.gold} gold.`)
    if (s.room === rooms.length - 1) { s.cleared = true; s.done = true; s.log.push('The Depths are cleared!') }
    else { s.room++; s.enemyHp = rooms[s.room].hp; s.log.push(`Room ${s.room + 1}: ${rooms[s.room].name}.`) }
    s.charging = false
  } else if (sp && s.room === rooms.length - 1 && (sp === 'heal' || sp === 'mixed') && s.enemyHp < e.hp / 2 && r() < 0.2) {
    const h = 8; s.enemyHp = Math.min(e.hp, s.enemyHp + h); s.log.push(`${e.name} heals ${h}!`)
  } else if (sp && s.room === rooms.length - 1 && (sp === 'shell' || sp === 'mixed') && s.bossDef < 4 && r() < 0.15) {
    s.bossDef += 2; s.log.push(`${e.name} hardens its shell (+2 DEF)!`)
  } else if (s.charging) {
    // telegraphed heavy blow: defending blocks most of it, attacking into it hurts
    s.charging = false
    const raw = 3 * e.atk + Math.floor(r() * 3) - s.def
    const dmg = Math.max(0, defending ? Math.floor(raw / 6) : raw)
    s.hp -= dmg; s.log.push(defending ? `You block the heavy blow (${dmg}).` : `${e.name} SMASHES you for ${dmg}!`)
  } else if (r() < (s.room === rooms.length - 1 && sp !== 'double' ? 0.3 : 0.18)) {
    s.charging = true; s.log.push(`${e.name} is winding up a heavy blow! (Defend!)`)
  } else {
    const miss = r() < 0.1
    const twice = (sp === 'double' || sp === 'mixed') && s.room === rooms.length - 1 && r() < 0.35
    const one = Math.max(0, e.atk + Math.floor(r() * 2) - s.def - 1 - (defending ? 4 : 0))
    const dmg = miss ? 0 : twice ? one * 2 : one
    s.hp -= dmg; s.log.push(miss ? `${e.name} misses.` : twice ? `${e.name} strikes TWICE for ${dmg}!` : `${e.name} hits you for ${dmg}.`)
    if (s.hp <= 0) { s.hp = 0; s.dead = true; s.done = true; s.log.push('You fall in the dark.') }
  }
  if (!s.done && s.turn >= MAX_TURNS) { s.done = true; s.log.push('Your torch burns out.') }
  if (s.log.length > 60) s.log = s.log.slice(-60)
  return s
}

export function scoreOf(s: RunState) {
  const score = Math.max(0, s.kills * 100 + s.gold + (s.cleared ? 500 + s.hp * 10 : 0) - s.turn * 2)
  const xp = s.kills * 10 + (s.cleared ? 50 : 0)
  return { score, xp }
}

/** Server-side re-check. Returns the result plus which items the run consumed. */
export function replay(mode: Mode | number, loadout: ItemId[], moves: Move[], gear: Gear = NOGEAR) {
  if (moves.length > MAX_TURNS) throw new Error('too many moves')
  if (loadout.length > 5) throw new Error('loadout too big')
  for (const i of loadout) if (![1, 2, 3, 4].includes(i)) throw new Error('bad item')
  if (loadout.filter((i) => i === 2).length > 1 || loadout.filter((i) => i === 3).length > 1) throw new Error('one of each charm')
  let s = start(mode, loadout, gear)
  for (const m of moves) { if (!['A', 'D', 'P'].includes(m)) throw new Error('bad move'); s = step(s, m) }
  if (!s.done) throw new Error('run not finished')
  const used: number[] = []
  for (let k = 0; k < s.potionsUsed; k++) used.push(1)
  if (loadout.includes(2)) used.push(2)
  if (loadout.includes(3)) used.push(3)
  return { state: s, ...scoreOf(s), used }
}
export const LEVEL_KIT: ItemId[] = [1, 1, 4] // level runs: 2 free potions + 1 energy potion; shop items are for the daily run
