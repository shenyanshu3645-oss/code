// SPDX-License-Identifier: MIT
pragma solidity 0.6.2;

import {Script, console} from "forge-std/Script.sol";
import {UniswapV2Factory} from "v2-core/UniswapV2Factory.sol";
import {UniswapV2Pair} from "v2-core/UniswapV2Pair.sol";

contract DeployFactoryScript is Script {
    UniswapV2Factory public factory;

    function setUp() public {}

    function run() public {
        address deployer = vm.envAddress("DEPLOYER");
        vm.startBroadcast(deployer);

        // 计算并显示init_code_hash
        bytes memory creationCode = type(UniswapV2Pair).creationCode;
        bytes32 initCodeHash = keccak256(creationCode);
        console.log("Init Code Hash:");
        console.logBytes32(initCodeHash);

        // 部署Uniswap V2 Factory
        factory = new UniswapV2Factory(deployer);
        console.log("UniswapV2Factory deployed at:", address(factory));

        // 设置手续费收取地址为零地址（无手续费）
        factory.setFeeTo(address(0));
        console.log("FeeTo set to zero address");

        vm.stopBroadcast();
    }
}