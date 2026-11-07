// PIN vault: the browser wallet key, encrypted IN THE BROWSER with a key derived from @name + 4-digit PIN (scrypt).
// The server only ever sees: the ciphertext, a random salt, and sha256(authKey) (a second scrypt output half).
// It never sees the PIN or the raw wallet key. Wrong guesses are rate limited per name with escalating lockouts.
import { put, get } from '@vercel/blob'
import { getAddress, isAddress, recoverMessageAddress, toHex, type Hex } from 'viem'
import { sha256 } from '@noble/hashes/sha2.js'
import { D, namesAbi } from '../shared/chain'
import { pub } from './core'
import { vaultDigest, vaultMessage } from './vaultmsg'

type Rec = { v: 1; addr: Hex; salt: string; verifier: string; iv: string; ct: string; question?: string; rsalt?: string; rverifier?: string; riv?: string; rct?: string; fails: number; locks: number; lockUntil: number; updated: number }
const nameRe = /^[a-z0-9_]{3,15}$/
const hexRe = (n?: number) => new RegExp(`^0x[0-9a-f]${n ? `{${n}}` : '+'}$`)
const MAX_FAILS = 5, BASE_LOCK = 15 * 60_000, MAX_LOCK = 24 * 3600_000
const QUESTIONS = ['What is your best color?', 'What was your first pet\'s name?', 'What city were you born in?']
const path = (n: string) => `vault/${n}.json`
const err = (status: number, msg: string, extra: any = {}) => Object.assign(new Error(msg), { status, extra })

// tiny in-memory store for local tests (no BLOB token)
const mem = new Map<string, string>()
const usesMemoryStore = () => process.env.NODE_ENV !== 'production' && !process.env.BLOB_READ_WRITE_TOKEN
async function load(n: string): Promise<Rec | null> {
  if (usesMemoryStore()) { const s = mem.get(path(n)); return s ? JSON.parse(s) : null }
  const r = await get(path(n), { access: 'private', useCache: false } as any).catch(() => null) as any
  if (!r || r.statusCode !== 200) return null
  return JSON.parse(await new Response(r.stream).text())
}
async function save(n: string, rec: Rec) {
  const body = JSON.stringify(rec)
  if (usesMemoryStore()) { mem.set(path(n), body); return }
  await put(path(n), body, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 } as any)
}
const namePath = (n: string) => `names/${n}.json`
const walletPath = (a: string) => `wallets/${a.toLowerCase()}.json`
type NameRec = { addr: Hex; created: number }
async function loadName(n: string): Promise<NameRec | null> {
  if (usesMemoryStore()) { const s = mem.get(namePath(n)); return s ? JSON.parse(s) : null }
  const r = await get(namePath(n), { access: 'private', useCache: false } as any).catch(() => null) as any
  if (!r || r.statusCode !== 200) return null
  return JSON.parse(await new Response(r.stream).text())
}
async function saveName(n: string, rec: NameRec) {
  const body = JSON.stringify(rec)
  if (usesMemoryStore()) { mem.set(namePath(n), body); return }
  await put(namePath(n), body, { access: 'private', allowOverwrite: false, addRandomSuffix: false, contentType: 'application/json' } as any)
}
async function loadWalletName(addr: string): Promise<{ name: string } | null> {
  if (usesMemoryStore()) { const s = mem.get(walletPath(addr)); return s ? JSON.parse(s) : null }
  const r = await get(walletPath(addr), { access: 'private', useCache: false } as any).catch(() => null) as any
  if (!r || r.statusCode !== 200) return null
  return JSON.parse(await new Response(r.stream).text())
}
async function saveWalletName(addr: string, name: string) {
  const body = JSON.stringify({ name, updated: Date.now() })
  if (usesMemoryStore()) { mem.set(walletPath(addr), body); return }
  await put(walletPath(addr), body, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 } as any)
}
const ZERO = '0x0000000000000000000000000000000000000000' as Hex
const legacyOwner = async (n: string) => pub().readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'resolve', args: [n] }).catch(() => ZERO) as Promise<Hex>
const ownerOf = async (n: string) => {
  const r = await loadName(n)
  return r ? getAddress(r.addr) : getAddress(await legacyOwner(n))
}
const mins = (ms: number) => Math.max(1, Math.ceil(ms / 60_000))

export async function vault(body: any) {
  const op = String(body?.op || ''), name = String(body?.name || '').toLowerCase()
  if (op === 'walletName') {
    if (!isAddress(body?.addr)) throw err(400, 'Bad wallet address.')
    const addr = getAddress(body.addr)
    const stored = await loadWalletName(addr)
    if (stored?.name) return { name: stored.name }
    const legacy = await pub().readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'nameOf', args: [addr] }).catch(() => '')
    return { name: String(legacy || '') }
  }
  if (!nameRe.test(name)) throw err(400, 'Names are 3–15 characters: a–z, 0–9 and _.')
  if (op === 'lookup') {
    const stored = await loadName(name)
    const owner = stored?.addr || await legacyOwner(name)
    return { exists: !!owner && getAddress(owner) !== ZERO, addr: owner || ZERO }
  }
  if (op === 'claim') {
    const { addr, sig } = body
    const ts = Number(body.ts)
    if (!isAddress(addr) || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > 10 * 60_000) throw err(400, 'Bad name-claim data. Try again.')
    const a = getAddress(addr)
    const message = `Zeron: claim username\nname: @${name}\naddress: ${a}\ntime: ${ts}`
    const who = await recoverMessageAddress({ message, signature: sig }).catch(() => null)
    if (!who || getAddress(who) !== a) throw err(401, "Couldn't verify wallet ownership for this name.")
    const legacy = await legacyOwner(name)
    if (legacy !== ZERO && getAddress(legacy) !== a) throw err(409, `@${name} is already taken.`)
    const existing = await loadName(name)
    if (existing && getAddress(existing.addr) !== a) throw err(409, `@${name} is already taken.`)
    if (!existing) {
      try { await saveName(name, { addr: a, created: Date.now() }) }
      catch {
        const raced = await loadName(name)
        if (!raced || getAddress(raced.addr) !== a) throw err(409, `@${name} is already taken.`)
      }
    }
    await saveWalletName(a, name)
    return { ok: true, name, addr: a }
  }
  if (op === 'salt') {
    const r = await load(name)
    return r ? { exists: true, salt: r.salt, addr: r.addr, question: r.question || null, rsalt: r.rsalt || null, recovery: !!(r.rsalt && r.riv && r.rct) } : { exists: false }
  }
  if (op === 'set') {
    const { addr, salt, verifier, iv, ct, question, rsalt, rverifier, riv, rct, sig } = body; const ts = Number(body.ts)
    if (!isAddress(addr) || !hexRe(32).test(salt) || !hexRe(64).test(verifier) || !hexRe(24).test(iv) || !hexRe().test(ct) || ct.length > 400 || !QUESTIONS.includes(String(question)) || !hexRe(32).test(rsalt) || !hexRe(64).test(rverifier) || !hexRe(24).test(riv) || !hexRe().test(rct) || rct.length > 400) throw err(400, 'Bad PIN or recovery data. Try again.')
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 10 * 60_000) throw err(400, 'Your clock looks off. Try again.')
    const a = getAddress(addr)
    const who = await recoverMessageAddress({ message: vaultMessage(name, a, vaultDigest({ salt, verifier, iv, ct, question, rsalt, rverifier, riv, rct }), ts), signature: sig }).catch(() => null)
    if (!who || getAddress(who) !== a) throw err(401, "Couldn't verify this device owns that wallet.")
    if ((await ownerOf(name)) !== a) throw err(403, `@${name} isn't registered to this wallet, so you can't set its PIN.`)
    const prev = await load(name)
    if (prev && prev.lockUntil > Date.now()) throw err(423, `@${name} is locked after too many wrong PINs. Try again in ${mins(prev.lockUntil - Date.now())} min.`)
    await save(n, { v: 1, addr: a, salt, verifier, iv, ct, question, rsalt, rverifier, riv, rct, fails: 0, locks: 0, lockUntil: 0, updated: Date.now() })
    return { ok: true }
  }
  if (op === 'login') {
    const auth = String(body.auth || '')
    if (!hexRe(64).test(auth)) throw err(400, 'Bad PIN data. Try again.')
    const r = await load(name)
    if (!r) throw err(404, `@${name} has no PIN yet. Log in on the device you played on and set one.`)
    const now = Date.now()
    if (r.lockUntil > now) throw err(423, `Too many wrong PINs. @${name} is locked for ${mins(r.lockUntil - now)} more min.`, { lockedFor: r.lockUntil - now })
    const ok = toHex(sha256(Buffer.from(auth.slice(2), 'hex'))) === r.verifier
    if (!ok) {
      r.fails = (r.fails || 0) + 1
      if (r.fails >= MAX_FAILS) {
        const dur = Math.min(MAX_LOCK, BASE_LOCK * 2 ** (r.locks || 0)); r.locks = (r.locks || 0) + 1; r.fails = 0; r.lockUntil = now + dur
        await save(name, r)
        throw err(423, `Wrong PIN. Too many tries, so @${name} is locked for ${mins(dur)} min.`, { lockedFor: dur })
      }
      await save(name, r)
      const left = MAX_FAILS - r.fails
      throw err(401, `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before a lock.`, { left })
    }
    if ((await ownerOf(name)) !== getAddress(r.addr)) throw err(409, `@${name} is no longer registered to this wallet.`)
    if (r.fails || r.locks) { r.fails = 0; r.locks = 0; await save(name, r) }
    return { addr: r.addr, iv: r.iv, ct: r.ct }
  }
  if (op === 'recover') {
    const auth = String(body.auth || ''), r = await load(name)
    if (!hexRe(64).test(auth)) throw err(400, 'Bad recovery answer.')
    if (!r || !r.rsalt || !r.rverifier || !r.riv || !r.rct) throw err(404, `@${name} has no recovery question yet. Log in on the device where you set the PIN and add one.`)
    const now = Date.now()
    if (r.lockUntil > now) throw err(423, `Too many wrong answers. @${name} is locked for ${mins(r.lockUntil - now)} more min.`)
    const ok = toHex(sha256(Buffer.from(auth.slice(2), 'hex'))) === r.rverifier
    if (!ok) {
      r.fails = (r.fails || 0) + 1
      if (r.fails >= MAX_FAILS) { const dur = Math.min(MAX_LOCK, BASE_LOCK * 2 ** (r.locks || 0)); r.locks = (r.locks || 0) + 1; r.fails = 0; r.lockUntil = now + dur; await save(name, r); throw err(423, `Too many wrong answers. Try again in ${mins(dur)} min.`) }
      await save(name, r); throw err(401, `Wrong answer. ${MAX_FAILS - r.fails} tries left before a lock.`)
    }
    return { addr: r.addr, rsalt: r.rsalt, riv: r.riv, rct: r.rct }
  }
  if (op === 'reset') {
    const { addr, salt, verifier, iv, ct, auth } = body, r = await load(name)
    if (!r || !r.rsalt || !r.rverifier || !r.riv || !r.rct) throw err(404, 'Recovery is not set up for this name.')
    if (!isAddress(addr) || getAddress(addr) !== getAddress(r.addr) || !hexRe(32).test(salt) || !hexRe(64).test(verifier) || !hexRe(24).test(iv) || !hexRe().test(ct) || ct.length > 400 || !hexRe(64).test(auth)) throw err(400, 'Bad reset data.')
    if (toHex(sha256(Buffer.from(auth.slice(2), 'hex'))) !== r.rverifier) throw err(401, 'Wrong recovery answer.')
    if ((await ownerOf(name)) !== getAddress(r.addr)) throw err(409, `@${name} is no longer registered to this wallet.`)
    await save(n, { ...r, salt, verifier, iv, ct, fails: 0, locks: 0, lockUntil: 0, updated: Date.now() })
    return { ok: true }
  }
  throw err(400, 'unknown op')
}
