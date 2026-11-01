import { start, step, MAX_LEVEL, type Gear, type ItemId } from '../src/shared/engine'
const smart = (s: any) => s.charging ? 'D' : (s.hp < s.maxHp * 0.35 && s.potions > 0 ? 'P' : 'A')
const spam = (s: any) => (s.hp < s.maxHp * 0.3 && s.potions > 0 ? 'P' : 'A')
function play(mode: any, lo: ItemId[], g: Gear, pol: any) { let s = start(mode, lo, g); while (!s.done) s = step(s, pol(s)); return s.cleared }
const gears: [string, Gear][] = [['L-1 bare', { level: 0, sword: 0, armor: 0, charm: 0 }]]
for (let L = 1; L <= MAX_LEVEL; L++) {
  const lv = L - 1, t = Math.min(3, Math.floor(lv / 1.5))
  const g = { level: lv, sword: t, armor: t, charm: Math.max(0, t - 1) }
  const row = [] as string[]
  for (const [nm, lo, pol] of [['smart0', [], smart], ['spam0', [], spam], ['smart3p', [1, 1, 1], smart], ['spam3p', [1, 1, 1], spam], ['smart-bare3p', [1,1,1], smart]] as any) {
    const gg = nm === 'smart-bare3p' ? { level: lv, sword: 0, armor: 0, charm: 0 } : g
    let w = 0; for (let k = 0; k < 200; k++) w += +play({ kind: 'level', level: L, salt: k }, lo, gg, pol)
    row.push(`${nm}=${w / 2}%`)
  }
  console.log('L' + L, JSON.stringify(g), row.join(' '))
}
let w = { s: 0, a: 0 }
for (let d = 20000; d < 20200; d++) { w.s += +play(d, [], { level: 0, sword: 0, armor: 0, charm: 0 }, smart); w.a += +play(d, [], { level: 0, sword: 0, armor: 0, charm: 0 }, spam) }
console.log('daily bare smart', w.s / 2, '% spam', w.a / 2, '%')
