// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import "forge-std/console.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";


contract Bank is AutomationCompatibleInterface{
    mapping(address => uint) public balances;
    address ownerAddr;
    
    constructor(){
        ownerAddr = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == ownerAddr, "not owner");
        _;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withDraw() onlyOwner external {
        payable(ownerAddr).transfer(address(this).balance);
    }

    receive() external payable {
        balances[msg.sender] += msg.value; 
    }


    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // 验证条件
        if(address(this).balance >= 5 * 10 ** 17){ // 0.5 ether
            upkeepNeeded = true;
        }
        
        performData = "";
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        if(address(this).balance >= 5 * 10 ** 17){ // 0.5 ether
            //转一半的钱到owner
            payable(ownerAddr).transfer(address(this).balance / 2);
        }
        // 如果条件不满足，什么都不做
    }
}