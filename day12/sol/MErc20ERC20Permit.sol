// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MErc20ERC20Permit is ERC20Permit {

    //ERC20Permit本身是继承erc20的

    constructor() ERC20("PermitERC20","PERC20") ERC20Permit("PermitERC20") {

        _mint(msg.sender, 100000000 * 10 ** 18); 
    }
}