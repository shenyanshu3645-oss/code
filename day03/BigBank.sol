// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "./Bank.sol";
import "hardhat/console.sol";

contract BigBank is Bank {
    // address public override ownerAddr;

    // constructor() {
    //     ownerAddr = msg.sender;
    // }

    //转移管理员
    function changeowner(address newaddr) external {
        ownerAddr = newaddr;
    }

    //充值限制
    modifier depositlimit() {
        console.log("bigbank msg.value:", msg.value);
        require(msg.value > 0.001 ether, "amount too low");
        _;
    }

    //充值
    function deposit() public payable depositlimit {}

    //重写withdraw
    function withdraw() external override onlyOwner {
        console.log("bigbank ownerAddr:", ownerAddr);
        console.log("bigbank balance:", address(this).balance);

        payable(ownerAddr).transfer(address(this).balance);
    }

    receive() external payable override {}
}
