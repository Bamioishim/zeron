// Bot with "decent timing" to balance real-time combat: defends mid wind-up (sometimes parries), attacks in gaps.
import { rtStart, rtTick, rtReplay, type Ev } from '../src/shared/rt'
import { LEVEL_KIT, NOGEAR } from '../src/shared/engine'
const skill = Number(process.argv[2] || 0.75)
for (const L of [1, 2, 3, 4, 5]) {
  let wins = 0, hpLeft = 0; const N = 200
  for (let k = 0; k < N; k++) {
    const mode = { kind: 'level', level: L, salt: k } as const
    const G = Number(process.argv[3] ?? 1); const g = { level: L - 1, sword: Math.floor((L - 1) * G), armor: Math.floor((L - 1) * G), charm: Math.floor(Math.max(0, L - 2) * G) }
    let s = rtStart(mode, LEVEL_KIT, g); const evs: Ev[] = []
    let r = Math.random
    let plan = -1
    while (!s.done) {
      let m: any
      if (s.phase === 'wind' && !s.feint && s.kind !== 'heal' && s.kind !== 'shell') {
        if (plan < 0) plan = r() < skill ? s.plen - 1 - Math.floor(r() * 9) : 999
        if (s.pt === plan) m = 'D'
      } else plan = -1
      if (!m && s.phase !== 'wind' && s.atkCd <= 0 && r() < 0.6) m = 'A'
      if (!m && s.phase === 'wind' && (s.kind === 'heal' || s.kind === 'shell') && s.atkCd <= 0) m = 'A'
      if (!m && s.hp < s.maxHp * 0.35 && s.potions > 0 && s.drink <= 0 && s.phase === 'gap') m = 'P'
      if (m) evs.push({ r: s.room, t: s.t, m })
      s = rtTick(s, m)
    }
    if (s.cleared) { wins++; hpLeft += s.hp
      if (k === 0) { const v = rtReplay(mode, LEVEL_KIT, evs, g); if (!v.state.cleared) throw new Error('replay mismatch') } }
  }
  console.log(`L${L} skill ${skill}: win ${(100 * wins / N).toFixed(0)}% avg hp left ${(hpLeft / Math.max(1, wins)).toFixed(0)}`)
}
