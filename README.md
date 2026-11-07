# Zeron

Zeron is a daily pixel dungeon game powered by **$WIF on Robinhood Chain**.

**Play:** https://zeron-game.vercel.app

## The daily loop

1. Enter the daily ranked challenge and fight through **15 enemies**, ending with the Daily Warden.
2. Earn up to **30 WIF** for a full clear. The run is limited to one recorded attempt per player each day.
3. Spend WIF on useful items and gear to prepare for future runs.
4. Ranked entry fees and daily-item fees contribute to the on-chain prize pool. The highest ranked score takes the pool when the day is settled.
5. The leaderboard and daily dungeon reset, and the next run begins.

The Armory's combat rewards and the ranked prize pool are separate: the up-to-30-WIF clear reward is paid from the prefunded Armory pool, while ranked fees fund the daily leaderboard pool. Armory payouts depend on the reward signer being configured and the pool having enough WIF; rewards are not guaranteed if either is unavailable.

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
