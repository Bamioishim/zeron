# Zeron — 4-post X thread (copy deck)

Delivered for @writer / posting. Use only after checking that the live site and contract configuration still match the details below.

## Sources (keep OUT of post bodies)
- Live game: https://zeron-game.vercel.app
- Token (Robinhood Chain 4663): `0x5173b8eA6923c2d40267890D45C46a3480954773` — [@WIFonRH](https://x.com/WIFonRH) / [worldisflat.fun](https://worldisflat.fun/)
- Economy mechanics: [TOKENOMICS.md](TOKENOMICS.md)
- Demo and footage limitations: [assets/CAPTIONS.md](assets/CAPTIONS.md)

## Thread (4 posts)

**1/4**

Zeron is a daily pixel dungeon game on Robinhood Chain.

Claim an `@name`, explore the town, then fight through dungeon levels, challenge arena opponents and build your character.

It uses the real World is Flat ($WIF) token. Players can use sponsored transactions without holding ETH, while sponsorship is available.

**2/4**

$WIF is used across the game: a 5 WIF starter grant, 10 WIF ranked entry, WIF-priced daily items, weapons, costumes and ammo. Renaming, crafting and PvP stakes also use WIF.

Eligible play rewards are paid from the Armory pool. It was seeded by the team and is refilled by 50% of weapon and ammo buys. Payouts are capped onchain at 65% of the last 24h inflows and at 10 WIF per wallet per day. Rewards depend on available pool funds and are not guaranteed.

**3/4**

A standard sponsored on-chain batch costs 0.2 WIF: 0.1 goes to the dead address and 0.1 reimburses the relayer covering network gas.

Here's the ranked loop: 80% of ranked-entry and daily-item fees flow into that day's on-chain prize pool. After the day ends, anyone can settle it and the top 3 ranked players are paid 50/30/20. Players return for the next contest, generating new entry and item fees. The contract records entries, pool contributions and payouts on-chain. Armory kill/level rewards are separate and come from the Armory's own finite balance.

**4/4**

Built for the World is Flat hackathon, using the real @WIFonRH token on Robinhood Chain (4663).

The live homepage reads named wallets, 7-day returning players, recorded runs, prize-pool inflows and payouts, plus the separate Armory reward balance and estimated runway directly from mainnet events. The new demo video (docs/assets/zeron-demo.mp4) was recorded on the live mainnet app.

Play: https://zeron-game.vercel.app/

Code and transparent token mechanics: https://github.com/Bamioishim/zeron

WIF token contract:
`0x5173b8eA6923c2d40267890D45C46a3480954773`
