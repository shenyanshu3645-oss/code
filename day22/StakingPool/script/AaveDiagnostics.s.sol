pragma solidity ^0.8.0;

import "forge-std/Script.sol";

contract AaveDiagnosticsScript is Script {
    address constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address constant WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    
    function run() external {
        console.log("=== AAVE DIAGNOSTICS ON CHAIN ===");
        
        // 1. 检查 Aave Pool 是否可调用
        (bool success1, bytes memory data1) = AAVE_POOL.staticcall(
            abi.encodeWithSignature("ADDRESSES_PROVIDER()")
        );
        console.log("Aave Pool responsive:", success1);
        if (success1) {
            address provider = abi.decode(data1, (address));
            console.log("Addresses Provider:", provider);
        }
        
        // 2. 检查 WETH 储备状态
        (bool success2, bytes memory data2) = AAVE_POOL.staticcall(
            abi.encodeWithSignature("getReserveData(address)", WETH)
        );
        console.log("Can get WETH reserve data:", success2);
        
        if (success2 && data2.length >= 32 * 10) {
            // 解析 ReserveData 结构
            bytes32 reserveData = abi.decode(data2, (bytes32));
            console.log("WETH reserve data (first 32 bytes):");
            console.logBytes32(reserveData);
        }
        
        // 3. 检查配置器
        (bool success3, ) = AAVE_POOL.staticcall(
            abi.encodeWithSignature("getConfiguration(address)", WETH)
        );
        console.log("Can get WETH configuration:", success3);
        
        // 4. 直接测试 supply
        console.log("=== TESTING SUPPLY DIRECTLY ===");
        
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(privateKey);
        
        vm.startBroadcast(privateKey);
        
        // 先包装一些 WETH
        IWETH(WETH).deposit{value: 0.001 ether}();
        console.log("WETH wrapped");
        
        // 批准
        IWETH(WETH).approve(AAVE_POOL, 0.001 ether);
        console.log("WETH approved");
        
        // 尝试 supply
        try IAavePool(AAVE_POOL).supply(WETH, 0.001 ether, user, 0) {
            console.log("Aave supply SUCCESS!");
            
            // 检查 aToken 余额
            // 需要先找到正确的 aWETH 地址
            (bool reserveSuccess, bytes memory reserveData) = AAVE_POOL.staticcall(
                abi.encodeWithSignature("getReserveData(address)", WETH)
            );
            if (reserveSuccess) {
                // aToken 地址在 ReserveData 的特定位置
                address aToken;
                assembly {
                    aToken := mload(add(reserveData, 32))
                }
                uint256 aTokenBalance = IERC20(aToken).balanceOf(user);
                console.log("aToken balance:", aTokenBalance);
            }
        } catch Error(string memory reason) {
            console.log("Aave supply failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Aave supply failed with low level data, length:", lowLevelData.length);
            if (lowLevelData.length > 0) {
                console.logBytes(lowLevelData);
            }
        }
        
        vm.stopBroadcast();
    }
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function getReserveData(address asset) external view returns (ReserveData memory);
}

struct ReserveData {
    ReserveConfigurationMap configuration;
    uint128 liquidityIndex;
    uint128 currentLiquidityRate;
    uint128 variableBorrowIndex;
    uint128 currentVariableBorrowRate;
    uint128 currentStableBorrowRate;
    uint40 lastUpdateTimestamp;
    uint16 id;
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    address interestRateStrategyAddress;
    uint128 accruedToTreasury;
    uint128 unbacked;
    uint128 isolationModeTotalDebt;
}

struct ReserveConfigurationMap {
    uint256 data;
}

interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}