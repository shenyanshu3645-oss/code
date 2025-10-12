pragma solidity ^0.8.0;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract MultiWallet {
    //提案
    struct Transaction {
        uint256 transactionId;
        address to;
        uint256 value;
        bytes data;
    }
    //提案的状态
    struct TransactionStatus {
        uint256 transactionId;
        uint256 approvalscount; //提案通过的签名的数量
        uint256 rejectionscount; //提案拒绝的签名数量
        mapping(address => bool) approvalssigners; //通过的签名
        mapping(address => bool) rejectionsigners; //拒绝的签名
        bool rejected; //提案是否被拒绝
        bool executed; //是否已执行
    }

    event NewTransaction(uint256 transactionId);

    address[] private owners; //所有者
    // 记录地址是否是所有者,避免重复
    mapping(address => bool) private isOwner;
    uint256 private required; //签名数

    //提案列表
    mapping(uint256 => Transaction) private transactions;
    //提案状态
    mapping(uint256 => TransactionStatus) private transactionStatus;

    //提案号
    uint256 private transactionId = 1;
    //构造函数
    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "owners required");
        require(
            _required > 0 && _required <= _owners.length,
            "invalid required number of owners"
        );
        //签名数不能小于总数的1/2
        require(
            _required >= (_owners.length + 1) / 2,
            "required number of signatures must be greater than half of the number of owners"
        );
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
        }
        required = _required;
    }

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }

    //提交提案(owner可以提交提案)
    function submitTransaction(
        address to,
        uint256 value,
        bytes memory data
    ) public onlyOwner {
        transactions[transactionId] = Transaction(
            transactionId,
            to,
            value,
            data
        );
        transactionId++;
    }

    //签名方法(to是目标地址(背签名的事件))
    function signTransation(uint id, bool approval) public onlyOwner {
        TransactionStatus storage transactionstatus = transactionStatus[id];
        //同意提案签名
        if (approval) {
            require(!transactionstatus.executed, "transaction aready executed");
        } else {
            require(!transactionstatus.rejected, "transaction aready rejected");
        }

        if (approval) {
            require(
                !transactionstatus.approvalssigners[msg.sender],
                "you have signed"
            );
            transactionstatus.approvalssigners[msg.sender] = true;
            transactionstatus.approvalscount++;
        } else {
            require(
                !transactionstatus.rejectionsigners[msg.sender],
                "you have signed"
            );
            transactionstatus.rejectionsigners[msg.sender] = true;
            transactionstatus.rejectionscount++;
        }
    }

    //执行提案（iserc20是否是转出代币）
    function executTransaction(
        uint id,
        bool iserc20,
        address token
    ) public onlyOwner {
        require(id >= 1 && id <= transactionId, "invalid id");
        if (iserc20) {
            require(token != address(0), "invalid token");
        }
        TransactionStatus storage transactionstatus = transactionStatus[id];
        require(!transactionstatus.executed, "transaction has been executed");
        require(
            transactionstatus.approvalscount >= required,
            "you have not enough signatures"
        );
        Transaction storage transaction = transactions[id];
        bool success = false;
        if (iserc20) {
            //erc20调用合约的transfer方法
            require(
                IERC20(token).balanceOf(address(this)) >= transaction.value,
                "token balance is not enough"
            );
            bytes memory data = abi.encodeWithSignature(
                "transfer(address,uint256)",
                transaction.to,
                transaction.value
            );
            (success, ) = token.call{value: 0}(data); //erc20转账value为0
        } else {
            //普通转账
            require(getBalance() >= transaction.value, "balance is not enough");
            bytes memory data = ""; // ETH转账不需要data
            (success, ) = transaction.to.call{value: transaction.value}(data);
        }

        require(success, "executTransaction failed");
        transactionstatus.executed = true;
        transactionstatus.rejected = false;
    }

    //拒绝提案
    function rejectTransaction(uint id) public onlyOwner {
        require(id >= 1 && id <= transactionId, "invalid id");
        TransactionStatus storage transactionstatus = transactionStatus[id];
        require(!transactionstatus.executed, "transaction executed");
        require(!transactionstatus.rejected, "transaction rejected");
        require(
            transactionstatus.rejectionscount >= required,
            "you have not enough signatures"
        );

        transactionstatus.executed = false;
        transactionstatus.rejected = true;
    }

    // 获取所有者
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    //获取提案状态
    function getTransactionStatus(
        uint256 _transactionId
    )
        public
        view
        returns (
            uint256 approvalscount,
            uint256 rejectionscount,
            bool rejected,
            bool executed
        )
    {
        TransactionStatus storage transactionstatus = transactionStatus[
            _transactionId
        ];
        return (
            transactionstatus.approvalscount,
            transactionstatus.rejectionscount,
            transactionstatus.rejected,
            transactionstatus.executed
        );
    }

    //获取提案详情
    function getTransaction(
        uint256 _transactionId
    ) public view returns (address to, uint256 value, bytes memory data) {
        Transaction storage transaction = transactions[_transactionId];
        return (transaction.to, transaction.value, transaction.data);
    }

    //获取合约的余额
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    //查看erc20代币的余额
    function getERC20Balance(
        address _erc20token
    ) public view returns (uint256) {
        return IERC20(_erc20token).balanceOf(address(this));
    }

    //可以接收ETH
    receive() external payable {}
}
