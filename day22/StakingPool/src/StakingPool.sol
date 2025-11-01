// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title KK Token
 */
interface IToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

interface IAToken {
    function balanceOf(address user) external view returns (uint256);
}

/**
 * @title Staking Interface
 */
interface IStaking {
    /**
     * @dev 质押 ETH 到合约
     */
    function stake() external payable;

    /**
     * @dev 赎回质押的 ETH
     * @param amount 赎回数量
     */
    function unstake(uint256 amount) external;

    /**
     * @dev 领取 KK Token 收益
     */
    function claim() external;

    /**
     * @dev 获取质押的 ETH 数量
     * @param account 质押账户
     * @return 质押的 ETH 数量
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev 获取待领取的 KK Token 收益
     * @param account 质押账户
     * @return 待领取的 KK Token 收益
     */
    function earned(address account) external view returns (uint256);
}

// Aave 接口
interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external payable;
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

contract StakingPool is IStaking {
    struct UserInfo {
        uint256 amount; //质押eth数量
        uint256 rewardDebt; //进入时刻已奖励部分
    }

    mapping(address => UserInfo) public userInfo;

    IToken public kkToken;
    uint256 public constant KK_PERBlock = 10 * 10 ** 18; //每个区块奖励10个kktoken
    uint256 public constant ACC_KK_PRECISION = 1e12; //平衡精度和防止溢出
    uint256 public lastUpdateBlock = 0;
    uint256 public totalSupply = 0;
    uint256 public totalStaked = 0;
    uint256 public accKkPerShare = 0; //累计每份额的KkToken

    IAavePool public constant AAVE_POOL =
        IAavePool(0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951);
    IAToken public constant aETH =
        IAToken(0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830);
    address public constant WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;

    // uint256 public totalAETH; // 合约持有的 aETH 总量

    address public owner;

    constructor(address _kkTokenAddress) {
        kkToken = IToken(_kkTokenAddress);
        lastUpdateBlock = block.number;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev 质押 ETH 到合约
     */
    function stake() public payable override {
        require(msg.value > 0, "Must stake more than 0");
        UserInfo storage user = userInfo[msg.sender];
        //判断用户是否已质押，如果已质押，则计算待领取的KkToken收益
        if (user.amount > 0) {
            updatePool(); //先更新池子，计算出accKkPerShare
            uint256 userAETHShare = getUserAETHShare(msg.sender); //结算基于当前状态
            uint256 pending = (userAETHShare *
                accKkPerShare -
                user.rewardDebt) / ACC_KK_PRECISION;
            if (pending > 0) {
                kkToken.mint(msg.sender, pending);
                totalSupply += pending;
            }
        }

        // 存入 Aave,利息会发送到本合约
        AAVE_POOL.supply{value: msg.value}(WETH, msg.value, address(this), 0);

        // AAVE_POOL.supply{value: msg.value}(address(0), msg.value, address(this), 0);

        
        //更新份额和奖励债务
        user.amount += msg.value;
        totalStaked += msg.value;

        //更新rewardDebt（基于新的总状态）
        uint256 newUserAETHShare = getUserAETHShare(msg.sender);

        user.rewardDebt = newUserAETHShare * accKkPerShare;
        // user.rewardDebt = user.amount * accKkPerShare;
    }

    /**
     * @dev 赎回质押的 ETH
     * @param amount 赎回数量
     */
    function unstake(uint256 amount) public override {
        require(amount > 0, "Must unstake more than 0");
        UserInfo storage user = userInfo[msg.sender];
        require(amount <= user.amount, "Not enough balance");

        updatePool(); //先更新池子，计算出accKkPerShare

        uint256 userAETHShare = getUserAETHShare(msg.sender);

        //计算全部待领取的KkToken收益
        uint256 pending = (userAETHShare * accKkPerShare - user.rewardDebt) /
            ACC_KK_PRECISION;
        if (pending > 0) {
            kkToken.mint(msg.sender, pending);
            totalSupply += pending;
        }

        // 从 Aave 提取
        uint256 ethReceived = AAVE_POOL.withdraw(WETH, amount, address(this));
        // uint256 ethReceived = AAVE_POOL.withdraw(address(0), amount, address(this));

        user.amount -= ethReceived; //使用实际取出的数量
        totalStaked -= ethReceived;

        uint256 newUserAETHShare = getUserAETHShare(msg.sender);

        user.rewardDebt = newUserAETHShare * accKkPerShare;

        // user.rewardDebt = user.amount * accKkPerShare;

        payable(msg.sender).transfer(ethReceived);
    }

    /**
     * @dev 领取 KK Token 收益
     */
    function claim() public override {
        updatePool(); //先更新池子，计算出accKkPerShare
        UserInfo storage user = userInfo[msg.sender];

        uint256 userAETHShare = getUserAETHShare(msg.sender);
        uint256 pending = (userAETHShare * accKkPerShare - user.rewardDebt) /
            ACC_KK_PRECISION;
        if (pending > 0) {
            kkToken.mint(msg.sender, pending);
            totalSupply += pending;
        }
        //更新奖励债务
        user.rewardDebt = userAETHShare * accKkPerShare;
    }

    /**
     * @dev 获取质押的 ETH 数量
     * @param account 质押账户
     * @return 质押的 ETH 数量
     */
    function balanceOf(address account) public view override returns (uint256) {
        return userInfo[account].amount;
    }

    /**
     * @dev 获取待领取的 KK Token 收益
     * @param account 质押账户
     * @return 待领取的 KK Token 收益
     */
    function earned(address account) public view override returns (uint256) {
        require(account != address(0), "Invalid account");
        UserInfo memory user = userInfo[account];
        uint256 currentAccKkPerShare = accKkPerShare;

        // 模拟更新池子
        if (block.number > lastUpdateBlock && totalStaked > 0) {
            uint256 currtotalAETH = aETH.balanceOf(address(this));
            uint256 blocksSinceLastUpdate = block.number - lastUpdateBlock;
            uint256 kkReward = blocksSinceLastUpdate * KK_PERBlock;
            currentAccKkPerShare +=
                (kkReward * ACC_KK_PRECISION) /
                currtotalAETH;
        }
        //基于用户的实际 aWETH 份额计算奖励
        uint256 userAETHShare = getUserAETHShare(account);

        return
            (userAETHShare * currentAccKkPerShare - user.rewardDebt) /
            ACC_KK_PRECISION;
    }

    function getUserAETHShare(address user) public view returns (uint256) {
        UserInfo memory userData = userInfo[user];
        uint256 currtotalAETH = aETH.balanceOf(address(this));

        if (totalStaked == 0 || currtotalAETH == 0) return 0;

        // 用户份额 = (用户ETH数量 / 总ETH数量) × 总aWETH余额
        return (userData.amount * currtotalAETH) / totalStaked;
    }

    // 合约接收ETH
    receive() external payable {
        // stake();不走质押流程，gas限制问题，容易失败，如果用户直接转入eth，没有调用stake，则无法获得kktoken
    }

    function updatePool() public {
        if (block.number <= lastUpdateBlock) {
            return;
        }

        //这里要根据本合约中实际的aETH数量来计算
        uint256 currentTotalAETH = aETH.balanceOf(address(this));

        if (currentTotalAETH == 0) {
            lastUpdateBlock = block.number;
            return;
        }

        // 计算本阶段应产生的kktoken数量
        uint256 blocksSinceLastUpdate = block.number - lastUpdateBlock;
        uint256 kkReward = blocksSinceLastUpdate * KK_PERBlock;

        // 更新累计每份额奖励
        accKkPerShare += (kkReward * ACC_KK_PRECISION) / currentTotalAETH;
        lastUpdateBlock = block.number;
    }

    function withdraw() public onlyOwner(){
        payable(msg.sender).transfer(address(this).balance);
    }
}
