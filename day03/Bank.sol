// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "hardhat/console.sol";

interface IBank {
    function withdraw() external;
}

contract Bank is IBank{
    mapping(address => uint256) public balances;
    address public ownerAddr;

    struct TopThreeUser {
        address addr;
        uint256 amount;
    }

    TopThreeUser[4] topusers;

    constructor() {
        ownerAddr = msg.sender;
        for (uint256 i = 0; i < 4; i++) {
            topusers[i] = TopThreeUser(address(0), 0);
        }
    }

    modifier onlyOwner() {
        console.log("ownerAddr:",ownerAddr);
        require(msg.sender == ownerAddr, unicode"仅管理员可以提取资金");
        _;
    }
    //实现接口中的方法
    function withdraw() external onlyOwner virtual {
        console.log("bank ownerAddr:", ownerAddr);
        console.log("bank balance:",address(this).balance);

        payable(ownerAddr).transfer(address(this).balance);
    }

    function gettop3() public view returns (TopThreeUser[] memory) {
        TopThreeUser[] memory top3users = new TopThreeUser[](3);
        for (uint256 i = 0; i < 3; i++) {
            top3users[i] = TopThreeUser(topusers[i].addr, topusers[i].amount);
        }

        return top3users;
    }

    receive() external payable virtual {
        balances[msg.sender] += msg.value;

        topusers[3] = TopThreeUser(msg.sender, msg.value);

        TopThreeUser memory temp;
        bool swapped;
        uint256 length = 4;

        for (uint256 i = 0; i < length - 1; i++) {
            swapped = false;
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (topusers[j].amount < topusers[j + 1].amount) {
                    // 交换元素
                    temp = topusers[j];
                    topusers[j] = topusers[j + 1];
                    topusers[j + 1] = temp;
                    swapped = true;
                }
            }
            // 如果本轮没有交换，说明已排序完成
            if (!swapped) break;
        }
    }
}
