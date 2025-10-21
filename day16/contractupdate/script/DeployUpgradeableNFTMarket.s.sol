// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/UpgradeableNFTMarket.sol";
import "../src/NftMarketProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract DeployUpgradeableNFTMarket is Script {
    function run() external {
        // 从环境变量获取私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // 设置初始化参数 (这里使用占位符地址，实际部署时需要替换为真实的合约地址)
        IERC20 paymentToken = IERC20(0xe7F07a03404AF7b5d205Ec15b09474c0AA664Be5); // 需要替换为真实的ERC20代币合约地址
        ERC721URIStorage erc721 = ERC721URIStorage(0x8c28cf493C571dcA9AED07675aA6884B92EE51Ce); // 需要替换为真实的ERC721合约地址

        // 部署逻辑合约 (UpgradeableNFTMarket)
        UpgradeableNFTMarket marketLogic = new UpgradeableNFTMarket();
        console.log("UpgradeableNFTMarket logic contract deployed at:", address(marketLogic));

        // 构造初始化数据
        bytes memory initData = abi.encodeWithSelector(
            UpgradeableNFTMarket.initialize.selector,
            paymentToken,
            erc721
        );

        // 部署代理合约
        NFTMarketProxy marketProxy = new NFTMarketProxy(
            address(marketLogic),
            deployer, // admin
            initData
        );
        console.log("NFT Market Proxy contract deployed at:", address(marketProxy));

        // 验证部署
        UpgradeableNFTMarket market = UpgradeableNFTMarket(address(marketProxy));
        console.log("Implementation Address:", marketProxy.getImplementation());
        console.log("Admin Address:", marketProxy.getAdmin());

        vm.stopBroadcast();
    }
}