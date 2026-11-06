# Zeron — handover

Zeron is a top-down pixel dungeon for the **World is Flat** hackathon (closes **Thu 12 Nov 2026, 18:30 WAT**; stay live until **16 Nov**). Town hub, levels, shop, wardrobe, crafting, PvP, Halloween content. Economy uses **real $wif** on **Robinhood Chain mainnet (4663)**. Players need 0 ETH; gas is sponsored and repaid in $wif. Fee shares are **destroyed to `0x…dEaD`** (`useBurn=false` on FeeSinks)—see [docs/TOKENOMICS.md](docs/TOKENOMICS.md).

Live: https://zeron-game.vercel.app  
Token CA: `0x5173b8eA6923c2d40267890D45C46a3480954773` ([@WIFonRH](https://x.com/WIFonRH))

## Stack
- `app/` — React 19 + Vite + TypeScript, viem. Local player key in `app/src/wallet.ts`.
- `app/api/` — Vercel functions: `relay.js`, `run.js`, `vault.js` (bundled; TS sources under `app/src/server/`).
- `contracts/` — Foundry. Mainnet deploy script: `contracts/script/DeployMainnet.s.sol`.
- `docs/TOKENOMICS.md` — detailed fees, burn mode, funding snapshot, verification.
- `brand/`, `deploy-assets/` — art assets.

## Run locally
```
cd app && npm install && npm run dev        # localhost:5173
npx tsx scripts/e2e-mainnet.ts              # spends real $wif; needs PLAYER_KEY
cd contracts && forge build && forge test
```
Without `BLOB_READ_WRITE_TOKEN` the PIN vault uses in-memory storage.

Production `deployments.json` is mainnet, so Enter the Depths prompts `@name`. Opening / Burn / How-it-works are safe chrome. Relayed actions cost **0.2 WIF** gas unless they are free onboarding (`starter` and/or first `@name` claim only—see TOKENOMICS §4). Demo gameplay used the existing `deployed===false` practice path via blank `VITE_DEPLOYMENTS` (not a new feature; no mainnet spend). Reviewed demo: [docs/assets/zeron-desktop-demo.mp4](docs/assets/zeron-desktop-demo.mp4).

## Deploy
Vercel project for zeron-game.vercel.app (root `app/`). Env **names** only in docs (values in Vercel):
`RELAYER_KEY`, `RUN_SIGNER_KEY`, `RPC_URL`, `SPONSOR_DAILY_CAP`, `SPONSOR_MIN_BALANCE_WEI`, `SPONSOR_PAUSED`, `DEPLOYMENTS_OVERRIDE`, `BLOB_READ_WRITE_TOKEN`.

## Mainnet contracts (4663)
Canonical WIF: `0x5173b8eA6923c2d40267890D45C46a3480954773` — explorer https://robinhoodchain.blockscout.com

| Contract | Address |
|---|---|
| Game | 0x7a9b811C490F4F089f63bC6001d801216846Fbd8 |
| Quest | 0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451 |
| QuestEndgame | 0xDC9100bDFfC996e509b0e49934aF006785887Fa6 |
| Names | 0x4A09d12912dA069687Ce1F568908D18409Eb3B63 |
| Shop | 0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE |
| Armory | 0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7 |
| WifAccount | 0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392 |
| Relayer | 0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a |
| Treasury | 0x2bCEc454514201d867982ecDE9766DC2ed87958E |

## Economy (live — do not use stale 150/350/testnet figures)
- Gas fee: **0.2 WIF**/sponsored batch → 0.1 dEaD + 0.1 relayer.
- FeeSinks: `useBurn=false`; game/quest **20%** destroy; names/shop/armory **50%**; PvP stake burn **10%**.
- Starter **5 WIF**; ranked entry **10**; items 2.5/4/4; weapons 6–25; ammo 1.5; rename 5; craft base 2; PvP stake 1.
- Armory `dailyCap()` = **10 WIF/day** (on-chain). Frontend `rewardScaleBps=1000`.
- First `@name` free. PIN + recovery as in README.

`burnVerified` remains **false** until a deliberate native-burn cutover.

## Funding snapshot (point-in-time)
**2026-11-06 ~02:02 WAT** (public RPC): relayer ≈ **0.000799 ETH** + 1 WIF; armory **194.3 WIF**; shop **80 WIF**; treasury ≈ **92.86 WIF** + dust ETH. Quiet since **2026-11-01** (no ongoing spend observed). Prepaid on-chain only—cannot infer bank auto-debits. Details: [docs/TOKENOMICS.md](docs/TOKENOMICS.md) §6.

## Done
Mainnet deploy + e2e; name claim; PIN login; recovery-question reset; shop, wardrobe, bosses, mobile controls; docs pass clarifying real WIF + dead-address destroy model (**this branch**).

## Next
1. Demo media reviewed: [docs/assets/zeron-desktop-demo.mp4](docs/assets/zeron-desktop-demo.mp4), stills in [docs/assets/CAPTIONS.md](docs/assets/CAPTIONS.md), thread [docs/SOCIAL-THREAD.md](docs/SOCIAL-THREAD.md). Economy detail [docs/TOKENOMICS.md](docs/TOKENOMICS.md).
2. Keep live + sponsored through **16 Nov**; top up relayer ETH if balance falls below the configured `SPONSOR_MIN_BALANCE_WEI` (repo default if unset: **2e13** wei ≈ 0.00002 ETH in `app/src/server/core.ts` — production env may differ).
3. Optional UI copy fixes (starter “350”, “150 WIF/day” strings) in a **code** PR—out of scope for docs-only.
4. Contract changes need the **deployer key (not in repo)** — ask Bamio.
5. Link this GitHub repo to the Vercel project when ready; confirm env vars before first auto-deploy.
6. `@bamio` vault checked **4 Nov 2026** as legacy (`recovery: false`)—Change PIN on unlocked wallet to add recovery.

## Art / audio
Preserve credits in README (DungeonTileset II CC0 by 0x72; original hero/UI; OpenGameArt CC0 audio). Do not strip footer credits when editing docs.
