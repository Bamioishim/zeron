import { defineChain, parseAbi, encodeFunctionData } from 'viem'
import deployments from './deployments.json'

export type Deployments = { chainId: number; rpc: string; explorer: string; wif: `0x${string}` | ''; game: `0x${string}` | '';
  names: `0x${string}` | ''; accountImpl: `0x${string}` | ''; quest: `0x${string}` | ''; shop?: `0x${string}`; armory?: `0x${string}`; sponsor: 'relay7702' | 'zerodev' | 'off'; network: string; burnVerified: boolean;
  questX?: `0x${string}`; relayer?: `0x${string}`; gasFeeWei?: string; rewardScaleBps?: number }
const ov = (globalThis as any).process?.env?.DEPLOYMENTS_OVERRIDE || (import.meta as any).env?.VITE_DEPLOYMENTS
export const D = (ov ? JSON.parse(ov) : deployments) as Deployments
export const deployed = !!(D.wif && D.game && D.names && D.accountImpl)

export const chain = defineChain({
  id: D.chainId, name: D.chainId === 4663 ? 'Robinhood Chain' : 'Robinhood Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [D.rpc] } }, blockExplorers: { default: { name: 'Explorer', url: D.explorer } },
})

export const wifAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)',
  'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)',
  'function burn(uint256)', 'function transfer(address,uint256) returns (bool)',
])
export const gameAbi = parseAbi([
  'function today() view returns (uint64)', 'function entryFee() view returns (uint256)', 'function itemPrice(uint8) view returns (uint256)',
  'function items(address,uint8) view returns (uint256)', 'function entered(uint64,address) view returns (bool)',
  'function pool(uint64) view returns (uint256)', 'function leader(uint64) view returns (address)', 'function topScore(uint64) view returns (uint32)',
  'function bestScore(uint64,address) view returns (uint32)', 'function nonces(address) view returns (uint64)',
  'function xp(address) view returns (uint256)', 'function streak(address) view returns (uint32)', 'function lastRunDay(address) view returns (uint64)',
  'function totalDestroyed() view returns (uint256)', 'function burnBps() view returns (uint16)', 'function useBurn() view returns (bool)',
  'function enterRanked()', 'function buy(uint8,uint256)', 'function settle(uint64)', 'function settled(uint64) view returns (bool)',
  'function recordRun(uint64 day,uint32 score,uint32 xp,uint64 deadline,uint8[] used,bytes sig)',
  'event RunRecorded(address indexed player, uint64 indexed day, uint32 score, uint32 xp, uint32 streak, bool newLeader)',
  'event Entered(address indexed player, uint64 indexed day, uint256 fee, uint256 toPool)',
  'event Bought(address indexed player, uint8 indexed item, uint256 qty, uint256 cost)',
  'event Settled(uint64 indexed day, address indexed winner, uint256 prize)',
])
export const shopAbi = parseAbi([
  'function buy(uint8)', 'function equip(uint8)', 'function claimDrop(uint8,uint256,bytes)',
  'function price(uint8) view returns (uint256)', 'function wardrobe(address) view returns (uint32 mask, uint8 eq, bool)',
  'function equipped(address) view returns (uint8)', 'function totalDestroyed() view returns (uint256)', 'function gotStarter(address) view returns (bool)',
  'event Bought(address indexed who, uint8 id, uint256 price)', 'event Destroyed(uint256 amount, bool viaBurn)',
])
export const namesAbi = parseAbi([
  'function claim(string)', 'function sendToName(string,uint256)', 'function resolve(string) view returns (address)',
  'function nameOf(address) view returns (string)', 'function renameFee() view returns (uint256)', 'function check(string) view returns (uint8)', 'function feeFor(address) view returns (uint256)', 'function valid(string) pure returns (bool)',
])
export const questXAbi = parseAbi(['function levelOf(address) view returns (uint8)', 'function nonces(address) view returns (uint64)', 'function recordClear(uint8 level, uint8 iron, uint8 hide, uint8 glow, uint64 deadline, bytes sig)'])
export const questAbi = parseAbi([
  'function players(address) view returns (uint8 level, uint8 sword, uint8 armor, uint8 charm, uint16 iron, uint16 hide, uint16 glow, uint64 nonce)',
  'function fighters(address) view returns (uint16 atk, uint16 def, uint16 hp, bool npc, uint16 rating, uint16 wins, uint16 losses, uint32 battles)',
  'function fighterList(uint256) view returns (address)', 'function fighterCount() view returns (uint256)',
  'function stats(address) view returns (uint16 atk, uint16 def, uint16 hp)', 'function craftFee() view returns (uint256)', 'function pvpStake() view returns (uint256)',
  'function recordClear(uint8 level, uint8 iron, uint8 hide, uint8 glow, uint64 deadline, bytes sig)', 'function craft(uint8 kind)',
  'function register()', 'function challenge(address defender)', 'function resolve(address challenger, bytes sig) returns (bool)', 'function cancelChallenge()',
  'function pending(address) view returns (address defender, uint64 at, uint16 aA, uint16 aD, uint16 aH, uint16 bA, uint16 bD, uint16 bH, uint256 stake)',
  'event Challenged(address indexed challenger, address indexed defender, uint32 battle)',
  'event Battle(address indexed challenger, address indexed defender, bool challengerWon, bytes32 seed, uint256 stake, uint16 cRating, uint16 dRating)',
  'event LevelCleared(address indexed player, uint8 level, uint8 iron, uint8 hide, uint8 glow)',
])
export const CLEAR_TYPES = { Clear: [
  { name: 'player', type: 'address' }, { name: 'level', type: 'uint8' }, { name: 'iron', type: 'uint8' }, { name: 'hide', type: 'uint8' },
  { name: 'glow', type: 'uint8' }, { name: 'nonce', type: 'uint64' }, { name: 'deadline', type: 'uint64' }] } as const
export const DUEL_TYPES = { Duel: [{ name: 'challenger', type: 'address' }, { name: 'defender', type: 'address' }, { name: 'battle', type: 'uint32' }] } as const
export const accountAbi = parseAbi([
  'struct Call { address to; uint256 value; bytes data; }',
  'function execute(Call[] calls, uint256 deadline, bytes sig)', 'function nonce() view returns (uint256)', 'function sponsoredToday() view returns (uint256)',
])
export const RUN_TYPES = { Run: [
  { name: 'player', type: 'address' }, { name: 'day', type: 'uint64' }, { name: 'score', type: 'uint32' }, { name: 'xp', type: 'uint32' },
  { name: 'nonce', type: 'uint64' }, { name: 'deadline', type: 'uint64' }, { name: 'used', type: 'bytes32' }] } as const
export const BATCH_TYPES = { Batch: [{ name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'callsHash', type: 'bytes32' }] } as const
export type Call = { to: `0x${string}`; value: bigint; data: `0x${string}` }

export const armoryAbi = parseAbi([
  'function buy(uint8 id)', 'function equip(uint8 id)', 'function refill()',
  'function claim(uint256 amount, uint8 ammoUsed, uint8 drop, uint256 deadline, bytes sig)',
  'function arsenal(address who) view returns (uint32 mask, uint8 eq, uint8 ammo, uint256 earnedToday, uint256 nonce)',
  'function price(uint8 id) view returns (uint256)', 'function ammoPrice() view returns (uint256)', 'function dailyCap() view returns (uint256)',
  'function totalDestroyed() view returns (uint256)', 'event Rewarded(address indexed who, uint256 amount, uint8 ammoUsed, uint8 drop)',
])

/** Standard sponsored batches repay gas in WIF: half goes to the dead address and half to the relayer.
 *  The first @name claim omits this fee. */
export function gasFeeCalls(): Call[] {
  const DEAD = '0x000000000000000000000000000000000000dEaD' as const
  const fee = BigInt(D.gasFeeWei || '0'); if (!fee || !D.relayer) return []
  const half = fee / 2n
  const t = (to: `0x${string}`, v: bigint): Call => ({ to: D.wif as `0x${string}`, value: 0n, data: encodeFunctionData({ abi: wifAbi, functionName: 'transfer', args: [to, v] }) as `0x${string}` })
  return [t(DEAD, half), t(D.relayer, fee - half)]
}
