// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "hardhat/console.sol";

interface IBank {
    function withdraw() external;
}

contract Admin {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function adminWithdraw(IBank bank) public {
        console.log("IBank:",address(bank));
        bank.withdraw();
    }

    receive() external payable { }
}
