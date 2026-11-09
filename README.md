# Zeron

Zeron is a daily pixel dungeon game powered by **$WIF on Robinhood Chain**.

**Play:** https://zeron-game.vercel.app

## The daily loop

1. Enter the daily ranked challenge and fight through **14 unique enemy types plus the Daily Warden** (15 fights total).
2. Earn up to **30 WIF** for a full clear. The run is limited to one recorded attempt per player each day.
3. Spend WIF on useful items and gear to prepare for future runs.
4. Ranked entry fees and daily-item fees contribute to the on-chain prize pool. The highest ranked score takes the pool when the day is settled.
5. The leaderboard and daily dungeon reset, and the next run begins.

The Armory's combat rewards and the ranked prize pool are separate: the up-to-30-WIF clear reward is paid from the prefunded Armory pool, while ranked fees fund the daily leaderboard pool. Armory payouts depend on the reward signer being configured and the pool having enough WIF; rewards are not guaranteed if either is unavailable.

## Campaign progression

The campaign now has **12 levels**, each with three distinct enemy types and a themed boss. Enemy health, attack and defence rise as the levels progress. Levels 7–12 are endgame stages and use the existing endgame checkpoint flow; no new contracts or on-chain deployments were added.

## Network

- **Chain:** Robinhood Chain mainnet (4663)
- **Token:** WIF
- **Token address:** `0x5173b8eA6923c2d40267890D45C46a3480954773`
- **Explorer:** https://robinhoodchain.blockscout.com

The frontend reads contract addresses and reward settings from `app/src/shared/deployments.json`.

## Build

The Vite app lives in `app/`.

```bash
cd app
npm install
npm run build
```

Free movement and combat run in the browser. Ranked results are replay-verified by the server and recorded through the deployed Robinhood Chain contracts.

## Fees and destruction

Sponsored actions charge **0.2 WIF** (0.1 to `0x…dEaD`, 0.1 to the relayer). Deployed FeeSinks use `useBurn=false` (dead-address destruction, not native supply burn). Armory daily reward cap is **10 WIF** per wallet.
