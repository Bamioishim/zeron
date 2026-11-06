// Embedded "burner" wallet: a key generated in this browser. It never holds ETH;
// our sponsor pays gas via EIP-7702 (the key delegates once to WifAccount, then signs batches).
import { createPublicClient, http, keccak256, encodeAbiParameters, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { D, chain, accountAbi, BATCH_TYPES, gasFeeCalls, shopAbi, namesAbi, type Call } from './shared/chain'
import { decodeFunctionData } from 'viem'

const KEY = 'wifdepths.key.v1'
export function getKey(): Hex {
  let k = localStorage.getItem(KEY) as Hex | null
  if (!k) { k = generatePrivateKey(); localStorage.setItem(KEY, k) }
  return k
}
export function setKey(k: Hex) { localStorage.setItem(KEY, k) }
export const account = () => privateKeyToAccount(getKey())
export const pub = createPublicClient({ chain, transport: http(D.rpc) })
const API = (import.meta as any).env?.VITE_API_BASE || ''

export function callsHash(calls: Call[]) {
  const hs = calls.map((c) => keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }], [c.to, c.value, keccak256(c.data)])))
  return keccak256(hs.length ? (('0x' + hs.map((h) => h.slice(2)).join('')) as Hex) : '0x')
}

let queue: Promise<any> = Promise.resolve()
/** One sponsored batch at a time (parallel batches would sign the same account nonce). */
const fnOf = (c: Call, abi: any) => { try { return decodeFunctionData({ abi, data: c.data }).functionName } catch { return '' } }
/** welcome gift and/or FIRST @name: free for the player (no WIF gas fee). Mirrors the relay's isOnboarding check. */
export async function isFreeOnboarding(calls: Call[]) {
  if (!calls.length || calls.length > 2) return false
  let claim = false
  for (const c of calls) {
    const to = c.to.toLowerCase()
    if (D.shop && to === D.shop.toLowerCase() && fnOf(c, shopAbi) === 'starter') continue
    if (to === (D.names as string).toLowerCase() && fnOf(c, namesAbi) === 'claim') { claim = true; continue }
    return false
  }
  if (!claim) return true
  const cur = await pub.readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'nameOf', args: [account().address] }) as string
  return !cur
}
export function sponsored(calls: Call[]): Promise<{ hash: Hex; explorer: string }> {
  // Standard sponsored batches prepend a 0.2 WIF fee split between the dead address and relayer; onboarding batches are free.
  const prep = async () => ((await isFreeOnboarding(calls)) ? calls : [...gasFeeCalls(), ...calls])
  const go = () => prep().then((c) => sponsoredOnce(c, 0))
  const run = queue.then(go, go)
  queue = run.catch(() => {})
  return run
}
type Hint = { delegated: boolean; nonce: string; txNonce: number }
async function sponsoredOnce(calls: Call[], attempt: number, hint?: Hint): Promise<{ hash: Hex; explorer: string }> {
  if (D.sponsor === 'zerodev') throw new Error('ZeroDev mode needs a project id (see README)')
  const acct = account()
  let delegated: boolean
  if (hint) delegated = hint.delegated
  else {
    const code = await pub.getCode({ address: acct.address, blockTag: 'pending' } as any)
    delegated = !!code && code.toLowerCase() === ('0xef0100' + D.accountImpl.slice(2)).toLowerCase()
  }
  let authorization: any
  if (!delegated) {
    const nonce = hint ? hint.txNonce : await pub.getTransactionCount({ address: acct.address, blockTag: 'pending' })
    const a = await acct.signAuthorization({ address: D.accountImpl as Hex, chainId: D.chainId, nonce })
    authorization = { address: a.address, chainId: a.chainId, nonce: a.nonce, r: a.r, s: a.s, yParity: a.yParity }
  }
  const n = hint ? BigInt(hint.nonce) : delegated ? await pub.readContract({ address: acct.address, abi: accountAbi, functionName: 'nonce', blockTag: 'pending' } as any) as bigint : 0n
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
  const sig = await acct.signTypedData({
    domain: { name: 'WifAccount', version: '1', chainId: D.chainId, verifyingContract: acct.address },
    types: BATCH_TYPES, primaryType: 'Batch', message: { nonce: n, deadline, callsHash: callsHash(calls) },
  })
  const r = await fetch(`${API}/api/relay`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from: acct.address, calls: calls.map((c) => ({ ...c, value: c.value.toString() })), deadline: deadline.toString(), sig, authorization }) })
  const j = await r.json().catch(() => ({ error: 'relay failed' }))
  // the relay saw newer account state than we did: re-sign once with its numbers
  if (!r.ok && j.stale && attempt < 2) return sponsoredOnce(calls, attempt + 1, j.stale)
  if (!r.ok) throw new Error(j.error || 'relay failed')
  if (j.status !== 'success') throw new Error('tx reverted: ' + j.hash)
  return j
}

export async function postRun(body: any) {
  const r = await fetch(`${API}/api/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json(); if (!r.ok) throw new Error(j.error || 'run check failed'); return j
}
