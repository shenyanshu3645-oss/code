/**
 * 简单的日志工具
 * TODO: 可以替换为更复杂的日志库如winston
 */

export const logger = {
    info: (message, data) => {
        console.log(`[INFO] ${message}`, data || '');
    },
    
    error: (message, error) => {
        console.error(`[ERROR] ${message}`, error || '');
    },
    
    warn: (message, data) => {
        console.warn(`[WARN] ${message}`, data || '');
    },
    
    debug: (message, data) => {
        console.debug(`[DEBUG] ${message}`, data || '');
    }
};

/**
 * 记录NFT事件的专用函数
 */
export function logNFTEvent(eventType, eventData) {
    // TODO: 实现NFT事件专用日志记录
    console.log(`[NFT_EVENT] ${eventType}:`, eventData);
}