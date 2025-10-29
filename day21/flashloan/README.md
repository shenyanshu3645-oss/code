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
$ forge script script/Deploy.s.sol:DeployScript --rpc-url <your_rpc_url> --private-key <your_private_key>
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

## Flash Loan Implementation

This repository contains a Uniswap V2 based flash loan implementation with the following components:

1. **FlashLoan.sol**: The main flash loan contract that interacts with Uniswap V2 pairs
2. **FlashLoanReceiver.sol**: Example receiver contract that implements the flash loan callback
3. **Interfaces**: Uniswap V2 interfaces for factory, pair, and router contracts

### Key Features

- Supports flash loans from multiple Uniswap V2 pairs
- Implements Uniswap V2's `uniswapV2Call` callback mechanism
- Calculates and enforces flash loan fees (0.3%)
- Provides a clean interface for implementing arbitrage or other strategies

### How it works

1. The flash loan contract uses Uniswap V2's swap functionality to borrow tokens
2. The borrowed tokens are sent to the receiver contract
3. The receiver contract must implement the `executeOperation` function to handle the borrowed funds
4. After execution, the receiver must return the borrowed amount plus fees to the pair contract
5. The Uniswap V2 pair contract ensures the correct amount is returned, otherwise the transaction reverts