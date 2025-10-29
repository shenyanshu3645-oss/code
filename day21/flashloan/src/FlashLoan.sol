// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IERC20.sol";

contract FlashLoan {

    //tokena 0xAA9e90E71bb721446B5f0f88A7C1D4DBc54E7024
    // tokenb 0x684DF40cffF4C88AaFe9b7c02BCB831c1ef31529

    // pair1 10000个tokenA 20000个tokenB
    // pair2 10000个tokenA 30000个tokenB
    //pair1 0x411fE828C8741D7083119cBa4633F172e03e5342
    //pair2 0xc705e9F14A6329eA2ADFb818DF1A094a7785c4A1

    // Uniswap V1 配置
    //weth 0x0C96889a0867055191DCb1c54cA7Fb7F8f32A651
    address public constant UNISWAP_V1_FACTORY = 0x9339aB5e4Cb4D6Ed4F42c9583E421d557429fD36;
    address public constant UNISWAP_V1_ROUTER = 0xaDB5E25FFe2Cd3d258c5287E107dcEE260e98055;
    
    // Uniswap V2 配置
    //weth 0x4D70F253A935ddb068b62340a3f3Bc51Ec25dF9b
    address public constant UNISWAP_V2_FACTORY = 0x00b609319bE24D293B4E673B3D9596f270168358;
    address public constant UNISWAP_V2_ROUTER = 0x5f006465473636db1ef69A01B677f5d028eE606D;
    
    IUniswapV2Factory public factory1;
    IUniswapV2Router02 public router1;
    IUniswapV2Factory public factory2;
    IUniswapV2Router02 public router2;
    
    constructor() {
        factory1 = IUniswapV2Factory(UNISWAP_V1_FACTORY);
        router1 = IUniswapV2Router02(UNISWAP_V1_ROUTER);
        factory2 = IUniswapV2Factory(UNISWAP_V2_FACTORY);
        router2 = IUniswapV2Router02(UNISWAP_V2_ROUTER);
    }
    
    // 发起闪电贷套利
    function executeFlashLoan(
        address pair1,      // 池子1地址
        address pair2,      // 池子2地址
        address tokenA,     // Token A 地址
        address tokenB,     // Token B 地址
        uint256 amountIn    // 从池子1借入的tokenA数量
    ) external {
        // 计算手续费 (0.3%)
        uint256 fee = (amountIn * 1000 + 996) / 997;
        // uint256 fee = amountIn * 3 / 1000;
        // uint256 fee =amountIn * 1 / 100; // 多还1%
        
        // 准备回调数据
        bytes memory data = abi.encode(
            pair1,
            pair2,
            tokenA,
            tokenB,
            amountIn,
            fee,
            msg.sender
        );
        
        // 从池子1借出tokenA (通过swap操作)
        // 我们需要确定哪个token是tokenA
        address token0 = IUniswapV2Pair(pair1).token0();
        
        uint256 amount0Out = 0;
        uint256 amount1Out = 0;
        
        if (token0 == tokenA) {
            amount0Out = amountIn;
        } else {
            amount1Out = amountIn;
        }
        
        // 执行swap操作触发闪电贷
        IUniswapV2Pair(pair1).swap(
            amount0Out,
            amount1Out,
            address(this),
            data
        );
    }
    
    // Uniswap V2 回调函数
    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        
        require(sender == address(this), "Invalid sender");

        // 解析回调数据
        (
            address pair1,
            address pair2,
            address tokenA,
            address tokenB,
            uint256 amountIn,
            uint256 fee,
            address initiator
        ) = abi.decode(data, (address, address, address, address, uint256, uint256, address));
        
        // 确保调用来自uniswap
        require(msg.sender == pair1, "Invalid pair");
        

        // _executeArbitrage2(pair1, pair2, tokenA, tokenB, amountIn, fee, initiator);

        // 执行套利操作并归还tokenA
        _executeArbitrage(pair1, pair2, tokenA, tokenB, amountIn, fee, initiator);
    }


    // 测试借出直接归还
    function _executeArbitrage2(
        address pair1,
        address pair2,
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 fee,
        address initiator
    ) internal {

        //检查借成功没
        uint256 balanceBefore = IERC20(tokenA).balanceOf(address(this));
        require(balanceBefore >= amountIn, "Not enough balance");

        // uint256 amountToRepay = amountIn + fee;
        uint256 amountToRepay = (amountIn * 1000 + 996) / 997;
        // uint256 amountToRepay = amountIn + 10000000000000000000;
        // 转移tokenA给池子1
        IERC20(tokenA).transfer(pair1, amountToRepay);
    }
    
    // 执行套利操作的内部函数
    function _executeArbitrage(
        address pair1,
        address pair2,
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 fee,
        address initiator
    ) internal {
        // 步骤1: 我们已经从池子1借到了tokenA
        // 步骤2: 到池子2中swap tokenA换tokenB
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        
        // 授权池子2使用我们的tokenA
        IERC20(tokenA).approve(address(router2), amountIn);
        
        // 在池子2中swap tokenA为tokenB
        uint[] memory amounts = router2.swapExactTokensForTokens(
            amountIn,
            0, // 接受任何数量的tokenB
            path,
            address(this),
            block.timestamp
        );
        
        // uint256 tokenBAmount = amounts[amounts.length - 1];
        
        //不能再从池子1中取出tokenA，这样会出现重入问题
        // // 步骤3: 用tokenB在池子1中swap回tokenA
        // path[0] = tokenB;
        // path[1] = tokenA;
        
        // // 授权路由器使用我们的tokenB
        // IERC20(tokenB).approve(address(router1), tokenBAmount);
        
        // // 在池子1中swap tokenB为tokenA
        // uint[] memory amounts2 = router1.swapExactTokensForTokens(
        //     tokenBAmount,
        //     0, // 接受任何数量的tokenA
        //     path,
        //     address(this),
        //     block.timestamp
        // );
        
        // uint256 tokenAAmount = amounts2[amounts2.length - 1];
        
        // 步骤4: 归还tokenA给池子1 (本金+手续费),本合约中要有足够的tokenA
        uint256 amountToRepay = (amountIn * 1000 + 996) / 997;
        // require(tokenAAmount > amountToRepay, "Not enough profit");
        
        // 转移tokenA给池子1(还款)
        IERC20(tokenA).transfer(pair1, amountToRepay);
        
        // 将tokena和tokenb发送给发起者
        uint tokenaamount = IERC20(tokenA).balanceOf(address(this));
        uint tokenbamount = IERC20(tokenB).balanceOf(address(this));
        IERC20(tokenA).transfer(initiator, tokenaamount);
        IERC20(tokenB).transfer(initiator, tokenbamount);
        
    }
    
    // 接收 ETH
    receive() external payable {}
}