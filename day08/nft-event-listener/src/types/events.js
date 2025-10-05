/**
 * NFT市场事件类型定义 - 适配viem框架
 */

/**
 * NFT上架事件
 */
export const NFTListedEvent = {
    eventName: 'NFTListed',
    // Viem事件签名格式
    args: {
        tokenId: { indexed: true, type: 'uint256' },
        seller: { indexed: true, type: 'address' },
        price: { indexed: false, type: 'uint256' }
    }
};

/**
 * NFT售出事件
 */
export const NFTSoldEvent = {
    eventName: 'NFTSold',
    args: {
        tokenId: { indexed: true, type: 'uint256' },
        buyer: { indexed: true, type: 'address' },
        seller: { indexed: true, type: 'address' },
        price: { indexed: false, type: 'uint256' }
    }
};

/**
 * 代币接收事件
 */
export const TokensReceivedEvent = {
    eventName: 'TokensReceived',
    args: {
        from: { indexed: false, type: 'address' },
        amount: { indexed: false, type: 'uint256' },
        tokenId: { indexed: false, type: 'uint256' }
    }
};

/**
 * 事件处理结果类型
 */
export const EventProcessingResult = {
    SUCCESS: 'success',
    ERROR: 'error',
    SKIP: 'skip'
};

/**
 * 监听状态类型
 */
export const ListenerStatus = {
    STOPPED: 'stopped',
    STARTING: 'starting',
    RUNNING: 'running',
    STOPPING: 'stopping',
    ERROR: 'error'
};

/**
 * Viem watchContractEvent 参数类型
 */
export const WatchEventParams = {
    // 轮询方式
    POLLING: 'polling',
    // WebSocket方式
    WEBSOCKET: 'webSocket'
};