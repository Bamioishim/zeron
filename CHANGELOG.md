# Zeron changelog and historical notes

This file contains implementation history, testnet context, migration evidence, and older design notes that are intentionally kept out of the submission README.

## 2026-11-09 — self-funding flywheel (proposed)

- Armory purchase remainder retained in-contract as the reward pool (no treasury skim).
- On-chain 24h inflow payout cap (`inflowPayoutBps`, default 65%).
- Ranked settle pays top 3 (`placeBps` default 50/30/20).
- Relayer WIF→ETH helper via Uniswap v3; blocked today by zero WIF/WETH pool liquidity.
- Not deployed to mainnet in this change.

## 2026-11-09 — landing restore production cutover

- Squashed the long `landing-restore` draft PR onto `main` as a single clean change set (backup tag `backup/pr4-tip-3c66fa4`).
- Restored compact landing, Menu → Stats/Profile, PIN vault + recovery signature fixes, Blob-backed vault, off-chain username registry, 12-level campaign, and daily gauntlet updates.
- Removed the one-time starter WIF claim from the app path.
- Canonical production URL: `https://zeron-game.vercel.app` (Vercel project `wif-depths`).
- Fixed Open Graph / Twitter meta to the production domain and added `app/public/og.png`.

## 2026-11-06 — submission cleanup

- Clarified that Armory rewards are treasury-funded, with 0% of weapon/ammo fees routed to the pool.
- Added the manual Monday review / 30-day target top-up policy and retained the live Blockscout balance link.
- Removed the Armory runway estimate because a dated Blockscout balance snapshot could not be verified for submission.

- Reframed the README around the live game, the actual two-part economy, and evidence-bounded traction claims.
- Clarified that Armory rewards are funded by manual project-WIF transfers and are not currently self-funded by play.
- Clarified that weapon fees go to the dead address and treasury, not the Armory reward pool.
- Standardized the current production URL as `https://zeron-game.vercel.app`.
- Standardized the documented production sponsor cap as 10 sponsored moves per wallet per day.
- Removed the older public-seed PvP description from the current README; current PvP is commit/reveal-style state with server-signed resolution.
- Documented the known potion-loadout balance issue and the proposed per-run budget or diminishing-returns fix.

## 2026-11-04 to 2026-11-06 — gameplay and economy updates

- Every normal and Halloween run starts at 100 HP / 100 EP, including when advancing to another level.
- Enemy damage was reduced to keep the longer runs fair.
- Each normal level received four or five minions before its boss; Halloween received four minions.
- Dungeon layouts use seeded variations, with distinct layouts across levels.
- A boss-room barrier prevents entry until all minions are defeated.
- Town dungeon entrance was redesigned around a castle landmark with a floating ENTER label.
- Reward schedule: 3 WIF per small enemy, 10 WIF per boss, and 10 WIF per level clear.
- Production Armory reward cap was verified as 10 WIF per wallet per day.
- Auto-Hunt / Armory item 8 was left unavailable because its deployed price is zero.
- PIN recovery was added using client-side encryption and recovery questions. Legacy records must be migrated through Change PIN while the wallet is unlocked.
- Bundled `run.js`, `vault.js`, and `relay.js` serverless functions to resolve Vercel ESM/TypeScript module-loading failures.

## Mainnet economy facts

- Chain: Robinhood Chain mainnet, ID 4663.
- Canonical project WIF: `0x5173b8eA6923c2d40267890D45C46a3480954773`.
- Production destruction mode is `useBurn=false`: destruction transfers go to `0x000000000000000000000000000000000000dEaD` and do not reduce total token supply.
- Sponsored actions charge 0.2 WIF: 0.1 WIF to the dead address and 0.1 WIF to reimburse the gas sponsor.
- Ranked entry and consumable/crafting fees route 20% to the dead address and 80% to the daily ranked pool.
- Weapon purchases route 50% to the dead address and 50% to the treasury; they do not fund the Armory reward pool.
- The Armory is a finite, pre-funded reward pool. The owner refills it by transferring project WIF to the Armory contract.

## Mainnet contracts

| Contract | Address |
|---|---|
| WIF | `0x5173b8eA6923c2d40267890D45C46a3480954773` |
| WifAccount | `0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392` |
| Game | `0x7a9b811C490F4F089f63bC6001d801216846Fbd8` |
| Quest | `0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451` |
| QuestEndgame | `0xDC9100bDFfC996e509b0e49934aF006785887Fa6` |
| NameRegistryV2 | `0x4A09d12912dA069687Ce1F568908D18409Eb3B63` |
| ZeronShop | `0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE` |
| ZeronArmory | `0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7` |

## Mainnet migration transactions

- Bridge, Solana → Robinhood: [0x04581af3…c093](https://robinhoodchain.blockscout.com/tx/0x04581af3c77d09b80725720bb1195ee23ab8784a5d8f6be05945eedbf826c093)
- Swap 0.00022 ETH → 406.36 WIF: [0x04c062df…4e9d](https://robinhoodchain.blockscout.com/tx/0x04c062dfdc1dc358ed76556d094fcf6bd8098735efe37eba3cbd3b0831434e9d)
- 1 WIF transfer to the dead address: [0x469f4305…9ab6](https://robinhoodchain.blockscout.com/tx/0x469f4305f29547611cf40f50a403a5e02f7ffee202c02828368eca4f1e929ab6)
- Seed Shop with 100 WIF: [0x43754d4d…36e2](https://robinhoodchain.blockscout.com/tx/0x43754d4da4329495d633ca3a03131ace122d15dec6801c239709cbb2ffe336e2)
- Seed Armory with 200 WIF: [0xc3656127…9e13](https://robinhoodchain.blockscout.com/tx/0xc36561272e98f05be70e5ea9591583b89d9354eeb5993543bbd0a6a4f6939e13)
- Fund e2e player with 20 WIF: [0xe091fa23…6f527e](https://robinhoodchain.blockscout.com/tx/0xe091fa23aed4747f47f413c14f057738c235b3e2be31b354f4b937488e6f527e)
- Fund relayer with 0.00085 ETH: [0xfa0f29c7…3ad3](https://robinhoodchain.blockscout.com/tx/0xfa0f29c7cb24fbec8c1130b4f1b90b408199425bd938957167ee04ee92033ad3)
- Treasury claim for `@zeron`: [0x0692ee28…a0a4](https://robinhoodchain.blockscout.com/tx/0x0692ee28fa6b1cdb50f6ab4064e43d79dd23ef78ceb7487cc9a6d6d2101ea0a4)

## Mainnet zero-ETH end-to-end proof

Player wallet: `0x8E5280E28fF90B546dB58fB0aF6cd7661be53588`.

1. Starter gift + 7702 delegation: [0x3ac2b05f…9792](https://robinhoodchain.blockscout.com/tx/0x3ac2b05f0f556abf0b1f795c3dcc4e4c331e9838f376dc057e7f11728cb59792)
2. Claim `@z8e5280`: [0x80426b02…ab78](https://robinhoodchain.blockscout.com/tx/0x80426b02e7b277d064d8fd7b3e3fe4c9bfff4b4a6098842ee006ae1e6ea0ab78)
3. Buy Bow for 6 WIF: [0xbe5dd78c…5b82](https://robinhoodchain.blockscout.com/tx/0xbe5dd78c1cd27d12a5f5fdf069f6bbc6da0a547275ad538358e90387e60e5b82)
4. Send 1 WIF to `@zeron`: [0x735731f9…dd00](https://robinhoodchain.blockscout.com/tx/0x735731f9cbaf2512b3e9ece966db7f94b3c8df53ebd4764474cbc56bd2dddd00)
5. Level 1 checkpoint: [0x685ba836…e257](https://robinhoodchain.blockscout.com/tx/0x685ba8369ae8a8bdde18c9a781a2d305860b6a49b21064a751951ba1c778e257)
6. The relay refused a non-allowlisted transfer.
7. Production API transfer of 0.5 WIF to `@zeron`: [0xded64b21…68fb](https://robinhoodchain.blockscout.com/tx/0xded64b21e94727be690b333fb067c4ab9fe01763642fbf2d60ac09db60fe68fb)

## Testnet history

The old testnet used chain ID 46630, mock WIF, and the former `wif-depths` deployment. It remains historical context only and is not the current production economy.

- Former testnet live URL: `https://wif-depths.vercel.app`.
- WifDepths: `0xf7C1a647b1A2AcDfA9c83f759dabfe8bc64c606a`.
- Quest: `0xc09fCeF3D094e74112eAA049F3746368e51f5A8A`.
- Mock WIF: `0x26f08a9b911b3c5074ae488036c1a235e85c3863`.
- Names: `0x6b8de7415c9c9177f3aa1d900d2dd0763280e6cf`.
- WifAccount: `0xc3589a6b6ce130052ebcf61b0a716db5122dee11`.

Historical testnet notes included a 20-move sponsor cap, 100-WIF ranked entry, and older burn terminology. Those values do not describe the current mainnet deployment.

## Art and audio credits

- Tiles, props, and monsters: “DungeonTileset II” v1.7 by 0x72, CC0 1.0: <https://0x72.itch.io/dungeontileset-ii>
- Hero and UI sprites: original project art.
- Cave Theme by Brandon Morris, CC0: <https://opengameart.org/content/cave-theme>
- Dungeon Ambience by yd, CC0: <https://opengameart.org/content/dungeon-ambience>
- 512 Sound Effects by Juhani Junkala / SubspaceAudio, CC0: <https://opengameart.org/content/512-sound-effects-8-bit-style>

## Earlier implementation notes

- PvP moved from an earlier public-seed design to commit/reveal-style challenge state with server-signed resolution.
- The town gained Market, Forge, Arena, Post, Tailor, Apothecary, Armory, and Notice Board stalls.
- Combat moved in-place onto the dungeon map with floating damage, mini HP bars, finishers, mobile controls, and weapon abilities.
- Vercel API functions are committed as bundles because the deployed Node ESM resolver could not reliably load the original extensionless TypeScript dependency graph.
