import inquirer from 'inquirer';
import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { createPublicClient } from 'viem';
import dotenv from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';
import * as crypto from 'crypto';
import * as secp256k1 from 'secp256k1';
import { erc20Abi } from 'viem'
import { encodeFunctionData, parseUnits } from 'viem'
import { prepareTransactionRequest } from 'viem/actions'

dotenv.config();

// Placeholder for wallet state
let walletState: { privateKey?: `0x${string}`; address?: `0x${string}` } = {};

// Global transaction parameters
let txParams: any = null;

/**
 * Generate a new private key and display the corresponding address
 */
export async function generatePrivateKey(): Promise<void> {


    //生成32位随机数
    let privateKey = crypto.randomBytes(32).toString('hex');
    //检查私钥是否可用
    while (!secp256k1.privateKeyVerify(Buffer.from(privateKey, 'hex'))) {
        privateKey = crypto.randomBytes(32).toString('hex');
    }

    const formattedPrivateKey = `0x${privateKey}` as `0x${string}`;
    walletState.privateKey = formattedPrivateKey;

    // Create account from private key to get the address
    const account = privateKeyToAccount(formattedPrivateKey);
    walletState.address = account.address;

    // Example of how to collect user input
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Do you want to generate a new private key?',
            default: true
        }
    ]);

    if (confirm) {
        console.log('New private key generated!');
        console.log(`Private Key: ${formattedPrivateKey}`);
        console.log(`Address: ${account.address}`);
    }
}

/**
 * Display the balance of the wallet
 */
export async function displayBalance(): Promise<void> {
    // Check if wallet is initialized
    if (!walletState.privateKey || !walletState.address) {
        console.log('Wallet not initialized. Please generate a private key first.');
        return;
    }

    console.log(`Checking wallet balance for ${walletState.address}...`);

    try {
        // Create a public client to interact with the Sepolia network
        const publicClient = createPublicClient({
            chain: sepolia,
            transport: http(process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org')
        });

        // Get the balance
        const balance = await publicClient.getBalance({
            address: walletState.address
        });

        console.log(`Balance: ${formatEther(balance)} ETH`);
    } catch (error) {
        console.error('Error fetching balance:', error);
    }
}



/**
 * Gen an ERC20 transfer transaction
 * // 11. 构建交易参数
    const txParams = {
  account: account,
  to: '0xTokenContractAddress' as `0x${string}`, // ERC20 合约地址
  data: '0xa9059cbb000000000000000000000000recipientAddress000000000000000000000000000000000000000000000000000000000amount', // 编码的transfer函数调用
  value: 0, // 一定是0，因为不是发送ETH
  chain: sepolia,
  maxFeePerGas: feeData.maxFeePerGas!,
  maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
  gas: 65000n, // 建议设置为65000-100000
  nonce: nonce,
}


 */
export async function GenERC20Transfer(): Promise<void> {
    // Check if wallet is initialized
    if (!walletState.privateKey || !walletState.address) {
        console.log('Wallet not initialized. Please generate a private key first.');
        return;
    }

    console.log('Gen ERC20 transfer transaction...');

    // Collect user input for transfer details according to the specified format
    const transferDetails = await inquirer.prompt([
        {
            type: 'input',
            name: 'contractAddress',
            message: 'Enter ERC20 token contract address (to):', // 对应格式中的 'to' 字段
            validate: (input: string) => {
                if (!input.startsWith('0x') || input.length !== 42) {
                    return 'Please enter a valid contract address (must start with 0x and be 42 characters long)';
                }
                return true;
            }
        },
        {
            type: 'input',
            name: 'recipient',
            message: 'Enter recipient address (first input in data):', // 对应格式中 data 字段的第一个 input
            validate: (input: string) => {
                if (!input.startsWith('0x') || input.length !== 42) {
                    return 'Please enter a valid recipient Ethereum address (must start with 0x and be 42 characters long)';
                }
                return true;
            }
        },
        {
            type: 'input',
            name: 'amount',
            message: 'Enter amount in wei (second input in data):', // 对应格式中 data 字段的第二个 input
            validate: (input: string) => {
                if (isNaN(parseInt(input)) || parseInt(input) <= 0) {
                    return 'Please enter a valid amount in wei (positive integer)';
                }
                return true;
            }
        }
    ]);

    try {
        // Create account from private key
        const account = privateKeyToAccount(walletState.privateKey);

        // Create public client to get fee data and nonce
        const publicClient = createPublicClient({
            chain: sepolia,
            transport: http(process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org')
        });

        // Get fee data and nonce
        const [feeData, nonce] = await Promise.all([
            publicClient.estimateFeesPerGas(),
            publicClient.getTransactionCount({ address: walletState.address })
        ]);

        // Construct transaction data according to the specified format
        txParams = {
            account: account,
            to: transferDetails.contractAddress as `0x${string}`, // 这个是合约地址
            data: `0xa9059cbb${transferDetails.recipient.slice(2).padStart(64, '0')}${parseInt(transferDetails.amount).toString(16).padStart(64, '0')}`, // 第一个input是转账地址，第二个是金额
            value: 0, // 一定是0，因为不是发送ETH
            chain: sepolia,
            maxFeePerGas: feeData.maxFeePerGas!,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
            gas: 70000n, // 建议设置为65000-100000
            nonce: nonce,
        };

        console.log('Transaction parameters constructed:');
        console.log(txParams);

        console.log('ERC20 transfer transaction data constructed successfully!');
    } catch (error) {
        console.error('Error constructing transaction:', error);
    }
}

/**
 * Send a transaction to the Sepolia network
 */
export async function SignAndSendTransaction(): Promise<void> {
    // Check if wallet is initialized
    if (!walletState.privateKey || !walletState.address) {
        console.log('Wallet not initialized. Please generate a private key first.');
        return;
    }

    console.log('Sending transaction to Sepolia network...');

    try {

        if (!txParams) {
            console.log('Transaction parameters not found. Please generate transaction parameters first.');
            return;
        }
        // Create wallet client
        const account = privateKeyToAccount(walletState.privateKey);
        // 创建公共客户端
        const publicClient = createPublicClient({
            chain: sepolia,
            transport: http(process.env.SEPOLIA_RPC_URL)
        })

        const walletClient = createWalletClient({
            account,
            chain: sepolia,
            transport: http(process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org')
        });

        // 准备交易
        const preparedTx = await prepareTransactionRequest(walletClient, txParams)
        console.log('准备后的交易参数:preparedTx', preparedTx)
        // 签名交易
        const signedTx = await walletClient.signTransaction(preparedTx)
        console.log('Signed Transaction:', signedTx)
        // 发送交易
        const txHash = await walletClient.sendRawTransaction({
            serializedTransaction: signedTx
        })
        console.log('Transaction Hash:', txHash)
        //等待区块确认
        const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash
        })

        console.log('交易状态:', receipt.status === 'success' ? '成功' : '失败')

        console.log(`View on explorer: https://sepolia.etherscan.io/tx/${txHash}`);
    } catch (error) {
        console.error('Error sending transaction:', error);
    }
}