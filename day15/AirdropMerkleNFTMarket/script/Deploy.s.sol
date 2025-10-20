// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../src/AirdropMerkleNFTMarket.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DeployScript is Script {
    function run() external {
        // 获取部署者地址
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        
        // 使用已部署的 ERC20 和 ERC721 合约地址
        // 你需要在环境变量中设置这些地址
        address erc20Address = vm.envAddress("ERC20_TOKEN_ADDRESS");
        address erc721Address = vm.envAddress("ERC721_NFT_ADDRESS");
        
        // 部署 NFT 市场合约
        bytes32 merkleRoot = 0xe77be144a7bde76710475a0d5db55211215dad96ea268f4b33a06cf3c3a82ce7;
        NFTMarket market = new NFTMarket(
            IERC20Permit(erc20Address), 
            ERC721(erc721Address), 
            merkleRoot, 
            deployer
        );
        console.log("NFT Market deployed at:", address(market));
        
        vm.stopBroadcast();
        
        // 输出部署信息
        console.log("");
        console.log("Deployment Summary:");
        console.log("==================");
        console.log("Deployer Address: ", deployer);
        console.log("Payment Token:    ", erc20Address);
        console.log("NFT Contract:     ", erc721Address);
        console.log("Market Contract:  ", address(market));
    }
}