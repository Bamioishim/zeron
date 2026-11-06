# Zeron maintainer handover

This document is the operational guide for maintaining the live Zeron deployment. It intentionally contains configuration names and public contract addresses only. **Do not add private keys, wallet exports, personal recovery status, or secret environment values here.**

## Release at a glance

- **Production app:** https://zeron-game-sigma.vercel.app
- **GitHub:** https://github.com/Bamioishim/zeron
- **Production branch:** `main`
- **Vercel project:** `zeron-game`
- **Vercel root directory:** `app/`
- **Network:** Robinhood Chain mainnet, chain ID `4663`
- **RPC:** https://rpc.mainnet.chain.robinhood.com
- **Explorer:** https://robinhoodchain.blockscout.com
- **Canonical WIF:** `0x5173b8eA6923c2d40267890D45C46a3480954773`

The Vercel project is connected to this GitHub repository. Non-production branches are preview releases; pushes to `main` are production releases. Always verify the target branch and deployment state before treating a URL as production.

Vercel SSO protection is enabled for **preview deployments only**. Production domains are public so players can access the game. Do not change this to `all_except_custom_domains` unless production access is intentionally being gated.

The legacy hostname `zeron-game.vercel.app` is still assigned to a separate older Vercel project/deployment. It was not reassigned during this release. Do not move that alias unless the owner explicitly requests the routing change.

## Repository layout

- `app/` — React 19, Vite, TypeScript, and viem frontend.
- `app/api/` — Vercel serverless entry points for relay, run signing, and vault operations.
- `app/src/server/` — TypeScript source for server-side logic. The API entry files are committed runtime bundles; update them only through the project's established build process.
- `app/src/shared/` — chain configuration, ABIs, and shared game logic.
- `contracts/` — Solidity contracts and Foundry scripts.
- `docs/` — tokenomics, screenshots, demo media, and social copy.
- `brand/`, `deploy-assets/` — branding and artwork.

## Local development and checks

Frontend:

```bash
cd app
npm install
npm run dev
npm run build
npm run lint
```

The production build runs Oxlint in error-only mode, the TypeScript project check, and the Vite build in sequence; the explicit `npm run lint` command also displays non-blocking warnings.

Contracts:

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test
```

The mainnet end-to-end script spends real WIF. Do not run it against a production wallet as a routine health check. Use a dedicated test wallet, confirm its funding and budget, and review the script before execution.

## Production environment variables

Values are stored in Vercel. This file documents names and intent only.

| Variable | Purpose |
|---|---|
| `RELAYER_KEY` | Private key for the wallet that pays sponsored transaction gas. |
| `RUN_SIGNER_KEY` | Private key for signing validated run and reward messages. |
| `RPC_URL` | Optional RPC endpoint override. |
| `SPONSOR_DAILY_CAP` | Relayer-side cap for sponsored batches per player/day. |
| `SPONSOR_MIN_BALANCE_WEI` | Minimum relayer ETH balance before sponsorship pauses. |
| `SPONSOR_PAUSED` | Emergency sponsorship switch; set to `true` to pause. |
| `DEPLOYMENTS_OVERRIDE` | Optional JSON contract/network override. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access for encrypted PIN/recovery records. |

The code default for `SPONSOR_MIN_BALANCE_WEI` is `20000000000000` wei (0.00002 ETH) when the variable is unset. A Vercel production value can override that default. Never assume the production value from repository code alone.

The `WifAccount` contract enforces a hard maximum of **20 sponsored batches per player per day**. The relayer's `SPONSOR_DAILY_CAP` may impose a lower limit. Sponsorship also depends on the relayer having enough ETH and not being manually paused.

If `BLOB_READ_WRITE_TOKEN` is absent, the vault uses in-memory storage. That is not persistent across serverless instances and is not suitable for production recovery.

## Mainnet contracts

All addresses below are on Robinhood Chain, chain ID `4663`.

| Contract | Address |
|---|---|
| WIF token | `0x5173b8eA6923c2d40267890D45C46a3480954773` |
| Game | `0x7a9b811C490F4F089f63bC6001d801216846Fbd8` |
| Quest | `0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451` |
| QuestEndgame | `0xDC9100bDFfC996e509b0e49934aF006785887Fa6` |
| Name registry | `0x4A09d12912dA069687Ce1F568908D18409Eb3B63` |
| Shop | `0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE` |
| Armory | `0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7` |
| EIP-7702 account implementation | `0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392` |
| Relayer | `0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a` |
| Treasury / deployer | `0x2bCEc454514201d867982ecDE9766DC2ed87958E` |

The canonical token and contract addresses also appear in `app/src/shared/deployments.json`. Keep that file, the deploy script, and this table consistent.

## Economy and fee model

- Players do not need ETH. The relayer pays network gas.
- A standard sponsored batch costs **0.2 WIF**: 0.1 WIF goes to the dead address and 0.1 WIF goes to the relayer.
- The starter grant and first `@name` claim are free-onboarding exceptions.
- Game and Quest FeeSinks send 20% of configured fees to the dead address.
- Names, Shop, and Armory FeeSinks send 50% to the dead address.
- PvP stake resolution sends 10% of the stake to the dead address.
- The deployed FeeSinks use `useBurn=false`. This is dead-address destruction, **not** a native token `burn()` call and not a reduction of WIF total supply.
- Armory rewards come from a prefunded pool. The on-chain daily cap is 10 WIF per wallet, and the mainnet reward scale is 10%.
- Auto-Hunt is not offered on mainnet: Armory item ID 8 has no configured sale price.

See [docs/TOKENOMICS.md](docs/TOKENOMICS.md) for per-function details and read-only verification commands.

## Wallet, PIN, and recovery behavior

The game wallet key is generated and stored in the player's browser. PIN and recovery flows encrypt the wallet locally. The server-side vault stores encrypted wallet data and one-way verifiers, not plaintext PINs or recovery answers.

A legacy vault record without recovery fields must be updated by its owner from an already-unlocked wallet using the in-app Change PIN flow. Never add a hardcoded PIN, administrative bypass, or a server-side decryption shortcut. Those would create an account-takeover path.

## Deployment procedure

1. Make changes on a feature branch.
2. Let Vercel create a preview deployment and verify its commit, build state, and URL.
3. Run the frontend build/lint and relevant contract tests.
4. Review the exact diff, especially anything touching wallet signing, relaying, recovery, contract addresses, or fee logic.
5. Merge the reviewed change into `main`.
6. Verify the production deployment is `READY`, targets `main`, and points to the expected commit.
7. Smoke-test the public app and read-only contract pages. Do not make real-money transactions as a smoke test.

Do not deploy a preview branch directly to the production domain. Do not run contract deployment scripts as part of a frontend release.

## Operational safety

- Monitor relayer ETH balance and WIF gas reimbursement balance. The code's default pause floor is not proof of the production environment value.
- Use `SPONSOR_PAUSED=true` if sponsorship must be stopped immediately.
- Keep `SPONSOR_DAILY_CAP` at or below the on-chain cap.
- Recheck reward-pool balances before promising rewards. Pool balances are prepaid and finite; there is no automatic top-up implied by the contracts.
- Verify live balances and contract parameters with read-only RPC calls. Funding snapshots belong in dated operational reports, not permanent project docs.
- Contract changes require the authorized deployer/owner key. That key must remain outside this repository and outside chat.
- Never commit `.env`, private keys, wallet JSON, Vercel tokens, Blob tokens, or user-specific recovery details.

## Known limitations

- The relayer submits allowlisted calls and pays ETH gas; it is a trusted operational component.
- Run results are replayed and signed by a server key. This is not fully trustless scoring.
- Level salt is client-influenced.
- Starter and reward pools are finite.
- Mainnet FeeSink destruction is a dead-address transfer. Native token burning is not enabled.
- The old testnet deployment (chain ID `46630`) and MockWIF addresses are historical only.

## Demo and supporting docs

- [Desktop demo video](docs/assets/zeron-desktop-demo.mp4)
- [Screenshots and captions](docs/assets/CAPTIONS.md)
- [Tokenomics](docs/TOKENOMICS.md)
- [X thread copy](docs/SOCIAL-THREAD.md)

The gameplay portion of the demo was recorded in local practice mode and is not evidence of on-chain gameplay transactions or token transfers. The public-site menus and tracker footage show the production interface.
