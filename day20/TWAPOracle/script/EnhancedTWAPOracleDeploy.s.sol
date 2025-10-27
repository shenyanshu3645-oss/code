// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/EnhancedTWAPOracle.sol";

contract EnhancedTWAPOracleDeployScript is Script {
    function run() external {
        // 获取部署者私钥（从环境变量中读取）
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying EnhancedTWAPOracle with account:", deployer);
        
        // 获取 Uniswap V2 Factory 地址（从环境变量中读取，或使用默认值）
        address uniswapV2Factory = vm.envOr("UNISWAP_V2_FACTORY", address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f));
        
        // 开始广播交易
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署 EnhancedTWAPOracle 合约
        EnhancedTWAPOracle oracle = new EnhancedTWAPOracle(uniswapV2Factory);
        
        // 停止广播交易
        vm.stopBroadcast();
        
        // 输出部署的合约地址
        console.log("EnhancedTWAPOracle deployed at:", address(oracle));
        console.log("Using Uniswap V2 Factory at:", uniswapV2Factory);
    }
    
    // 如果您想在部署时指定 Uniswap V2 Factory 地址，可以使用此函数
    function runWithFactory(address _uniswapFactory) external {
        // 获取部署者私钥（从环境变量中读取）
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying EnhancedTWAPOracle with account:", deployer);
        
        // 开始广播交易
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署 EnhancedTWAPOracle 合约
        EnhancedTWAPOracle oracle = new EnhancedTWAPOracle(_uniswapFactory);
        
        // 停止广播交易
        vm.stopBroadcast();
        
        // 输出部署的合约地址
        console.log("EnhancedTWAPOracle deployed at:", address(oracle));
        console.log("Using Uniswap V2 Factory at:", _uniswapFactory);
    }
}