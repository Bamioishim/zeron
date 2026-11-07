// Server logic shared by the Vercel functions and the local e2e test.
import { parseEventLogs, createPublicClient, createWalletClient, http, decodeFunctionData, encodeFunctionData, keccak256, toHex, getAddress, hashTypedData, recoverAddress, encodeAbiParameters, isAddress, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { D, chain, gameAbi, wifAbi, namesAbi, accountAbi, questAbi, questXAbi, shopAbi, armoryAbi, RUN_TYPES, CLEAR_TYPES, DUEL_TYPES, BATCH_TYPES, type Call } from '../shared/chain'
import { rtReplay, type Ev } from '../shared/rt'
import { replay, lootFor, MAX_LEVEL, ONCHAIN_MAX_LEVEL, LEVEL_KIT, type ItemId, type Move, type Gear } from '../shared/engine'

const rpc = () => process.env.RPC_URL || D.rpc
export const pub = () => createPublicClient({ chain, transport: http(rpc()) })

/* ---------- run verification + signing ---------- */
async function armsOf(player: Hex) {
  const A = (D as any).armory as Hex; if (!A) return { w: 0, ammo: 0, nonce: 0n }
  const r = await pub().readContract({ address: A, abi: armoryAbi, functionName: 'arsenal', args: [player] }) as any
  return { w: Number(r[1]) >= 8 ? 0 : Number(r[1]), ammo: Number(r[2]), nonce: r[4] as bigint }
}
/** one batched reward claim per verified run (kills + clear WIF, ammo spent, optional drop) */
async function signClaim(key: Hex, player: Hex, nonce: bigint, earned: number, ammoUsed: number, drop = 0) {
  const A = (D as any).armory as Hex; if (!A) return null
  // earned is in reward units; real WIF paid = units * rewardScaleBps / 10000 (mainnet: 0.1 WIF per unit, max 30 WIF per run)
  const scale = BigInt(D.rewardScaleBps ?? 10000)
  const amount = BigInt(Math.max(0, Math.min(300, Math.floor(earned)))) * 10n ** 18n * scale / 10000n
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
  const sig = await privateKeyToAccount(key).signTypedData({
    domain: { name: 'ZeronArmory', version: '1', chainId: D.chainId, verifyingContract: A },
    types: { Claim: [{ name: 'player', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'ammoUsed', type: 'uint8' }, { name: 'drop', type: 'uint8' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
    primaryType: 'Claim', message: { player, amount, ammoUsed: Math.max(0, ammoUsed), drop, nonce, deadline },
  })
  return { amount: amount.toString(), earned: Number(amount / 10n ** 15n) / 1000, ammoUsed: Math.max(0, ammoUsed), drop, deadline: deadline.toString(), sig }
}
async function gearOf(player: Hex) {
  if (!D.quest) return { g: { level: 0, sword: 0, armor: 0, charm: 0 } as Gear, nonce: 0n }
  const r = await pub().readContract({ address: D.quest as Hex, abi: questAbi, functionName: 'players', args: [player] })
  const X = (D as any).questX as Hex | undefined
  const lvl = X ? Number(await pub().readContract({ address: X, abi: questXAbi, functionName: 'levelOf', args: [player] })) : r[0]
  const xn = X ? await pub().readContract({ address: X, abi: questXAbi, functionName: 'nonces', args: [player] }) as bigint : 0n
  return { g: { level: lvl, sword: r[1], armor: r[2], charm: r[3] } as Gear, nonce: r[7], xn }
}
export async function signRun(body: { player: string; event?: boolean; day?: number; level?: number; salt?: number; loadout: ItemId[]; moves?: Move[]; events?: Ev[] }) {
  const key = process.env.RUN_SIGNER_KEY?.trim() as Hex | undefined
  if (!key) throw new Error('RUN_SIGNER_KEY not set')
  if (!isAddress(body.player)) throw new Error('bad player')
  const player = getAddress(body.player)
  const p = pub()
  const { g, nonce: qn, xn } = await gearOf(player)
  const arms = await armsOf(player)
  if (body.event) {
    // Halloween event: a verified Pumpkin King kill signs a one-time costume drop (ZeronShop id 7)
    const salt = Math.max(0, Math.floor(Number(body.salt) || 0)) % 1000
    const r = rtReplay({ kind: 'event', salt }, LEVEL_KIT, body.events || [], g, arms.w, arms.ammo)
    if (!r.state.cleared) return { cleared: false, dead: r.state.dead }
    const shop = (D as any).shop as Hex; if (!shop) throw new Error('shop not deployed')
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
    const sig = await privateKeyToAccount(key).signTypedData({
      domain: { name: 'ZeronShop', version: '1', chainId: D.chainId, verifyingContract: shop },
      types: { Drop: [{ name: 'player', type: 'address' }, { name: 'id', type: 'uint8' }, { name: 'deadline', type: 'uint256' }] }, primaryType: 'Drop', message: { player, id: 7, deadline },
    })
    return { cleared: true, drop: 7, deadline: deadline.toString(), sig, claim: await signClaim(key, player, arms.nonce, r.earned, r.ammoUsed, 7) }
  }
  if (body.level) {
    // level run: boss clear -> signed checkpoint (level, loot). Only next level is accepted on-chain.
    const level = Number(body.level)
    const endgame = level > ONCHAIN_MAX_LEVEL && !!(D as any).questX
    if (level !== g.level + 1 || level > MAX_LEVEL) throw new Error(`you can play level ${Math.min(g.level + 1, MAX_LEVEL)} next`)
    const salt = Math.max(0, Math.floor(Number(body.salt) || 0)) % 1000
    const r = body.events ? rtReplay({ kind: 'level', level, salt }, LEVEL_KIT, body.events, g, arms.w, arms.ammo) : replay({ kind: 'level', level, salt }, LEVEL_KIT, body.moves || [], g)
    if (!r.state.cleared) return { cleared: false, dead: r.state.dead, level }
    const claim = 'earned' in r ? await signClaim(key, player, arms.nonce, (r as any).earned, (r as any).ammoUsed) : null
    const loot = lootFor(level)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
    // levels 7+ are recorded by the WifQuestEndgame extension (same Clear checkpoint, its own domain + nonce)
    const sig = await privateKeyToAccount(key).signTypedData({
      domain: endgame ? { name: 'WifQuestEndgame', version: '1', chainId: D.chainId, verifyingContract: (D as any).questX as Hex } : { name: 'WifQuest', version: '1', chainId: D.chainId, verifyingContract: D.quest as Hex },
      types: CLEAR_TYPES, primaryType: 'Clear', message: { player, level, ...loot, nonce: endgame ? xn : qn, deadline },
    })
    return { cleared: true, level, endgame, loot, deadline: deadline.toString(), sig, used: r.used, claim }
  }
  body.day = Number(body.day)
  const today = Number(await p.readContract({ address: D.game as Hex, abi: gameAbi, functionName: 'today' }))
  if (body.day !== today) throw new Error('wrong day')
  const lastRunDay = Number(await p.readContract({ address: D.game as Hex, abi: gameAbi, functionName: 'lastRunDay', args: [player] }))
  if (lastRunDay === today) throw new Error('daily challenge already played today')
  const r = body.events ? rtReplay({ kind: 'daily', day: body.day }, body.loadout, body.events, g, arms.w, arms.ammo) : replay(body.day, body.loadout, body.moves || [], g)
  const nonce = await p.readContract({ address: D.game as Hex, abi: gameAbi, functionName: 'nonces', args: [player] })
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
  const usedHash = keccak256(('0x' + r.used.map((u) => u.toString(16).padStart(64, '0')).join('')) as Hex) // = abi.encodePacked(uint8[]) (elements padded)
  const acct = privateKeyToAccount(key)
  const sig = await acct.signTypedData({
    domain: { name: 'WifDepths', version: '1', chainId: D.chainId, verifyingContract: D.game as Hex },
    types: RUN_TYPES, primaryType: 'Run',
    message: { player, day: BigInt(body.day), score: r.score, xp: r.xp, nonce, deadline, used: usedHash },
  })
  return { score: r.score, xp: r.xp, used: r.used, deadline: deadline.toString(), sig, cleared: r.state.cleared, dead: r.state.dead, claim: 'earned' in r && (r as any).earned > 0 ? await signClaim(key, player, arms.nonce, (r as any).earned, (r as any).ammoUsed) : null }
}

/* ---------- gas sponsorship: EIP-7702 relay ---------- */
// Per-player daily cap (20) is enforced ON-CHAIN in WifAccount.execute, so it holds across all serverless instances.

function callsHash(calls: Call[]) {
  return keccak256(('0x' + calls.map((c) => keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }], [c.to, c.value, keccak256(c.data)])).slice(2)).join('')) as Hex)
}
function checkCall(c: Call) {
  if (BigInt(c.value) !== 0n) throw new Error('value not allowed')
  const to = getAddress(c.to)
  const ours = [D.wif, D.game, D.names, D.quest, (D as any).shop, (D as any).armory, (D as any).questX].filter(Boolean).map((a) => getAddress(a as Hex))
  if (!ours.includes(to)) throw new Error(`target not sponsored: ${to}`)
  if (to === ours[0]) {
    const f = decodeFunctionData({ abi: wifAbi, data: c.data })
    if (f.functionName === 'approve') {
      if (!ours.slice(1).includes(getAddress(f.args![0] as Hex))) throw new Error('approve only our contracts')
    } else if (f.functionName === 'transfer') {
      // gas fee in WIF only: to the burn address or to the gas sponsor
      const dest = getAddress(f.args![0] as Hex)
      if (dest === '0x0000000000000000000000000000000000000000') throw new Error('transfer to zero address')
    } else throw new Error(`token call not sponsored: ${f.functionName}`)
  } else if (to === ours[1]) decodeFunctionData({ abi: gameAbi, data: c.data })
  else if (to === ours[2]) decodeFunctionData({ abi: namesAbi, data: c.data })
  else if (to === ours[3]) decodeFunctionData({ abi: questAbi, data: c.data })
  else if (to === ours[4]) decodeFunctionData({ abi: shopAbi, data: c.data })
  else if (to === ours[5]) {
    const f = decodeFunctionData({ abi: armoryAbi, data: c.data })
    if (f.functionName === 'buy' && Number(f.args![0]) === 7) throw new Error('Pumpkin Launcher is a Pumpkin King drop only')
  }
  else if (to === ours[6]) decodeFunctionData({ abi: questXAbi, data: c.data })
  else decodeFunctionData({ abi: armoryAbi, data: c.data })
}

const DEAD = getAddress('0x000000000000000000000000000000000000dEaD')
import { gasFeeCalls } from '../shared/chain'
/** fee-free onboarding batch: only the player's FIRST @name (V2 registry: first name costs nothing) */
export function isOnboarding(calls: Call[]) {
  if (calls.length !== 1) return false
  const call = calls[0]
  if (getAddress(call.to) !== getAddress(D.names as Hex)) return false
  return decodeFunctionData({ abi: namesAbi, data: call.data }).functionName === 'claim'
}
async function checkGasFee(calls: Call[], from: Hex) {
  const need = gasFeeCalls(); if (!need.length) return
  if (isOnboarding(calls)) {
    const hasName = calls.some((c) => getAddress(c.to) === getAddress(D.names as Hex))
    if (!hasName) return
    const cur = await pub().readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'nameOf', args: [from] }) as string
    if (!cur) return
    throw new Error('Renaming costs WIF; only your first @name is free.')
  }
  if (calls.length < 3 || need.some((c, i) => calls[i].data.toLowerCase() !== c.data.toLowerCase() || getAddress(calls[i].to) !== getAddress(c.to)))
    throw new Error('gas fee in WIF missing')

}
export async function relay(body: { from: string; calls: { to: string; value: string; data: string }[]; deadline: string; sig: Hex;
  authorization?: { address: Hex; chainId: number; nonce: number; r: Hex; s: Hex; yParity: number } }) {
  if (D.sponsor !== 'relay7702') throw new Error('relay disabled (sponsor mode ' + D.sponsor + ')')
  if (process.env.SPONSOR_PAUSED === 'true') throw new Error('Gas sponsorship is paused right now. Free play still works.')
  const key = process.env.RELAYER_KEY?.trim() as Hex | undefined
  if (!key) throw new Error('RELAYER_KEY not set')
  const from = getAddress(body.from)
  const calls: Call[] = body.calls.map((c) => ({ to: getAddress(c.to), value: BigInt(c.value), data: c.data as Hex }))
  if (calls.length < 1 || calls.length > 8) throw new Error('1-8 calls')
  calls.forEach(checkCall)
  const startsDuel = calls.some((c) => getAddress(c.to) === getAddress(D.quest as Hex) && decodeFunctionData({ abi: questAbi, data: c.data }).functionName === 'challenge')
  if (startsDuel && !process.env.RUN_SIGNER_KEY?.trim()) throw new Error('RUN_SIGNER_KEY not set; arena duel resolution is unavailable. No transaction was sent.')
  await checkGasFee(calls, from)
  const p = pub()
  const code = await p.getCode({ address: from })
  const delegated = !!code && code.toLowerCase() === ('0xef0100' + (D.accountImpl as string).slice(2)).toLowerCase()
  let authorizationList: any[] | undefined
  if (!delegated) {
    const a = body.authorization
    if (!a) throw new Error('needs authorization')
    if (getAddress(a.address) !== getAddress(D.accountImpl as Hex) || a.chainId !== D.chainId) throw new Error('bad authorization')
    authorizationList = [{ address: a.address, chainId: a.chainId, nonce: a.nonce, r: a.r, s: a.s, yParity: a.yParity }]
  }
  // Stale-state guard: the client signs with the account nonce it read. If its RPC read lagged
  // (e.g. right after its previous tx), the signature is for the wrong nonce and execute() reverts
  // "bad sig". Detect that here and hand back the real state so the client can re-sign.
  const n = delegated ? await p.readContract({ address: from, abi: accountAbi, functionName: 'nonce' }) as bigint : 0n
  const txNonce = await p.getTransactionCount({ address: from })
  const stale = () => Object.assign(new Error('stale'), { stale: { delegated, nonce: n.toString(), txNonce } })
  if (!delegated && body.authorization && body.authorization.nonce !== txNonce) throw stale()
  {
    const digest = hashTypedData({ domain: { name: 'WifAccount', version: '1', chainId: D.chainId, verifyingContract: from },
      types: BATCH_TYPES, primaryType: 'Batch', message: { nonce: n, deadline: BigInt(body.deadline), callsHash: callsHash(calls) } })
    const who = await recoverAddress({ hash: digest, signature: body.sig }).catch(() => null)
    if (!who || getAddress(who) !== from) throw stale()
  }
  if (delegated) {
    const used = await p.readContract({ address: from, abi: accountAbi, functionName: 'sponsoredToday' })
    const cap = BigInt(Math.min(20, Number(process.env.SPONSOR_DAILY_CAP || 20)))
    if (used >= cap) throw new Error(`Daily limit of ${cap} sponsored moves reached. Come back tomorrow!`)
  }
  const relayer = privateKeyToAccount(key)
  const minBal = BigInt(process.env.SPONSOR_MIN_BALANCE_WEI || '20000000000000') // auto-pause below ~0.00002 ETH
  if ((await p.getBalance({ address: relayer.address })) < minBal) throw new Error('Gas sponsor pot is low; sponsorship paused until it is topped up.')
  const w = createWalletClient({ account: relayer, chain, transport: http(rpc()) })
  const data = encodeFunctionData({ abi: accountAbi, functionName: 'execute', args: [calls, BigInt(body.deadline), body.sig] })
  // simulate first so we never pay for a failing tx
  const fee = BigInt(D.gasFeeWei || '0')
  if (fee && !isOnboarding(calls)) {
    const bal = await p.readContract({ address: D.wif as Hex, abi: wifAbi, functionName: 'balanceOf', args: [from] }) as bigint
    if (bal < fee) throw new Error(`no gas wif: every move costs ${Number(fee) / 1e18} WIF in gas and you have ${Number(bal * 1000n / 10n ** 18n) / 1000}. Earn WIF in the dungeon or receive WIF from another player.`)
  }
  let gas: bigint
  try { gas = await p.estimateGas({ account: relayer, to: from, data, authorizationList } as any) }
  catch (e: any) {
    const why = String(e?.details || e?.shortMessage || e?.message || '').match(/reverted(?: with reason string)?:?\s*['"]?([^'"\n]+)/i)?.[1]?.trim()
    console.warn('relay estimate failed', from, String(e?.shortMessage || e?.message).slice(0, 300))
    throw new Error(why && !/unknown reason/i.test(why) ? `reverted: ${why}` : 'reverted: the chain rejected this action (nothing was spent)')
  }
  let hash: Hex | undefined
  for (let i = 0; i < 4 && !hash; i++) {
    try {
      const nonce = await p.getTransactionCount({ address: relayer.address, blockTag: 'pending' })
      hash = await w.sendTransaction({ to: from, data, authorizationList, gas: (gas * 13n) / 10n, nonce } as any)
    } catch (e: any) {
      if (!/nonce|underpriced|already known/i.test(String(e?.message)) || i === 3) throw e
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 800))
    }
  }
  if (!hash) throw new Error('relay busy, try again')
  const rcpt = await p.waitForTransactionReceipt({ hash, timeout: 60_000 })
  const out: any = { hash, status: rcpt.status, gasUsed: rcpt.gasUsed.toString(), explorer: `${D.explorer}/tx/${hash}` }
  // PvP reveal: the stake is now locked, so sign the duel and resolve it. The seed is hash(server signature).
  const ch = D.quest ? parseEventLogs({ abi: questAbi, logs: rcpt.logs, eventName: 'Challenged' }).filter((l) => getAddress(l.address) === getAddress(D.quest as Hex)) : []
  if (ch.length) {
    const sk = process.env.RUN_SIGNER_KEY?.trim() as Hex
    const ev = ch[0].args as any
    const dsig = await privateKeyToAccount(sk).signTypedData({
      domain: { name: 'WifQuest', version: '1', chainId: D.chainId, verifyingContract: D.quest as Hex },
      types: DUEL_TYPES, primaryType: 'Duel', message: { challenger: ev.challenger, defender: ev.defender, battle: ev.battle } })
    const rdata = encodeFunctionData({ abi: questAbi, functionName: 'resolve', args: [ev.challenger, dsig] })
    const rgas = await p.estimateGas({ account: relayer, to: D.quest as Hex, data: rdata })
    let rh: Hex | undefined
    for (let i = 0; i < 4 && !rh; i++) {
      try { const nonce = await p.getTransactionCount({ address: relayer.address, blockTag: 'pending' }); rh = await w.sendTransaction({ to: D.quest as Hex, data: rdata, gas: (rgas * 13n) / 10n, nonce } as any) }
      catch (e: any) { if (!/nonce|underpriced|already known/i.test(String(e?.message)) || i === 3) throw e; await new Promise((r) => setTimeout(r, 400 + Math.random() * 800)) }
    }
    await p.waitForTransactionReceipt({ hash: rh!, timeout: 60_000 })
    out.resolve = rh; out.challengeExplorer = out.explorer; out.explorer = `${D.explorer}/tx/${rh}`
  }
  return out
}
export { toHex }
