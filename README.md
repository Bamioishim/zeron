# Zeron — World is Flat hackathon build on Robinhood Chain mainnet

**Live:** https://zeron-game.vercel.app  
**Chain:** Robinhood Chain **mainnet** (id **4663**)  
**Token:** real **$wif** ([@WIFonRH](https://x.com/WIFonRH) / [worldisflat.fun](https://worldisflat.fun/)) at [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773)  
**Explorer:** https://robinhoodchain.blockscout.com  

Zeron is a top-down pixel dungeon: town hub, levels, shop, wardrobe, crafting, arena, Halloween Pumpkin King. Players need **0 ETH** — gas is sponsored and repaid in **$wif**. Part of each fee is **destroyed** (see burn model below).

> **Deep dive:** [docs/TOKENOMICS.md](docs/TOKENOMICS.md) — per-function fees, dead-address vs native `burn()`, live parameter table, funding snapshot, verification commands.  
> **Ops / pickup:** [HANDOVER.md](HANDOVER.md)

Hackathon window (from project handover): submissions close **Thu 12 Nov 2026, 18:30 WAT**; keep the game live through **16 Nov**.

---

## Canonical project token

Use this exact Robinhood Chain token for production. Do **not** substitute Solana dogwifhat, MockWIF, or any other “WIF” ticker.

| | |
|---|---|
| Network / chain id | Robinhood Chain mainnet / **4663** |
| Contract | `0x5173b8eA6923c2d40267890D45C46a3480954773` |
| On-chain name / symbol | World is Flat / WIF |
| Frontend source of truth | `app/src/shared/deployments.json` |

Official identity references: site [worldisflat.fun](https://worldisflat.fun/), X [@WIFonRH](https://x.com/WIFonRH) (includes CA citation in [this post](https://x.com/WIFonRH/status/2107896657648173164)).

**Testnet / history only:** older MockWIF builds (chain **46630**) such as https://wif-depths-5ak1srszj-bamioishim.vercel.app are **not** production. Ignore testnet prices (often 10× mainnet) when talking about the live game.

---

## Burn / destroy model (read carefully)

FeeSink contracts were deployed with **`useBurn = false`** (`DeployMainnet.s.sol`). Destroyed fee shares are sent to **`0x000000000000000000000000000000000000dEaD`**, not via `token.burn()`.

| Contract | Live `burnBps` | Destroy share |
|---|---|---|
| Game (ranked entry + daily items) | 2000 | **20%** → dEaD |
| Quest (craft) | 2000 | **20%** → dEaD |
| Names (rename) | 5000 | **50%** → dEaD |
| Shop (wardrobe buys) | 5000 | **50%** → dEaD |
| Armory (weapons / ammo) | 5000 | **50%** → dEaD |
| PvP stake resolve | `pvpBurnBps` 1000 | **10%** of stake → dEaD |

**Sponsored gas repayment** (frontend `gasFeeCalls`): **0.2 WIF** per batch → **0.1** to dEaD + **0.1** to the relayer (always dead-address path), except free-onboarding batches (`starter` and/or first `@name`; see [docs/TOKENOMICS.md](docs/TOKENOMICS.md) §4).

`deployments.json` has `"burnVerified": false`. The WIF token may support `burn()`, but **Zeron sinks do not call it on mainnet today**. UI “burned” = destroyed / sent to dead (or gas half-dead), **not** a claim that Zeron reduced `totalSupply` via native burn.

FeeSink `totalDestroyed` sum observed **2026-11-06 ~02:02 WAT**: **6.5 WIF** (Game 0.5 + Shop 3 + Armory 3). Details and verification: [docs/TOKENOMICS.md](docs/TOKENOMICS.md).

---

## Mainnet addresses (chain 4663)

| Contract | Address |
|---|---|
| WIF | [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773) |
| Game (WifDepths) | [`0x7a9b811C490F4F089f63bC6001d801216846Fbd8`](https://robinhoodchain.blockscout.com/address/0x7a9b811C490F4F089f63bC6001d801216846Fbd8) |
| Quest | [`0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451`](https://robinhoodchain.blockscout.com/address/0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451) |
| QuestEndgame | [`0xDC9100bDFfC996e509b0e49934aF006785887Fa6`](https://robinhoodchain.blockscout.com/address/0xDC9100bDFfC996e509b0e49934aF006785887Fa6) |
| Names | [`0x4A09d12912dA069687Ce1F568908D18409Eb3B63`](https://robinhoodchain.blockscout.com/address/0x4A09d12912dA069687Ce1F568908D18409Eb3B63) |
| Shop | [`0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE`](https://robinhoodchain.blockscout.com/address/0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE) |
| Armory | [`0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7`](https://robinhoodchain.blockscout.com/address/0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7) |
| Account impl | [`0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392`](https://robinhoodchain.blockscout.com/address/0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392) |
| Relayer | [`0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a`](https://robinhoodchain.blockscout.com/address/0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a) |
| Treasury / deployer | [`0x2bCEc454514201d867982ecDE9766DC2ed87958E`](https://robinhoodchain.blockscout.com/address/0x2bCEc454514201d867982ecDE9766DC2ed87958E) |

---

## Economy cheat-sheet (live mainnet parameters)

Verified on-chain **2026-11-06**; full tables in [docs/TOKENOMICS.md](docs/TOKENOMICS.md).

- Starter gift: **5 WIF** once (`ZeronShop.starterAmount`)
- Ranked entry: **10 WIF** (20% destroyed)
- Daily items: **2.5 / 4 / 4 WIF** (20% destroyed → prize pool keeps rest)
- Rename `@name`: **5 WIF** (50% destroyed); first claim free
- Craft fee base: **2 WIF** × tier (20% destroyed)
- PvP stake: **1 WIF** (10% of stake destroyed on resolve)
- Weapons: **6–25 WIF** (50% destroyed); ammo refill **1.5 WIF**
- Costumes: **6–15 WIF** (50% destroyed)
- Gas in WIF: **0.2** per sponsored batch (0.1 dead + 0.1 relayer), **waived** for free onboarding only (`starter` and/or first `@name` claim—see TOKENOMICS §4)
- Play-to-earn: paid from armory pool; on-chain **`dailyCap = 10 WIF`/day** (frontend also scales units by `rewardScaleBps = 1000`)
- Sponsored batches: **`SPONSORED_PER_DAY = 20`** in `WifAccount`

**Misleading older claims to ignore:** testnet weapon prices 60–250 WIF; “150 WIF/day” reward cap as if it were current mainnet; “Claim 350 WIF” starter UI string; any implication that FeeSinks already use native `burn()`.

---

## PIN login and recovery

Login is `@name` + 4-digit PIN. Setup also stores a recovery question. Wallet keys are encrypted in the browser; the vault API stores ciphertext and one-way verifiers only. **Forgot PIN?** uses the recovery answer locally. Legacy vault rows without recovery must use **Change PIN** on an unlocked device. Do not hardcode PINs or add admin bypasses.

---

## Stack / run locally

- `app/` — React 19 + Vite + TypeScript + viem; serverless `app/api/{relay,run,vault}.js`
- `contracts/` — Foundry (solc 0.8.28)

```bash
cd app && npm install && npm run dev   # http://localhost:5173
cd contracts && forge build && forge test
```

Production env var **names** (values only in Vercel — never commit): `RELAYER_KEY`, `RUN_SIGNER_KEY`, `RPC_URL`, `SPONSOR_DAILY_CAP`, `SPONSOR_MIN_BALANCE_WEI`, `SPONSOR_PAUSED`, `DEPLOYMENTS_OVERRIDE`, `BLOB_READ_WRITE_TOKEN`.

### Demo media (reviewed)

| | |
|---|---|
| Video (~63s PC) | [docs/assets/zeron-desktop-demo.mp4](docs/assets/zeron-desktop-demo.mp4) |
| Thumbnail | [docs/assets/zeron-desktop-demo-thumb.jpg](docs/assets/zeron-desktop-demo-thumb.jpg) |
| Screenshots | [docs/assets/CAPTIONS.md](docs/assets/CAPTIONS.md) — landing, Burn tracker (dEaD), local practice KO |
| X thread (text) | [docs/SOCIAL-THREAD.md](docs/SOCIAL-THREAD.md) |

Gameplay in the demo used the **existing** `deployed === false` practice path (blank contract addresses via `VITE_DEPLOYMENTS`)—not a new feature and **not** mainnet spend. Live Play still prompts `@name`; shop/starter/relayed actions on production move real WIF. Full burn/economy: [docs/TOKENOMICS.md](docs/TOKENOMICS.md).

---

## Example mainnet migration / e2e txs

Bridge, swap, seed, and zero-ETH player e2e hashes remain useful references:

- Bridge land: [`0x04581af3…c093`](https://robinhoodchain.blockscout.com/tx/0x04581af3c77d09b80725720bb1195ee23ab8784a5d8f6be05945eedbf826c093)
- Swap → WIF: [`0x04c062df…4e9d`](https://robinhoodchain.blockscout.com/tx/0x04c062dfdc1dc358ed76556d094fcf6bd8098735efe37eba3cbd3b0831434e9d)
- Seed shop / armory / relayer / e2e path: see prior README history and explorer links in git history; full narrative in [docs/TOKENOMICS.md](docs/TOKENOMICS.md) §6 and deploy broadcast under `contracts/broadcast/DeployMainnet.s.sol/4663`.

---


---

## Historical notes (testnet / older README body)

Sections below include **art/audio credits** (keep) plus older testnet/v3/v4 narrative. Prefer the **mainnet** tables above and [docs/TOKENOMICS.md](docs/TOKENOMICS.md) for live fees. Testnet MockWIF and 10× prices are not production.

## Art and licenses
- Tiles, props and monsters: "DungeonTileset II" v1.7 by 0x72 (CC0 1.0), https://0x72.itch.io/dungeontileset-ii
- Hero and UI sprites: original, made for this project.
- The style reference image was not copied, traced or used.

- Market town (stalls with awnings, counters, goods and signs, cobblestones, fountain, lamp posts, flower boxes): original pixel art drawn in code (src/game/World.tsx). Shopkeepers and villagers use 0x72 DungeonTileset II (CC0) characters.

## Addresses (testnet, chain 46630)
Live at https://wif-depths.vercel.app
- WifDepths 0xf7C1a647b1A2AcDfA9c83f759dabfe8bc64c606a
- Quest (levels, forge, arena) 0xc09fCeF3D094e74112eAA049F3746368e51f5A8A
- WIF (mock) 0x26f08a9b911b3c5074ae488036c1a235e85c3863
- Names 0x6b8de7415c9c9177f3aa1d900d2dd0763280e6cf
- WifAccount (7702) 0xc3589a6b6ce130052ebcf61b0a716db5122dee11
- Relayer 0xacB7C8E8B13f0319c40211386165c4E6f33dE19C, deployer 0x9FEe4D5d1538e7a5DC3578CAD1968639b27f5048

## Burn verification plan
1. On the real token, eth_call burn() from a holder and confirm it succeeds.
2. Confirm totalSupply drops.
3. Do one tiny real burn.
4. Only then deploy with USE_BURN=true.

## Limitations
- The 20 sponsored moves per day cap is enforced on-chain inside the WifAccount delegate (shared by every server instance), and the relay pre-checks it.
- Only one daily winner.
- The anti-cheat is server-trusted.
- Full-kit potion spam still wins most ranked runs.
- Contract addresses ship in the bundle (they are public anyway).
- The level salt is client-chosen and can be ground for easier layouts.

## v3 changes
- PvP uses commit-reveal. `challenge()` locks the stake and snapshots both fighters. The relay server then signs an EIP-712 `Duel` message and submits `resolve()`, and the battle seed is the hash of that signature. Players can't predict or reroll the outcome. `cancelChallenge()` refunds the stake after 1 hour.
- New quest contract: 0xc09fCeF3D094e74112eAA049F3746368e51f5A8A. Progress from the old quest was reset.
- Dungeon and town art: walls now have depth and edges. Added props (barrels, crates, chests, rubble and planks, grates, candles, statues, doors) and flickering warm light pools. The camera zooms in further. Art is CC0 0x72 DungeonTileset II plus original sprites.

## Zeron brand
Original pixel wordmark + helm-and-sword icon (lime #d4fc50 on near-black), generated by `brand/gen.py`. Live: https://zeron-game.vercel.app (also https://wif-depths.vercel.app).
Opening page: big logo over a panning torchlit dungeon, "Enter the Depths" panel, claim-your-@name, How it works, Leaderboard, credits footer.

## Audio credits (all CC0, OpenGameArt)
- "Cave Theme" by Brandon Morris (haeldb), https://opengameart.org/content/cave-theme (CC0): title music
- "Dungeon Ambience" by yd, https://opengameart.org/content/dungeon-ambience (CC0): in-run loop
- "512 Sound Effects (8-bit style)" by Juhani Junkala (SubspaceAudio), https://opengameart.org/content/512-sound-effects-8-bit-style (CC0): hit, coin, clear SFX
Audio stays muted until your first click; toggle with the speaker button.

## Combat v2 + Armory (Oct 31)
- Fights happen in place on the dungeon map (no fight window): floating damage/heal/BLOCK/PARRY numbers, mini HP bars, anime slash finisher (≤15% HP or stagger, skippable, longer for bosses).
- Controls (current fight HUD): mobile ATTACK / BLOCK / POTION / WEAPON (+FINISH); desktop **J** attack, **K** block, **L** weapon special, **Q** potion, **F** finisher, **E** interact. Older How-it-works text may still say A/D/P — prefer J/K/Q/F.
- **Historical / testnet narrative (not current mainnet):** older Armory address `0x8594…7b6f` and testnet-scale prices (Bow 60 … War Hammer 250, ammo 15, **150 WIF/day** cap). **Live mainnet** uses Armory `0xd667…c2c7`, weapons **6–25 WIF**, ammo **1.5**, on-chain `dailyCap` **10 WIF/day**, `rewardScaleBps` **1000** — see [docs/TOKENOMICS.md](docs/TOKENOMICS.md).
- Burn tab: total burned + per-sink chips + recent burns with tx links. Leaderboard: @names, costume avatar, level, PvP wins, burned.

## v4 changes
- Level flow: when you clear a level, a result card offers Next level (the checkpoint save is queued in the background and its status shows inline) or Back to town (also saves). Dying shows a GAME OVER screen with Retry or Back to town.
- Market town: Armory, Apothecary, Tailor, Forge, Arena, Post (@names) and Notice Board stalls. Walk up and press E at the counter.
