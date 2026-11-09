# Zeron tokenomics & burn model (Robinhood Chain mainnet)

**Network:** Robinhood Chain mainnet · **chain id 4663**  
**Live app:** https://zeron-game.vercel.app  
**Explorer:** https://robinhoodchain.blockscout.com  

This document describes **what the deployed contracts and production frontend actually do**. Parameters and balances below were re-verified with read-only `eth_call` / `eth_getLogs` against public RPC on **2026-11-09 19:54 WAT** (block **110283289**) for the post-cutover contracts (first snapshot: 2026-11-06 ~02:02 WAT, block 107180069), and against `contracts/script/DeployMainnet.s.sol` + `app/src/shared/deployments.json`. They are a **point-in-time** snapshot where labelled as such—not a promise of future balances, USD value, or remaining sponsored actions.

---

## 1. Canonical $wif (real token)

Zeron uses the official **World is Flat** `$wif` on Robinhood Chain—not Solana dogwifhat, not a MockWIF, not a placeholder.

| Field | Value |
|---|---|
| Name / symbol (on-chain) | `World is Flat` / `WIF` |
| Decimals | 18 |
| Contract | [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773) |
| Official project | [@WIFonRH](https://x.com/WIFonRH) · [worldisflat.fun](https://worldisflat.fun/) |
| Identity citation | [@WIFonRH post](https://x.com/WIFonRH/status/2107896657648173164) includes `robinhood:0x5173b8ea6923c2d40267890d45c46a3480954773` |

**Supply snapshot (2026-11-09 19:54 WAT, block 110283289):**

- `totalSupply()` ≈ **999,996,177.10 WIF**
- Balance of burn sink `0x…dEaD` ≈ **116,272.05 WIF**. This is the chain-wide dead balance, **not** only Zeron's; Zeron's transfers make up 12.8 WIF of it (see the README *Live economy* section).

DexScreener lists the same contract with website `worldisflat.fun` and social `x.com/WIFonRH`. Do not substitute another token merely because it is named WIF.

---

## 2. Destroy mode: dead address vs native `burn()`

Shared logic lives in `contracts/src/FeeSink.sol`:

- `useBurn == true` → call `token.burn(amount)` (reduces `totalSupply` if the token supports it).
- `useBurn == false` → `transfer(0x000…dEaD, amount)`. Tokens remain in total supply but are economically removed from circulation.

**Mainnet deploy (`DeployMainnet.s.sol`) set `useBurn = false` on every FeeSink contract.** Live reads confirm:

| Contract | `useBurn()` | `burnBps` | Meaning of fee share |
|---|---|---|---|
| Game `WifDepths` | **false** | **2000** (20%) | 20% → dEaD, 80% kept (prize pool / contract) |
| Quest `WifQuest` | **false** | **2000** (20%) | craft fees: 20% → dEaD, 80% → Game prize pool (`addToPool`) |
| Names `NameRegistryV2` | **false** | **5000** (50%) | rename: 50% → dEaD, 50% treasury |
| Shop `ZeronShop` | **false** | **5000** (50%) | costume buys: 50% → dEaD, 50% treasury |
| Armory `ZeronArmory` | **false** | **5000** (50%) | weapon buys / ammo: 50% → dEaD, 50% kept in the Armory as reward pool |

`app/src/shared/deployments.json` also has `"burnVerified": false`.

**Do not claim “native burn is live” for Zeron sinks.** A static `burn(1)` simulation against the WIF token from a funded holder can succeed (the token appears burn-capable), but **Zeron’s FeeSinks are not configured to call it**. Destruction today is **transfer-to-dead**. Older UI copy used “burned” as shorthand for transfers to the dead address. The current interface labels these amounts as **destroyed**. FeeSink totals exclude the separate gas-fee transfers; neither path reduces `totalSupply` through Zeron's FeeSink configuration.

### Contract-reported destroyed totals (FeeSink `totalDestroyed`, 2026-11-09 19:54 WAT)

| Sink | Current contract | Pre-cutover contract |
|---|---|---|
| Game | **2 WIF** | 2.1 WIF |
| Quest (Forge + Arena) | **0** | 0.4 WIF |
| Names | **0** | (unchanged contract) |
| Shop (Wardrobe) | **3 WIF** | (unchanged contract) |
| Armory | **0** | 3 WIF |
| **Sum** | **5 WIF** | **5.5 WIF** |

The in-app **Destroyed** tracker reads the current contracts only (it showed Dungeon 2 · Wardrobe 3 on Nov 9). These counters track FeeSink `_destroy` calls only. They exclude the separate **gas fee** halves sent to the dead address (23 × 0.1 = 2.3 WIF as of the snapshot; see §4). Together, 10.5 + 2.3 = **12.8 WIF** sent to `0x…dEaD` by Zeron, which matches the WIF `Transfer` logs.

---|---|
| Game | **0.5 WIF** |
| Quest (Forge + Arena) | **0** |
| Names | **0** |
| Shop (Wardrobe) | **3 WIF** |
| Armory | **3 WIF** |
| **Sum** | **6.5 WIF** |

This matches the live **Destroyed** tracker breakdown observed ~02:00 WAT (the interface previously labelled this tab “Burn”) (Game 0.5 · Wardrobe 3 · Armory 3 · Forge/Arena 0 · Names 0; recent ledger empty). Those counters only track FeeSink `_destroy` calls—not the separate **gas fee** half-to-dead transfers (see §4).

---

## 3. Architecture (how $wif moves)

```
Player browser wallet (local key; optional @name + PIN vault)
        │
        ├─ free / ranked dungeon movement & fights  → client-side engine (no chain)
        │
        └─ economy / progress writes → sponsored EIP-7702 batch via /api/relay
              ├─ gas repayment in WIF (see §4)
              └─ contract calls: Game, Quest, QuestEndgame, Names, Shop, Armory
```

| Piece | Role | Address |
|---|---|---|
| WIF token | ERC-20 economy | [`0x5173…4773`](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773) |
| Game | Ranked entry, daily items, run record, prize pool | [`0x87A5…74E3`](https://robinhoodchain.blockscout.com/address/0x87A52585d84A2E649315B302eb713501095674E3) |
| Quest | Levels/forge craft, arena PvP | [`0x2DA0…3175`](https://robinhoodchain.blockscout.com/address/0x2DA0821b7830e8E3183aab7D412D5f643F053175) |
| QuestEndgame | High levels | [`0xeDCD…8fEd`](https://robinhoodchain.blockscout.com/address/0xeDCD2AF1EF29e9788D6402e2B1E09209f0a98fEd) |
| Names | Unique `@name`, `sendToName` | [`0x4A09…3B63`](https://robinhoodchain.blockscout.com/address/0x4A09d12912dA069687Ce1F568908D18409Eb3B63) |
| Shop | Starter gift, costumes / wardrobe | [`0xfA88…20eE`](https://robinhoodchain.blockscout.com/address/0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE) |
| Armory | Weapons, ammo, play-to-earn claims | [`0x1B80…c303`](https://robinhoodchain.blockscout.com/address/0x1B8093B8be96ccf8Bb2D0f2EDB416e2c8514c303) |
| Account impl | EIP-7702 delegate | [`0xaE20…F392`](https://robinhoodchain.blockscout.com/address/0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392) |
| Relayer | Pays ETH gas; receives WIF gas share | [`0x00E7…A26a`](https://robinhoodchain.blockscout.com/address/0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a) |
| Treasury / deployer | Owner & fee recipient | [`0x2bCE…958E`](https://robinhoodchain.blockscout.com/address/0x2bCEc454514201d867982ecDE9766DC2ed87958E) |

Players need **0 ETH**. The relayer sponsors gas subject to allowlists, daily caps, and pause switches (`SPONSOR_PAUSED`, `SPONSOR_MIN_BALANCE_WEI`, `SPONSOR_DAILY_CAP` in Vercel env—values are not in this repo).

---

## 4. Gas fee in $wif (not FeeSink)

Default sponsored batches prepend `gasFeeCalls()` from `app/src/shared/chain.ts` (client) and are checked by `checkGasFee` / `isOnboarding` in `app/src/server/core.ts` (relay):

- Fee size: `deployments.gasFeeWei` = **0.2 WIF** (`200000000000000000` wei).
- Split: **0.1 WIF → `0x…dEaD`**, **0.1 WIF → relayer**.
- This path always uses the dead address; it does **not** consult `useBurn`.

### When the 0.2 WIF gas fee is **waived** (free onboarding)

A batch skips `gasFeeCalls()` only if it is a **free-onboarding** batch (≤2 calls, mirrored on client as `isFreeOnboarding` and on relay as `isOnboarding`):

| Allowed call | Contract | Notes |
|---|---|---|
| `starter()` | Shop | Welcome gift |
| `claim(string)` | Names | **Only the wallet’s first `@name`** (empty `nameOf`); rename is **not** free |

Allowed batch shapes: `starter` alone; first `claim` alone; or `starter` + first `claim` together. Any other call in the batch, a rename while already named, or >2 calls → **not** onboarding → **0.2 WIF gas fee required**.

The `chain.ts` comment and client/server onboarding checks now describe the same free batch shapes: starter grant and/or first `@name` claim.

On-chain account limit: `WifAccount.SPONSORED_PER_DAY = 20` sponsored batches per player day.

---

## 5. Per-function WIF flows (mainnet live parameters)

### 5.1 Names — `NameRegistryV2`

| Action | Function | Player pays | Destroy share | Rest |
|---|---|---|---|---|
| First `@name` | `claim(string)` | **0** | — | — |
| Rename | `claim(string)` while already named | **5 WIF** (`renameFee`) | **50%** → dEaD | **50%** → treasury |
| Send to `@name` | `sendToName(string,uint256)` | amount chosen | none (plain transfer to resolved address) | — |

### 5.2 Shop / wardrobe — `ZeronShop`

| Action | Function | Amount | Destroy | Rest |
|---|---|---|---|---|
| Welcome grant | `starter()` | **5 WIF** from shop pool (once / wallet) | none (payout) | — |
| Buy costume | `buy(uint8)` | on-chain `price[id]` | **50%** → dEaD | **50%** → treasury |
| Equip | `equip(uint8)` | 0 | — | — |
| Event drop | `claimDrop(...)` | 0 WIF (signed) | — | — |

Live costume prices (id → WIF): **1→6, 2→8, 3→12, 4→10, 5→10, 6→15**. Id **7** (Pumpkin King’s Crown) is drop-only in the UI.

### 5.3 Armory — `ZeronArmory`

| Action | Function | Amount | Destroy | Rest |
|---|---|---|---|---|
| Buy weapon | `buy(uint8)` | `price[id]` | **50%** → dEaD | **50%** stays in the Armory (reward pool) |
| Refill ammo | `refill()` | **1.5 WIF** (`ammoPrice`) | **50%** → dEaD | **50%** stays in the Armory (reward pool) |
| Claim rewards | `claim(...)` | 0 paid; pool pays out | none | clamped by `dailyCap`, `rollingPayoutRoom()` (65% of trailing-24h inflows) and the balance |

Live weapon list prices (WIF): **1 Bow 6 · 2 Spear 9 · 3 Twin Daggers 12 · 4 Fire Staff 15 · 5 Bazooka 20 · 6 War Hammer 25 · 7 Pumpkin Launcher 18** (UI treats 7 as drop-only / not sold).  
`dailyCap()` live = **10 WIF / wallet / day**. Older documentation used a 150 WIF figure; that is not the current mainnet cap.  
Frontend `rewardScaleBps = 1000` applies a **0.1×** mainnet payout scale. The interface now shows the scaled amounts directly: **0.3 WIF** per small enemy and **1 WIF** per boss / level-clear reward unit, subject to the pool balance, the 65% inflow cap and the 10 WIF daily cap.

### 5.4 Game — `WifDepths`

| Action | Function | Amount | Destroy | Rest |
|---|---|---|---|---|
| Ranked daily entry | `enterRanked()` | **10 WIF** (`entryFee`) | **20%** → dEaD | **80%** → that day’s prize pool |
| Buy daily items | `buy(uint8,uint256)` | item price × qty | **20%** → dEaD | **80%** → prize pool |
| Record free/ranked run | `recordRun(...)` | 0 WIF (plus gas fee if relayed) | — | — |

Live item prices: id **1 = 2.5**, **2 = 4**, **3 = 4** WIF.

### 5.5 Quest — `WifQuest` / endgame

| Action | Function | Amount | Destroy | Notes |
|---|---|---|---|---|
| Craft | `craft(uint8)` | `craftFee * tier` with **craftFee = 2 WIF** | **20%** of fee → dEaD | 80% → today's Game prize pool (`game.addToPool`) |
| PvP stake | `challenge` then `resolve` | **pvpStake = 1 WIF** | **pvpBurnBps = 1000 (10%)** of stake destroyed on resolve | 90% to the winner. If an NPC defender wins, it goes to the Game prize pool. A defender never loses WIF. |
| Level clear | `recordClear(...)` | 0 WIF (materials + optional armory claim in same batch) | — | server-signed |

### 5.6 Faucets / sinks summary

- **Faucets:** `starter()` (5 WIF from shop balance); armory `claim` (from armory WIF pool, clamped by `dailyCap`, `rollingPayoutRoom()` and balance); ranked `settle` (top 3 of that day's pool).
- **Token fees:** shop/armory/names/game/quest as above.
- **Gas token fee:** 0.2 WIF / sponsored batch (half dead, half relayer).
- **No minting** in game contracts—rewards only while prefunded pools last.

---

## 6. Pool and sponsor funding

Zeron's starter and reward balances are **pre-funded contract balances**, not newly minted rewards. They decrease as grants, rewards, and other contract flows are paid. The contracts do not automatically replenish these pools.

- Read the live `Shop` balance before assuming a new player can claim the 5 WIF starter grant.
- Read the live `Armory` balance and `dailyCap()` before describing play-to-earn availability.
- Read the live relayer ETH balance and check `SPONSOR_MIN_BALANCE_WEI`, `SPONSOR_DAILY_CAP`, and `SPONSOR_PAUSED` in the production environment before promising sponsored actions.
- The repository default relayer pause floor is `20000000000000` wei (0.00002 ETH) when `SPONSOR_MIN_BALANCE_WEI` is unset. The actual production environment value is not visible from source code.
- These balances are live operational data. Verify them through read-only RPC calls when needed; do not keep dated personal or treasury balance snapshots in permanent project documentation.

---

## 6.1 The live ranked prize flywheel

**The ranked prize-pool loop is implemented on-chain.** It is important to distinguish it from the separate Armory kill/level reward pool.

1. **Players generate fees.** A player pays the ranked daily entry fee, and players can also buy daily-run items.
2. **Fees fund the prize.** The Game contract retains the configured share of those fees. At the current 20% destruction setting, **80%** is added to `pool[today]`.
3. **The contract pays the podium.** After the day ends, anyone can call `settle(day)`. The contract pays that day's pool to the top three ranked players (default 50/30/20). Empty podium seats roll their share into the current day.
4. **Competition restarts.** Players return for the next daily contest. New ranked entries and item purchases generate the next pool.

This is a real fee → prize pool → player reward → next competition loop. It is not a guaranteed yield or a promise of a fixed prize: pool size depends on actual player activity and paid item usage. The contract's `Entered`, `Bought`, and `Settled` events are the source of truth for contributions and payouts.

### Separate Armory rewards: self-funding pool with an inflow cap

Armory kill/level rewards are **not** paid from the ranked Game prize pool. They come from the Armory's own WIF balance. Since the 2026-11-09 flywheel cutover, the retained share of weapon/ammo purchases (50% after the dead-address share) stays in the Armory as reward pool, and total payouts in any trailing 24 hours are capped on-chain at 65% of trailing-24h purchase inflows.

- **Balance (2026-11-09 19:54 WAT):** **174.3 WIF** (`WIF.balanceOf(Armory)`). All of it is the manually seeded balance (200 WIF seeded into the first Armory, minus 25.7 WIF paid out, migrated on Nov 9). `rollingPayoutRoom()` was **0** at that time, because there were no purchases in the trailing 24 h. Check the [live balance on Blockscout](https://robinhoodchain.blockscout.com/address/0x1B8093B8be96ccf8Bb2D0f2EDB416e2c8514c303?tab=tokens).
- **Daily cap:** `dailyCap()` = 10 WIF per wallet/day, and `inflowPayoutBps()` = 6500, both read 2026-11-09. The live getters remain the source of truth.
- **Funding policy:** the team reviews the balance every Monday. If it is below 30 days of payouts at the trailing-seven-day average, the team tops it back up toward that 30-day target. This is a manual treasury policy, not an on-chain automatic refill.
- **Rewards stop when the pool is depleted.** No runway estimate is published; a cap is a maximum claim limit, not a forecast of daily outflow.

### What is still trusted / future work

The ranked pool accounting and settlement are on-chain. Gameplay scoring is not fully trustless: the run API deterministically replays submitted moves and signs eligible scores. At this stage, this is a practical anti-tampering layer because the contract accepts a score only with a valid signer signature and a per-player nonce, rather than trusting a browser-submitted score. The trade-off is trust in the replay service and signer key.

Planned decentralization: publish replay inputs and deterministic rules, support independent replay verification, add a challenge/dispute period, and move toward independently verifiable reward claims. Until that work is shipped and deployed, scores remain server-authorized.

## 7. Security & economy limitations

- The relayer is trusted to enforce its allowlist, apply operational limits, and submit sponsored batches. The run signer is trusted to replay and sign gameplay results. This is an intentional early-stage trust boundary: server replay is more resistant to simple client-side score spoofing than accepting a browser-reported score, while keeping the current game practical to ship. It is not trustless. Planned improvements are public deterministic replay inputs, independently reproducible verification, a challenge/dispute period, and eventually on-chain-verifiable reward claims.
- `SPONSOR_*` environment settings are operational controls. The EIP-7702 account contract independently enforces its hard cap of 20 sponsored batches per player per day.
- The PIN vault stores encrypted wallet ciphertext and one-way verifiers. With no `BLOB_READ_WRITE_TOKEN`, the API falls back to in-memory storage, which is not persistent.
- Starter and reward pools are finite. A reward is paid only while the relevant pool has funds; rewards are not guaranteed income.
- Campaign/event level salt is client-chosen (the daily ranked seed is not). This and the potion balance issue are tracked in [HANDOVER.md → Known limitations](../HANDOVER.md#known-limitations).
- Armory item ID 8 (Auto-Hunt) has no configured mainnet sale price. The app no longer offers it in the shop or exposes its toggle.
- The displayed FeeSink destruction total does not include the separate 0.1 WIF gas-fee transfers to the dead address.

---

## 8. Operational decisions and remaining caveats

- Native token `burn()` is not enabled for Zeron FeeSinks. `burnVerified` remains `false`; do not change the setting without a reviewed verification, owner-authorized configuration change, and post-change supply check.
- Sponsorship depends on the relayer's ETH balance, its configured environment limits, and the manual pause switch. Check the live Vercel configuration and current chain balance rather than relying on an old balance snapshot.
- The on-chain sponsored-batch ceiling is 20 per player/day. The relayer may apply a lower cap.
- The starter and reward pools are prefunded. There is no automatic top-up implied by the contracts.
- Contract configuration changes require the authorized owner/deployer. Private keys must remain outside the repository.


---

## 9. Read-only verification (no keys)

```bash
RPC=https://rpc.mainnet.chain.robinhood.com
WIF=0x5173b8eA6923c2d40267890D45C46a3480954773
# example with cast, or any eth_call client:
# cast call $WIF "name()(string)" --rpc-url $RPC
# cast call $WIF "totalSupply()(uint256)" --rpc-url $RPC
# cast call <Game|Shop|Armory|Names|Quest> "useBurn()(bool)" --rpc-url $RPC
# cast call <…> "burnBps()(uint16)" --rpc-url $RPC
# cast call <…> "totalDestroyed()(uint256)" --rpc-url $RPC
```

Explorer: open each address above on https://robinhoodchain.blockscout.com.  
**Never** commit private keys, `RELAYER_KEY`, `RUN_SIGNER_KEY`, vault tokens, or wallet JSON.

---

## 10. Demo / capture status

| Asset | Path |
|---|---|
| Mainnet demo MP4 (43 s, 1920×1080) | [assets/zeron-demo.mp4](assets/zeron-demo.mp4) |
| README GIF (30 s, 960 px, 12 fps) | [assets/zeron-demo.gif](assets/zeron-demo.gif) |
| Hero still | [assets/zeron-hero.png](assets/zeron-hero.png) |
| Older desktop demo (superseded, includes local practice footage) | [assets/zeron-desktop-demo.mp4](assets/zeron-desktop-demo.mp4) · [CAPTIONS.md](assets/CAPTIONS.md) |
| 4-post thread copy | [SOCIAL-THREAD.md](SOCIAL-THREAD.md) |

The mainnet demo's gameplay was recorded on the live production app. Its burn and proof sections show real Blockscout transactions on Robinhood Chain. Example: ranked entry [0xec66e9a2…c0e5](https://robinhoodchain.blockscout.com/tx/0xec66e9a2ecb19c872e8847876e63373c11a589cc6d1d2d04207d66ac9122c0e5), block 110051411: 10 WIF in, 2 WIF FeeSink share plus 0.1 WIF gas to `0x…dEaD`, 8 WIF into the day's pool. The older desktop demo's gameplay was recorded in local practice mode (`deployed === false`, no funds moved) and is not onchain proof.

### Controls note

Desktop fight keys in the current HUD/handler and updated How-it-works copy: **J** attack · **K** block/parry · **L** weapon special · **Q** potion · **F** finisher · **E** interact · WASD/arrows walk.


## Self-funding flywheel (deployed on mainnet 2026-11-09)

Deployed from PR #6 as new Game, Quest, QuestEndgame and Armory contracts (addresses in the table above). The old Armory's 174.3 WIF was migrated to the new Armory. A migrated balance only pays out once purchase inflows create payout room under the 65% cap.

### 1. Armory purchase remainder → reward pool
Weapon/ammo fees still destroy `burnBps` (currently 50% → dEaD with `useBurn=false`). The **kept remainder stays in the Armory contract** instead of the treasury, so play refills the reward pool.

Forge fees in `WifQuest` call `game.addToPool(kept)`; Quest was redeployed so they reach the new Game pool.

### 2. On-chain inflow payout cap (default 65%)
`ZeronArmory.inflowPayoutBps` (default `6500`) caps total rewards paid in the trailing 24 hours at that share of trailing-24h purchase inflows. Tracked with 24 hourly buckets (`inflow24h`, `outflow24h`, `rollingPayoutRoom`). Still also enforces the per-wallet `dailyCap`.

### 3. Ranked top-3 settlement (default 50/30/20)
`WifDepths.settle` pays `placeBps` (default `5000/3000/2000`) to the top three ranked scores. Empty seats roll their share into today's pool. Configurable via `setPlaceBps` (must sum to 10_000). No new WIF is minted.

### 4. Relayer WIF → ETH
Uniswap v3 is live on Robinhood Chain (`SwapRouter02` `0xcaf681…5cb2`, factory `0x1f7d75…2efa`). A WIF/WETH 1% pool exists at `0x156064…Ef09` but **liquidity is currently 0**, so automatic conversion cannot work until the pool is seeded. Helper: `app/scripts/relayer-wif-to-eth.mjs` (dry-run by default; exits `NO_LIQUIDITY` when empty). Until then, top up relayer ETH manually.

