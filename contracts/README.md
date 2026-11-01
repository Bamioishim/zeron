## Zeron contract build

For production integrations, builders must use the Zeron project WIF token—not any arbitrary token with the same symbol:

- **Network:** Robinhood Chain mainnet (chain ID 4663)
- **Canonical project WIF:** `0x5173b8eA6923c2d40267890D45C46a3480954773`
- **Explorer:** https://robinhoodchain.blockscout.com/address/0x5173b8eA6923c2d40267890D45C46a3480954773

`MockWIF` is for local/testnet tests only. Mainnet deployment scripts accept `WIF_TOKEN`, which must be set to the canonical address above.

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
