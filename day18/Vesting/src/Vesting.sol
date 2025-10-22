pragma solidity ^0.8.0;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vesting is Ownable {
    event EtherReleased(uint256 amount);
    event ERC20Released(address indexed token, uint256 amount);

    uint256 private _released;
    mapping(address token => uint256) private _erc20Released;
    uint64 private immutable _start; //开始释放的时间
    uint64 private immutable _duration; //释放的周期
    uint64 private immutable _cliff; //断崖时间

    constructor(
        address beneficiary,
        uint64 startTimestamp,
        uint64 cliffDuration,
        uint64 vestingDuration
    ) payable Ownable(beneficiary) {
        _start = startTimestamp + cliffDuration;
        _duration = vestingDuration;
        _cliff = cliffDuration;
    }

    function start() public view returns (uint64) {
        return _start;
    }

    function duration() public view returns (uint64) {
        return _duration;
    }
    function cliff() public view returns (uint64) {
        return _cliff;
    }

    function end() public view returns (uint64) {
        return _start + _duration;
    }

    function released() public view returns (uint256) {
        return _released;
    }

    function released(address token) public view returns (uint256) {
        return _erc20Released[token];
    }

    function releasable() public view returns (uint256) {
        uint vestingamout = _vestingSchedule(
            address(this).balance + released(),
            uint64(block.timestamp)
        );
        return vestingamout - released();
    }

    function releasable(address token) public view returns (uint256) {
        uint256 totaltoken = IERC20(token).balanceOf(address(this));
        uint256 releasedtoken = released(token);
        uint256 vestingamout = _vestingSchedule(
            totaltoken + releasedtoken,
            uint64(block.timestamp)
        );
        return vestingamout - released(token);
    }
    function release() public {
        uint256 releasableAmount = releasable();
        _released += releasableAmount;
        emit EtherReleased(releasableAmount);
        Address.sendValue(payable(owner()), releasableAmount);
    }

    function release(address token) public {
        uint256 releasableAmount = releasable(token);
        _erc20Released[token] += releasableAmount;
        emit ERC20Released(token, releasableAmount);
        IERC20(token).transfer(owner(), releasableAmount);
    }

    function _vestingSchedule(
        uint256 totalAllocation,
        uint64 timestamp
    ) internal view returns (uint256) {
        if (timestamp < start()) {
            return 0;
        } else if (timestamp > end()) {
            return totalAllocation;
        } else {
            return (totalAllocation * (timestamp - start())) / duration();
        }
    }

    receive() external payable {}
}
