## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Setup

1. Install Foundry: https://getfoundry.sh/
2. Install dependencies:
   ```shell
   $ forge install foundry-rs/forge-std --no-commit
   $ forge install OpenZeppelin/openzeppelin-contracts --no-commit
   ```

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

Run MemeFactory tests specifically:
```shell
$ forge test --match-contract MemeFactoryTest
```

All tests are currently passing:
```shell
$ forge test --rpc-url http://127.0.0.1:8545
Running 6 tests for test/WorkingMemeFactoryTest.t.sol:WorkingMemeFactoryTest
[PASS] testBuyMeme() (gas: 2845971)
[PASS] testChangeOwner() (gas: 17935)
[PASS] testDeployment() (gas: 361724)
[PASS] testGetAllClones() (gas: 673582)
[PASS] testMintMeme() (gas: 2763950)
[PASS] testPairForAndCreatePair() (gas: 2062928)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 37.53ms
```

Test Summary:
- testDeployment: Verifies token deployment functionality
- testMintMeme: Tests the meme token minting with liquidity addition
- testGetAllClones: Checks the clone management functionality
- testBuyMeme: Tests the meme token purchasing functionality
- testChangeOwner: Verifies owner change functionality
- testPairForAndCreatePair: Validates Uniswap pair address calculation consistency

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