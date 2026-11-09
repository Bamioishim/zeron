# Zeron

A daily pixel dungeon on **Robinhood Chain** where **real $WIF runs the whole game**.

**Play:** https://zeron-game.vercel.app · **Demo video:** [docs/assets/zeron-desktop-demo.mp4](docs/assets/zeron-desktop-demo.mp4)

Walk the town, fight real-time battles (block, parry, finish), clear a 12-level campaign, forge gear, and run the **daily ranked dungeon**: 15 fights, the same for everyone that day. Fights 5 and 10 are giant mini-bosses that drop a full-heal potion. Add friends by @name and send them WIF.

## WIF runs the game

The token is the real **World Is Flat $WIF** from [@WIFonRH](https://x.com/WIFonRH):
[`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773) (Robinhood Chain, ID 4663).

Every paid action is WIF: weapons, ammo, ranked entries, forging, renames, costumes, sends, and the 0.2 WIF sponsored-gas fee. Players never need ETH, because a relayer pays the gas.

## The flywheel

```
 players spend WIF ──► burn share ──► 0x…dEaD (gone for good)
        ▲          └─► the rest ───► reward pools
        │                               │
        └──── win WIF back ◄────────────┘
```

- **Weapons and ammo** (Armory): 50% to the dead address, 50% stays in the Armory as the **reward pool**.
- **Ranked entries and forging**: 20% to the dead address, 80% goes to that day's **ranked prize pool**.
- **Rewards can't drain the pool.** The Armory can pay out at most **65% of the WIF it took in over the last 24h**, enforced onchain, and at most 10 WIF per wallet per day. The pool can shrink, but it can never run dry.
- **Ranked pays the top 3**: 50% / 30% / 20% of the day's pool. A new dungeon every day brings players back.
- Runs are replayed and checked by the server before any reward is signed, so scores can't be faked.

## How Zeron meets the rules

| Rule | How |
|---|---|
| A product people return to | A game with a new ranked dungeon and a fresh prize pool every day. |
| $WIF onchain (3) | Uses real WIF `0x5173…0954773` for every paid action. |
| Flywheel (7) | Spending burns WIF and funds the pools. Rewards are capped at 65% of 24h inflows. Daily ranked brings players back. |
| Free to try (2) | You don't need any ETH, and the browser wallet and your first @name are free. You can play the campaign without WIF. Saving progress onchain costs 0.2 WIF per action, and ranked entry costs 10 WIF. |
| Stays live (4) | https://zeron-game.vercel.app |
| Proof (5) | This repo, the [demo video](docs/assets/zeron-desktop-demo.mp4) (it includes practice footage; TODO: Bamio to add an updated mainnet demo link), and the onchain links below. |
| Existing work (6) | Built on earlier Zeron work, extended for this hackathon. |
| Brand (11) | Zeron's own name, logo and art. "Robinhood Chain" appears only as the network name. |
| Third-party assets (13) | All CC0 or open licence. See the credits below. |

## Onchain (Robinhood Chain mainnet)

| Contract | Address |
|---|---|
| Game (daily + ranked) | [`0x87A52585d84A2E649315B302eb713501095674E3`](https://robinhoodchain.blockscout.com/address/0x87A52585d84A2E649315B302eb713501095674E3) |
| Armory (reward pool) | [`0x1B8093B8be96ccf8Bb2D0f2EDB416e2c8514c303`](https://robinhoodchain.blockscout.com/address/0x1B8093B8be96ccf8Bb2D0f2EDB416e2c8514c303) |
| Quest (campaign, forge) | [`0x2DA0821b7830e8E3183aab7D412D5f643F053175`](https://robinhoodchain.blockscout.com/address/0x2DA0821b7830e8E3183aab7D412D5f643F053175) |
| Quest endgame (levels 7–12) | [`0xeDCD2AF1EF29e9788D6402e2B1E09209f0a98fEd`](https://robinhoodchain.blockscout.com/address/0xeDCD2AF1EF29e9788D6402e2B1E09209f0a98fEd) |
| Names (@names) | [`0x4A09d12912dA069687Ce1F568908D18409Eb3B63`](https://robinhoodchain.blockscout.com/address/0x4A09d12912dA069687Ce1F568908D18409Eb3B63) |
| Shop (wardrobe) | [`0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE`](https://robinhoodchain.blockscout.com/address/0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE) |

Flywheel cutover transactions (Nov 9, 2026): the
[Game deploy](https://robinhoodchain.blockscout.com/tx/0x0dd817db74f3cc266b80220b3fe2322fa78176dc31561f057440eeb6f717d773), the
[Armory deploy](https://robinhoodchain.blockscout.com/tx/0x76fdc9b29066772f0283c65fdbdc7ffa5f5f91e8b442cacbdacb80c86a1bcdb5) and the
[Quest deploy](https://robinhoodchain.blockscout.com/tx/0x1c0bd9b231e53041fea3f65f8f175b65aca609608070dfdb9b8c3861f959d2ba). The 174.3 WIF reward pool was
[claimed from the old Armory](https://robinhoodchain.blockscout.com/tx/0x81a46c06d4f71f9730c8b15438d1b364b1cc7e10573a599fcdf3d8b1d4242cc5) and then
[moved into the new one](https://robinhoodchain.blockscout.com/tx/0xf327e2635ff9720bb07f1055082a7ef088d31536ae185cdd518610b5efe8a867).

Addresses live in `app/src/shared/deployments.json`. Details are in [docs/TOKENOMICS.md](docs/TOKENOMICS.md).

## Run it

```bash
cd app && npm install
npm test          # daily mini-boss + replay checks, sound checks
npm run build     # lint, typecheck, build
npm run build:api # rebuild the api/run.js bundle after engine changes
```

## Credits

Tiles and monsters: "DungeonTileset II" by 0x72 (CC0). Music: "Cave Theme" by Brandon Morris (CC0) and "Dungeon Ambience" by yd (CC0), via OpenGameArt. Sound effects are synthesized in-app. Fonts: Silkscreen and Space Mono (SIL OFL). The hero, UI and logo are original.
