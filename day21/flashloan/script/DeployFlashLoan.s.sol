// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/FlashLoan.sol";

contract DeployFlashLoanScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 部署闪电贷合约
        FlashLoan flashLoan = new FlashLoan();
        console.log("FlashLoan deployed at:", address(flashLoan));

        vm.stopBroadcast();
    }
}