# CLI Wallet

A simple command-line interface wallet for Ethereum transactions.

## Features

1. Generate private keys
2. Check wallet balances
3. Sign ERC20 transfer transactions
4. Send transactions to the Sepolia network

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

Or for development:

```bash
npm run dev
```

## Configuration

Create a `.env` file with your configuration:

```
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=0x...
ERC20_TOKEN_ADDRESS=0x...
```

## Commands

1. **Generate Private Key** - Creates a new Ethereum private key and displays the corresponding address
2. **Check Balance** - Displays the balance of a specified wallet address
3. **Sign ERC20 Transfer** - Signs an ERC20 token transfer transaction
4. **Send Transaction** - Sends a transaction to the Sepolia network
5. **Exit** - Exits the application

## Development

To build the project:

```bash
npm run build
```

The compiled JavaScript files will be in the `dist` directory.