// Mainnet e2e: 0-ETH player, every action through the sponsor relay, gas fee paid in WIF.
import { encodeFunctionData, parseEther, formatEther, maxUint256, type Hex } from 'viem'
const mem: Record<string, string> = {}
;(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => (mem[k] = v) }
const { relay, signRun } = await import('../src/server/core')
const realFetch = globalThis.fetch
;(globalThis as any).fetch = async (url: any, init: any) => {
  if (typeof url !== 'string' || !url.includes('/api/')) return realFetch(url, init)
  const body = JSON.parse(init.body)
  try { const j = url.endsWith('/api/relay') ? await relay(body) : await signRun(body); return { ok: true, json: async () => j } }
  catch (e: any) { return { ok: false, json: async () => ({ error: e.shortMessage || e.message }) } }
}
mem['wifdepths.key.v1'] = process.env.PLAYER_KEY!
const { sponsored, postRun, account, pub } = await import('../src/wallet')
const { D, wifAbi, namesAbi, shopAbi, armoryAbi, questAbi } = await import('../src/shared/chain')
const { start, step, LEVEL_KIT } = await import('../src/shared/engine')
const me = account().address, W = D.wif as Hex, REL = D.relayer as Hex
const tx = (to: Hex, abi: any, functionName: string, args: any[] = []) => ({ to, value: 0n, data: encodeFunctionData({ abi, functionName, args } as any) })
const bal = async () => ({ eth: await pub.getBalance({ address: me }), wif: await pub.readContract({ address: W, abi: wifAbi, functionName: 'balanceOf', args: [me] }), rel: await pub.getBalance({ address: REL }) })
let prev = await bal(); console.log('player', me, 'ETH', formatEther(prev.eth), 'WIF', formatEther(prev.wif))
const go = async (label: string, calls: any[]) => {
  try { const r = await sponsored(calls); await new Promise((s) => setTimeout(s, 1500)); const b = await bal()
    console.log(`${label}: ${r.explorer} | player ETH ${formatEther(b.eth)} | WIF ${formatEther(b.wif - prev.wif)} | sponsor ETH -${prev.rel - b.rel} wei`); prev = b; return r }
  catch (e: any) { console.log(label, 'FAIL', e.message); throw e }
}
await go('1 starter (7702 delegation)', [tx(D.shop as Hex, shopAbi, 'starter')])
const name = 'z' + me.slice(2, 8).toLowerCase()
await go('2 claim @' + name, [tx(D.names, namesAbi, 'claim', [name])])
await go('3 buy Bow', [tx(W, wifAbi, 'approve', [D.armory, maxUint256]), tx(D.armory as Hex, armoryAbi, 'buy', [1])])
await go('4 send 1 WIF to @zeron', [tx(W, wifAbi, 'approve', [D.names, maxUint256]), tx(D.names, namesAbi, 'sendToName', ['zeron', parseEther('1')])])
let best: any = null
for (let salt = 0; salt < 80 && !best; salt++) { let s = start({ kind: 'level', level: 1, salt } as any, LEVEL_KIT); const moves: any[] = []
  while (!s.done) { const m = s.charging ? 'D' : s.hp < 12 && s.potions > 0 ? 'P' : 'A'; moves.push(m); s = step(s, m) }
  if (s.cleared) best = { salt, moves } }
const r = await postRun({ player: me, level: 1, salt: best.salt, loadout: LEVEL_KIT, moves: best.moves })
await go('5 level 1 checkpoint', [tx(D.quest, questAbi, 'recordClear', [r.level, r.loot.iron, r.loot.hide, r.loot.glow, BigInt(r.deadline), r.sig])])
try { await sponsored([tx(W, wifAbi, 'transfer', [me, 1n])]); console.log('!! relay accepted bad call') } catch (e: any) { console.log('6 relay refused bad call:', e.message) }
console.log('owns bow', (await pub.readContract({ address: D.armory as Hex, abi: armoryAbi, functionName: 'arsenal', args: [me] }) as any)[0] & 2 ? 'yes' : 'no', 'name', await pub.readContract({ address: D.names, abi: namesAbi, functionName: 'nameOf', args: [me] }))
