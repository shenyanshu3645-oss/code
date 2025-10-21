// scripts/UpgradeViaProxyAdmin.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/UpgradeableNFTMarketNew.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";


contract UpgradeViaProxyAdminScript is Script {
    address constant PROXY_ADDRESS = 0xB4c7C662e2EF004E9F02c8083b50273A2DD19a9F;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deployer:", deployer);

        // 1. 获取 ProxyAdmin 地址
        (address proxyAdminAddress, ) = getProxyInfo();
        console.log("ProxyAdmin address:", proxyAdminAddress);

        // 2. 检查 ProxyAdmin 的 owner
        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
        address proxyAdminOwner = proxyAdmin.owner();
        console.log("ProxyAdmin owner:", proxyAdminOwner);
        console.log("Is deployer the ProxyAdmin owner?", deployer == proxyAdminOwner);

        if (deployer != proxyAdminOwner) {
            console.log("not ProxyAdmin owner");
            revert("Not authorized");
        }

        // 3. 部署新的逻辑合约
        UpgradeableNFTMarketNew newImplementation = new UpgradeableNFTMarketNew();
        console.log("New implementation:", address(newImplementation));

        // 4. 通过 ProxyAdmin 升级
        console.log("Upgrading via ProxyAdmin...");
        // 使用 upgradeAndCall 方法，传入空的 calldata
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(PROXY_ADDRESS)),
            address(newImplementation),
            ""
        );
        console.log("Upgrade via ProxyAdmin successful!");

        vm.stopBroadcast();
    }

    function getProxyInfo() internal view returns (address admin, address implementation) {
        (bool success1, bytes memory adminData) = PROXY_ADDRESS.staticcall(
            abi.encodeWithSignature("getAdmin()")
        );
        require(success1, "Failed to get admin");
        admin = abi.decode(adminData, (address));

        (bool success2, bytes memory implData) = PROXY_ADDRESS.staticcall(
            abi.encodeWithSignature("getImplementation()")
        );
        require(success2, "Failed to get implementation");
        implementation = abi.decode(implData, (address));

        return (admin, implementation);
    }
}