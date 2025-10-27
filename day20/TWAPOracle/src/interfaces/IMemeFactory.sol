// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.5.0;

interface IMemeFactory {
    function deployMeme(
        string memory _name,
        string memory _symbol,
        uint _totalSupply,
        uint _perMint,
        uint _price
    ) external returns (address token);
    
    function mintMeme(address tokenAddr) external payable returns(address);

    function buyMeme(address tokenAddr) external payable;
}