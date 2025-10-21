// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/UpgradeableNFTMarketNew.sol";

contract DeployUpgradeableNFTMarketNew is Script {
    function run() external {
        // 从环境变量获取私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // 部署逻辑合约 (UpgradeableNFTMarketNew)
        UpgradeableNFTMarketNew marketLogic = new UpgradeableNFTMarketNew();
        console.log("UpgradeableNFTMarketNew logic contract deployed at:", address(marketLogic));

        // 注意：这是一个逻辑合约，需要通过代理合约来初始化和使用
        // 直接部署逻辑合约不会调用initialize函数
        
        vm.stopBroadcast();
    }
}