// End-to-end on a chain (local anvil or testnet): fresh 0-ETH player, everything via the sponsor relay.
import { encodeFunctionData, parseEther, formatEther, maxUint256, type Hex } from 'viem'
import { generatePrivateKey } from 'viem/accounts'
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
mem['wifdepths.key.v1'] = process.env.PLAYER_KEY || generatePrivateKey()
const { sponsored, postRun, account, pub } = await import('../src/wallet')
const { D, wifAbi, gameAbi, namesAbi } = await import('../src/shared/chain')
const { start, step, scoreOf } = await import('../src/shared/engine')
const W = D.wif as Hex, G = D.game as Hex, N = D.names as Hex
const me = account().address
const tx = (to: Hex, abi: any, functionName: string, args: any[] = []) => ({ to, value: 0n, data: encodeFunctionData({ abi, functionName, args } as any) })
const log = (s: string, r?: any) => console.log(s, r ? r.explorer || r.hash : '')

console.log('player', me, 'ETH', formatEther(await pub.getBalance({ address: me })))
const supply0 = await pub.readContract({ address: W, abi: wifAbi, functionName: 'totalSupply' })
log('1 delegate+faucet+approve+enterRanked+buy potion+whetstone', await sponsored([
  tx(W, wifAbi, 'faucet'), tx(W, wifAbi, 'approve', [G, maxUint256]), tx(W, wifAbi, 'approve', [N, maxUint256]),
  tx(G, gameAbi, 'enterRanked'), tx(G, gameAbi, 'buy', [1, 2n]), tx(G, gameAbi, 'buy', [2, 1n])]))
const name = 'p' + me.slice(2, 8).toLowerCase()
log('2 claim @' + name, await sponsored([tx(N, namesAbi, 'claim', [name])]))
// play: drink potion when low, else attack
const day = Number(await pub.readContract({ address: G, abi: gameAbi, functionName: 'today' }))
const loadout = [1, 1, 2] as any
let s = start(day, loadout); const moves: any[] = []
while (!s.done) { const m = s.charging ? 'D' : s.hp < 14 && s.potions > 0 ? 'P' : 'A'; moves.push(m); s = step(s, m) }
console.log('run', scoreOf(s), 'cleared', s.cleared, 'turns', s.turn)
const signed = await postRun({ player: me, day, loadout, moves })
log('3 recordRun', await sponsored([tx(G, gameAbi, 'recordRun', [BigInt(day), signed.score, signed.xp, BigInt(signed.deadline), signed.used, signed.sig])]))
const friend = process.env.FRIEND_NAME
if (friend) log('4 send 5 WIF to @' + friend, await sponsored([tx(N, namesAbi, 'sendToName', [friend, parseEther('5')])]))
// negative: relay must refuse a non-allowlisted call
try { await sponsored([tx(W, wifAbi, 'approve', [me, 1n])]); console.log('!! relay accepted bad call') } catch (e: any) { console.log('relay refused bad call:', e.message) }
const r = async (fn: string, args: any[]) => pub.readContract({ address: G, abi: gameAbi, functionName: fn, args } as any)
console.log({ eth: formatEther(await pub.getBalance({ address: me })), wif: formatEther(await pub.readContract({ address: W, abi: wifAbi, functionName: 'balanceOf', args: [me] })),
  pool: formatEther(await r('pool', [BigInt(day)]) as bigint), leader: await r('leader', [BigInt(day)]), streak: await r('streak', [me]), xp: await r('xp', [me]),
  potionsLeft: await r('items', [me, 1]), burned: formatEther(supply0 + 10000n * 10n ** 18n - await pub.readContract({ address: W, abi: wifAbi, functionName: 'totalSupply' })),
  name: await pub.readContract({ address: N, abi: namesAbi, functionName: 'nameOf', args: [me] }) })
console.log('NAME', name)
