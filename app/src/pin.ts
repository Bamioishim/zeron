// PIN login. The wallet key is encrypted here, in the browser, with a key derived from @name + PIN (scrypt).
// The server stores only ciphertext + salt + a hash of a separate auth key; it never sees the PIN or the wallet key.
import { scryptAsync } from '@noble/hashes/scrypt.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, toHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { vaultDigest, vaultMessage } from './server/vaultmsg'
import { getKey, setKey } from './wallet'

export const pinRe = /^\d{4}$/
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 64 }
async function derive(name: string, secret: string, saltHex: string, kind = 'pin') {
  const salt = new Uint8Array([...new TextEncoder().encode(`zeron-${kind}-v1:${name}:`), ...(hexToBytes(saltHex as Hex) as any)])
  const out = await scryptAsync(new TextEncoder().encode(secret), salt, SCRYPT)
  const aes = await crypto.subtle.importKey("raw", out.slice(0, 32) as any, 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { aes, auth: out.slice(32) }
}
async function api(body: any) {
  const r = await fetch(((import.meta as any).env?.VITE_API_BASE || '') + '/api/vault', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
  if (!r) throw new Error("Can't reach the server right now. Try again.")
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Try again.'), j)
  return j
}
export const hasPin = async (name: string) => !!(await api({ op: 'salt', name })).exists
/** Claim a username in the off-chain registry after proving wallet ownership with a signed message. */
export async function claimName(name: string) {
  const acct = privateKeyToAccount(getKey())
  const ts = Date.now()
  const message = `Zeron: claim username\nname: @${name}\naddress: ${acct.address}\ntime: ${ts}`
  const sig = await acct.signMessage({ message })
  await api({ op: 'claim', name, addr: acct.address, ts, sig })
}
export async function lookupName(name: string): Promise<string> {
  const r = await api({ op: 'lookup', name })
  return String(r.addr || '0x0000000000000000000000000000000000000000')
}
export async function nameForAddress(addr: string): Promise<string> {
  const r = await api({ op: 'walletName', addr })
  return String(r.name || '')
}
export const RECOVERY_QUESTIONS = ['What is your best color?', "What was your first pet's name?", 'What city were you born in?']
const answer = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
async function encryptedKey(name: string, secret: string, salt: string, kind: string) {
  const { aes, auth } = await derive(name, secret, salt, kind)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = bytesToHex(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`${name}|${privateKeyToAccount(getKey()).address}`) }, aes, (hexToBytes(getKey()) as any))))
  return { salt, verifier: toHex(sha256(auth)), iv: bytesToHex(iv), ct }
}
export async function setPin(name: string, pin: string, question: string, recoveryAnswer: string) {
  if (!pinRe.test(pin)) throw new Error('PIN must be 4 digits.')
  if (!RECOVERY_QUESTIONS.includes(question) || answer(recoveryAnswer).length < 2) throw new Error('Choose a recovery question and enter an answer.')
  const acct = privateKeyToAccount(getKey())
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const pinBox = await encryptedKey(name, pin, salt, 'pin')
  const rsalt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const recoveryBox = await encryptedKey(name, answer(recoveryAnswer), rsalt, 'recovery')
  const b = { ...pinBox, question, rsalt, rverifier: recoveryBox.verifier, riv: recoveryBox.iv, rct: recoveryBox.ct }
  const ts = Date.now()
  const sig = await acct.signMessage({ message: vaultMessage(name, acct.address, vaultDigest(b), ts) })
  await api({ op: 'set', name, addr: acct.address, ...b, ts, sig })
}
/** returns the restored address; stores the key in this browser */
export async function loginPin(name: string, pin: string) {
  if (!pinRe.test(pin)) throw new Error('PIN must be 4 digits.')
  const s = await api({ op: 'salt', name })
  if (!s.exists) throw new Error(`@${name} has no PIN yet. Open Zeron on the device you played on and set one.`)
  const { aes, auth } = await derive(name, pin, s.salt)
  const r = await api({ op: 'login', name, auth: bytesToHex(auth) })
  const pk = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: (hexToBytes(r.iv) as any), additionalData: new TextEncoder().encode(`${name}|${r.addr}`) }, aes, (hexToBytes(r.ct) as any)).catch(() => null)
  if (!pk) throw new Error("PIN was right but the saved login couldn't be opened. Set your PIN again on your old device.")
  const key = bytesToHex(new Uint8Array(pk))
  if (privateKeyToAccount(key).address.toLowerCase() !== String(r.addr).toLowerCase()) throw new Error("Saved login didn't match @" + name + '.')
  setKey(key); return r.addr as string
}
export async function resetPin(name: string, recoveryAnswer: string, newPin: string) {
  if (!pinRe.test(newPin)) throw new Error('PIN must be 4 digits.')
  const s = await api({ op: 'salt', name })
  if (!s.recovery || !s.rsalt) throw new Error('This account has no recovery question yet.')
  const { aes, auth } = await derive(name, answer(recoveryAnswer), s.rsalt, 'recovery')
  const r = await api({ op: 'recover', name, auth: bytesToHex(auth) })
  const pk = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(r.riv as Hex) as any, additionalData: new TextEncoder().encode(`${name}|${r.addr}`) }, aes, hexToBytes(r.rct as Hex) as any).catch(() => null)
  if (!pk) throw new Error("That answer couldn't unlock the account.")
  const key = bytesToHex(new Uint8Array(pk)); if (privateKeyToAccount(key).address.toLowerCase() !== String(r.addr).toLowerCase()) throw new Error('Recovered wallet did not match this name.')
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const { aes: naes, auth: nauth } = await derive(name, newPin, salt, 'pin')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = bytesToHex(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`${name}|${r.addr}`) }, naes, hexToBytes(key) as any)))
  await api({ op: 'reset', name, auth: bytesToHex(auth), addr: r.addr, salt, verifier: toHex(sha256(nauth)), iv: bytesToHex(iv), ct })
  setKey(key); return r.addr as string
}
