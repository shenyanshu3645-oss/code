// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/MyERC20Permit.sol";

contract DeployPermitTokenScript is Script {
    function run() external {
        // 获取部署者私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying Permit Token with account: %s", deployer);
        
        // 开始广播交易
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署 MyERC20Permit 合约
        MyERC20Permit token = new MyERC20Permit();
        
        console.log("Permit Token deployed at: %s", address(token));
        console.log("Token name: %s", token.name());
        console.log("Token symbol: %s", token.symbol());
        console.log("Deployer initial balance: %d", token.balanceOf(deployer));
        
        // 停止广播
        vm.stopBroadcast();
        
        // 输出部署信息
        console.log("");
        console.log("Deployment Summary:");
        console.log("==================");
        console.log("Deployer Address: %s", deployer);
        console.log("Token Address:    %s", address(token));
        console.log("Network:          %s", block.chainid);
    }
}