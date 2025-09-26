// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract Bank{
    mapping(address=>uint) public balances;
    address ownerAddr;

    struct TopThreeUser{
        address addr;
        uint amount;
    }

    TopThreeUser[4] topusers;


    constructor() {
        ownerAddr = msg.sender;
        for (uint i=0; i<4; i++)
        {
            topusers[i]= TopThreeUser(address(0),0);
        }
    }


    modifier onlyOwner{
        require(msg.sender==ownerAddr,unicode"仅管理员可以提取资金");
        _;
    }

    function withDraw() onlyOwner external {
        payable(ownerAddr).transfer(address(this).balance);
    }

    function gettop3()public view returns(TopThreeUser[] memory){
        TopThreeUser[] memory top3users = new TopThreeUser[](3);
        for (uint i=0; i<3; i++)
        {
            top3users[i]=TopThreeUser(topusers[i].addr,topusers[i].amount);
        }

        return top3users;

    }

    receive() external payable {
        balances[msg.sender] += msg.value;

        topusers[3] = TopThreeUser(msg.sender,msg.value);

        TopThreeUser memory temp;
        bool swapped;
        uint length = 4;

        for (uint i = 0; i < length - 1; i++) {
            swapped = false;
            for (uint j = 0; j < length - i - 1; j++) {
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