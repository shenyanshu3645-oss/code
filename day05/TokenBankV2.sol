// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "./TokenBank.sol";

interface IHook {
    function tokensReceived(address _from, uint256 _value)
        external;
}

contract TokenBankV2 is TokenBank, IHook {
    IHook private hook;

    constructor(IHook _hook) {
        hook = _hook;
    }

    //扩展
    function transferWithCallback(
        address _from,
        address _to,
        uint256 _value
    ) public {
        //如果目标地址是合约地址的话，调用目标地址的 tokensReceived() 方法
        if (_to == address(this)) {
            IHook(_to).tokensReceived(_from, _value);
        } else {
            //走正常的转账逻辑
            transferFrom(_from, _to, _value);
        }
    }

    function tokensReceived(address _from, uint256 _value)
        external
    {
        deposit(_value);
    }
}
