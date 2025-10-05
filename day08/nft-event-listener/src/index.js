import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
import { config } from './config/config.js';
import { NFTMarketEventListener } from './handlers/nftMarketEventHandler.js';

// 加载环境变量
dotenv.config();

class NFTEventListenerApp {
    constructor() {
        this.publicClient = null;
        this.eventListener = null;
        this.isRunning = false;
    }

    /**
     * 初始化应用
     */
    async initialize() {
        console.log('🚀 NFT Event Listener 启动中...');

        // TODO: 初始化Viem公共客户端
        this.publicClient = createPublicClient({
            chain: sepolia,
            transport: http()
        });
        // TODO: 初始化事件监听器
        this.eventListener = new NFTMarketEventListener(this.publicClient, config);
        console.log('✅ NFT Event Listener 初始化完成');
    }

    /**
     * 启动事件监听
     */
    async start() {
        console.log('🎯 开始监听NFT市场事件...');

        // TODO: 启动事件监听器
        await this.eventListener.startListening();

        this.isRunning = true;
        console.log('✅ NFT事件监听已启动');
    }

    /**
     * 停止事件监听
     */
    async stop() {
        console.log('🛑 停止事件监听...');

        // TODO: 停止事件监听器
        await this.eventListener.stopListening();

        this.isRunning = false;
        console.log('✅ NFT事件监听已停止');
    }
}

// 创建应用实例
const app = new NFTEventListenerApp();

// 启动应用
async function main() {
    try {
        await app.initialize();
        await app.start();

        console.log('🔄 事件监听器正在运行，按 Ctrl+C 停止...');

    } catch (error) {
        console.error('❌ 应用启动失败:', error);
        process.exit(1);
    }
}

// 执行主函数
main();