// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "./BaseERC20.sol";

contract TokenBank is BaseERC20 {
    event Deposit(uint256 amount);
    function getbalance() external returns (uint256) {
        return balanceOf(msg.sender);
    }

    //充值
    function deposit(uint256 amount) external {
        bool depret = approve(owner, amount);
        //授权失败
        require(depret, "approve fail");
        //扣款
        bool tranret = transferFrom(owner, msg.sender, amount);
        //交易失败
        require(tranret, "deposit fail");
       
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "out of balance");
        bool tranret = transfer(msg.sender, amount);
        require(tranret,"withdraw fail");
    }
}
