// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "hardhat/console.sol";
interface INftMarket {
    function tokensReceived(
        address _operator,
        uint256 _value,
        uint _tokenid
    ) external returns (bool);
}

contract BaseERC20{
    string public name;
    string public symbol;
    uint8 public decimals;

    uint256 public totalSupply;

    mapping(address => uint256) balances;

    mapping(address => mapping(address => uint256)) allowances;

    INftMarket public nftMarket;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    constructor() public {
        // write your code here
        // set name,symbol,decimals,totalSupply
        name = "MyBaseERC20";
        symbol = "MBERC20";
        decimals = 18;
        totalSupply = 100000000 * 10 ** decimals;
        balances[msg.sender] = totalSupply;

    }

    function balanceOf(address _owner) public view returns (uint256 balance) {
        // write your code here
        return balances[_owner];
    }

    //合约调用的
    function transfer(
        address _to,
        uint256 _value
    ) public returns (bool success) {
        // write your code here
        require(
            balances[msg.sender] >= _value,
            "ERC20: transfer amount exceeds balance"
        );

        balances[msg.sender] -= _value;
        balances[_to] += _value;

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool success) {
        // write your code here
        require(
            balances[_from] >= _value,
            "ERC20: transfer amount exceeds balance"
        );
        require(
            allowances[_from][msg.sender] >= _value,
            "ERC20: transfer amount exceeds allowance"
        );
        //消耗授权
        allowances[_from][msg.sender] -= _value;
        //修改代币数量
        balances[_from] -= _value;
        balances[_to] += _value;

        emit Transfer(_from, _to, _value);
        return true;
    }

    function approve(
        address _spender,
        uint256 _value
    ) public returns (bool success) {
        // write your code here
        allowances[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(
        address _owner,
        address _spender
    ) public view returns (uint256 remaining) {
        // write your code here
        uint256 remainingdata = allowances[_owner][_spender];
        return remainingdata;
    }
    //带回调的转账,带一个额外的参数
    function transfrewithcallback(
        address _to,
        uint256 _value,
        uint _tokenid
    ) public returns (bool success) {
        //判断是否是合约
        if (_to.code.length == 0) {
            console.log("commone transfer");
            //普通转账
            return transfer(_to, _value);
        }
        //转账给合约
        transfer(_to, _value);
        //回调
        console.log("INftMarket tokensReceived");
        return INftMarket(_to).tokensReceived(msg.sender, _value, _tokenid);
    }
}
