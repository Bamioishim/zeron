# Zeron (World is Flat hackathon) — live on Robinhood Chain mainnet

Production (https://zeron-game.vercel.app) runs on **Robinhood Chain mainnet (chain 4663)** with the real $wif.
The old testnet build is still reachable at https://wif-depths-5ak1srszj-bamioishim.vercel.app (chain 46630, mock WIF).
Explorer: https://robinhoodchain.blockscout.com

## Canonical project token
Builders must use the Zeron project WIF token on Robinhood Chain mainnet, not an arbitrary token named WIF:

- **Network:** Robinhood Chain mainnet
- **Chain ID:** 4663
- **Project WIF contract:** `0x5173b8eA6923c2d40267890D45C46a3480954773`

The frontend reads this address from `app/src/shared/deployments.json`. The testnet-only `MockWIF` address must not be used for production integrations.

## Mainnet addresses (chain 4663)
- WIF (real) [0x5173b8eA6923c2d40267890D45C46a3480954773](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773)
- WifAccount (7702) [0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392](https://robinhoodchain.blockscout.com/address/0xaE20DBB3853875aa6F0C68e2a831aD6F1d90F392)
- WifDepths (game) [0x7a9b811C490F4F089f63bC6001d801216846Fbd8](https://robinhoodchain.blockscout.com/address/0x7a9b811C490F4F089f63bC6001d801216846Fbd8)
- WifQuest [0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451](https://robinhoodchain.blockscout.com/address/0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451)
- WifQuestEndgame [0xDC9100bDFfC996e509b0e49934aF006785887Fa6](https://robinhoodchain.blockscout.com/address/0xDC9100bDFfC996e509b0e49934aF006785887Fa6)
- NameRegistryV2 [0x4A09d12912dA069687Ce1F568908D18409Eb3B63](https://robinhoodchain.blockscout.com/address/0x4A09d12912dA069687Ce1F568908D18409Eb3B63)
- ZeronShop [0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE](https://robinhoodchain.blockscout.com/address/0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE)
- ZeronArmory [0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7](https://robinhoodchain.blockscout.com/address/0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7)
- Deployer/treasury 0x2bCEc454514201d867982ecDE9766DC2ed87958E · Relayer 0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a · Run signer 0x3A889344dD6D5E39AC319d11C799504ffaac03fe

Burns: real WIF burns are sent to 0x000000000000000000000000000000000000dEaD (contracts deployed with useBurn=false).
Economy (1/10 of testnet): starter gift 5 WIF (owner-settable, clamped to the pool), ranked entry 10, items 2.5/4/4, weapons 6–25, ammo 1.5, rename 5, rewards of 3 WIF per small enemy, 10 WIF per boss, and 10 WIF per level clear (max 150 WIF/day per wallet, paid only while the pool lasts).
Gas: players need 0 ETH; each sponsored action costs 0.2 WIF (0.1 to 0xdEaD, 0.1 to the relayer). Sponsor limits: SPONSOR_DAILY_CAP=10 per wallet, auto-pause below SPONSOR_MIN_BALANCE_WEI=5e13, kill switch SPONSOR_PAUSED.

## PIN login and recovery

Zeron login uses `@name` plus a 4-digit PIN. During PIN setup, the player also chooses a recovery question and answer. The wallet private key is encrypted in the browser with the PIN and separately with the normalized recovery answer; the server stores only ciphertext, salts, and one-way verifiers in the private Vercel Blob vault. Answers and PINs are never sent to the server in plaintext.

If a player forgets the PIN, the login screen provides **Forgot PIN?**. After the correct recovery answer, the player chooses a new PIN and the wallet is re-encrypted locally. Recovery attempts are rate-limited and locked temporarily after repeated failures. Accounts created before recovery questions were added must open Zeron on the already-unlocked wallet, use **Change PIN**, and save a question before recovery is available. The current `@bamio` vault record is one of these legacy records (`recovery: false`); it has not been changed remotely.

Do not hardcode a PIN such as `0000` or add an administrative PIN bypass. Setting a PIN must be authorized by the wallet that owns the on-chain name, otherwise the encrypted wallet could be taken over.

## Mainnet migration transactions
- Bridge (Relay, Solana→Robinhood): Solana sig 2T2wuqqenC1mYiYScvDgpX8vNXvxx8DN6hPy8ErCqzUcwghLeqfhgunvyLi75LYNojHaZ5sZNSfgNpdtUSFtdwYM → [0x04581af3…c093](https://robinhoodchain.blockscout.com/tx/0x04581af3c77d09b80725720bb1195ee23ab8784a5d8f6be05945eedbf826c093) (0.001396987 ETH landed)
- Swap 0.00022 ETH → 406.36 WIF (KyberSwap): [0x04c062df…4e9d](https://robinhoodchain.blockscout.com/tx/0x04c062dfdc1dc358ed76556d094fcf6bd8098735efe37eba3cbd3b0831434e9d)
- 1 WIF → 0xdEaD transfer test (no tax): [0x469f4305…9ab6](https://robinhoodchain.blockscout.com/tx/0x469f4305f29547611cf40f50a403a5e02f7ffee202c02828368eca4f1e929ab6)
- Deploy: see contracts/broadcast/DeployMainnet.s.sol/4663
- Seed Shop 100 WIF [0x43754d4d…36e2](https://robinhoodchain.blockscout.com/tx/0x43754d4da4329495d633ca3a03131ace122d15dec6801c239709cbb2ffe336e2), Armory 200 WIF [0xc3656127…9e13](https://robinhoodchain.blockscout.com/tx/0xc36561272e98f05be70e5ea9591583b89d9354eeb5993543bbd0a6a4f6939e13), e2e player 20 WIF [0xe091fa23…6f527e](https://robinhoodchain.blockscout.com/tx/0xe091fa23aed4747f47f413c14f057738c235b3e2be31b354f4b937488e6f527e), relayer 0.00085 ETH [0xfa0f29c7…3ad3](https://robinhoodchain.blockscout.com/tx/0xfa0f29c7cb24fbec8c1130b4f1b90b408199425bd938957167ee04ee92033ad3)
- Treasury claims @zeron: [0x0692ee28…a0a4](https://robinhoodchain.blockscout.com/tx/0x0692ee28fa6b1cdb50f6ab4064e43d79dd23ef78ceb7487cc9a6d6d2101ea0a4)

## Mainnet e2e (zero-ETH player 0x8E5280E28fF90B546dB58fB0aF6cd7661be53588, gas paid in WIF)
1. Starter gift + 7702 delegation: [0x3ac2b05f…9792](https://robinhoodchain.blockscout.com/tx/0x3ac2b05f0f556abf0b1f795c3dcc4e4c331e9838f376dc057e7f11728cb59792)
2. Claim @z8e5280: [0x80426b02…ab78](https://robinhoodchain.blockscout.com/tx/0x80426b02e7b277d064d8fd7b3e3fe4c9bfff4b4a6098842ee006ae1e6ea0ab78)
3. Buy Bow (6 WIF): [0xbe5dd78c…5b82](https://robinhoodchain.blockscout.com/tx/0xbe5dd78c1cd27d12a5f5fdf069f6bbc6da0a547275ad538358e90387e60e5b82)
4. Send 1 WIF to @zeron: [0x735731f9…dd00](https://robinhoodchain.blockscout.com/tx/0x735731f9cbaf2512b3e9ece966db7f94b3c8df53ebd4764474cbc56bd2dddd00)
5. Level 1 checkpoint: [0x685ba836…e257](https://robinhoodchain.blockscout.com/tx/0x685ba8369ae8a8bdde18c9a781a2d305860b6a49b21064a751951ba1c778e257)
6. Relay refused a non-allowlisted transfer.
7. Through the live production API: send 0.5 WIF to @zeron [0xded64b21…68fb](https://robinhoodchain.blockscout.com/tx/0xded64b21e94727be690b333fb067c4ab9fe01763642fbf2d60ac09db60fe68fb)

---
# Testnet history (chain 46630)
A daily pixel dungeon game. **We sponsor gas; $wif powers the game, and part of every fee is destroyed.** Players need 0 ETH.

## Onchain (contracts/, Foundry, 14 tests)
- WifDepths: ranked entry (100 WIF, 20% destroyed, the rest goes to the daily pot), shop, server-signed runs (EIP-712, nonce), streaks, settle().
- NameRegistry: @username (50 WIF, 50% destroyed), sendToName.
- WifAccount: EIP-7702 delegate for sponsored batched calls.
- MockWIF (testnet only). Set the token address with WIF_TOKEN for mainnet.
- Destroy mode: `USE_BURN=false` sends tokens to 0x…dEaD. Only switch to burn() after it is verified (see below).

## Offchain (app/)
React/Vite/viem frontend. Two serverless endpoints:
- /api/run replays the deterministic run and signs it.
- /api/relay sponsors gas. It only calls our contracts and caps each player at `SPONSOR_DAILY_CAP=20` moves per day.
  - Manual pause: `SPONSOR_PAUSED=true`.
  - Auto-pause: when the relayer balance is below `SPONSOR_MIN_BALANCE_WEI`.
Env vars: RELAYER_KEY, RUN_SIGNER_KEY.

## Game (top-down)
- A town hub with Market, Forge, Arena, Gate, Leaderboard and @Names NPCs. Talk to them with E or a tap.
- 5 dungeon levels with wandering foes, turn-based fights, a boss room per level and onchain checkpoints (server-signed Clear).
- A free daily run plus a ranked daily run.
- Crafting at the Forge from level loot (iron, hide, glow), with a WIF fee that is partly destroyed.
- PvP Arena: register, then challenge players or 6 NPC fighters with a staked WIF fee. **Deviation:** PvP is resolved onchain from a public seed, not server-signed, so outcomes are predictable per nonce.
- Controls: WASD/arrows, E, number keys, and A/D/P in fights. On mobile there is a D-pad, an action button, 56px sticky fight buttons, vibrate on hit and swipeable tabs.
- Movement is offchain; only results and economy calls go onchain.

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
- Controls: mobile cluster ATTACK / BLOCK / POTION / WEAPON (+FINISH); desktop J attack, K block, L weapon, Q potion, F finisher, E interact/attack.
- Weapons (ZeronArmory `0x8594ECDD0f48a95aDdbC2F1A4e81b4164ad77b6f`): Bow 60, Spear 90, Twin Daggers 120, Fire Staff 150, Pumpkin Launcher 180 (also a Pumpkin King drop), Bazooka 200, War Hammer 250. 50% burned / 50% treasury. Bazooka/Launcher share 3 ammo, refill 15 WIF.
- Earn WIF: +3 per small enemy, +10 per boss, and +10 per level clear, claimed in the same sponsored tx as the checkpoint; server-signed EIP-712 claim, 150 WIF/day cap, paid from the Armory pool (clamped, never reverts). Pool is finite test WIF: top it up by transferring WIF to the Armory.
- Burn tab: total burned + per-sink chips + recent burns with tx links. Leaderboard: @names, costume avatar, level, PvP wins, burned.

## v4 changes
- Level flow: when you clear a level, a result card offers Next level (the checkpoint save is queued in the background and its status shows inline) or Back to town (also saves). Dying shows a GAME OVER screen with Retry or Back to town.
- Market town: Armory, Apothecary, Tailor, Forge, Arena, Post (@names) and Notice Board stalls. Walk up and press E at the counter.
