import { logger } from '../utils/logger.js';
import { 
    NFTListedEvent, 
    NFTSoldEvent, 
    TokensReceivedEvent,
    EventProcessingResult,
    ListenerStatus 
} from '../types/events.js';
import { parseAbi } from 'viem';
import { on } from 'events';

/**
 * NFT市场事件监听器 - 使用Viem框架
 */
export class NFTMarketEventListener {
    constructor(publicClient, config) {
        this.publicClient = publicClient;
        this.config = config;
        this.unwatchFunctions = new Map(); // 存储取消监听的函数
    }

    /**
     * 开始监听事件
     */
    async startListening() {
        console.log('🎯 开始监听事件...');
        
        // TODO: 订阅NFTListed事件
        await this.subscribeToNFTListedEvents();
        // TODO: 订阅NFTSold事件
        await this.subscribeToNFTSoldEvents();
        // TODO: 订阅TokensReceived事件
        await this.subscribeToTokensReceivedEvents();
        
        console.log('✅ 事件监听已启动');
    }

    /**
     * 停止监听事件
     */
    async stopListening() {
        console.log('🛑 停止事件监听...');
        
        // TODO: 取消所有订阅        
        console.log('✅ 事件监听已停止');
    }

    /**
     * 订阅NFT上架事件
     */
    async subscribeToNFTListedEvents() {
        // TODO: 使用publicClient.watchContractEvent实现NFTListed事件订阅
        this.unwatchFunctions.set(
            'NFTListed',
            this.publicClient.watchContractEvent({
                address: this.config.marketContractAddress,
                abi: parseAbi(['event NFTListed(uint256 indexed tokenId,address indexed seller,uint256 price)']),
                eventName: NFTListedEvent.eventName,
                // args: NFTListedEvent.args,//这个是过滤参数的，比如特定地址的事件
                onLogs: (logs) => {
                    this.handleNFTListedEvent(logs);
                }
            })
        )
        console.log('📝 订阅NFTListed事件');
    }

    /**
     * 订阅NFT售出事件
     */
    async subscribeToNFTSoldEvents() {
        // TODO: 使用publicClient.watchContractEvent实现NFTSold事件订阅
        this.unwatchFunctions.set(
            'NFTSold',
            this.publicClient.watchContractEvent({
                address: this.config.marketContractAddress,
                abi: parseAbi(['event NFTSold(uint256 indexed tokenId,address indexed buyer,address indexed seller,uint256 price)']),
                eventName: NFTSoldEvent.eventName,
                // args: NFTSoldEvent.args,//这个是过滤参数的，比如特定地址
                onLogs: (logs) => {
                    this.handleNFTSoldEvent(logs);
                }
            })
        )
        console.log('💰 订阅NFTSold事件');
    }

    /**
     * 订阅代币接收事件
     */
    async subscribeToTokensReceivedEvents() {
        // TODO: 使用publicClient.watchContractEvent实现TokensReceived事件订阅
        this.unwatchFunctions.set(
            'TokensReceived',
            this.publicClient.watchContractEvent({
                address: this.config.marketContractAddress,
                abi: parseAbi(['event TokensReceived(address indexed from,uint256 amount,uint256 indexed tokenId)']),
                eventName: TokensReceivedEvent.eventName,
                // args: TokensReceivedEvent.args,//这个是过滤参数的，比如特定地址
                onLogs: (logs) => {
                    this.handleTokensReceivedEvent(logs);
                }
            })
        )
        console.log('🪙 订阅TokensReceived事件');
    }

    /**
     * 处理NFT上架事件
     */
    handleNFTListedEvent(logs) {
        // TODO: 实现NFT上架事件处理逻辑
        console.log('NFT上架事件:', logs);
    }

    /**
     * 处理NFT售出事件
     */
    handleNFTSoldEvent(logs) {
        // TODO: 实现NFT售出事件处理逻辑
        console.log('NFT售出事件:', logs);
    }

    /**
     * 处理代币接收事件
     */
    handleTokensReceivedEvent(logs) {
        // TODO: 实现代币接收事件处理逻辑
        console.log('代币接收事件:', logs);
    }

    /**
     * 获取历史事件
     */
    async getHistoricalEvents() {
        // TODO: 使用publicClient.getLogs获取历史事件
        console.log('获取历史事件...');
    }
}