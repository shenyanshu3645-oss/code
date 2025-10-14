pragma solidity 0.8.30;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract TokenBank {
    
    IERC20Permit token; //使用permittoken

    //记录用户的金额
    mapping(address=>uint) balance;

    constructor(IERC20Permit _token){
        token = _token;
    }

    event Deposit(address from , uint256 amount);
    event PermitDeposit(address from, uint256 amount);
    event Allowance(uint256 amount);
    event Withdraw(address to, uint256 amount);

    //充值
    function deposit(uint256 amount) public {
       
        //增加授权额度的判断
        emit Allowance(IERC20(address(token)).allowance(msg.sender, address(this)));
        require(IERC20(address(token)).allowance(msg.sender, address(this)) >= amount, "ERC20: transfer amount exceeds allowance");
        //扣款给合约
        bool tranret = IERC20(address(token)).transferFrom(msg.sender, address(this), amount);
        //交易失败
        require(tranret, "ERC20: transfer amount exceeds balance");
        //记录充值金额
        balance[msg.sender] += amount;

        emit Deposit(msg.sender, amount);
    }


    // 使用离线签名进行存款
    function permitDeposit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // 检查deadline
        require(block.timestamp <= deadline, "TokenBank: expired deadline");

        // 使用 permit 设置授权
        token.permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );

        // 验证授权是否设置成功
        require(
            IERC20(address(token)).allowance(msg.sender, address(this)) >= amount,
            "TokenBank: permit failed"
        );

        // 执行转账
        bool transferSuccess = IERC20(address(token)).transferFrom(msg.sender, address(this), amount);
        require(transferSuccess, "TokenBank: transfer failed");

        // 更新余额
        balance[msg.sender] += amount;

        emit PermitDeposit(msg.sender, amount);

    }

    function withdraw(uint256 amount) external {
        require(balance[msg.sender] >= amount, "out of balance");
        bool tranret = IERC20(address(token)).transfer(msg.sender, amount);
        require(tranret, "withdraw fail");
        //更新余额
        balance[msg.sender] -= amount;
        emit Withdraw(msg.sender, amount);
    }

    //查询余额
    function balanceOf(address user) external view returns (uint256) {
        return balance[user];
    }

    // 调试函数：检查用户的授权状态和余额
    function checkUserStatus(address user, uint256 amount) external view returns (
        uint256 userBalance,
        uint256 allowanceAmount,
        bool hasEnoughBalance,
        bool hasEnoughAllowance
    ) {
        userBalance = IERC20(address(token)).balanceOf(user);
        allowanceAmount = IERC20(address(token)).allowance(user, address(this));
        hasEnoughBalance = userBalance >= amount;
        hasEnoughAllowance = allowanceAmount >= amount;
    }

    // 调试函数：获取代币合约的DOMAIN_SEPARATOR
    function getTokenDomainSeparator() external view returns (bytes32) {
        return token.DOMAIN_SEPARATOR();
    }
}
