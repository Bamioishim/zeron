// Live on-chain reads for the homepage stats strip, the Burn panel and the leaderboard. No made-up numbers.
import { parseAbi, type Hex } from 'viem'
import { D, gameAbi, questAbi, shopAbi, armoryAbi, wifAbi } from './shared/chain'
import { pub } from './wallet'
const sinkAbi = parseAbi(['function totalDestroyed() view returns (uint256)', 'event Destroyed(uint256 amount, bool viaBurn)'])
export const SINKS = () => [['Dungeon (entries + shop items)', D.game], ['Forge + Arena', D.quest], ['@names', D.names], ['Wardrobe shop', D.shop], ['Armory (weapons)', (D as any).armory]].filter((x) => x[1]) as [string, Hex][]
const range = async (n = 400000n) => { const latest = await pub.getBlockNumber(); return { fromBlock: latest > n ? latest - n : 0n, toBlock: latest } }

export async function totalBurned() {
  const v = await Promise.all(SINKS().map(([, a]) => pub.readContract({ address: a, abi: sinkAbi, functionName: 'totalDestroyed' }).catch(() => 0n) as Promise<bigint>))
  return { total: v.reduce((a, b) => a + b, 0n), parts: SINKS().map(([l, a], i) => ({ label: l, addr: a, v: v[i] })) }
}
export async function homeStats() {
  const r = await range()
  const [b, names, clears] = await Promise.all([totalBurned(),
    pub.getLogs({ address: D.names as Hex, event: parseAbi(['event NameClaimed(address indexed who, string name)'])[0], ...r }).catch(() => []),
    pub.getContractEvents({ address: D.quest as Hex, abi: questAbi, eventName: 'LevelCleared', ...r }).catch(() => [])])
  return { burned: b.total, players: new Set((names as any[]).map((l) => l.args?.who)).size, clears: (clears as any[]).length }
}
export type BurnRow = { player: string; amount: bigint; sink: string; hash: Hex; block: bigint }
/** recent Destroyed events across every fee sink; the paying player is the 7702 account the tx was sent to */
export async function recentBurns(limit = 200): Promise<BurnRow[]> {
  const r = await range()
  const all = (await Promise.all(SINKS().map(async ([label, a]) => (await pub.getLogs({ address: a, event: sinkAbi[1] as any, ...r }).catch(() => [])).map((l: any) => ({ l, label }))))).flat()
  all.sort((x, y) => Number(y.l.blockNumber - x.l.blockNumber))
  const pick = all.slice(0, limit)
  const txs = new Map<string, string>()
  await Promise.all([...new Set(pick.map((p) => p.l.transactionHash))].map(async (h) => { try { const t = await pub.getTransaction({ hash: h }); txs.set(h, (t.to || '') as string) } catch { /* skip */ } }))
  return pick.map((p) => ({ player: txs.get(p.l.transactionHash) || '', amount: p.l.args.amount as bigint, sink: p.label, hash: p.l.transactionHash, block: p.l.blockNumber }))
}
export async function wardrobeOf(who: string): Promise<{ mask: number; eq: number; starterUsed: boolean } | null> {
  if (!D.shop) return null
  try { const r = await pub.readContract({ address: D.shop, abi: shopAbi, functionName: 'wardrobe', args: [who as Hex] }) as any; return { mask: Number(r[0]), eq: Number(r[1]), starterUsed: r[2] } } catch { return null }
}
export async function shopPrices() {
  if (!D.shop) return {} as Record<number, bigint>
  const ids = [1, 2, 3, 4, 5, 6, 7]
  const v = await Promise.all(ids.map((i) => pub.readContract({ address: D.shop!, abi: shopAbi, functionName: 'price', args: [i] }) as Promise<bigint>))
  return Object.fromEntries(ids.map((i, k) => [i, v[k]])) as Record<number, bigint>
}
/** WIF destroyed inside one tx (sum of Destroyed logs from our sinks) */
export async function burnedIn(hash: Hex) {
  const rc = await pub.waitForTransactionReceipt({ hash, timeout: 15000 })
  const sinks = SINKS().map(([, a]) => a.toLowerCase())
  let s = 0n
  for (const l of rc.logs) if (sinks.includes(l.address.toLowerCase()) && l.topics[0] === '0x' + DESTROYED_TOPIC) s += BigInt(l.data.slice(0, 66))
  return s
}
import { toEventSelector } from 'viem'
const DESTROYED_TOPIC = toEventSelector('Destroyed(uint256,bool)').slice(2)
void gameAbi

export async function arsenalOf(who: string) {
  const A = (D as any).armory as Hex | undefined; if (!A) return null
  try {
    const [r, allow] = await Promise.all([pub.readContract({ address: A, abi: armoryAbi, functionName: 'arsenal', args: [who as Hex] }) as Promise<any>, pub.readContract({ address: D.wif as Hex, abi: wifAbi, functionName: 'allowance', args: [who as Hex, A] }) as Promise<bigint>])
    return { a: { mask: Number(r[0]), eq: Number(r[1]), ammo: Number(r[2]), earnedToday: r[3] as bigint }, allow }
  } catch { return null }
}
