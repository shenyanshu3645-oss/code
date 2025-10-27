// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";

// 辅助库用于分数计算（Q112.112 格式）
library FixedPoint {
    struct uq112x112 {
        uint224 _x;
    }

    function fraction(uint112 numerator, uint112 denominator) 
        internal 
        pure 
        returns (uq112x112 memory) 
    {
        require(denominator > 0, "FixedPoint: DIV_BY_ZERO");
        return uq112x112(uint224(numerator) << 112 / denominator);
    }
}

/**
 * @title 增强版 TWAP 预言机（基于 Uniswap V2）
 * @dev 
 * - 支持多交易对独立观测窗口
 * - 返回 Q112.112 格式的 TWAP 价格（与 Uniswap V2 兼容）
 * - 价格方向：consult(tokenA, tokenB) 返回 "每单位 tokenA 的 tokenB 数量"（按 TWAP）
 */
contract EnhancedTWAPOracle {
    IUniswapV2Factory public immutable factory;
    
    struct Observation {
        uint32 timestamp;
        uint256 price0Cumulative; // cumulative price of token0 in terms of token1 (Q112.112)
        uint256 price1Cumulative; // cumulative price of token1 in terms of token0 (Q112.112)
    }
    
    mapping(address => Observation[]) public observations;
    mapping(address => uint8) public observationCount;
    
    // 便于测试：生产环境应设为 30 minutes 或更高
    uint32 public constant MIN_UPDATE_INTERVAL = 0;
    uint8 public constant MAX_OBSERVATIONS = 20;
    
    event ObservationRecorded(
        address indexed pair,
        uint32 timestamp,
        uint256 price0Cumulative,
        uint256 price1Cumulative
    );

    constructor(address _factory) {
        factory = IUniswapV2Factory(_factory);
    }

    /**
     * @dev 记录当前累积价格观测值
     * @param tokenA 第一个代币
     * @param tokenB 第二个代币
     */
    function recordObservation(address tokenA, address tokenB) external {
        address pair = factory.getPair(tokenA, tokenB);
        require(pair != address(0), "EnhancedTWAPOracle: Pair does not exist");
        
        Observation[] storage pairObservations = observations[pair];
        
        // 防止过于频繁更新
        if (pairObservations.length > 0) {
            uint32 lastTimestamp = pairObservations[pairObservations.length - 1].timestamp;
            require(
                block.timestamp >= lastTimestamp + MIN_UPDATE_INTERVAL,
                "EnhancedTWAPOracle: Update too frequent"
            );
        }
        
        (uint256 price0Cumulative, uint256 price1Cumulative,) = 
            _currentCumulativePrices(pair);
        
        Observation memory newObservation = Observation({
            timestamp: uint32(block.timestamp),
            price0Cumulative: price0Cumulative,
            price1Cumulative: price1Cumulative
        });
        
        // 维护最多 MAX_OBSERVATIONS 个观测点（保留最新）
        if (pairObservations.length == MAX_OBSERVATIONS) {
            // 移除最旧的（索引0），左移
            for (uint256 i = 0; i < MAX_OBSERVATIONS - 1; i++) {
                pairObservations[i] = pairObservations[i + 1];
            }
            pairObservations[MAX_OBSERVATIONS - 1] = newObservation;
        } else {
            pairObservations.push(newObservation);
        }
        
        observationCount[pair] = uint8(pairObservations.length);
        
        emit ObservationRecorded(
            pair, 
            uint32(block.timestamp), 
            price0Cumulative, 
            price1Cumulative
        );
    }

    /**
     * @dev 查询 TWAP 价格
     * @param tokenIn 输入代币（例如 WETH）
     * @param tokenOut 输出代币（例如 USDC）
     * @param period 时间窗口（秒），例如 1800 = 30 分钟
     * @return amountOut 返回 Q112.112 格式的平均价格：
     *         表示 "1 单位 tokenIn 可兑换多少 tokenOut" 的时间加权平均值
     */
    function consult(
        address tokenIn,
        address tokenOut,
        uint32 period
    ) external view returns (uint256 amountOut) {
        address pair = factory.getPair(tokenIn, tokenOut);
        require(pair != address(0), "EnhancedTWAPOracle: Pair does not exist");
        
        Observation[] storage obs = observations[pair];
        require(obs.length >= 2, "EnhancedTWAPOracle: Insufficient observations");
        
        IUniswapV2Pair pairContract = IUniswapV2Pair(pair);
        address token0 = pairContract.token0();
        
        // 确定使用 price0 还是 price1
        bool usePrice0 = (tokenIn == token0); // true: price = token1/token0

        uint32 endTime = uint32(block.timestamp);
        uint32 startTime = endTime - period;

        (uint256 cumStart, uint256 cumEnd, uint32 actualStart, uint32 actualEnd) = 
            _getCumulativeForDirection(obs, startTime, endTime, usePrice0);

        uint32 elapsed = actualEnd - actualStart;
        require(elapsed > 0, "EnhancedTWAPOracle: No time elapsed");

        return (cumEnd - cumStart) / elapsed;
    }

    /**
     * @dev 根据方向获取指定时间段内的累积价格
     */
    function _getCumulativeForDirection(
        Observation[] storage obs,
        uint32 startTime,
        uint32 endTime,
        bool usePrice0
    ) internal view returns (uint256 cumStart, uint256 cumEnd, uint32 actualStart, uint32 actualEnd) {
        require(obs.length >= 2, "EnhancedTWAPOracle: Need at least 2 observations");

        // 默认使用第一个和最后一个观测点
        uint256 startIndex = 0;
        uint256 endIndex = obs.length - 1;
        
        // 查找第一个 >= startTime 的观测点，取其前一个作为起点
        for (uint256 i = 0; i < obs.length; i++) {
            if (obs[i].timestamp >= startTime) {
                startIndex = (i > 0) ? i - 1 : 0;
                break;
            }
        }
        
        // 查找第一个 >= endTime 的观测点，取其前一个作为结束点
        for (uint256 i = 0; i < obs.length; i++) {
            if (obs[i].timestamp >= endTime) {
                endIndex = (i > 0) ? i - 1 : 0;
                break;
            }
        }
        
        // 如果endIndex为0，使用最后一个观测点
        if (endIndex == 0 && obs.length > 1) {
            endIndex = obs.length - 1;
        }

        // 确保 startIndex 不越界且小于 endIndex
        if (startIndex >= endIndex) {
            startIndex = endIndex > 0 ? endIndex - 1 : 0;
        }

        actualStart = obs[startIndex].timestamp;
        actualEnd = obs[endIndex].timestamp;

        if (usePrice0) {
            cumStart = obs[startIndex].price0Cumulative;
            cumEnd = obs[endIndex].price0Cumulative;
        } else {
            cumStart = obs[startIndex].price1Cumulative;
            cumEnd = obs[endIndex].price1Cumulative;
        }
    }

    /**
     * @dev 计算当前（最新）的累积价格，考虑自上次更新以来的时间
     */
    function _currentCumulativePrices(address pair)
        internal
        view
        returns (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp)
    {
        blockTimestamp = uint32(block.timestamp);
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = 
            IUniswapV2Pair(pair).getReserves();
        
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        require(timeElapsed <= 2**32 - 1, "EnhancedTWAPOracle: Time elapsed too large");

        // 获取上一次的累积价格
        uint256 price0CumulativeLast = IUniswapV2Pair(pair).price0CumulativeLast();
        uint256 price1CumulativeLast = IUniswapV2Pair(pair).price1CumulativeLast();

        // 计算当前累积价格 = last + currentPrice * timeElapsed
        price0Cumulative = price0CumulativeLast + 
            uint256(FixedPoint.fraction(reserve1, reserve0)._x) * timeElapsed;
        
        price1Cumulative = price1CumulativeLast + 
            uint256(FixedPoint.fraction(reserve0, reserve1)._x) * timeElapsed;
    }
}