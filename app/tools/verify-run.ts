#!/usr/bin/env node
/**
 * Independently replay a Zeron real-time run and verify its EIP-712 signature.
 *
 * Usage:
 *   cd app && npm run verify:run -- ../path/to/run.json
 *
 * JSON fields:
 *   kind: "daily" | "level"
 *   player, signer, verifyingContract, chainId, nonce, deadline, signature
 *   events: [{ r: roomIndex, t: tick, m: "A"|"D"|"P"|"S"|"F"|"N" }]
 *   gear: { level, sword, armor, charm }   (optional; use the run-start snapshot)
 *   weapon, ammo                            (optional; use the run-start snapshot)
 *   daily: day, loadout
 *   level: level, salt
 *
 * This checks deterministic replay and the signer signature. It does not prove
 * that the submitted event log came from an untampered client or decentralize
 * the single RUN_SIGNER_KEY trust boundary.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { verifyTypedData, keccak256, type Hex, type Address } from 'viem'
import { rtReplay, type Ev } from '../src/shared/rt'
import { LEVEL_KIT, NOGEAR, lootFor, type Gear, type ItemId } from '../src/shared/engine'
import { CLEAR_TYPES, RUN_TYPES } from '../src/shared/chain'

type Input = {
  kind: 'daily' | 'level'
  player: Address
  signer: Address
  verifyingContract: Address
  chainId: number
  nonce: string
  deadline: string
  signature: Hex
  events: Ev[]
  gear?: Gear
  weapon?: number
  ammo?: number
  day?: number
  loadout?: ItemId[]
  level?: number
  salt?: number
  domainName?: string
}

function usedHash(used: number[]): Hex {
  const encoded = '0x' + used.map((n) => BigInt(n).toString(16).padStart(64, '0')).join('')
  return keccak256(encoded as Hex)
}

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('Pass a JSON run file: npm run verify:run -- ./run.json')
  const input = JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8')) as Input
  if (!['daily', 'level'].includes(input.kind)) throw new Error('kind must be daily or level')
  if (!Array.isArray(input.events)) throw new Error('events must be an array')
  if (!input.player || !input.signer || !input.verifyingContract || !input.signature) throw new Error('Missing player, signer, verifyingContract or signature')

  const gear = input.gear ?? NOGEAR
  const weapon = input.weapon ?? 0
  const ammo = input.ammo ?? 0
  let replayed: ReturnType<typeof rtReplay>
  let domainName: string
  let types: any
  let primaryType: 'Run' | 'Clear'
  let message: Record<string, unknown>

  if (input.kind === 'daily') {
    if (!Number.isInteger(input.day) || !Array.isArray(input.loadout)) throw new Error('Daily run requires day and loadout')
    replayed = rtReplay({ kind: 'daily', day: input.day! }, input.loadout!, input.events, gear, weapon, ammo)
    domainName = input.domainName ?? 'WifDepths'
    types = RUN_TYPES
    primaryType = 'Run'
    message = {
      player: input.player,
      day: BigInt(input.day!),
      score: replayed.score,
      xp: replayed.xp,
      nonce: BigInt(input.nonce),
      deadline: BigInt(input.deadline),
      used: usedHash(replayed.used),
    }
  } else {
    if (!Number.isInteger(input.level) || !Number.isInteger(input.salt)) throw new Error('Level run requires level and salt')
    replayed = rtReplay({ kind: 'level', level: input.level!, salt: input.salt! }, LEVEL_KIT, input.events, gear, weapon, ammo)
    if (!replayed.state.cleared) throw new Error('Replay did not clear the level')
    const loot = lootFor(input.level!)
    domainName = input.domainName ?? (input.level! > 6 ? 'WifQuestEndgame' : 'WifQuest')
    types = CLEAR_TYPES
    primaryType = 'Clear'
    message = {
      player: input.player,
      level: input.level!,
      ...loot,
      nonce: BigInt(input.nonce),
      deadline: BigInt(input.deadline),
    }
  }

  const valid = await verifyTypedData({
    address: input.signer,
    domain: { name: domainName, version: '1', chainId: input.chainId, verifyingContract: input.verifyingContract },
    types,
    primaryType,
    message,
    signature: input.signature,
  } as any)

  const report = {
    replayValid: true,
    signatureValid: valid,
    kind: input.kind,
    player: input.player,
    result: input.kind === 'daily'
      ? { score: replayed.score, xp: replayed.xp, cleared: replayed.state.cleared, dead: replayed.state.dead, used: replayed.used }
      : { level: input.level, cleared: replayed.state.cleared, dead: replayed.state.dead, loot: lootFor(input.level!) },
    signer: input.signer,
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  if (!valid) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n')
  process.exitCode = 1
})
