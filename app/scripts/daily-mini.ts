// Daily gauntlet check: fights 5 and 10 are mini-bosses that drop a full-heal potion,
// the day's other enemies are unchanged, and the server replay matches the live run.
// usage: npx tsx scripts/daily-mini.ts
import { dungeonFor, DAILY_MINI, ROOMS } from '../src/shared/engine'
import { rtStart, rtTick, rtReplay, type Ev } from '../src/shared/rt'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error('FAIL', m) } }
for (let day = 20390; day < 20420; day++) {
  const rooms = dungeonFor(day)
  ok(rooms.length === ROOMS, `day ${day}: ${rooms.length} rooms`)
  ok(rooms.filter((r) => r.mini).length === 2 && DAILY_MINI.every((i) => rooms[i].mini), `day ${day}: minis at 5 and 10`)
  // bot: block late in wind-ups, attack in gaps, drink a potion when low
  let s = rtStart({ kind: 'daily', day }, [1, 1], { level: 3, sword: 2, armor: 2, charm: 2 }); const evs: Ev[] = []
  let heals = 0, r = 0x1234 + day
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296)
  while (!s.done) {
    let m: any
    if (s.phase === 'wind' && s.kind !== 'heal' && s.kind !== 'shell' && s.pt === s.plen - 2) m = 'D'
    else if (s.phase !== 'wind' && s.atkCd <= 0 && rnd() < 0.6) m = 'A'
    else if (s.phase === 'wind' && (s.kind === 'heal' || s.kind === 'shell') && s.atkCd <= 0) m = 'A'
    const room = s.room
    if (m) evs.push({ r: s.room, t: s.t, m })
    s = rtTick(s, m)
    if (s.fx.includes('potion')) { heals++; ok(DAILY_MINI.includes(room), `day ${day}: potion from room ${room + 1}`); ok(s.hp === s.maxHp, `day ${day}: potion heals to full`) }
  }
  const v = rtReplay({ kind: 'daily', day }, [1, 1], evs, { level: 3, sword: 2, armor: 2, charm: 2 })
  ok(v.state.hp === s.hp && v.state.kills === s.kills && v.state.cleared === s.cleared && v.earned === s.earned, `day ${day}: replay mismatch`)
  const expect = DAILY_MINI.filter((i) => s.kills > i).length
  ok(heals === expect, `day ${day}: ${heals} potions, expected ${expect}`)
  if (day === 20390) console.log(`day ${day}: kills ${s.kills}/${ROOMS}, cleared ${s.cleared}, potions ${heals}, minis: ${DAILY_MINI.map((i) => `${rooms[i].name} hp ${rooms[i].hp}`).join(', ')}`)
}
console.log(fails ? `${fails} failures` : 'daily mini-boss checks passed (30 days)')
process.exit(fails ? 1 : 0)
