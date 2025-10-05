import dotenv from 'dotenv';
import { sepolia, mainnet } from 'viem/chains';

// 加载环境变量
dotenv.config();

/**
 * 应用配置
 */
export const config = {
    // 网络配置 - 使用Viem链定义
    chain: process.env.NETWORK_NAME === 'mainnet' ? mainnet : sepolia,
    
    // RPC配置
    rpcUrl: process.env.RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID',
    
    // 合约配置
    contracts: {
        nftMarket: {
            address: process.env.NFT_MARKET_ADDRESS || '0x45E62735ba934568b057b9184C738A34998f1bb7',
            // TODO: 添加完整的合约ABI
            abi: [
                // NFTListed事件
                {
                    "anonymous": false,
                    "inputs": [
                        {"indexed": true, "name": "tokenId", "type": "uint256"},
                        {"indexed": true, "name": "seller", "type": "address"},
                        {"indexed": false, "name": "price", "type": "uint256"}
                    ],
                    "name": "NFTListed",
                    "type": "event"
                },
                // NFTSold事件
                {
                    "anonymous": false,
                    "inputs": [
                        {"indexed": true, "name": "tokenId", "type": "uint256"},
                        {"indexed": true, "name": "buyer", "type": "address"},
                        {"indexed": true, "name": "seller", "type": "address"},
                        {"indexed": false, "name": "price", "type": "uint256"}
                    ],
                    "name": "NFTSold",
                    "type": "event"
                },
                // TokensReceived事件
                {
                    "anonymous": false,
                    "inputs": [
                        {"indexed": false, "name": "from", "type": "address"},
                        {"indexed": false, "name": "amount", "type": "uint256"},
                        {"indexed": false, "name": "tokenId", "type": "uint256"}
                    ],
                    "name": "TokensReceived",
                    "type": "event"
                }
                // TODO: 添加其他需要的函数ABI
            ]
        }
    },
    
    // 事件监听配置
    eventListening: {
        // 从哪个区块开始监听（'latest'表示最新区块）
        fromBlock: process.env.FROM_BLOCK ? BigInt(process.env.FROM_BLOCK) : 'latest',
        // 是否处理历史事件
        processHistoricalEvents: process.env.PROCESS_HISTORICAL === 'true',
        // 轮询间隔（毫秒）
        pollingInterval: parseInt(process.env.POLLING_INTERVAL) || 4000
    }
};;