# Zeron

**Zeron is a daily pixel dungeon game built around the real World is Flat ($WIF) token on Robinhood Chain.** Players claim an `@name`, explore dungeons, fight, compete in ranked runs, buy gear, and send WIF to other players.

> **At a glance**
> - **Play:** https://zeron-game.vercel.app
> - **Network:** Robinhood Chain mainnet · chain ID `4663`
> - **Token:** WIF · `0x5173b8eA6923c2d40267890D45C46a3480954773`
> - **Ranked prize pool:** ranked entries and daily-item purchases pay WIF fees; 80% enters that day's on-chain Game prize pool. After the day ends, anyone can settle it to the top ranked player. This is a ranked prize loop, not an Armory funding loop.
> - **Live proof metrics:** the homepage now reads named wallets, 7-day returning players, recorded runs, EIP-7702 batches, prize-pool inflows and payouts, Armory balance, and estimated Armory reward runway directly from Robinhood Chain events. These are live counters, not practice-mode estimates.
> - **Economy limits:** 0.2 WIF per standard sponsored batch; the last documented production Armory cap is 10 WIF per wallet/day (the Solidity constructor default is 150 WIF, so verify the live `dailyCap()` getter); reward pools are finite.
>
> **Status honesty:** mainnet contracts and WIF-denominated economy actions are deployed. The demo's combat footage is practice-mode footage. Do not treat simulated HUD rewards as paid on-chain rewards. Retention and economy metrics shown on the live homepage are derived from public mainnet events.

## What players can do

1. **Create a game wallet.** Zeron creates a wallet in the browser. Players do not need to connect MetaMask or Phantom or hold ETH.
2. **Claim an identity.** Claim a unique `@name`. The first name claim is free.
3. **Explore and fight.** Move around the town, enter the dungeon, fight enemies and bosses, and save level progress.
4. **Build a character.** Buy weapons, refill ammo, collect items, craft upgrades, and equip costumes.
5. **Compete.** Enter the daily ranked run and challenge players or NPCs in the arena.
6. **Use WIF socially.** Send WIF to another player by their `@name`.

Free movement and combat are handled in the browser. Economy actions and saved progress use the deployed smart contracts.

## Mainnet token and contracts

The production frontend reads its network and contract configuration from `app/src/shared/deployments.json`.

| Contract | Address |
|---|---|
| World is Flat (WIF) token | [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773) |
| Game | [`0x7a9b811C490F4F089f63bC6001d801216846Fbd8`](https://robinhoodchain.blockscout.com/address/0x7a9b811C490F4F089f63bC6001d801216846Fbd8) |
| Quest | [`0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451`](https://robinhoodchain.blockscout.com/address/0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451) |
| Quest endgame | [`0xDC9100bDFfC996e509b0e49934aF006785887Fa6`](https://robinhoodchain.blockscout.com/address/0xDC9100bDFfC996e509b0e49934aF006785887Fa6) |
| Name registry | [`0x4A09d12912dA069687Ce1F568908D18409Eb3B63`](https://robinhoodchain.blockscout.com/address/0x4A09d12912dA069687Ce1F568908D18409Eb3B63) |
| Shop | [`0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE`](https://robinhoodchain.blockscout.com/address/0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE) |
| Armory | [`0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7`](https://robinhoodchain.blockscout.com/address/0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7) |
| EIP-7702 account implementation | [`0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392`](https://robinhoodchain.blockscout.com/address/0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392) |
| Relayer | [`0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a`](https://robinhoodchain.blockscout.com/address/0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a) |
| Treasury / deployer | [`0x2bCEc454514201d867982ecDE9766DC2ed87958E`](https://robinhoodchain.blockscout.com/address/0x2bCEc454514201d867982ecDE9766DC2ed87958E) |

The old testnet deployment used chain ID `46630` and MockWIF. It is historical only and must not be used for production transactions: https://wif-depths-5ak1srszj-bamioishim.vercel.app

## Armory rewards: team-funded for now

The Armory reward pool is **not self-sustaining**. The deployed `ZeronArmory` source has no fee-split setter or automatic route from weapon/ammo purchases into the reward pool. Purchases pass through `_takeFee()`; the retained amount is sent to the treasury. The `burnBps` setting controls the destroyed share, not reward funding. **0% of weapon/ammo fees is currently routed to Armory rewards.**

- **Live pool balance:** [Read the WIF balance held by the Armory on Blockscout](https://robinhoodchain.blockscout.com/address/0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7?tab=tokens). The balance is live; we do not hard-code a stale snapshot here.
- **Reward cap:** the last production verification recorded 10 WIF per wallet/day. The Solidity constructor default is 150 WIF and the owner can change it with `setCap`; use the live `dailyCap()` getter as the source of truth before quoting the production cap.
- **Runway:** the homepage's Armory runway metric uses current pool balance divided by average Armory payouts over the trailing seven days. If there were no payouts in that window, runway is unavailable rather than an invented number. The daily cap is a maximum, not expected daily outflow.
- **Top-up policy:** the team reviews the pool every Monday. If the live balance is below 30 days of payouts at the trailing-seven-day average, the team tops it back up to that 30-day target. This is an operational treasury commitment, not an on-chain automatic refill. Rewards remain subject to available funds.
- **Funding source:** treasury transfers only. Weapon and ammo fees do not feed the pool. Do not describe Armory rewards as a self-sustaining flywheel unless fee routing is deployed and verified on-chain.

## How WIF and gas work

Players do not need ETH. Zeron uses an EIP-7702 delegated account and a relayer that submits approved, player-signed batches and pays the network gas in ETH.

A **standard sponsored batch costs 0.2 WIF**:
- **0.1 WIF** is transferred to the dead address: `0x000000000000000000000000000000000000dEaD`.
- **0.1 WIF** is transferred to the relayer to reimburse the sponsor.

The starter grant and the player's first `@name` claim are free-onboarding exceptions. Other sponsored batches require the WIF gas fee. The account contract enforces a maximum of **20 sponsored batches per player per day**; the current production relayer setting is **10 sponsored batches per player per day**, and the relayer can impose a lower limit or pause sponsorship.

### Fee destruction is not native token burning

The deployed FeeSink contracts use `useBurn = false`. Their configured fee share is transferred to the dead address. This removes those tokens from practical circulation, but **does not reduce WIF total supply** through the token's native `burn()` function.

Current mainnet fee shares:
- Game and Quest: **20%** to the dead address.
- Names, Shop, and Armory: **50%** to the dead address.
- PvP stake resolution: **10%** to the dead address.

The remaining share is routed according to the specific contract. In particular, Game ranked-entry and daily-item fees retain 80% in the Game contract's daily prize pool; this does not automatically fund the separate Armory reward pool. The on-chain setting `burnVerified` remains `false`. Zeron must not be described as using native token burning unless that configuration is deliberately changed and verified.

### Mainnet economy snapshot

| Action | Current amount |
|---|---:|
| One-time starter grant | 5 WIF |
| First `@name` claim | Free |
| Rename | 5 WIF |
| Ranked entry | 10 WIF |
| Daily-run items | 2.5 / 4 / 4 WIF |
| Crafting base fee | 2 WIF per tier |
| PvP stake | 1 WIF |
| Weapons | 6–25 WIF |
| Ammo refill | 1.5 WIF |
| Costumes | 6–15 WIF |
| Armory reward cap | 10 WIF per wallet per day |

Play-to-earn rewards come from the separate prefunded Armory pool. They are not minted, are scaled by the mainnet reward setting, are limited by the on-chain daily cap, and stop when the pool runs out. The Game prize pool does not automatically refill the Armory pool. There is no automatic replenishment mechanism in the current deployment; an authorized operator must fund the Armory contract. Rewards are not guaranteed income.

For the detailed per-function flows, current settings, and read-only verification commands, see [the tokenomics guide](docs/TOKENOMICS.md).

## Verifiable scoring and current trust boundary

The run API replays the submitted event log using the shared deterministic game engine before signing a result. Anyone can independently repeat that replay with [`app/tools/verify-run.ts`](app/tools/verify-run.ts):

```bash
cd app
npm run verify:run -- ./run.json
```

The input JSON must include the signed run's player, signer, verifying contract, chain ID, nonce, deadline, signature, event log, and the run-start gameplay snapshot (gear, weapon, ammo, plus day/loadout for daily runs or level/salt for level runs). The verifier recomputes the result and checks the EIP-712 signature.

The contracts also enforce EIP-712 signatures: `WifDepths.recordRun` checks the Run signature; `WifQuest.recordClear` and `WifQuestEndgame.recordClear` check Clear signatures; and `WifQuest.resolve` checks the Duel signature before resolving a PvP stake. These checks prevent arbitrary unsigned claims, but they do **not** remove trust in the authorized signer.

**Known limitation:** the level salt is currently client-influenced. A server commitment published at run start and a later seed reveal are not yet implemented. Scoring therefore still relies on one authorized signer today. The replay logic is open and independently reproducible; multi-signer verification and a committed-seed start/reveal flow are the next decentralization steps. This is not fully decentralized scoring.

## How the app is built

| Area | Technology and responsibility |
|---|---|
| `app/` | React, Vite, TypeScript, viem. Browser game, wallet, UI, and client-side transaction preparation. |
| `app/api/` | Vercel serverless endpoints for relaying transactions, signing run results, and PIN/recovery vault operations. |
| `app/src/server/` | TypeScript source for server-side relay and signing logic. |
| `contracts/` | Solidity smart contracts and Foundry deployment/test scripts. |
| `docs/` | Tokenomics, maintainer notes, demo media, and social copy. |
| `brand/`, `deploy-assets/` | Project identity and visual assets. |

The browser creates and stores the player's local wallet key. The player signs the exact transaction batch; the relayer cannot change the signed calls. The relay endpoint allowlists contract calls and checks sponsorship rules before submitting them.

The run API deterministically replays submitted gameplay and signs eligible results. This is server-trusted scoring, not a fully trustless game engine. For the current stage, replay validation is a practical anti-tampering layer: it prevents the browser from simply declaring an arbitrary score and makes reward eligibility depend on a server-checked replay. The trade-off is explicit trust in the run service and signing key. The planned decentralization path is to publish replay inputs and deterministic rules, move validation to independently reproducible verifiers, and ultimately make reward claims verifiable on-chain or through a challenge window. Until then, scores and signatures remain server-authorized.

## Run locally

### Requirements

- Node.js compatible with the app's Vite and TypeScript toolchain.
- npm.
- Foundry, if you want to build or test the Solidity contracts.

### Frontend

```bash
cd app
npm install
npm run dev
```

Vite serves the app locally (normally at http://localhost:5173).

The production build runs Oxlint in error-only mode, the TypeScript project check, and the Vite production build in sequence. Run `npm run lint` directly to see non-blocking warnings as well.

Useful app scripts:

```bash
npm run build
npm run lint
npm run preview
```

### Smart contracts

The Foundry dependencies are not committed. Install them from the `contracts/` directory, then build and test:

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test
```

The mainnet deployment script is `contracts/script/DeployMainnet.s.sol`. It expects deployment inputs from the environment. Do not run a deployment script against mainnet unless you are intentionally deploying contracts with the required owner/deployer authority and have reviewed every address and parameter.

The end-to-end mainnet script can spend real WIF. Only run it with a dedicated test wallet and an explicit test budget.

## Vercel configuration

The Vercel project is connected to this GitHub repository and serves the app from the `app/` root directory. Pushes to non-production branches create preview deployments; the `main` branch is the production release branch.

The following environment variable **names** are used by the app. Their values belong in Vercel's encrypted environment settings, never in Git:

| Variable | Purpose |
|---|---|
| `RELAYER_KEY` | Relayer wallet private key used to pay ETH gas. |
| `RUN_SIGNER_KEY` | Key used to sign verified run/reward messages. |
| `RPC_URL` | Optional Robinhood Chain RPC override. |
| `SPONSOR_DAILY_CAP` | Optional relayer-side sponsored-batch cap; cannot exceed the on-chain cap. |
| `SPONSOR_MIN_BALANCE_WEI` | Relayer ETH balance floor. Code default is `20000000000000` wei if unset. |
| `SPONSOR_PAUSED` | Set to `true` to pause sponsored transactions. |
| `DEPLOYMENTS_OVERRIDE` | Optional JSON override for network/contract configuration. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access for persistent encrypted PIN/recovery vault records. |

Without `BLOB_READ_WRITE_TOKEN`, the vault falls back to in-memory storage. That is suitable for local development, not persistent production recovery.

## Security and known limitations

- Never commit `.env`, private keys, wallet exports, Vercel tokens, or Blob credentials.
- The player's private key is created in the browser. PIN/recovery vault records store encrypted wallet ciphertext and one-way verifiers, not plaintext PINs or answers.
- The relayer is trusted to submit allowlisted batches and pay gas. The run signer is trusted to validate and sign gameplay results.
- Reward and starter pools are finite. A displayed reward is not a promise that the pool will always have funds.
- The game uses a client-influenced level salt; ranked scoring also relies on server-side replay and signatures.
- Auto-Hunt is not available on the current mainnet deployment. Armory item ID 8 has no configured sale price and is not offered in the shop.
- The current destruction model sends configured fee shares to the dead address. It does not call the token's native `burn()` function.

## Demo and project documentation

- [Desktop demo video (~63 seconds)](docs/assets/zeron-desktop-demo.mp4)
- [Demo screenshots and captions](docs/assets/CAPTIONS.md)
- [Tokenomics and fee mechanics](docs/TOKENOMICS.md)
- [Changelog and historical implementation notes](CHANGELOG.md)
- [Maintainer handover](HANDOVER.md)
- [Four-post X thread copy](docs/SOCIAL-THREAD.md)

The repository's existing desktop video still contains local practice-mode combat and must not be submitted as proof of live gameplay. The live app homepage now reads wallet, retention, run, prize-pool, and Armory runway metrics from public mainnet events. Record a fresh screen capture of a real ranked entry, on-chain run recording, and the resulting prize settlement before presenting gameplay footage as mainnet proof. The homepage's EIP-7702 batch metric counts matching `Executed` events from the last seven days; it is a best-effort indexed metric, not a lifetime total. The visible run count is a separate count of `RunRecorded` events.

## Art and audio credits

- Dungeon tiles, props, and monsters: **DungeonTileset II v1.7** by 0x72, CC0 1.0: https://0x72.itch.io/dungeontileset-ii
- Hero and UI sprites: original assets created for this project.
- Title music: **Cave Theme** by Brandon Morris (haeldb), CC0: https://opengameart.org/content/cave-theme
- Dungeon ambience: by yd, CC0: https://opengameart.org/content/dungeon-ambience
- Sound effects: **512 Sound Effects (8-bit style)** by Juhani Junkala (SubspaceAudio), CC0: https://opengameart.org/content/512-sound-effects-8-bit-style

Audio remains muted until the player interacts with the page.
