// Live check: fresh wallet clears level 1 (greedy policy) and saves the checkpoint via the live API + relay.
const store: Record<string, string> = {}
;(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } }
const BASE = process.env.BASE || 'https://zeron-game.vercel.app'
;(globalThis as any).fetch = ((f) => (u: any, o: any) => f(String(u).startsWith('/') ? BASE + u : u, o))(globalThis.fetch)
const { start, step, LEVEL_KIT } = await import('../src/shared/engine')
const { account, sponsored, postRun } = await import('../src/wallet')
const { D, questAbi } = await import('../src/shared/chain')
const { encodeFunctionData } = await import('viem')
const player = account().address
const mode = { kind: 'level', level: 1, salt: 7 } as any
let best: any = null
for (let salt = 0; salt < 60 && !best; salt++) {
  mode.salt = salt; let s = start(mode, LEVEL_KIT); const moves: any[] = []
  while (!s.done) { const m = s.charging ? 'D' : s.hp < 12 && s.potions > 0 ? 'P' : 'A'; moves.push(m); s = step(s, m) }
  if (s.cleared) best = { salt, moves }
}
console.log('player', player, 'salt', best.salt, 'moves', best.moves.length)
const r = await postRun({ player, level: 1, salt: best.salt, loadout: LEVEL_KIT, moves: best.moves })
console.log('server', JSON.stringify({ ...r, sig: r.sig?.slice(0, 10) }))
const data = encodeFunctionData({ abi: questAbi, functionName: 'recordClear', args: [r.level, r.loot.iron, r.loot.hide, r.loot.glow, BigInt(r.deadline), r.sig] })
try { console.log('tx', await sponsored([{ to: D.quest as any, value: 0n, data }])) } catch (e: any) { console.log('FAIL', e.message) }
// back-to-back sponsored calls (the old "bad sig" race), then claim + send by @name
const { wifAbi, namesAbi } = await import('../src/shared/chain')
const { parseEther } = await import('viem')
const nm = 'zt' + player.slice(2, 8).toLowerCase()
const t = (to: any, abi: any, fn: string, args: any[]) => ({ to, value: 0n, data: encodeFunctionData({ abi, functionName: fn, args } as any) })
for (const [label, c] of [['faucet', [t(D.wif, wifAbi, 'faucet', [])]], ['claim @' + nm, [t(D.names, namesAbi, 'claim', [nm])]],
  ['send 1 WIF to @wifhero', [t(D.wif, wifAbi, 'approve', [D.names, parseEther('1000')]), t(D.names, namesAbi, 'sendToName', ['wifhero', parseEther('1')])]]] as any)
  try { console.log(label, (await sponsored(c)).explorer) } catch (e: any) { console.log(label, 'FAIL', e.message) }
