// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6;

import {Script, console} from "lib/forge-std/src/Script.sol";
import {UniswapV2Router02} from "lib/v2-periphery/contracts/UniswapV2Router02.sol";
import {WETH9} from "lib/v2-periphery/contracts/test/WETH9.sol";

contract DeployRouterScript is Script {
    UniswapV2Router02 public router;
    WETH9 public weth;

    function setUp() public {}

    function run() public {
        address deployer = vm.envAddress("DEPLOYER");
        address factory = vm.envAddress("FACTORY");
        vm.startBroadcast(deployer);

        // 部署WETH（如果尚未部署）
        weth = new WETH9();
        console.log("WETH deployed at:", address(weth));

        // 部署Uniswap V2 Router
        router = new UniswapV2Router02(factory, address(weth));
        console.log("UniswapV2Router02 deployed at:", address(router));

        vm.stopBroadcast();
    }
}