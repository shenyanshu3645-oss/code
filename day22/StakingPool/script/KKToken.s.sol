// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/KKToken.sol";

contract KKTokenScript is Script {
    function run() external {
        // 从环境变量中获取部署者的私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying KKToken with deployer:", deployer);
        
        // 开始广播交易
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署KKToken合约
        KKToken kkToken = new KKToken();
        
        // 停止广播交易
        vm.stopBroadcast();
        
        // 输出部署的合约地址
        console.log("KKToken deployed at:", address(kkToken));
        console.log("KKToken name:", kkToken.name());
        console.log("KKToken symbol:", kkToken.symbol());
        
        // 验证部署
        require(address(kkToken) != address(0), "KKToken deployment failed");
        require(keccak256(bytes(kkToken.name())) == keccak256(bytes("KkToken")), "KKToken name mismatch");
        require(keccak256(bytes(kkToken.symbol())) == keccak256(bytes("KkToken")), "KKToken symbol mismatch");
        console.log("Deployment verified successfully");
    }
    
    
}