import { keccak256, toHex } from 'viem'
export const vaultMessage = (name: string, addr: string, digest: string, ts: number) => `Zeron: save my PIN login\nname: @${name}\naddress: ${addr}\ndata: ${digest}\ntime: ${ts}`
export const vaultDigest = (b: { salt: string; verifier: string; iv: string; ct: string }) => keccak256(toHex(`${b.salt}|${b.verifier}|${b.iv}|${b.ct}`))
