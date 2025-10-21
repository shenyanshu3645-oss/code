// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/UpgradeableNFT.sol";
import "../src/NftProxy.sol";

contract DeployUpgradeableNFT is Script {
    function run() external {
        // 从环境变量获取私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // 设置初始化参数
        string memory name = "My Upgradeable NFT";
        string memory symbol = "UPNFT";
        string memory baseTokenURI = "https://example.com/token/";
        address initialOwner = deployer;

        // 部署逻辑合约 (UpgradeableNFT)
        UpgradeableNFT nftLogic = new UpgradeableNFT();
        console.log("UpgradeableNFT logic contract deployed at:", address(nftLogic));

        // 构造初始化数据
        bytes memory initData = abi.encodeWithSelector(
            UpgradeableNFT.initialize.selector,
            name,
            symbol,
            baseTokenURI,
            initialOwner
        );

        // 部署代理合约
        NFTProxy nftProxy = new NFTProxy(
            address(nftLogic),
            deployer, // admin
            initData
        );
        console.log("NFT Proxy contract deployed at:", address(nftProxy));

        // 验证部署
        UpgradeableNFT nft = UpgradeableNFT(address(nftProxy));
        console.log("NFT Name:", nft.name());
        console.log("NFT Symbol:", nft.symbol());
        console.log("Initial Owner:", nft.owner());
        console.log("Implementation Address:", nftProxy.getImplementation());
        console.log("Admin Address:", nftProxy.getAdmin());

        vm.stopBroadcast();
    }
}