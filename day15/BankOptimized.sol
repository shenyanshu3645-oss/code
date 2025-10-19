// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/console.sol";

contract Bank {
    mapping(address => uint) public balances;
    mapping(address => address) public nextUser;
    address ownerAddr;
    uint public total;
    address constant GUARD = address(1);
    address public lastUser;

   
    constructor() {
        ownerAddr = msg.sender;
        nextUser[GUARD] = GUARD;//首节点
        lastUser=GUARD;
    }

    modifier onlyOwner() {
        require(msg.sender == ownerAddr, unicode"仅管理员可以提取资金");
        _;
    }

    function withDraw() external onlyOwner {
        payable(ownerAddr).transfer(address(this).balance);
    }

    function gettop10() public view returns (address[] memory) {
        address[] memory userLists = new address[](10);
        uint[] memory balanceList = new uint[](10);
        
        // 初始化数组
        for (uint i = 0; i < 10; i++) {
            balanceList[i] = 0;
        }
        
        // 遍历所有用户，找到存款前10的用户
        address currentUser = lastUser;
        while (currentUser != GUARD) {
            uint currentBalance = balances[currentUser];
            
            // 只有当当前用户余额大于现有最小余额时才考虑加入排行榜
            if (currentBalance > balanceList[9]) {
                // 检查当前用户是否能进入前10
                for (uint i = 0; i < 10; i++) {
                    if (currentBalance > balanceList[i]) {
                        // 向后移动元素
                        for (uint j = 9; j > i; j--) {
                            userLists[j] = userLists[j-1];
                            balanceList[j] = balanceList[j-1];
                        }
                        
                        // 插入当前用户
                        userLists[i] = currentUser;
                        balanceList[i] = currentBalance;
                        break;
                    }
                }
            }
            
            // 移动到下一个用户
            currentUser = nextUser[currentUser];
        }
        
        return userLists;
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        if (nextUser[msg.sender] == address(0)) {//新用户,指向上一个用户
            nextUser[msg.sender] = lastUser;
            lastUser = msg.sender;
            total++;
        }
    }
}