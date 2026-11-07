import atlasUrl from './assets/dungeon.png'
import { FRAMES } from './atlas'
import { ART, PAL } from '../sprites'
import { COSTUMES } from '../config'

export const atlas = new Image(); atlas.src = atlasUrl
/** game sprite key -> CC0 atlas animation (or 'art:<name>' for our own pixel art) */
export const LOOK: Record<string, { a: string; scale?: number }> = {
  hero: { a: 'art:knight' },
  slime: { a: 'muddy_anim' }, bat: { a: 'imp_idle_anim' }, skull: { a: 'skelet_idle_anim' }, golem: { a: 'orc_warrior_idle_anim' },
  boss: { a: 'ogre_idle_anim' }, glorp: { a: 'swampy_anim', scale: 2 }, moth: { a: 'necromancer_anim', scale: 1.5 },
  tortoise: { a: 'big_zombie_idle_anim' }, jester: { a: 'chort_idle_anim', scale: 1.5 }, rim: { a: 'big_demon_idle_anim' },
  // level families (CC0 0x72 DungeonTileset II); bosses are ~2x versions of their family
  slime2: { a: 'swampy_anim' }, slug: { a: 'slug_anim' }, kslime: { a: 'swampy_anim', scale: 2 },
  goblin: { a: 'goblin_idle_anim' }, goblin2: { a: 'lizard_m_idle_anim' }, wogol: { a: 'wogol_idle_anim' }, gchief: { a: 'goblin_idle_anim', scale: 2 },
  skull2: { a: 'necromancer_anim' }, slord: { a: 'skelet_idle_anim', scale: 2 },
  orc: { a: 'orc_warrior_idle_anim' }, orc2: { a: 'masked_orc_idle_anim' }, orc3: { a: 'orc_shaman_idle_anim' }, owar: { a: 'masked_orc_idle_anim', scale: 2 },
  imp: { a: 'imp_idle_anim' }, chort: { a: 'chort_idle_anim' }, demon: { a: 'big_demon_idle_anim', scale: 1.3 },
  necro: { a: 'necromancer_anim' }, zombie0: { a: 'tiny_zombie_idle_anim' }, doc: { a: 'doc_idle_anim' }, nlord: { a: 'necromancer_anim', scale: 2 },
  ogre: { a: 'ogre_idle_anim' }, bogre: { a: 'ogre_idle_anim', scale: 1.6 },
  zombie: { a: 'tiny_zombie_idle_anim' }, zombie2: { a: 'ice_zombie_anim' }, bigzombie: { a: 'big_zombie_idle_anim' }, bzombie: { a: 'big_zombie_idle_anim', scale: 1.6 },
  pking: { a: 'pumpkin_dude_idle_anim', scale: 2.2 }, pumpkin: { a: 'pumpkin_dude_idle_anim' },
  icezombie: { a: 'ice_zombie_anim' }, angel: { a: 'angel_idle_anim' }, slug2: { a: 'tiny_slug_anim' }, swampbeast: { a: 'swampy_anim' }, tiny_slug: { a: 'tiny_slug_anim' }, lizard: { a: 'lizard_m_idle_anim' },
  frostboss: { a: 'big_zombie_idle_anim', scale: 2 }, deepboss: { a: 'ogre_idle_anim', scale: 2 }, carnivalboss: { a: 'pumpkin_dude_idle_anim', scale: 2 }, bigdemon: { a: 'big_demon_idle_anim' }, ashboss: { a: 'big_demon_idle_anim', scale: 1.8 },
  merchant: { a: 'dwarf_m_idle_anim' }, alchemist: { a: 'wizzard_f_idle_anim' }, tailor: { a: 'elf_m_idle_anim' }, v0: { a: 'knight_m_idle_anim' }, v1: { a: 'lizard_f_idle_anim' }, v2: { a: 'dwarf_m_idle_anim' }, v3: { a: 'wizzard_m_idle_anim' }, v4: { a: 'elf_f_idle_anim' }, smith: { a: 'dwarf_f_idle_anim' }, guard: { a: 'lizard_m_idle_anim' },
  gatekeeper: { a: 'knight_f_idle_anim' }, scribe: { a: 'wizzard_m_idle_anim' }, namekeeper: { a: 'elf_f_idle_anim' },
}
for (const c of COSTUMES) LOOK['c' + c.id] = { a: c.look, scale: c.scale }
/** dress the local hero (town, dungeon, fights) */
export function setCostume(id: number) { const c = COSTUMES[id] || COSTUMES[0]; LOOK.hero = { a: c.look, scale: c.scale } }
const artCache = new Map<string, HTMLCanvasElement>()
function artCanvas(name: string) {
  let c = artCache.get(name); if (c) return c
  const rows = ART[name] || ART.slime
  c = document.createElement('canvas'); c.width = Math.max(...rows.map((r) => r.length)); c.height = rows.length
  const g = c.getContext('2d')!
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1) } }))
  artCache.set(name, c); return c
}
/** returns image + source rect for a key at time t (ms); moving=true picks run frames when available */
export function frameOf(key: string, t: number, moving = false): { img: CanvasImageSource; sx: number; sy: number; w: number; h: number; scale: number } {
  const look = LOOK[key] || (FRAMES[key] ? { a: key } : { a: 'art:' + key })
  if (look.a.startsWith('art:')) {
    const n = look.a.slice(4); const alt = moving && ART[n + '2'] && Math.floor(t / 140) % 2 ? n + '2' : n
    const c = artCanvas(alt); return { img: c, sx: 0, sy: 0, w: c.width, h: c.height, scale: look.scale || 1 }
  }
  let name = look.a
  if (!FRAMES[name]) {
    const run = moving ? name.replace('idle', 'run') : name
    const base = FRAMES[run + '_f0'] ? run : name
    const f = Math.floor(t / 130) % 4; name = FRAMES[`${base}_f${f}`] ? `${base}_f${f}` : `${base}_f0`
  }
  const [sx, sy, w, h] = FRAMES[name] || FRAMES.skull
  return { img: atlas, sx, sy, w, h, scale: look.scale || 1 }
}
export function tile(name: string) { return FRAMES[name] }
