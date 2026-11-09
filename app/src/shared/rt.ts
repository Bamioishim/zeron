// Real-time combat on a fixed 50 ms tick. Pure and deterministic: the browser runs it live,
// the server replays the same input log (room, tick, move) to verify a clear.
import { start, roomsFor, scoreOf, LEVEL_KIT, type Mode, type Move, type RunState, type ItemId, type Gear, NOGEAR } from './engine'
export const TICK = 50
export const ROOM_TICKS = 2400 // 2 minutes per fight before the torch gutters
/** real-time fights last longer than turn fights: enemies get more HP and hit harder */
export const HPX = 1.6, DMGX = 1.5
export const foeMax = (hp: number) => Math.ceil(hp * HPX)
export type FoePhase = 'gap' | 'wind' | 'stagger'
export type AtkKind = 'hit' | 'heavy' | 'heal' | 'shell'
export type Fx = 'special' | 'boom' | 'burn' | 'stun' | 'finish' | 'bossfinish' | 'canfinish' | 'hit' | 'crit' | 'hurt' | 'blocked' | 'parry' | 'feint' | 'trade' | 'heal' | 'shell' | 'drink' | 'kill' | 'clear' | 'dead' | 'tell' | 'whiff'
export interface RT extends RunState {
  t: number; total: number; phase: FoePhase; pt: number; plen: number; windStart: number; kind: AtkKind; feint: boolean; double: number
  count: number; guardAt: number; atkCd: number; drink: number; bonus: boolean; rs: number; fx: Fx[]
  ep: number; maxEp: number; weapon: number; ammo: number; ammo0: number; wcd: number; proj: number; projDmg: number; burnT: number; burnDmg: number; earned: number
  nums: { w: 'hero' | 'foe'; v: number; txt?: string }[]
}
/** weapon specials: cd in ticks; boss hits are capped at 22% of max HP so no weapon trivializes a boss */
export const WCD: Record<number, number> = { 0: 90, 1: 50, 2: 70, 3: 80, 4: 110, 5: 100, 6: 140, 7: 110 }
export const AMMO_W = [5, 7]
/** energy: weapon specials cost EP; it regenerates slowly (+1 every 10 ticks) and on parries */
export const EP_MAX = 100, EP_COST = 25, EP_PARRY = 15, EP_POT = 40
/** boss specials -> the attack pattern they use */
const BASEMOVE: Record<string, string> = { split: 'heal', raise: 'heal', summon: 'double', bone: 'charge', charge: 'charge', fire: 'charge', slam: 'charge', grab: 'charge' }
/** WIF earned in mainnet reward units (10 units = 1 WIF): +3 per small enemy, +10 per boss, +10 per level clear. */
export const killReward = (s: RT) => s.mode.kind === 'daily' ? (isBoss(s) ? 50 : 10) : (isBoss(s) ? 100 : 30)
// Daily gauntlet: 14 minions (1 WIF each) + Warden (5 WIF) + clear bonus (11 WIF) = 30 WIF.
export const clearReward = (m: Mode) => (m.kind === 'daily' ? 110 : m.kind === 'level' ? 100 : 300)
export const canFinish = (s: RT) => !s.done && (s.phase === 'stagger' || s.enemyHp <= Math.ceil(foeMax(roomsFor(s.mode)[s.room].hp) * 0.15))
export interface Ev { r: number; t: number; m: Move }
const rnd = (s: RT) => { let a = (s.rs = (s.rs + 0x6d2b79f5) >>> 0); a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296 }
/** level 1: the foe waits for the player's first move in each room */
const HOLD = 9999
const lvl = (m: Mode) => (m.kind === 'level' ? m.level : 2)
const isBoss = (s: RT) => s.room === roomsFor(s.mode).length - 1
export function tempo(s: RT) {
  const L = lvl(s.mode), b = isBoss(s)
  return { gap: b ? Math.max(10, 20 - 2 * L) : Math.max(14, 28 - 2 * L), wind: b ? 12 : 14, heavy: 22, cd: 9, guardCd: 12, parry: 5, stagger: 24, drink: 3 }
}
function resetFoe(s: RT, first = true) { s.phase = 'gap'; s.pt = 0; s.plen = first ? (lvl(s.mode) === 1 ? HOLD : 16) : tempo(s).gap; s.double = 0; s.feint = false; s.kind = 'hit' }
export function rtStart(mode: Mode, loadout: ItemId[] = LEVEL_KIT, gear: Gear = NOGEAR, weapon = 0, ammo = 0): RT {
  const b = start(mode, loadout, gear)
  const s = { ...b, enemyHp: foeMax(b.enemyHp), t: 0, total: 0, phase: 'gap', pt: 0, plen: lvl(mode) === 1 ? HOLD : 16, windStart: -99, kind: 'hit', feint: false, double: 0, count: 0, guardAt: -99, atkCd: 0, drink: 0, bonus: false, rs: b.day * 2654435761 >>> 0, fx: [], weapon, ammo: AMMO_W.includes(weapon) ? Math.min(3, ammo) : 0, ammo0: AMMO_W.includes(weapon) ? Math.min(3, ammo) : 0, ep: 60, maxEp: EP_MAX, wcd: 0, proj: 0, projDmg: 0, burnT: 0, burnDmg: 0, earned: 0, nums: [] } as RT
  s.log = [...b.log, 'Watch for the ! — block as the bar fills, attack in the gaps.']
  return s
}
function say(s: RT, l: string) { s.log.push(l); if (s.log.length > 40) s.log = s.log.slice(-40) }
function foeHits(s: RT, mult: number, guardOk: boolean) {
  const e = roomsFor(s.mode)[s.room]
  const T = tempo(s)
  const heavy = s.kind === 'heavy'
  const raw = heavy ? 3 * e.atk + Math.floor(rnd(s) * 3) - s.def : Math.max(1, e.atk + Math.floor(rnd(s) * 2) - s.def)
  const guarded = guardOk && s.guardAt >= s.windStart
  if (guarded && s.t - s.guardAt <= T.parry) {
    s.fx.push('parry'); s.nums.push({ w: 'hero', v: 0, txt: 'PARRY!' }); say(s, `PARRY! ${e.name} staggers.`); s.bonus = true; s.ep = Math.min(s.maxEp, s.ep + EP_PARRY)
    s.phase = 'stagger'; s.pt = 0; s.plen = T.stagger; s.double = 0; return
  }
  const dmg = Math.round((guarded ? (heavy ? Math.floor(raw / 6) : Math.floor(raw / 3)) : raw) * mult * DMGX)
  let extra = 0
  if (heavy && !guarded && e.special === 'fire') extra = 4
  if (heavy && !guarded && e.special === 'grab') { s.ep = Math.max(0, s.ep - 20) }
  s.hp -= dmg + extra; s.fx.push(guarded ? 'blocked' : 'hurt'); s.nums.push({ w: 'hero', v: -(dmg + extra), txt: guarded ? 'BLOCK' : extra ? 'BURN' : undefined })
  say(s, guarded ? `Blocked (${dmg}).` : heavy ? `${e.name} ${e.move || 'SMASHES you'}: ${dmg + extra} damage!${e.special === 'grab' ? ' (-20 EP)' : ''}` : `${e.name} hits you for ${dmg}.`)
  if (s.hp <= 0) { s.hp = 0; s.dead = true; s.done = true; s.fx.push('dead'); say(s, 'You fall in the dark.') }
}
function startWind(s: RT) {
  const e = roomsFor(s.mode)[s.room], T = tempo(s), b = isBoss(s)
  const sp0 = e.special || (b ? 'charge' : undefined), sp = sp0 ? BASEMOVE[sp0] || sp0 : undefined
  s.count++; s.phase = 'wind'; s.pt = 0; s.windStart = s.t; s.feint = false; s.double = 0; s.kind = 'hit'
  if (b && s.count % 3 === 0) {
    const pick = sp === 'mixed' ? (['heavy', 'heal', 'shell'] as AtkKind[])[(s.count / 3) % 3] : sp === 'heal' ? 'heal' : sp === 'shell' ? 'shell' : 'heavy'
    s.kind = pick === 'heal' && s.enemyHp >= foeMax(e.hp) * 0.7 ? 'heavy' : pick === 'shell' && s.bossDef >= 4 ? 'heavy' : pick
  } else if (b) { const r = rnd(s); if (r < 0.2) s.feint = true; else if (r < (sp === 'double' || sp === 'mixed' ? 0.55 : 0.4)) s.double = 1 }
  s.plen = s.kind === 'heavy' ? T.heavy : T.wind
  s.fx.push('tell')
}
function playerAttack(s: RT) {
  const e = roomsFor(s.mode)[s.room], T = tempo(s)
  s.atkCd = T.cd
  const def = e.def + (isBoss(s) ? s.bossDef : 0)
  const crit = rnd(s) < 0.12
  let dmg = Math.max(1, s.atk + Math.floor(rnd(s) * 3) - def); if (crit) dmg *= 2
  if (s.phase === 'stagger') dmg = Math.ceil(dmg * 1.5)
  if (s.bonus) { dmg *= 2; s.bonus = false }
  s.enemyHp -= dmg; s.nums.push({ w: 'foe', v: -dmg }); s.fx.push(crit ? 'crit' : 'hit'); say(s, `You hit ${e.name} for ${dmg}${crit ? ' (crit!)' : ''}.`)
  if (s.enemyHp <= 0) return kill(s)
  // swinging into a wind-up: you trade blows and its attack lands now
  if (s.phase === 'wind' && !s.feint && s.kind !== 'heal' && s.kind !== 'shell' && s.pt >= 3) { s.fx.push('trade'); foeHits(s, 1, false); if (!s.done) resetFoe(s, false) }
}
function kill(s: RT) {
  const rooms = roomsFor(s.mode), e = rooms[s.room]
  const rw = killReward(s); s.earned += rw; s.nums.push({ w: 'foe', v: rw, txt: `+${rw / 10} WIF` }); s.kills++; s.gold += e.gold; s.fx.push('kill'); say(s, `${e.name} falls. +${e.gold} gold.`)
  if (s.room === rooms.length - 1) { s.cleared = true; s.done = true; s.earned += clearReward(s.mode); s.fx.push('clear'); say(s, 'Level cleared!') }
  else { s.room++; s.enemyHp = foeMax(rooms[s.room].hp); s.t = 0; s.guardAt = -99; s.atkCd = 0; s.bonus = false; s.proj = 0; s.burnT = 0; resetFoe(s); say(s, `Room ${s.room + 1}: ${rooms[s.room].name}.`) }
}
const capB = (s: RT, d: number) => (isBoss(s) ? Math.min(d, Math.ceil(foeMax(roomsFor(s.mode)[s.room].hp) * 0.15)) : d)
function wound(s: RT, dmg: number) {
  dmg = Math.max(1, capB(s, dmg)); s.enemyHp -= dmg; s.nums.push({ w: 'foe', v: -dmg }); s.fx.push('hit')
  if (s.enemyHp <= 0) kill(s)
}
function special(s: RT) {
  const e = roomsFor(s.mode)[s.room], def = e.def + (isBoss(s) ? s.bossDef : 0), base = s.atk + 1
  s.wcd = WCD[s.weapon] ?? 60; s.fx.push('special')
  const W = s.weapon
  if (W === 5 || W === 7) { s.ammo--; s.proj = W === 5 ? 14 : 10; s.projDmg = W === 5 ? Math.ceil(3.2 * base) + 12 : 2 * base + 6; if (W === 7) { s.burnT = 100; s.burnDmg = 2 }; say(s, W === 5 ? 'Rocket away!' : 'Pumpkin lobbed!'); return }
  if (W === 4) { s.burnT = 100; s.burnDmg = Math.max(2, Math.ceil(base / 2)); say(s, `${e.name} catches fire!`); return wound(s, Math.max(1, base - def)) }
  if (W === 3) { say(s, 'Dagger combo!'); for (let i = 0; i < 3 && s.enemyHp > 0; i++) { const r = s.room; wound(s, Math.max(1, Math.ceil(base * 0.65) - Math.floor(def / 2))); if (s.room !== r || s.done) return } return }
  if (W === 6) { say(s, 'Hammer smash: stunned!'); s.fx.push('stun'); wound(s, Math.max(1, Math.ceil(base * 1.9) - def)); if (!s.done && s.enemyHp > 0) { s.phase = 'stagger'; s.pt = 0; s.plen = 20 } return }
  if (W === 2) { say(s, 'Spear thrust!'); const was = s.phase === 'wind'; wound(s, Math.max(1, Math.ceil(base * 1.4) - def)); if (was && !s.done && s.enemyHp > 0 && s.kind !== 'heavy') resetFoe(s, false); return }
  if (W === 1) { say(s, 'Arrow!'); return wound(s, Math.max(1, Math.ceil(base * 1.25) - Math.floor(def / 2))) }
  say(s, 'Wide slash!'); wound(s, Math.max(1, Math.ceil(base * 1.3) - def))
}
function finisher(s: RT) {
  const e = roomsFor(s.mode)[s.room], max = foeMax(e.hp)
  s.fx.push(isBoss(s) ? 'bossfinish' : 'finish')
  if (s.enemyHp <= Math.ceil(max * 0.15)) { s.nums.push({ w: 'foe', v: -s.enemyHp }); s.enemyHp = 0; say(s, `斬 — ${e.name} is cut down!`); return kill(s) }
  say(s, 'Slash-through!'); s.bonus = true; playerAttack(s) // stagger finisher: a guaranteed double-damage strike
}
/** drink a health (P) or energy (N) potion: instant, works in and out of fights */
function drinkNow(s: RT, m: Move) {
  if (m === 'P' && s.potions > 0) { s.potions--; s.potionsUsed++; const h = Math.min(15, s.maxHp - s.hp); s.hp += h; s.nums.push({ w: 'hero', v: h }); s.fx.push('drink'); say(s, `Potion: +${h} HP.`) }
  else if (m === 'N' && s.ethers > 0) { s.ethers--; s.ethersUsed++; const g = Math.min(EP_POT, s.maxEp - s.ep); s.ep += g; s.nums.push({ w: 'hero', v: g, txt: `+${g} EP` }); s.fx.push('drink'); say(s, `Energy potion: +${g} EP.`) }
}
/** out-of-fight drink (walking between rooms): no clock, logged as a negative tick for the current room */
export function rtDrink(s0: RT, m: Move): RT { if (s0.done) return s0; const s: RT = { ...s0, fx: [], nums: [], log: [...s0.log] }; drinkNow(s, m); return s }
/** advance one 50 ms tick, applying an optional input first */
export function rtTick(s0: RT, input?: Move): RT {
  if (s0.done) return s0
  const s: RT = { ...s0, fx: [], nums: [], log: s0.log }
  const T = tempo(s); const room = s.room
  if (s.plen === HOLD && (input === 'A' || input === 'S' || input === 'F' || input === 'D')) s.plen = s.pt + 10 // player moved first: the foe answers after a short beat
  if (input === 'A' && s.atkCd <= 0 && s.drink <= 0) playerAttack(s)
  else if (input === 'A') s.fx.push('whiff')
  else if (input === 'D' && s.t - s.guardAt >= T.guardCd) s.guardAt = s.t
  else if ((input === 'P' || input === 'N') && s.drink <= 0) { drinkNow(s, input); s.drink = T.drink }
  else if (input === 'S' && s.wcd <= 0 && s.ep >= EP_COST && (!AMMO_W.includes(s.weapon) || s.ammo > 0)) { s.ep -= EP_COST; special(s) }
  else if (input === 'F' && canFinish(s) && s.atkCd <= 0 && s.drink <= 0) finisher(s)
  if (s.done || s.room !== room) { s.log = [...s.log]; return s }
  if (s.atkCd > 0) s.atkCd--
  if (s.wcd > 0) s.wcd--
  if (s.proj > 0 && --s.proj === 0) { s.fx.push('boom'); wound(s, s.projDmg); if (s.done || s.room !== room) { s.log = [...s.log]; return s } }
  if (s.burnT > 0) { s.burnT--; if (s.burnT % 20 === 0) { s.fx.push('burn'); wound(s, s.burnDmg); if (s.done || s.room !== room) { s.log = [...s.log]; return s } } }
  if (s.drink > 0) s.drink--
  if (s.t % 10 === 9 && s.ep < s.maxEp) s.ep++
  s.pt++
  if (s.pt >= s.plen) {
    if (s.phase === 'gap' || s.phase === 'stagger') startWind(s)
    else if (s.feint) { s.fx.push('feint'); say(s, `${roomsFor(s.mode)[s.room].name} feints!`); s.phase = 'gap'; s.pt = 0; s.plen = 6 }
    else if (s.kind === 'heal') { const e = roomsFor(s.mode)[s.room]; const h = 8; s.enemyHp = Math.min(foeMax(e.hp), s.enemyHp + h); s.nums.push({ w: 'foe', v: h }); s.fx.push('heal'); say(s, `${e.name} ${e.move || 'heals'} (+${h})! (Hit it during the glow to stop it)`); resetFoe(s, false) }
    else if (s.kind === 'shell') { s.bossDef += 2; s.fx.push('shell'); say(s, `${roomsFor(s.mode)[s.room].name} hardens (+2 DEF)!`); resetFoe(s, false) }
    else {
      foeHits(s, 1, true)
      if (!s.done && s.phase === 'wind') { if (s.double === 1) { s.double = 2; s.pt = 0; s.plen = 6; s.fx.push('tell') } else resetFoe(s, false) }
    }
  }
  // interrupting a heal / shell: any hit during its glow cancels it
  s.t++; s.total++
  s.turn = Math.floor(s.total / 20)
  if (!s.done && s.t >= ROOM_TICKS) { s.done = true; say(s, 'Your torch burns out.') }
  s.log = [...s.log]
  return s
}
/** server-side re-check of a real-time run */
export function rtReplay(mode: Mode, loadout: ItemId[], evs: Ev[], gear: Gear = NOGEAR, weapon = 0, ammo = 0) {
  if (!Array.isArray(evs) || evs.length > 4000) throw new Error('bad input log')
  let s = rtStart(mode, loadout, gear, weapon, ammo); let i = 0
  for (const e of evs) if (!['A', 'D', 'P', 'S', 'F', 'N'].includes(e.m) || !Number.isInteger(e.r) || !Number.isInteger(e.t)) throw new Error('bad move')
  for (let k = 1; k < evs.length; k++) { const a = evs[k - 1], b = evs[k]; if (b.r < a.r || (b.r === a.r && b.t <= a.t)) throw new Error('log out of order') }
  let guard = 0
  while (!s.done && guard++ < 50000) {
    while (s.t === 0 && i < evs.length && evs[i].r === s.room && evs[i].t < 0) { const m = evs[i++].m; if (m === 'P' || m === 'N') s = rtDrink(s, m) }
    while (i < evs.length && (evs[i].r < s.room || (evs[i].r === s.room && evs[i].t < s.t))) i++ // stale inputs are ignored
    const ev = i < evs.length && evs[i].r === s.room && evs[i].t === s.t ? evs[i++] : undefined
    s = rtTick(s, ev?.m)
  }
  if (!s.done) throw new Error('run not finished')
  const used: number[] = []
  for (let k = 0; k < s.potionsUsed; k++) used.push(1)
  for (let k = 0; k < s.ethersUsed; k++) used.push(4)
  if (loadout.includes(2)) used.push(2)
  if (loadout.includes(3)) used.push(3)
  return { state: s, ...scoreOf(s), used, earned: s.earned, ammoUsed: s.ammo0 - s.ammo }
}
