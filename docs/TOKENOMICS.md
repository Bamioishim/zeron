# Zeron tokenomics & burn model (Robinhood Chain mainnet)

**Network:** Robinhood Chain mainnet · **chain id 4663**  
**Live app:** https://zeron-game.vercel.app  
**Explorer:** https://robinhoodchain.blockscout.com  

This document describes **what the deployed contracts and production frontend actually do**. Amounts below were verified with read-only `eth_call` against public RPC on **2026-11-06 ~02:02 WAT** (block **107180069**), and against `contracts/script/DeployMainnet.s.sol` + `app/src/shared/deployments.json`. They are a **point-in-time** snapshot where labelled as such—not a promise of future balances, USD value, or remaining sponsored actions.

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

**Supply snapshot (2026-11-06 ~02:02 WAT):**

- `totalSupply()` ≈ **999,997,630.616945 WIF**
- Balance of burn sink `0x…dEaD` ≈ **115,211.307022 WIF** (chain-wide dead balance; **not** only Zeron)

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
| Quest `WifQuest` | **false** | **2000** (20%) | craft fees: 20% → dEaD |
| Names `NameRegistryV2` | **false** | **5000** (50%) | rename: 50% → dEaD, 50% treasury |
| Shop `ZeronShop` | **false** | **5000** (50%) | costume buys: 50% → dEaD, 50% treasury |
| Armory `ZeronArmory` | **false** | **5000** (50%) | weapon buys / ammo: 50% → dEaD, 50% treasury |

`app/src/shared/deployments.json` also has `"burnVerified": false`.

**Do not claim “native burn is live” for Zeron sinks.** A static `burn(1)` simulation against the WIF token from a funded holder can succeed (the token appears burn-capable), but **Zeron’s FeeSinks are not configured to call it**. Destruction today is **transfer-to-dead**. UI copy that says “burned” means **destroyed via FeeSink / gas fee path**, not necessarily `totalSupply` reduction from Zeron.

### Contract-reported destroyed totals (FeeSink `totalDestroyed`, 2026-11-06 ~02:02 WAT)

| Sink | `totalDestroyed` |
|---|---|
| Game | **0.5 WIF** |
| Quest (Forge + Arena) | **0** |
| Names | **0** |
| Shop (Wardrobe) | **3 WIF** |
| Armory | **3 WIF** |
| **Sum** | **6.5 WIF** |

This matches the live **Burn** tab breakdown observed ~02:00 WAT (Game 0.5 · Wardrobe 3 · Armory 3 · Forge/Arena 0 · Names 0; recent ledger empty). Those counters only track FeeSink `_destroy` calls—not the separate **gas fee** half-to-dead transfers (see §4).

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
| Game | Ranked entry, daily items, run record, prize pool | [`0x7a9b…Fbd8`](https://robinhoodchain.blockscout.com/address/0x7a9b811C490F4F089f63bC6001d801216846Fbd8) |
| Quest | Levels/forge craft, arena PvP | [`0x9Ef0…9451`](https://robinhoodchain.blockscout.com/address/0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451) |
| QuestEndgame | High levels | [`0xDC91…7Fa6`](https://robinhoodchain.blockscout.com/address/0xDC9100bDFfC996e509b0e49934aF006785887Fa6) |
| Names | Unique `@name`, `sendToName` | [`0x4A09…3B63`](https://robinhoodchain.blockscout.com/address/0x4A09d12912dA069687Ce1F568908D18409Eb3B63) |
| Shop | Starter gift, costumes / wardrobe | [`0xfA88…20eE`](https://robinhoodchain.blockscout.com/address/0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE) |
| Armory | Weapons, ammo, play-to-earn claims | [`0xd667…c2c7`](https://robinhoodchain.blockscout.com/address/0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7) |
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

Comment in `chain.ts` that says “except a lone starter claim” is incomplete relative to the actual `isOnboarding` / `isFreeOnboarding` logic above.

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
| Buy weapon | `buy(uint8)` | `price[id]` | **50%** → dEaD | **50%** → treasury |
| Refill ammo | `refill()` | **1.5 WIF** (`ammoPrice`) | **50%** → dEaD | **50%** → treasury |
| Claim rewards | `claim(...)` | 0 paid; pool pays out | none | capped payout |

Live weapon list prices (WIF): **1 Bow 6 · 2 Spear 9 · 3 Twin Daggers 12 · 4 Fire Staff 15 · 5 Bazooka 20 · 6 War Hammer 25 · 7 Pumpkin Launcher 18** (UI treats 7 as drop-only / not sold).  
`dailyCap()` live = **10 WIF / wallet / day** (not 150—older docs and some UI strings are wrong).  
Frontend `rewardScaleBps = 1000` → displayed “reward units” pay at **0.1×** (e.g. UI “+10 WIF” unit → **1 WIF** paid when the pool allows).

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
| Craft | `craft(uint8)` | `craftFee * tier` with **craftFee = 2 WIF** | **20%** of fee → dEaD | rest kept / routed per contract |
| PvP stake | `challenge` / resolve | **pvpStake = 1 WIF** | **pvpBurnBps = 1000 (10%)** of stake destroyed on resolve | remainder to winner side per contract |
| Level clear | `recordClear(...)` | 0 WIF (materials + optional armory claim in same batch) | — | server-signed |

### 5.6 Faucets / sinks summary

- **Faucets:** `starter()` (5 WIF from shop balance); armory `claim` (from armory WIF pool, clamped by `dailyCap` and balance).
- **Token fees:** shop/armory/names/game/quest as above.
- **Gas token fee:** 0.2 WIF / sponsored batch (half dead, half relayer).
- **No minting** in game contracts—rewards only while prefunded pools last.

---

## 6. Operational funding snapshot (prepaid — not a bank debit)

**Label:** balances at **2026-11-06 ~02:02 WAT**, block **107180306**, public RPC only. No USD conversion. No forecast of how many actions remain.

| Account | ETH | WIF | Notes |
|---|---|---|---|
| Relayer `0x00E7…A26a` | **0.0007993756807** | **1** | Sponsors gas. Repo default auto-pause floor in `app/src/server/core.ts` is `SPONSOR_MIN_BALANCE_WEI` **or** `20000000000000` (**2e13** wei ≈ **0.00002 ETH**) if unset. **Production Vercel value unknown** from this repo—do not assume it matches the default. |
| Treasury `0x2bCE…958E` | **0.000076253956435273** | **≈92.85875** | Deployer / fee recipient |
| Armory | 0 | **194.3** | Reward pool (seeded 200) |
| Shop | 0 | **80** | Starter + shop float (seeded 100) |
| Game | 0 | **2** | Contract balance |

Solana funding address used for the Nov 1 bridge (`9TKr9SV2BkG9V6KFurcdCFQzFH4zTnJB5eubH3Uf4Erx`) held only dust afterward; **no evidence of automatic top-ups** after **2026-11-01**. WIF transfers involving Zeron sinks after seed were also **Nov 1 only** in a full log scan (last ~**2026-11-01 20:44 WAT**). Prepaid funds sit on-chain until spent; this does **not** prove anything about off-chain card/bank charges.

---

## 7. Security & economy limitations (honest)

- Relayer is trusted for allowlisting and meta-tx submission; run/reward signatures are server-trusted.
- `SPONSOR_*` env kill-switches are operational, not on-chain guarantees beyond `WifAccount` daily sponsored cap.
- PIN vault stores ciphertext + verifiers (Vercel Blob when configured); never paste keys into chat or commit `.env`.
- Finite reward / starter pools: empty pool ⇒ no payout (claims clamp / revert per code paths).
- UI/docs drift still present in places (e.g. some strings still say **150 WIF/day** or **Claim 350 WIF** while live `dailyCap=10` and `starterAmount=5`). Prefer this file + on-chain reads.
- Auto-Hunt UI tries armory id **8** at **100 WIF**, but live `price(8)=0` (not for sale on-chain).
- Level salt is client-influenced; ranked anti-cheat is server-trusted.

---

## 8. Known remaining work (docs / ops — not feature expansion)

- Demo video / capture for the World is Flat hackathon (submissions close **Thu 12 Nov 2026, 18:30 WAT**; stay live through **16 Nov**).
- Keep relayer ETH topped up if auto-pause trips.
- Optional: flip FeeSinks to native `burn()` only after a deliberate verification plan (`burnVerified` stays false until then).
- Fix stale UI copy (daily cap, starter button label) in a future code PR—not done in this docs-only change.
- `@bamio` vault may still be legacy without recovery question (see HANDOVER).
- Connect GitHub → Vercel for auto-deploy when ready.

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

Reviewed desktop demo (real screen recordings only; final videoReview **PASS**):

| Asset | Path |
|---|---|
| Demo MP4 (~63s) | [assets/zeron-desktop-demo.mp4](assets/zeron-desktop-demo.mp4) |
| Thumbnail | [assets/zeron-desktop-demo-thumb.jpg](assets/zeron-desktop-demo-thumb.jpg) |
| Stills + captions | [assets/CAPTIONS.md](assets/CAPTIONS.md) |
| 4-post thread copy | [SOCIAL-THREAD.md](SOCIAL-THREAD.md) |
| Rebuild script | [scripts/build-desktop-demo.sh](scripts/build-desktop-demo.sh) (`MEDIA_ROOT` / `MEDIA` for raw inputs) |

### How gameplay was captured (existing practice path — not a new feature)

Production at https://zeron-game.vercel.app has contracts deployed, so Play prompts `@name`. For **local practice footage only**, the existing app path `deployed === false` was used by supplying blank `wif` / `game` / `names` / `accountImpl` through the already-supported **`VITE_DEPLOYMENTS`** override (see `app/src/shared/chain.ts`). That shows the in-app banner **“Contracts aren't live yet, so this is practice mode.”** Onboarding/`act()` returns early—**no** account claim, login, payment, signatures, or mainnet writes. UI earn popups in practice are **simulated only**.

Menus / Burn / How segments in the demo were recorded on the live site (chrome only). Practice segments carry a persistent **LOCAL PRACTICE — NO FUNDS MOVED** overlay. Burn segment overlay: FeeSink destroy → **`0x…dEaD`** (`useBurn=false`) — **not** native `token.burn()` / totalSupply proof. The demo is **not** on-chain transfer proof. Do not invent room counts or HUD WIF totals from OCR.

### Controls note

Desktop fight keys in the current HUD/handler: **J** attack · **K** block · **L** weapon special · **Q** potion · **F** finisher · **E** interact · WASD/arrows walk. Some How-it-works copy still mentions older A/D/P bindings—prefer J/K/Q/F.
