#!/usr/bin/env node

import inquirer from 'inquirer';
import { generatePrivateKey, displayBalance, GenERC20Transfer, SignAndSendTransaction } from './wallet';

async function main() {
  console.log('Welcome to CLI Wallet!');

  const choices = [
    '1. Generate Private Key',
    '2. Check Balance',
    '3. Generate ERC20 Transfer',
    '4. Sign and Send Transaction',
    '5. Exit'
  ];

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices
      }
    ]);

    switch (action) {
      case '1. Generate Private Key':
        await generatePrivateKey();
        break;
      case '2. Check Balance':
        await displayBalance();
        break;
      case '3. Generate ERC20 Transfer':
        await GenERC20Transfer();
        break;
      case '4. Sign and Send Transaction':
        await SignAndSendTransaction();
        break;
      case '5. Exit':
        console.log('Goodbye!');
        process.exit(0);
        break;
      default:
        console.log('Invalid option. Please try again.');
    }

    // Add a separator for better readability
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

main().catch(console.error);