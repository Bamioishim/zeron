# Zeron

**A daily pixel dungeon powered by the real World is Flat ($WIF) token on Robinhood Chain.** Explore dungeons, fight enemies, claim an on-chain `@name`, compete in ranked runs, collect gear, and send WIF to other players.

- **Play:** https://zeron-game-sigma.vercel.app
- **Network:** Robinhood Chain mainnet · chain ID `4663`
- **Token:** WIF · [contract on Blockscout](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773)
- **Source:** [GitHub](https://github.com/Bamioishim/zeron)

> **Mainnet status:** Zeron's contracts and WIF-denominated economy actions are deployed. Some demo footage shows practice-mode gameplay; simulated HUD rewards are not proof of on-chain payouts. Check the live app and Blockscout for current activity.

## Gameplay

1. Create a wallet in the browser. No MetaMask, Phantom, or ETH is required.
2. Claim a unique `@name`.
3. Explore the town and dungeons, fight enemies, and progress through levels.
4. Buy gear, craft upgrades, and equip items.
5. Enter ranked runs, challenge players in the arena, and send WIF by username.

Free movement and combat run in the browser. Account identity, economy actions, and saved progression use Robinhood Chain contracts.

## How the economy works

- The first `@name` claim and starter grant are free onboarding actions.
- A standard sponsored transaction batch costs **0.2 WIF**: 0.1 WIF goes to the dead address and 0.1 WIF reimburses the relayer.
- Ranked entry and daily-item fees fund the on-chain Game prize pool. The configured player-fee share retained by the Game is 80%.
- Armory rewards are a **separate, finite, prefunded pool**. Weapon and ammo fees currently route **0%** to that pool; rewards depend on treasury funding and available balance.
- Fee shares sent to the dead address are not native WIF burns and do not reduce token total supply.
- Sponsored actions are subject to contract and relayer limits. The contract maximum is 20 batches per player per day; the relayer may enforce a lower cap or pause sponsorship.

Rewards are not guaranteed income. Read the [tokenomics guide](docs/TOKENOMICS.md) for contract-level details, fees, limits, and verification notes.

## Mainnet contracts

The production frontend reads its configuration from `app/src/shared/deployments.json`.

| Contract | Address |
|---|---|
| WIF token | [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773) |
| Game | [`0x7a9b811C490F4F089f63bC6001d801216846Fbd8`](https://robinhoodchain.blockscout.com/address/0x7a9b811C490F4F089f63bC6001d801216846Fbd8) |
| Quest | [`0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451`](https://robinhoodchain.blockscout.com/address/0x9Ef0A663E1E137921Cc64098B15a620BdcEF9451) |
| Quest endgame | [`0xDC9100bDFfC996e509b0e49934aF006785887Fa6`](https://robinhoodchain.blockscout.com/address/0xDC9100bDFfC996e509b0e49934aF006785887Fa6) |
| Name registry | [`0x4A09d12912dA069687Ce1F568908D18409Eb3B63`](https://robinhoodchain.blockscout.com/address/0x4A09d12912dA069687Ce1F568908D18409Eb3B63) |
| Shop | [`0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE`](https://robinhoodchain.blockscout.com/address/0xfA881eE41e048Db6343C6fdd77b5F45EF0F420eE) |
| Armory | [`0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7`](https://robinhoodchain.blockscout.com/address/0xd66752DAd6F8e54EC60f763fF5E75301F86fc2c7) |

## Development

Requirements: Node.js and npm. Foundry is required only for contract development.

```bash
cd app
npm install
npm run dev
npm run build
npm run lint
```

Contract build and tests:

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test
```

The end-to-end mainnet script can spend real WIF. Use a dedicated test wallet and an explicit budget; never run it casually against a production wallet.

## Architecture and security

- `app/`: React, Vite, TypeScript, and viem game frontend.
- `app/api/`: Vercel serverless relay, run-signing, and vault endpoints.
- `contracts/`: Solidity contracts and Foundry scripts.
- `docs/`: tokenomics, demo materials, and project documentation.

Players sign their transaction batches locally. The relayer submits allowlisted calls and pays network gas. Run results are replayed and signed by the server, so scoring still depends on an authorized signer; it is not fully trustless. Never commit private keys, wallet exports, `.env` files, or service tokens.

## Project documentation

- [Tokenomics and fee mechanics](docs/TOKENOMICS.md)
- [Changelog](CHANGELOG.md)
- [Maintainer handover](HANDOVER.md)
- [Demo screenshots and captions](docs/assets/CAPTIONS.md)
- [Social thread copy](docs/SOCIAL-THREAD.md)

**Demo note:** the existing desktop video contains practice-mode combat. Capture a fresh recording of real ranked activity and on-chain settlement before presenting gameplay footage as proof of mainnet rewards.

## Art and audio credits

- Dungeon tiles, props, and monsters: [DungeonTileset II by 0x72](https://0x72.itch.io/dungeontileset-ii), CC0.
- Hero and UI sprites: original project assets.
- Music: [Cave Theme by Brandon Morris](https://opengameart.org/content/cave-theme) and [Dungeon Ambience by yd](https://opengameart.org/content/dungeon-ambience), CC0.
- Sound effects: [512 Sound Effects (8-bit style) by Juhani Junkala](https://opengameart.org/content/512-sound-effects-8-bit-style), CC0.
