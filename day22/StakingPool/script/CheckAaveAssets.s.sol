pragma solidity ^0.8.0;

import "forge-std/Script.sol";

contract CheckAaveAssetsScript is Script {
    address constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    
    // Sepolia 上可能可用的资产
    address constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
    address constant DAI = 0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357;
    address constant LINK = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    
    function run() external {
        console.log("=== CHECKING AAVE ASSETS ON SEPOLIA ===");
        
        address[] memory assets = new address[](3);
       
        assets[0] = USDC;
        assets[1] = DAI; 
        assets[2] = LINK;
        
        for (uint i = 0; i < assets.length; i++) {
            console.log("Checking asset:", assets[i]);
            
            (bool success, bytes memory data) = AAVE_POOL.staticcall(
                abi.encodeWithSignature("getReserveData(address)", assets[i])
            );
            
            if (success) {
                // 解析 aToken 地址
                address aToken;
                assembly {
                    aToken := mload(add(data, 32))
                }
                
                console.log("  aToken address:", aToken);
                console.log("  Is active:", aToken != address(0));
                
                if (aToken != address(0)) {
                    console.log("This asset is ACTIVE in Aave");
                } else {
                    console.log("This asset is NOT ACTIVE in Aave");
                }
            } else {
                console.log("Cannot get reserve data");
            }
        }
    }
}