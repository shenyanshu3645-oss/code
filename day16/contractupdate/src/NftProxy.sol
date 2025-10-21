// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

/**
 * @title NFTProxy
 * @dev 透明代理合约
 */
contract NFTProxy is TransparentUpgradeableProxy {
    /**
     * @dev 构造函数
     * @param _logic 逻辑合约地址
     * @param admin_ 管理员地址  
     * @param _data 初始化数据
     */
    constructor(
        address _logic,
        address admin_,
        bytes memory _data
    ) TransparentUpgradeableProxy(_logic, admin_, _data) {}

    /**
     * @dev 获取实现合约地址
     */
    function getImplementation() public view returns (address) {
        return ERC1967Utils.getImplementation();
    }

    /**
     * @dev 获取管理员地址
     */
    function getAdmin() public view returns (address) {
        return ERC1967Utils.getAdmin();
    }

    /**
     * @dev 接收ETH的函数
     */
    receive() external payable{}
}