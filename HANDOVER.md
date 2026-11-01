# Zeron — handover

Zeron is a top-down pixel dungeon crawler built for the **World is Flat** hackathon (closes **Thu 12 Nov 2026, 6:30 PM WAT**; game must stay live until **16 Nov**). Town hub, levels with unique enemy families and bosses, shop, wardrobe, crafting, PvP, Halloween content. Every item and action uses **$wif on Robinhood Chain mainnet (chain id 4663)**; players never need ETH — gas is sponsored and paid back in $wif.

Live: https://zeron-game.vercel.app

## Stack
- `app/` — React 19 + Vite + TypeScript, viem. Game runs in the browser; each player gets a local key (`app/src/wallet.ts`).
- `app/api/` — Vercel serverless functions: `relay.ts` (sponsored meta-tx relayer / paymaster), `run.ts` (signs run results), `vault.ts` (name + 4-digit PIN login store). Logic in `app/src/server/`.
- `contracts/` — Foundry (solc 0.8.28, via_ir). Run `forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts` to restore `lib/`.
- `brand/`, `deploy-assets/` — art and assets.

## Run locally
```
cd app && npm install && npm run dev        # game at localhost:5173
npx tsx scripts/e2e-mainnet.ts              # end-to-end test (needs PLAYER_KEY, spends real $wif)
cd contracts && forge build && forge test
```
Without `BLOB_READ_WRITE_TOKEN` the PIN vault uses an in-memory store.

## Deploy
Vercel project serving zeron-game.vercel.app (root `app/`). Env var **names** (values live only in Vercel — never commit them):
- `RELAYER_KEY` — gas sponsor/relayer wallet key
- `RUN_SIGNER_KEY` — signs level/run rewards
- `RPC_URL` — Robinhood Chain mainnet RPC
- `SPONSOR_DAILY_CAP`, `SPONSOR_MIN_BALANCE_WEI`, `SPONSOR_PAUSED` — sponsor safety limits (auto-pauses when ETH is low)
- `DEPLOYMENTS_OVERRIDE` — optional JSON of contract addresses
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob store for name/PIN records (PINs are stored hashed)

## Mainnet contracts (chain 4663, explorer robinhoodchain.blockscout.com)
| Contract | Address |
|---|---|
| Game | 0x7a9b811C490F4F089f63bC6001d801216846Fbd8 |
| Quest | 0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451 |
| QuestEndgame | 0xDC9100bDFfC996e509b0e49934aF006785887Fa6 |
| Names | 0x4A09d12912dA069687Ce1F568908D18409Eb3B63 |
| Shop | 0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE |
| Armory | 0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7 |
| WifAccount | 0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392 |
| WIF token | 0x5173b8eA6923c2d40267890D45C46a3480954773 |

Example mainnet txs are listed in `README.md`.

## Economy
- 0.2 $wif fee per sponsored action: half burned, half to the gas sponsor.
- First name claim is free. Names are unique ("@x is already taken").
- Login = @name + 4-digit PIN (5 wrong tries → 15 min lock).
- New players get 5 $wif; weapons 6–25 $wif; rewards capped at 10 $wif/day.

## Done
Mainnet deploy + end-to-end test with a zero-ETH wallet; name claim fix; PIN login; shop, wardrobe, bosses, mobile controls.

## Next
1. Demo video — focus on $wif moving onchain (claim, buy, gas-in-$wif, burn).
2. Keep live and sponsored until 16 Nov. Sponsor has ~280 actions left; top up the relayer with a little ETH if it pauses.
3. Any contract change needs the **deployer key, which is NOT in this repo** — ask Bamio.
4. Linking this repo to the Vercel project: Vercel dashboard → Project → Settings → Git → Connect `Bamioishim/zeron`, root directory `app`. Check env vars are unchanged before the first auto-deploy.
