import { keccak256, toHex } from 'viem'
export const vaultMessage = (name: string, addr: string, digest: string, ts: number) => `Zeron: save my PIN login\nname: @${name}\naddress: ${addr}\ndata: ${digest}\ntime: ${ts}`
export const vaultDigest = (b: { salt: string; verifier: string; iv: string; ct: string; question?: string; rsalt?: string; rverifier?: string; riv?: string; rct?: string }) => keccak256(toHex(`${b.salt}|${b.verifier}|${b.iv}|${b.ct}|${b.question || ''}|${b.rsalt || ''}|${b.rverifier || ''}|${b.riv || ''}|${b.rct || ''}`))
