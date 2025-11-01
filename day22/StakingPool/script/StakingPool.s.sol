// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/StakingPool.sol";
import "../src/KKToken.sol";

contract StakingPoolScript is Script {
    function run() external {
        // 从环境变量中获取部署者的私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // KK Token的地址（需要根据实际情况替换）
        address kkTokenAddress = vm.envAddress("KK_TOKEN_ADDRESS");
        
        console.log("Deploying StakingPool with deployer:", deployer);
        console.log("KK Token address:", kkTokenAddress);
        
        // 开始广播交易
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署StakingPool合约
        StakingPool stakingPool = new StakingPool(kkTokenAddress);
        
        // 停止广播交易
        vm.stopBroadcast();
        
        // 输出部署的合约地址
        console.log("StakingPool deployed at:", address(stakingPool));
        
        // 验证部署
        require(address(stakingPool) != address(0), "StakingPool deployment failed");
        require(address(stakingPool.kkToken()) == kkTokenAddress, "KK Token address mismatch");
        console.log("Deployment verified successfully");
    }
    
    
}