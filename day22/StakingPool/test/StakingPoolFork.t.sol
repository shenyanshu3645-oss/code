// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

contract StakingPoolForkTest is Test {
    // 你已部署的合约地址
    address constant DEPLOYED_STAKING_POOL =
        0x3F40A75286fd539D193f055ca5d9e92aA0CD4d4d;

    // 测试网地址
    address constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address constant AETH = 0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830;

    address constant WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;

    IStakingPool stakingPool;

    function setUp() public {
        // 创建 Sepolia 测试网分叉
        string memory sepoliaUrl = vm.envString("SEPOLIA_RPC_URL");
        vm.createSelectFork(sepoliaUrl);

        // 连接到已部署的合约
        stakingPool = IStakingPool(DEPLOYED_STAKING_POOL);

        console.log("=== FORK TEST SETUP ===");
        console.log("Network:", block.chainid);
        console.log("StakingPool:", address(stakingPool));
        console.log("AAVE_POOL:", AAVE_POOL);
    }

    function testAaveWithWETH() public {
    console.log("=== TESTING AAVE WITH WETH ===");
    
    vm.deal(address(this), 1 ether);
    
    // 方法 A: 先包装 ETH 成 WETH，再存入 Aave
    console.log("Method A: Wrap ETH -> WETH -> Aave");
    
    // 1. 先包装 ETH 为 WETH
    (bool wrapSuccess, ) = WETH.call{value: 0.01 ether}("");
    console.log("WETH wrap success:", wrapSuccess);
    
    if (wrapSuccess) {
        // 2. 批准 WETH 给 Aave
        (bool approveSuccess, ) = WETH.call(
            abi.encodeWithSignature("approve(address,uint256)", AAVE_POOL, 0.01 ether)
        );
        console.log("WETH approve success:", approveSuccess);
        
        if (approveSuccess) {
            // 3. 使用 WETH 存入 Aave
            (bool supplySuccess, ) = address(AAVE_POOL).call(
                abi.encodeWithSignature(
                    "supply(address,uint256,address,uint16)",
                    WETH,           // 使用 WETH 地址而不是 address(0)
                    0.01 ether,     // 数量
                    address(this),  // 接收 aToken 的地址
                    0               // 推荐码
                )
            );
            console.log("Aave supply with WETH success:", supplySuccess);
            
            if (supplySuccess) {
                uint256 aETHBalance = IERC20(AETH).balanceOf(address(this));
                console.log("Received aETH:", aETHBalance);
            }
        }
    }
    
    // 方法 B: 直接测试 Aave 是否接受 WETH
    console.log("Method B: Direct Aave supply with WETH");
    
    // 给测试地址一些 WETH
    deal(WETH, address(this), 0.01 ether);
    uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
    console.log("WETH balance:", wethBalance);
    
    if (wethBalance > 0) {
        // 批准
        IERC20(WETH).approve(address(AAVE_POOL), 0.01 ether);
        
        // 存入
        (bool directSuccess, ) = address(AAVE_POOL).call(
            abi.encodeWithSignature(
                "supply(address,uint256,address,uint16)",
                WETH,
                0.01 ether,
                address(this),
                0
            )
        );
        console.log("Direct WETH supply success:", directSuccess);
    }
}

    function testStakeWithDebug() public {
        console.log("=== TESTING STAKE WITH DEBUG ===");

        vm.deal(address(this), 10 ether);
        console.log("Test address balance:", address(this).balance);

        IStakingPool stakingPool = IStakingPool(DEPLOYED_STAKING_POOL);

        // 记录初始状态
        uint256 aETHBalanceBefore = IERC20(AETH).balanceOf(DEPLOYED_STAKING_POOL);
        uint256 userStakeBefore = stakingPool.balanceOf(address(this));
        console.log("aETH balance before:", aETHBalanceBefore);
        console.log("User stake before:", userStakeBefore);

        console.log("Calling stake()...");

        // 尝试直接调用 Aave 来调试
        console.log("=== DIRECT AAVE TEST ===");

        // 方法1: 直接调用 Aave
        (bool success, bytes memory data) = address(AAVE_POOL).call{
            value: 0.001 ether
        }(
            abi.encodeWithSignature(
                "supply(address,uint256,address,uint16)",
                address(0),
                0.001 ether,
                DEPLOYED_STAKING_POOL,
                0
            )
        );

        console.log("Direct Aave call success:", success);
        if (!success) {
            console.log("Revert reason length:", data.length);
            if (data.length > 0) {
                console.logBytes(data);
                // 尝试解析错误信息
                if (data.length > 4) {
                    bytes4 errorSig = bytes4(data);
                    console.log("Error signature:");
                    console.logBytes4(errorSig);
                }
            }
        }

        // 如果直接调用也不行，尝试其他参数
        console.log("=== ALTERNATIVE PARAMETERS ===");

        // 尝试使用 WETH 地址而不是 address(0)
        (bool success2, ) = address(AAVE_POOL).call{value: 0.001 ether}(
            abi.encodeWithSignature(
                "supply(address,uint256,address,uint16)",
                WETH,
                0.001 ether,
                DEPLOYED_STAKING_POOL,
                0
            )
        );
        console.log("Aave with WETH success:", success2);
    }

    function checkAavePoolConfig() public view {
        console.log("=== AAVE POOL CONFIGURATION ===");

        // 检查池子是否暂停
        (bool success1, bytes memory data1) = address(AAVE_POOL).staticcall(
            abi.encodeWithSignature("paused()")
        );
        if (success1) {
            bool paused = abi.decode(data1, (bool));
            console.log("Aave Pool paused:", paused);
        }

        // 检查 ETH 储备状态
        (bool success2, bytes memory data2) = address(AAVE_POOL).staticcall(
            abi.encodeWithSignature("getReserveData(address)", address(0))
        );
        console.log("Can get ETH reserve data:", success2);

        // 检查配置器地址
        (bool success3, bytes memory data3) = address(AAVE_POOL).staticcall(
            abi.encodeWithSignature("ADDRESSES_PROVIDER()")
        );
        if (success3) {
            address provider = abi.decode(data3, (address));
            console.log("Addresses provider:", provider);
        }
    }

    function testAaveDiagnostics() public {
        console.log("=== AAVE DIAGNOSTICS ===");

        checkAavePoolConfig();

        // 测试不同金额
        vm.deal(address(this), 1 ether);

        uint256[] memory testAmounts = new uint256[](4);
        testAmounts[0] = 0.0001 ether;
        testAmounts[1] = 0.001 ether;
        testAmounts[2] = 0.01 ether;
        testAmounts[3] = 0.1 ether;

        for (uint i = 0; i < testAmounts.length; i++) {
            console.log("Testing amount:", testAmounts[i]);

            (bool success, ) = address(AAVE_POOL).call{value: testAmounts[i]}(
                abi.encodeWithSignature(
                    "supply(address,uint256,address,uint16)",
                    address(0),
                    testAmounts[i],
                    address(this),
                    0
                )
            );

            console.log("  Success:", success);

            if (success) {
                uint256 aETHBalance = IERC20(AETH).balanceOf(address(this));
                console.log("  Received aETH:", aETHBalance);
                break;
            }
        }
    }

    function testStakeFailureDebug() public {
        console.log("=== TESTING FAILURE CASES ===");

        vm.deal(address(this), 1 ether);

        // 测试各种可能失败的情况
        console.log("Testing with 0 value...");
        vm.expectRevert("Must stake more than 0");
        stakingPool.stake{value: 0}();

        console.log("All failure tests passed");
    }

    function testDetailedStakeProcess() public {
        console.log("=== DETAILED STAKE PROCESS ===");

        vm.deal(address(this), 1 ether);

        // 逐步调试
        console.log("1. Preparing stake...");
        uint256 initialETH = address(stakingPool).balance;
        console.log("Contract ETH before:", initialETH);

        console.log("2. Executing stake transaction...");
        // 这里会显示完整的内部调用
        stakingPool.stake{value: 0.001 ether}();

        console.log("3. Checking results...");
        uint256 finalETH = address(stakingPool).balance;
        uint256 aETHBalance = IERC20(AETH).balanceOf(address(stakingPool));

        console.log("Contract ETH after:", finalETH);
        console.log("Contract aETH after:", aETHBalance);
        console.log("User stake:", stakingPool.balanceOf(address(this)));
    }
}

interface IStakingPool {
    function stake() external payable;
    function unstake(uint256 amount) external;
    function claim() external;
    function balanceOf(address account) external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function totalStaked() external view returns (uint256);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function symbol() external view returns (string memory);
    function approve(address spender, uint256 amount) external returns (bool);
}
