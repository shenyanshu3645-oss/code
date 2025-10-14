import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { createPublicClient, createWalletClient, custom, formatUnits, http } from 'viem';
import { sepolia } from 'viem/chains';
import { loadABIFromSrc } from './utils/loadABI';



// 在文件顶部添加
declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: true
            request: (args: { method: string; params?: any[] }) => Promise<any>
            on: (event: string, handler: (data: any) => void) => void
            removeListener: (event: string, handler: (data: any) => void) => void
        }
    }
}

interface TokenBankProps {
    // 这里后续可以添加Web3相关的props
}

const App: React.FC<TokenBankProps> = () => {


    // 状态管理
    const [tokenBalance, setTokenBalance] = useState<string>('0');
    const [tokenbankBalance, setTokenbankBalance] = useState<string>('0');
    const [depositedAmount, setDepositedAmount] = useState<string>('0');
    const [depositInput, setDepositInput] = useState<string>('');
    const [withdrawInput, setWithdrawInput] = useState<string>('');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [userAddress, setUserAddress] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    // 添加permitDeposit相关的状态
    const [permitAmount, setPermitAmount] = useState<string>('');
    const [permitDeadline, setPermitDeadline] = useState<string>('');

    // TODO: 更换为实际部署的合约地址
    const TOKEN_BANK_ADDRESS = "0x08309425eFF852eACE137318F1A4FD01FbA7823F" as `0x${string}`; // TokenBank合约地址
    const TOKEN_ADDRESS = "0xe7F07a03404AF7b5d205Ec15b09474c0AA664Be5" as `0x${string}`; // ERC20代币合约地址 (正确的MyToken地址)


    // 使用useState来管理ABI加载状态
    const [tokenBankABI, setTokenBankABI] = useState<any>(null);
    const [tokenABI, setTokenABI] = useState<any>(null);
    const [tokenBankPermitABI, setTokenBankPermitABI] = useState<any>(null);
    const [abiLoading, setAbiLoading] = useState<boolean>(false);
    const [abiError, setAbiError] = useState<string | null>(null);
    const [abiLoaded, setAbiLoaded] = useState<boolean>(false);

    // 使用 useRef 来防止严格模式下的重复执行
    const abiLoadAttempted = useRef<boolean>(false);

    // 在useEffect中加载ABI - 添加Permit ABI的加载
    useEffect(() => {
        // 强制防护：如果已经尝试过加载，直接返回
        if (abiLoadAttempted.current) {
            console.log('🛡️ ABI加载已经尝试过，防止重复执行');
            return;
        }

        // 避免重复加载
        if (abiLoaded || abiLoading) {
            console.log('🙅 ABI已加载或正在加载中，跳过');
            return;
        }

        // 设置加载尝试标志
        abiLoadAttempted.current = true;

        console.log('🔧 开始加载ABI...');
        setAbiLoading(true);
        setAbiError(null);

        try {
            // 使用同步方式加载ABI
            const tokenbankabi = loadABIFromSrc('TokenBank');
            console.log('✅ TokenBank ABI loaded:', tokenbankabi.length, 'items');

            // 修复：加载MErc20Permit而不是MyToken
            const tokenabi = loadABIFromSrc('MErc20Permit');
            console.log('✅ MErc20Permit ABI loaded:', tokenabi.length, 'items');

            // 同步设置状态
            setTokenBankABI(tokenbankabi);
            setTokenABI(tokenabi);
            
            // 尝试加载TokenBankPermit ABI
            try {
                const permitABI = loadABIFromSrc('TokenBankPermit');
                setTokenBankPermitABI(permitABI);
                console.log('✅ TokenBankPermit ABI loaded:', permitABI.length, 'items');
            } catch (err) {
                console.log('ℹ️ TokenBankPermit ABI未找到，使用标准TokenBank ABI');
            }
            
            setAbiLoaded(true);

            console.log('🎉 Both ABIs loaded successfully');
        } catch (error) {
            console.error('❌ ABI加载失败:', error);
            setAbiError(error instanceof Error ? error.message : 'ABI加载失败');
            // 加载失败时重置标志，允许重试
            abiLoadAttempted.current = false;
        } finally {
            setAbiLoading(false);
        }
    }, []); // 空依赖数组，只在组件挂载时执行一次

    // 监听ABI加载完成后的状态变化 - 只记录日志，不做任何操作
    useEffect(() => {
        if (abiLoaded && tokenBankABI && tokenABI) {
            console.log('📋 ABI加载状态更新:');
            console.log('  - tokenBankABI: ✅ 已加载 (' + tokenBankABI.length + ' 项)');
            console.log('  - tokenABI: ✅ 已加载 (' + tokenABI.length + ' 项)');
            console.log('  - ABI加载状态:', abiLoading);
            console.log('  - ABI加载完成:', abiLoaded);
        }
    }, [abiLoaded]); // 只监听abiLoaded状态

    // 使用 useRef 保持 walletClient 的引用
    const walletClientRef = useRef<any>(null);
    // 添加一个标志来记录用户是否主动断开连接
    const userDisconnectedRef = useRef<boolean>(false);
    // 防止钱包连接检查重复执行
    const walletCheckAttempted = useRef<boolean>(false);
    // 防止余额查询重复执行
    const balanceQueryAttempted = useRef<boolean>(false);

    // 查询用户在TokenBank中的存款余额
    const getTokenBankBalance = async (userAddress: string): Promise<string> => {
        if (!tokenBankABI || !abiLoaded) {
            console.log('TokenBank ABI未加载，返回0');
            return "0";
        }


        try {
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http()
            });

            console.log('开始查询TokenBank余额...');
            console.log('合约地址:', TOKEN_BANK_ADDRESS);
            console.log('用户地址:', userAddress);

            // 使用publicClient的readContract方法 - 正确的viem v2语法
            const balance = await (publicClient as any).readContract({
                address: TOKEN_BANK_ADDRESS,
                abi: tokenBankABI,
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`]
            });

            console.log('查询到的原始余额:', balance);

            // 转换为eth格式
            const formattedBalance = formatUnits(balance as bigint, 18);
            console.log('格式化后的余额:', formattedBalance);

            return formattedBalance;

        } catch (error) {
            console.error('查询用户TokenBank余额失败:', error);
            return "0";
        }
    }


    // 查询用户在Token中的存款余额
    const getTokenBalance = async (userAddress: string): Promise<string> => {
        if (!tokenABI || !abiLoaded) {
            console.log('Token ABI未加载，返回0');
            return "0";
        }


        try {
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http()
            });

            console.log('开始查询Token余额...');
            console.log('合约地址:', TOKEN_ADDRESS);
            console.log('用户地址:', userAddress);

            // 使用publicClient的readContract方法 - 正确的viem v2语法
            const balance = await (publicClient as any).readContract({
                address: TOKEN_ADDRESS,
                abi: tokenABI,
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`]
            });

            console.log('查询到的原始余额:', balance);

            // 转换为eth格式
            const formattedBalance = formatUnits(balance as bigint, 18);
            console.log('格式化后的余额:', formattedBalance);

            return formattedBalance;

        } catch (error) {
            console.error('查询用户Token余额失败:', error);
            return "0";
        }
    }

    // 精确的金额转换函数
    const parseTokenAmount = (amount: string): bigint => {
        try {
            // 添加输入验证
            if (!amount || amount.trim() === '') {
                console.error('金额转换失败: 输入为空');
                return BigInt(0);
            }
            
            // 验证是否为有效数字
            const numValue = parseFloat(amount);
            if (isNaN(numValue) || numValue < 0) {
                console.error('金额转换失败: 无效的数字格式', amount);
                return BigInt(0);
            }
            
            // 使用字符串操作避免浮点数精度问题
            const [integerPart, decimalPart = ''] = amount.split('.');
            const paddedDecimal = decimalPart.padEnd(18, '0').slice(0, 18);
            const fullString = integerPart + paddedDecimal;
            
            // 验证字符串是否只包含数字
            if (!/^\d+$/.test(fullString)) {
                console.error('金额转换失败: 字符串包含非数字字符', fullString);
                return BigInt(0);
            }
            
            const result = BigInt(fullString);
            console.log('金额转换成功:', amount, '->', result.toString(), 'Wei');
            return result;
        } catch (error) {
            console.error('金额转换失败:', error);
            return BigInt(0);
        }
    };

    // 检查用户是否已授权TokenBank合约花费Token,并检查授权额度是否足够
    const isApproved = async (userAddress: string, requiredAmount?: string): Promise<{ approved: boolean, currentAllowance: bigint, requiredAmountWei: bigint }> => {
        if (!tokenABI || !abiLoaded) {
            console.log('Token ABI未加载，无法检查授权状态');
            return { approved: false, currentAllowance: BigInt(0), requiredAmountWei: BigInt(0) };
        }

        try {
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http()
            });
            
            console.log('检查授权状态...');
            console.log('Token合约地址:', TOKEN_ADDRESS);
            console.log('用户地址:', userAddress);
            console.log('TokenBank地址:', TOKEN_BANK_ADDRESS);
            if (requiredAmount) {
                console.log('需要授权金额:', requiredAmount, 'Token');
            }
            
            // 查询用户对TokenBank合约的授权额度
            const allowance = await (publicClient as any).readContract({
                address: TOKEN_ADDRESS,
                abi: tokenABI,
                functionName: 'allowance',
                args: [userAddress as `0x${string}`, TOKEN_BANK_ADDRESS]
            });

            console.log('查询到的授权额度(Wei):', allowance.toString());
            console.log('查询到的授权额度(Token):', formatUnits(allowance as bigint, 18));
            
            if (requiredAmount) {
                // 使用精确的金额转换
                const requiredAmountInWei = parseTokenAmount(requiredAmount);
                const isApproved = (allowance as bigint) >= requiredAmountInWei;
                console.log('需要金额(Wei):', requiredAmountInWei.toString());
                console.log('授权状态(足够金额):', isApproved);
                return {
                    approved: isApproved,
                    currentAllowance: allowance as bigint,
                    requiredAmountWei: requiredAmountInWei
                };
            } else {
                // 如果没有指定金额，只检查是否有任何授权
                const isApproved = (allowance as bigint) > BigInt(0);
                console.log('授权状态(任何金额):', isApproved);
                return {
                    approved: isApproved,
                    currentAllowance: allowance as bigint,
                    requiredAmountWei: BigInt(0)
                };
            }

        } catch (error) {
            console.error('检查授权状态失败:', error);
            return { approved: false, currentAllowance: BigInt(0), requiredAmountWei: BigInt(0) };
        }
    }


    // 初始化检查钱包连接状态 - 使用ref防止严格模式重复执行
    useEffect(() => {
        // 强制防护：如果已经尝试过检查，直接返回
        if (walletCheckAttempted.current) {
            console.log('🛡️ 钱包连接检查已经尝试过，防止重复执行');
            return;
        }

        // 设置检查尝试标志
        walletCheckAttempted.current = true;

        const checkWalletConnection = async () => {
            // 检查用户是否主动断开过连接
            const userDisconnected = localStorage.getItem('userDisconnected') === 'true';
            if (userDisconnected) {
                console.log('🙅 用户之前主动断开过连接，跳过自动连接');
                userDisconnectedRef.current = true;
                return;
            }

            if (typeof window.ethereum !== 'undefined') {
                try {
                    // 检查是否有已授权的账户
                    const accounts = await window.ethereum.request({
                        method: 'eth_accounts',
                    });

                    if (accounts.length > 0) {
                        // 有已连接的账户
                        const address = accounts[0] as `0x${string}`;
                        walletClientRef.current = createWalletClient({
                            chain: sepolia,
                            transport: custom(window.ethereum!),
                            account: address,
                        });

                        setIsConnected(true);
                        setUserAddress(address);

                        console.log('🔗 检测到已连接的钱包:', address);
                        // 注意：这里不查询余额，由另一个useEffect处理
                    }
                } catch (error) {
                    console.log('检查钱包连接状态失败:', error);
                }
            }
        };

        // 监听账户变化事件
        const handleAccountsChanged = (accounts: string[]) => {
            console.log('🔄 账户变化事件:', accounts.length, '个账户');

            // 检查用户是否主动断开
            const userDisconnected = userDisconnectedRef.current || localStorage.getItem('userDisconnected') === 'true';

            if (accounts.length === 0) {
                // 用户在钱包中断开了连接
                console.log('😐 用户在钱包中断开了连接');
                setIsConnected(false);
                setUserAddress('');
                walletClientRef.current = null;
                userDisconnectedRef.current = true;
                localStorage.setItem('userDisconnected', 'true');
            } else if (!userDisconnected) {
                // 只有在用户没有主动断开时才自动重连
                console.log('🔁 用户切换了账户:', accounts[0]);
                const newAddress = accounts[0] as `0x${string}`;
                walletClientRef.current = createWalletClient({
                    chain: sepolia,
                    transport: custom(window.ethereum!),
                    account: newAddress,
                });
                setUserAddress(newAddress);
                setIsConnected(true);
            }
        };

        checkWalletConnection();

        // 添加事件监听器
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }

        // 清理函数
        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []); // 空依赖数组，只在组件挂载时执行一次

    // 在ABI加载完成后，如果已经连接了钱包，则查询余额 - 使用ref防止重复执行
    useEffect(() => {
        if (abiLoaded && (tokenBankABI || tokenBankPermitABI) && tokenABI && isConnected && userAddress) {
            // 强制防护：如果已经尝试过查询，直接返回
            if (balanceQueryAttempted.current) {
                console.log('🛡️ 余额查询已经尝试过，防止重复执行');
                return;
            }

            // 设置查询尝试标志
            balanceQueryAttempted.current = true;

            const queryBalances = async () => {
                console.log('💰 ABI已加载且钱包已连接，开始查询余额...');

                try {
                    const tokenbankbalance = await getTokenBankBalance(userAddress);
                    const tokenbalance = await getTokenBalance(userAddress);

                    setTokenbankBalance(tokenbankbalance);
                    setTokenBalance(tokenbalance);

                    console.log('✅ 余额查询完成');
                } catch (error) {
                    console.error('❌ 查询余额失败:', error);
                    // 查询失败时重置标志，允许重试
                    balanceQueryAttempted.current = false;
                }
            };

            queryBalances();
        }
    }, [abiLoaded, isConnected, userAddress]); // 精简依赖数组
    // 断开钱包连接函数
    const disconnectWallet = () => {
        if (window.confirm('确定要断开钱包连接吗？')) {
            console.log('=== 用户主动断开连接 ===');

            // 设置用户主动断开标志（内存和localStorage）
            userDisconnectedRef.current = true;
            localStorage.setItem('userDisconnected', 'true');

            // 只清除前端状态，不调用钱包API
            setIsConnected(false);
            setUserAddress('');
            walletClientRef.current = null;

            console.log('钱包已断开连接（仅前端状态）');
        }
    };

    // 连接钱包函数
    const connectWallet = async () => {
        console.log('=== connectWallet 被调用 ===');

        // 首先清除用户断开标志（因为用户主动点击连接）
        userDisconnectedRef.current = false;
        localStorage.removeItem('userDisconnected');

        console.log('当前连接状态:', isConnected);
        console.log('当前用户地址:', userAddress);
        console.log('walletClientRef.current:', walletClientRef.current);

        if (typeof window.ethereum !== 'undefined') {
            try {
                console.log('开始连接钱包...')

                // 先请求权限重置，让用户重新授权
                try {
                    await window.ethereum.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }],
                    });
                    console.log('权限重置成功');
                } catch (permError) {
                    console.log('权限重置失败，尝试直接请求账户:', permError);
                }

                // 请求用户连接钱包（弹出授权界面）
                const [address] = await window.ethereum.request({
                    method: 'eth_requestAccounts',
                }) as string[];

                console.log('获得用户地址:', address);

                walletClientRef.current = createWalletClient({
                    chain: sepolia,
                    transport: custom(window.ethereum!),
                    account: address as `0x${string}`,
                })

                console.log('钱包已连接:', address)
                // 设置连接状态和用户地址
                setIsConnected(true);
                setUserAddress(address);
                console.log('状态已更新 - isConnected: true, userAddress:', address);
            } catch (error) {
                console.log('用户拒绝连接或出错:', error)
            }
        } else {
            console.log('未检测到钱包');
        }
    };

    // 检查网络状态诊断函数
    const diagnoseNetworkIssue = async () => {
        console.log('🔍 开始诊断网络问题...');

        if (!window.ethereum) {
            alert('❌ 未检测到钱包');
            return;
        }

        try {
            // 检查当前网络
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const chainIdDecimal = parseInt(chainId, 16);

            console.log('🌐 网络诊断结果:');
            console.log('- 当前 Chain ID (hex):', chainId);
            console.log('- 当前 Chain ID (decimal):', chainIdDecimal);

            // 网络名称映射
            const networkNames: { [key: number]: string } = {
                1: '以太坊主网 (Mainnet)',
                11155111: 'Sepolia 测试网',
                5: 'Goerli 测试网 (已弃用)',
                137: 'Polygon 主网',
                80001: 'Polygon Mumbai 测试网'
            };

            const networkName = networkNames[chainIdDecimal] || `未知网络 (${chainIdDecimal})`;
            console.log('- 当前网络:', networkName);

            // 检查钱包连接的账户
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            console.log('- 连接的账户数量:', accounts.length);
            if (accounts.length > 0) {
                console.log('- 当前账户:', accounts[0]);
            }

            // 检查 walletClient 的配置
            if (walletClientRef.current) {
                console.log('- WalletClient 存在:', true);
                console.log('- WalletClient 链配置:', walletClientRef.current.chain?.id || '未知');
            } else {
                console.log('- WalletClient 存在:', false);
            }

            let diagnosis = `🔍 网络诊断结果:\n\n`;
            diagnosis += `当前钱包网络: ${networkName}\n`;
            diagnosis += `Chain ID: ${chainId} (${chainIdDecimal})\n`;
            diagnosis += `连接账户: ${accounts.length > 0 ? accounts[0] : '无'}\n\n`;

            if (chainIdDecimal === 11155111) {
                diagnosis += `✅ 钱包已正确连接到 Sepolia 测试网\n\n`;
                diagnosis += `可能的问题原因:\n`;
                diagnosis += `1. WalletClient 配置与钱包网络不同步\n`;
                diagnosis += `2. viem 版本兼容性问题\n`;
                diagnosis += `3. 钱包状态缓存问题\n\n`;
                diagnosis += `建议解决方案:\n`;
                diagnosis += `1. 重新连接钱包\n`;
                diagnosis += `2. 刷新页面后重试\n`;
                diagnosis += `3. 检查浏览器控制台的详细错误`;
            } else {
                diagnosis += `❌ 钱包未连接到 Sepolia 测试网\n\n`;
                diagnosis += `需要切换到 Sepolia 测试网 (Chain ID: 11155111)\n`;
                diagnosis += `当前网络不是目标网络，请在钱包中手动切换。`;
            }

            alert(diagnosis);

        } catch (error) {
            console.error('❌ 网络诊断失败:', error);
            alert(`❌ 网络诊断失败: ${error}`);
        }
    };

    // 主动调起钱包授权函数
    const requestTokenApproval = async (amount: string) => {
        if (!walletClientRef.current || !tokenABI || !userAddress) {
            alert('请先连接钱包');
            return false;
        }

        try {
            setLoading(true);
            console.log('🔐 开始调起钱包授权...');
            console.log('现在状态检查：');
            console.log('- 用户地址:', userAddress);
            console.log('- Token合约地址:', TOKEN_ADDRESS);
            console.log('- TokenBank地址:', TOKEN_BANK_ADDRESS);
            console.log('- 钱包客户端:', walletClientRef.current ? '存在' : '不存在');
            console.log('- Token ABI:', tokenABI ? `已加载(${tokenABI.length}项)` : '未加载');

            // 检查合约地址有效性
            if (TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000' || !TOKEN_ADDRESS) {
                alert('❌ Token合约地址未配置，请检查配置');
                return false;
            }

            if (TOKEN_BANK_ADDRESS === '0x0000000000000000000000000000000000000000' || !TOKEN_BANK_ADDRESS) {
                alert('❌ TokenBank合约地址未配置，请检查配置');
                return false;
            }

            // 先重置权限以确保弹窗正常显示
            try {
                await window.ethereum?.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }],
                });
                console.log('✅ 权限重置成功');
            } catch (permError) {
                console.log('⚠️ 权限重置失败，继续执行授权:', permError);
            }

            // 验证输入金额
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                alert('❌ 请输入有效的授权金额');
                return false;
            }

            // 使用精确的金额转换
            const amountInWei = parseTokenAmount(amount);

            console.log('授权参数:');
            console.log('- Token合约地址:', TOKEN_ADDRESS);
            console.log('- TokenBank地址:', TOKEN_BANK_ADDRESS);
            console.log('- 授权金额:', amount, 'Token');
            console.log('- 授权金额(Wei):', amountInWei.toString());

            // 检查钱包连接状态
            if (!window.ethereum) {
                alert('❌ 未检测到 MetaMask 或其他以太坊钱包');
                return false;
            }

            // 检查当前网络
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const chainIdDecimal = parseInt(chainId, 16);
            console.log('🌐 当前网络 Chain ID:', chainId, '(', chainIdDecimal, ')');

            if (chainIdDecimal !== 11155111) {
                const networkNames: { [key: number]: string } = {
                    1: '以太坊主网',
                    11155111: 'Sepolia 测试网',
                    5: 'Goerli 测试网'
                };
                const currentNetwork = networkNames[chainIdDecimal] || `未知网络(${chainIdDecimal})`;

                alert(`❌ 网络不匹配！

当前钱包网络: ${currentNetwork}
需要网络: Sepolia 测试网

请在 MetaMask 中手动切换到 Sepolia 测试网后重试。`);
                return false;
            }

            // 检查 walletClient 的网络配置
            if (walletClientRef.current?.chain?.id && walletClientRef.current.chain.id !== 11155111) {
                console.log('⚠️ WalletClient 网络配置与钱包不同步，重新创建...');

                // 重新创建 walletClient
                walletClientRef.current = createWalletClient({
                    chain: sepolia,
                    transport: custom(window.ethereum!),
                    account: userAddress as `0x${string}`,
                });

                console.log('✅ WalletClient 已重新创建为 Sepolia 网络');
            }

            console.log('📝 即将调用合约 approve 方法...');

            // 调用 Token 合约的 approve 方法
            const hash = await walletClientRef.current.writeContract({
                address: TOKEN_ADDRESS,
                abi: tokenABI,
                functionName: 'approve',
                args: [TOKEN_BANK_ADDRESS, amountInWei],
            });

            console.log('✅ 授权交易已提交，交易哈希:', hash);

            // 等待交易确认 - 使用简化的方式，直接显示成功并刷新状态
            console.log('⏳ 授权交易已提交，请稍候片刻才会生效...');

            // 等待授权交易确认
            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log('🎉 授权交易已提交成功!');
            
            // 验证授权是否真正生效
            const verifyResult = await isApproved(userAddress, amount);
            if (!verifyResult.approved) {
                console.log('⚠️ 授权可能还未完全确认，建议稍后重试');
            }
            
            alert(`✅ 授权交易已提交！

交易哈希: ${hash}

授权状态: ${verifyResult.approved ? '✅ 已确认' : '⏳ 等待确认'}

${verifyResult.approved ? '现在可以进行存款操作。' : '请等待片刻后重试存款。'}`);

            // 自动刷新余额
            setTimeout(async () => {
                await refreshBalances();
                console.log('✅ 余额已自动刷新');
            }, 2000);

            return true;

        } catch (error: any) {
            console.error('❌ 授权过程出错:', error);
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            // 更详细的错误分类处理
            if (error.message?.includes('User denied transaction') || error.code === 4001) {
                alert('❌ 您拒绝了授权交易。如需存款，请重新授权。');
            } else if (error.message?.includes('insufficient funds') || error.code === -32000) {
                alert('❌ Gas 费用不足，请确保钱包中有足够的 ETH 支付交易费用。');
            } else if (error.message?.includes('does not match the target chain') || error.message?.includes('ContractFunctionExecutionError')) {
                // 网络不匹配的特定处理
                const shouldDiagnose = window.confirm(
                    '❌ 网络不匹配错误！\n\n' +
                    '可能的原因：\n' +
                    '1. 钱包网络设置与合约网络不同步\n' +
                    '2. WalletClient 配置问题\n' +
                    '3. 缓存问题\n\n' +
                    '点击确定进行详细网络诊断。'
                );

                if (shouldDiagnose) {
                    await diagnoseNetworkIssue();
                }
            } else if (error.message?.includes('execution reverted')) {
                alert('❌ 合约执行失败，请检查：\n1. 合约地址是否正确\n2. 网络是否为 Sepolia 测试网\n3. 合约是否已正确部署');
            } else if (error.message?.includes('network')) {
                alert('❌ 网络连接错误，请检查网络连接并确认切换到 Sepolia 测试网。');
            } else if (error.message?.includes('account')) {
                alert('❌ 钱包账户错误，请重新连接钱包。');
            } else {
                alert(`❌ 授权失败: ${error.message || '未知错误'}

请检查：
1. 钱包是否连接到 Sepolia 测试网
2. 账户余额是否足够
3. 合约地址是否正确`);
            }
            return false;
        } finally {
            setLoading(false);
        }
    };

    // 显示授权指导函数
    const showApprovalGuide = () => {
        const guideContent = `
📝 ERC20 代币授权步骤指导

为了安全地使用 TokenBank 存款功能，您需要先授权合约使用您的 Token。

🔒 授权信息：
• Token 合约地址: ${TOKEN_ADDRESS}
• TokenBank 合约地址: ${TOKEN_BANK_ADDRESS}
• 建议授权金额: ${depositInput || '您要存入的金额'} Token

💆 操作步骤：

方法一：在 MetaMask 中直接授权
1. 打开 MetaMask 钱包
2. 点击“资产”页的 Token 代币
3. 点击“发送”按钮
4. 在“发送至”中输入 TokenBank 地址
5. 设置授权金额后确认交易

方法二：使用区块链浏览器
1. 访问 Etherscan: https://sepolia.etherscan.io/address/${TOKEN_ADDRESS}#writeContract
2. 点击 "Connect to Web3" 连接钱包
3. 找到 "approve" 方法
4. 输入参数：
   - spender: ${TOKEN_BANK_ADDRESS}
   - amount: 您要授权的金额（单位：Wei）
5. 点击 "Write" 按钮并确认交易

方法三：使用其他 DApp 工具
可以使用 1inch、Uniswap 等 DApp 的授权功能

⚠️ 注意事项：
• 请确认合约地址正确，避免授权给错误地址
• 建议只授权您需要的金额，不要过度授权
• 授权后请返回此页面刷新余额并重试存款
        `;

        alert(guideContent);
    };

    // 存款函数
    const handleDeposit = async () => {
        if (!depositInput || parseFloat(depositInput) <= 0) {
            alert('请输入有效的存款金额');
            return;
        }

        // 检查授权状态 - 传入存款金额进行精确检查
        const approvalResult = await isApproved(userAddress, depositInput);
        if (!approvalResult.approved) {
            // 提供两种选择：主动授权或查看手动指导
            const shouldAutoApprove = window.confirm(
                `检测到您尚未授权 TokenBank 合约使用您的 Token。\n\n` +
                `点击"确定"自动调起钱包授权弹窗\n` +
                `点击"取消"查看手动授权指导`
            );

            if (shouldAutoApprove) {
                // 主动调起钱包授权
                const approvalSuccess = await requestTokenApproval(depositInput);
                if (!approvalSuccess) {
                    return; // 授权失败，停止存款
                }
                
                // 授权成功后，提示用户稍后重试存款
                alert('✅ 授权成功！\n\n请等待授权交易在区块链上确认（约15-30秒），然后重新点击存款按钮。');
                return; // 授权成功后返回，让用户手动重试存款
                
            } else {
                // 显示手动授权指导
                showApprovalGuide();
                return;
            }
        }

        // 已授权，开始存款逻辑
        console.log('✅ 已授权，开始存款，金额:', depositInput);
        
        try {
            setLoading(true);
            
            // 使用精确的金额转换
            const numAmount = parseFloat(depositInput);
            const amountInWei = parseTokenAmount(depositInput);
            
            console.log('🏦 开始存款操作...');
            console.log('- 存款金额:', depositInput, 'Token');
            console.log('- 存款金额(Wei):', amountInWei.toString());
            
            // 在存款交易提交前再次实时检查授权状态
            console.log('🔍 存款前再次检查授权状态...');
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http()
            });
            
            // 多次重试检查授权状态，以应对区块链延迟
            let currentAllowance = BigInt(0);
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    currentAllowance = await (publicClient as any).readContract({
                        address: TOKEN_ADDRESS,
                        abi: tokenABI,
                        functionName: 'allowance',
                        args: [userAddress as `0x${string}`, TOKEN_BANK_ADDRESS]
                    });
                    
                    console.log(`- 第${retryCount + 1}次检查授权额度(Wei):`, currentAllowance.toString());
                    console.log(`- 需要授权额度(Wei):`, amountInWei.toString());
                    
                    if (currentAllowance >= amountInWei) {
                        console.log('✅ 授权额度检查通过');
                        break; // 授权足够，跳出循环
                    }
                    
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`⏳ 授权额度不足，等待2秒后重试...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (error) {
                    console.error(`❌ 第${retryCount + 1}次授权检查失败:`, error);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (currentAllowance < amountInWei) {
                const shortfall = amountInWei - currentAllowance;
                const shortfallToken = formatUnits(shortfall, 18);
                
                alert(`❌ 授权额度仍然不足！\n\n` +
                    `当前授权额度: ${formatUnits(currentAllowance, 18)} Token\n` +
                    `需要授权额度: ${depositInput} Token\n` +
                    `缺少授权额度: ${shortfallToken} Token\n\n` +
                    `可能原因：\n` +
                    `1. 授权交易还未在区块链上确认\n` +
                    `2. 授权金额不足\n` +
                    `3. 网络延迟问题\n\n` +
                    `建议：\n` +
                    `1. 等待1-2分钟后重试\n` +
                    `2. 检查授权交易是否成功\n` +
                    `3. 重新进行授权操作`);
                return;
            }
            
            // 检查用户Token余额是否足够
            const userTokenBalance = await (publicClient as any).readContract({
                address: TOKEN_ADDRESS,
                abi: tokenABI,
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`]
            });
            
            console.log('- 用户Token余额(Wei):', userTokenBalance.toString());
            
            if (userTokenBalance < amountInWei) {
                const shortfall = amountInWei - userTokenBalance;
                const shortfallToken = formatUnits(shortfall, 18);
                
                alert(`❌ Token余额不足！\n\n` +
                    `当前余额: ${formatUnits(userTokenBalance, 18)} Token\n` +
                    `需要金额: ${depositInput} Token\n` +
                    `缺少金额: ${shortfallToken} Token`);
                return;
            }
            
            console.log('✅ 授权和余额检查通过，开始调用存款合约...');
            
            // 调用存款合约
            const hash = await walletClientRef.current.writeContract({
                address: TOKEN_BANK_ADDRESS,
                abi: tokenBankABI,
                functionName: 'deposit',
                args: [amountInWei],
            });
            
            console.log('✅ 存款交易已提交，交易哈希:', hash);
            
            // 等待交易确认
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            alert(`✅ 存款成功！

交易哈希: ${hash}

请等待区块链确认后刷新余额。`);
            
            // 自动刷新余额
            setTimeout(async () => {
                await refreshBalances();
                console.log('✅ 余额已自动刷新');
            }, 2000);
            
            // 清空输入
            setDepositInput('');
            
        } catch (error: any) {
            console.error('❌ 存款过程出错:', error);
            
            if (error.message?.includes('ERC20: transfer amount exceeds allowance')) {
                // 当出现授权不足错误时，提供更详细的诊断信息
                console.log('🔍 检测到授权不足错误，开始详细诊断...');
                
                try {
                    // 重新检查最新的授权状态
                    const latestApprovalResult = await isApproved(userAddress, depositInput);
                    
                    alert(`❌ 存款失败：授权额度不足！\n\n` +
                        `📊 最新状态检查：\n` +
                        `当前授权额度: ${formatUnits(latestApprovalResult.currentAllowance, 18)} Token\n` +
                        `需要授权额度: ${depositInput} Token\n` +
                        `授权是否足够: ${latestApprovalResult.approved ? '✅' : '❌'}\n\n` +
                        `💡 可能原因：\n` +
                        `1. 授权交易还未完全确认\n` +
                        `2. 授权被其他pending交易消耗\n` +
                        `3. 前端状态与链上状态不同步\n\n` +
                        `🔧 解决方案：\n` +
                        `1. 等待1-2分钟后重试存款\n` +
                        `2. 重新进行授权操作\n` +
                        `3. 使用"高级诊断"按钮检查详细状态`);
                } catch (diagError) {
                    alert(`❌ 授权额度不足！\n\n` +
                        `这通常是因为：\n` +
                        `1. 授权金额小于存款金额\n` +
                        `2. 授权已被其他交易消耗\n` +
                        `3. 授权状态不同步\n\n` +
                        `请重新授权后再试。`);
                }
            } else if (error.message?.includes('ERC20: transfer amount exceeds balance')) {
                alert('❌ Token余额不足，无法完成存款。');
            } else if (error.message?.includes('User denied transaction')) {
                alert('❌ 您取消了存款交易。');
            } else {
                alert(`❌ 存款失败: ${error.message || '未知错误'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // 取款函数
    const handleWithdraw = async () => {
        if (!withdrawInput || parseFloat(withdrawInput) <= 0) {
            alert('请输入有效的取款金额');
            return;
        }

        // 检查连接状态
        if (!isConnected || !userAddress || !abiLoaded || !tokenBankABI || !walletClientRef.current) {
            alert('❌ 请先连接钱包或等待ABI加载完成');
            return;
        }

        console.log('💰 开始取款流程...');
        console.log('- 取款金额:', withdrawInput, 'Token');
        
        try {
            setLoading(true);
            
            // 转换取款金额
            const amountInWei = parseTokenAmount(withdrawInput);
            console.log('- 取款金额(Wei):', amountInWei.toString());
            
            // 检查用户在TokenBank中的存款余额是否足够
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http()
            });
            
            console.log('🔍 检查TokenBank存款余额...');
            const userTokenBankBalance = await (publicClient as any).readContract({
                address: TOKEN_BANK_ADDRESS,
                abi: tokenBankABI,
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`]
            });
            
            console.log('- 用户TokenBank余额(Wei):', userTokenBankBalance.toString());
            console.log('- 需要取款金额(Wei):', amountInWei.toString());
            
            if (userTokenBankBalance < amountInWei) {
                const shortfall = amountInWei - userTokenBankBalance;
                const shortfallToken = formatUnits(shortfall, 18);
                
                alert(`❌ TokenBank存款余额不足！\n\n` +
                    `当前存款余额: ${formatUnits(userTokenBankBalance, 18)} Token\n` +
                    `需要取款金额: ${withdrawInput} Token\n` +
                    `缺少余额: ${shortfallToken} Token`);
                return;
            }
            
            console.log('✅ 存款余额检查通过，开始调用取款合约...');
            
            // 调用取款合约
            const hash = await walletClientRef.current.writeContract({
                address: TOKEN_BANK_ADDRESS,
                abi: tokenBankABI,
                functionName: 'withdraw',
                args: [amountInWei],
            });
            
            console.log('✅ 取款交易已提交，交易哈希:', hash);
            
            // 等待交易确认
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            alert(`✅ 取款成功！

交易哈希: ${hash}

请等待区块链确认后刷新余额。`);
            
            // 自动刷新余额
            setTimeout(async () => {
                await refreshBalances();
                console.log('✅ 余额已自动刷新');
            }, 2000);
            
            // 清空输入
            setWithdrawInput('');
            
        } catch (error: any) {
            console.error('❌ 取款过程出错:', error);
            
            if (error.message?.includes('out of balance')) {
                alert('❌ 取款失败：TokenBank存款余额不足！');
            } else if (error.message?.includes('withdraw fail')) {
                alert('❌ 取款失败：合约内部转账失败，可能是合约Token余额不足。');
            } else if (error.message?.includes('User denied transaction')) {
                alert('❌ 您取消了取款交易。');
            } else {
                alert(`❌ 取款失败: ${error.message || '未知错误'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // 刷新余额函数
    const refreshBalances = async () => {
        if (!isConnected || !userAddress || !abiLoaded || !tokenBankABI || !tokenABI) {
            console.log('未连接或ABI未加载，无法刷新余额');
            return;
        }

        setLoading(true);
        try {
            console.log('🔄 手动刷新余额...');

            const tokenbankbalance = await getTokenBankBalance(userAddress);
            setTokenbankBalance(tokenbankbalance);

            const tokenbalance = await getTokenBalance(userAddress);
            setTokenBalance(tokenbalance);

            console.log('✅ 手动刷新余额完成');
        } catch (error) {
            console.error('刷新余额失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 重置查询标志的工具函数（用于特殊情况）
    const resetQueryFlags = () => {
        balanceQueryAttempted.current = false;
        console.log('🔄 查询标志已重置');
    };

    // 调试授权问题函数
    const diagnoseApprovalIssues = async () => {
        console.log('🔍 开始诊断授权问题...');

        const issues: string[] = [];

        // 检查基本状态
        if (!isConnected) issues.push('❌ 钱包未连接');
        if (!userAddress) issues.push('❌ 用户地址为空');
        if (!walletClientRef.current) issues.push('❌ 钱包客户端未初始化');
        if (!abiLoaded) issues.push('❌ ABI 未加载');
        if (!tokenABI) issues.push('❌ Token ABI 未加载');
        if (!tokenBankABI) issues.push('❌ TokenBank ABI 未加载');

        // 检查合约地址
        if (!TOKEN_ADDRESS || TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000') {
            issues.push('❌ Token 合约地址未设置');
        }
        if (!TOKEN_BANK_ADDRESS || TOKEN_BANK_ADDRESS === '0x0000000000000000000000000000000000000000') {
            issues.push('❌ TokenBank 合约地址未设置');
        }

        // 检查网络连接
        if (!window.ethereum) {
            issues.push('❌ 未检测到以太坊钱包');
        }

        // 检查余额（如果已连接）
        if (isConnected && userAddress && tokenBankABI && issues.length === 0) {
            try {
                const publicClient = createPublicClient({
                    chain: sepolia,
                    transport: http()
                });

                // 如果有存款金额输入，则检查具体金额
                const checkAmount = depositInput ? parseTokenAmount(depositInput) : BigInt('1000000000000000000'); // 默认检查 1 Token
                
                console.log('📊 使用合约调试函数检查状态...');
                const userStatus = await (publicClient as any).readContract({
                    address: TOKEN_BANK_ADDRESS,
                    abi: tokenBankABI,
                    functionName: 'checkUserStatus',
                    args: [userAddress as `0x${string}`, checkAmount]
                });

                const [userBalance, allowanceAmount, hasEnoughBalance, hasEnoughAllowance] = userStatus;

                console.log('📊 合约返回的详细状态:');
                console.log('- 用户Token余额:', formatUnits(userBalance, 18), 'Token');
                console.log('- 授权额度:', formatUnits(allowanceAmount, 18), 'Token');
                console.log('- 余额是否足够:', hasEnoughBalance);
                console.log('- 授权是否足够:', hasEnoughAllowance);

                let diagnosisReport = `🔍 授权状态诊断报告\n\n`;
                diagnosisReport += `📊 合约数据 (检查金额: ${formatUnits(checkAmount, 18)} Token):\n`;
                diagnosisReport += `• 用户Token余额: ${formatUnits(userBalance, 18)} Token\n`;
                diagnosisReport += `• 授权额度: ${formatUnits(allowanceAmount, 18)} Token\n`;
                diagnosisReport += `• 余额足够: ${hasEnoughBalance ? '✅' : '❌'}\n`;
                diagnosisReport += `• 授权足够: ${hasEnoughAllowance ? '✅' : '❌'}\n\n`;

                if (!hasEnoughBalance) {
                    diagnosisReport += `❌ 问题: Token余额不足\n`;
                    diagnosisReport += `解决方案: 获取更多Token后重试\n\n`;
                }

                if (!hasEnoughAllowance) {
                    diagnosisReport += `❌ 问题: 授权额度不足\n`;
                    diagnosisReport += `当前授权: ${formatUnits(allowanceAmount, 18)} Token\n`;
                    diagnosisReport += `解决方案: 重新授权足够的金额\n\n`;
                }

                if (hasEnoughBalance && hasEnoughAllowance) {
                    diagnosisReport += `✅ 授权状态正常，应该可以正常存款\n\n`;
                    diagnosisReport += `如果仍然失败，可能的原因:\n`;
                    diagnosisReport += `1. 网络延迟导致状态不同步\n`;
                    diagnosisReport += `2. 其他pending交易消耗了授权\n`;
                    diagnosisReport += `3. Gas费用不足\n`;
                }

                alert(diagnosisReport);

            } catch (error) {
                console.error('❌ 合约状态检查失败:', error);
                issues.push('❌ 无法查询合约状态');
            }
        }

        // 输出诊断结果
        console.log('📊 诊断结果:');
        if (issues.length === 0) {
            console.log('✅ 基础检查通过');
        } else {
            console.log('❌ 发现问题:', issues);
            const issueText = issues.join('\\n');
            alert(`❌ 诊断发现基础问题:

${issueText}

请先解决这些问题后重试。`);
        }
    };

    // 添加通过签名存款的函数
    const handlePermitDeposit = async () => {
        console.log('开始处理签名存款，输入参数:', { permitAmount, permitDeadline });
        
        // 检查输入值
        if (!permitAmount || permitAmount.trim() === '') {
            alert('请输入存款金额');
            return;
        }
        
        const amountNum = parseFloat(permitAmount);
        console.log('解析的金额数值:', amountNum);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert('请输入有效的存款金额（大于0的数字）');
            return;
        }

        // 验证截止时间（如果提供了的话）
        if (permitDeadline && permitDeadline.trim() !== '') {
            const deadlineNum = parseInt(permitDeadline, 10);
            console.log('解析的截止时间数值:', deadlineNum);
            if (isNaN(deadlineNum)) {
                alert('截止时间格式错误，请输入有效的时间戳（Unix时间戳）');
                return;
            }
            
            const currentTime = Math.floor(Date.now() / 1000);
            console.log('当前时间戳:', currentTime, '输入的截止时间:', deadlineNum);
            if (deadlineNum <= currentTime) {
                alert(`截止时间必须是未来时间，当前时间戳：${currentTime}`);
                return;
            }
        }

        // 检查连接状态
        if (!isConnected || !userAddress || !abiLoaded || (!tokenBankPermitABI && !tokenBankABI) || !walletClientRef.current) {
            alert('❌ 请先连接钱包或等待ABI加载完成');
            return;
        }

        try {
            setLoading(true);
            
            // 转换存款金额，添加更严格的检查
            let amountInWei: bigint;
            try {
                console.log('开始转换存款金额，输入值:', permitAmount);
                // 确保输入金额是有效的数字
                if (!permitAmount || permitAmount.trim() === '' || isNaN(parseFloat(permitAmount))) {
                    throw new Error('请输入有效的存款金额');
                }
                
                const amountFloat = parseFloat(permitAmount);
                if (amountFloat <= 0) {
                    throw new Error('存款金额必须大于0');
                }
                
                // 使用更安全的转换方法
                amountInWei = parseTokenAmount(permitAmount);
                console.log('转换后的Wei金额:', amountInWei.toString());
                if (amountInWei === undefined || amountInWei <= BigInt(0)) {
                    throw new Error('金额转换结果无效');
                }
            } catch (parseError: any) {
                console.error('金额转换失败:', parseError);
                throw new Error('存款金额格式错误，请输入有效的数字');
            }
            
            // 设置截止时间（默认1小时后）
            let deadline: bigint;
            try {
                console.log('开始处理截止时间，输入值:', permitDeadline);
                if (permitDeadline && permitDeadline.trim() !== '') {
                    // 验证截止时间输入
                    const deadlineNum = parseInt(permitDeadline, 10);
                    console.log('解析的截止时间数值:', deadlineNum);
                    if (isNaN(deadlineNum) || deadlineNum <= 0) {
                        throw new Error('截止时间格式错误，请输入有效的时间戳');
                    }
                    
                    const currentTime = Math.floor(Date.now() / 1000);
                    console.log('当前时间戳:', currentTime, '截止时间:', deadlineNum);
                    if (deadlineNum <= currentTime) {
                        throw new Error(`截止时间必须是未来时间，当前时间戳：${currentTime}`);
                    }
                    
                    deadline = BigInt(deadlineNum);
                } else {
                    // 默认设置为1小时后
                    const defaultDeadline = Math.floor(Date.now() / 1000) + 3600;
                    console.log('使用默认截止时间（1小时后）:', defaultDeadline);
                    deadline = BigInt(defaultDeadline);
                }
                
                console.log('最终截止时间:', deadline.toString());
                if (deadline === undefined) {
                    throw new Error('截止时间转换结果无效');
                }
            } catch (timeError: any) {
                console.error('截止时间转换失败:', timeError);
                throw new Error(timeError.message || '截止时间格式错误，请输入有效的时间戳');
            }
            
            console.log('🏦 开始通过签名存款流程...');
            console.log('- 存款金额:', permitAmount, 'Token');
            console.log('- 截止时间:', deadline.toString());
            console.log('- 转换后的Wei金额:', amountInWei.toString());
            
            // 使用viem实现EIP-712签名生成
            console.log('🔐 正在请求钱包生成EIP-712签名...');
            
            // 首先获取代币的nonce值
            const publicClient: any = createPublicClient({
                chain: sepolia,
                transport: http()
            });
            
            // 检查ABI中是否包含nonces函数
            const noncesFunction = tokenABI.find((func: any) => func.name === 'nonces');
            if (!noncesFunction) {
                throw new Error(`ABI配置错误：代币合约ABI中未找到nonces函数。当前加载的ABI包含以下函数: ${tokenABI.map((f: any) => f.name).join(', ')}`);
            }
            console.log('找到nonces函数:', noncesFunction);
            
            let nonce: bigint;
            try {
                const nonceResult = await publicClient.readContract({
                    address: TOKEN_ADDRESS,
                    abi: tokenABI,
                    functionName: 'nonces',
                    args: [userAddress as `0x${string}`]
                });
                nonce = nonceResult as bigint;
                console.log('获取到的nonce值:', nonce.toString());
            } catch (nonceError) {
                console.error('获取nonce失败:', nonceError);
                throw new Error('无法获取用户nonce值，请检查网络连接和合约地址配置');
            }
            
            console.log('用户nonce:', nonce);
            
            // 构造EIP-712签名消息
            const domain = {
                name: 'PermitERC20',  // 与合约中的域名匹配
                version: '1',
                chainId: sepolia.id,
                verifyingContract: TOKEN_ADDRESS,
            };
            
            const types = {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
            };
            
            const message = {
                owner: userAddress,
                spender: TOKEN_BANK_ADDRESS,
                value: amountInWei,
                nonce: nonce,
                deadline: deadline,
            };
            
            console.log('签名消息:', { domain, types, message });
            
            // 请求钱包签名
            const signature = await walletClientRef.current.signTypedData({
                domain,
                types,
                primaryType: 'Permit',
                message,
                account: userAddress as `0x${string}`,
            });
            
            console.log('签名结果:', signature);
            
            // 解析签名结果，添加更详细的检查
            if (!signature) {
                throw new Error('签名生成失败：钱包未返回有效签名');
            }
            
            // 检查签名结果的格式
            console.log('签名结果类型:', typeof signature);
            console.log('签名结果内容:', signature);
            
            // 处理不同的签名返回格式
            let v, r, s;
            
            try {
                // 如果签名是对象格式，直接解构
                if (typeof signature === 'object' && signature !== null) {
                    if ('v' in signature && 'r' in signature && 's' in signature) {
                        // 标准格式
                        v = signature.v;
                        r = signature.r;
                        s = signature.s;
                        console.log('✅ 使用标准对象格式解析');
                    } else if ('signature' in signature) {
                        // 有些钱包返回 { signature: '0x...' } 格式
                        // 需要从完整签名中提取v, r, s
                        const sig = signature.signature;
                        if (typeof sig === 'string' && sig.startsWith('0x') && sig.length === 132) {
                            r = sig.slice(0, 66);  // 0x + 64个字符
                            s = '0x' + sig.slice(66, 130);  // 0x + 64个字符
                            // v通常是最后一个字节
                            const vHex = sig.slice(130, 132);
                            v = parseInt(vHex, 16);
                            console.log('✅ 从完整签名中提取v, r, s');
                        } else {
                            throw new Error(`签名格式不正确：无法解析签名参数。签名长度: ${sig?.length}, 类型: ${typeof sig}`);
                        }
                    } else {
                        // 详细记录对象内容
                        const keys = Object.keys(signature);
                        throw new Error(`签名格式不正确：缺少v、r、s参数。当前包含的字段: [${keys.join(', ')}]`);
                    }
                } 
                // 如果签名是字符串格式，需要解析
                else if (typeof signature === 'string' && signature.startsWith('0x')) {
                    if (signature.length === 132) {
                        // 完整签名格式
                        r = signature.slice(0, 66);  // 0x + 64个字符
                        s = '0x' + signature.slice(66, 130);  // 0x + 64个字符
                        // v通常是最后一个字节
                        const vHex = signature.slice(130, 132);
                        v = parseInt(vHex, 16);
                        console.log('✅ 从字符串签名中提取v, r, s');
                    } else {
                        throw new Error(`签名长度不正确：期望132字符的完整签名，实际长度: ${signature.length}`);
                    }
                } else {
                    throw new Error(`签名格式不正确：无法识别的签名格式。类型: ${typeof signature}, 值: ${signature}`);
                }
            } catch (parseError: any) {
                console.error('签名解析错误:', parseError);
                throw new Error(`签名解析失败: ${parseError.message}`);
            }
            
            console.log('解析后的签名参数:', { v, r, s });
            
            // 验证签名参数
            if (v === undefined || r === undefined || s === undefined) {
                throw new Error('签名参数不完整：缺少v、r或s参数');
            }
            
            // 验证参数类型
            if (typeof v !== 'number' || typeof r !== 'string' || typeof s !== 'string') {
                throw new Error(`签名参数类型错误: v=${typeof v}, r=${typeof r}, s=${typeof s}`);
            }
            
            // 验证参数格式
            if (!r.startsWith('0x') || r.length !== 66) {
                throw new Error(`签名参数r格式错误: 应该以0x开头且长度为66，实际值: ${r}, 长度: ${r.length}`);
            }
            
            if (!s.startsWith('0x') || s.length !== 66) {
                throw new Error(`签名参数s格式错误: 应该以0x开头且长度为66，实际值: ${s}, 长度: ${s.length}`);
            }
            
            console.log('签名参数验证通过');
            
            // 调用TokenBank的permitDeposit方法
            console.log('🔐 调用TokenBank的permitDeposit方法...');
            
            const hash = await walletClientRef.current.writeContract({
                address: TOKEN_BANK_ADDRESS,
                abi: tokenBankPermitABI || tokenBankABI, // 优先使用Permit ABI
                functionName: 'permitDeposit',
                args: [
                    amountInWei, 
                    deadline, 
                    v,
                    r,
                    s
                ],
            });
            
            console.log('✅ 签名存款交易已提交，交易哈希:', hash);
            
            // 等待交易确认
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            alert(`✅ 签名存款成功！

交易哈希: ${hash}

请等待区块链确认后刷新余额。`);
            
            // 自动刷新余额
            setTimeout(async () => {
                await refreshBalances();
                console.log('✅ 余额已自动刷新');
            }, 2000);
            
            // 清空输入
            setPermitAmount('');
            setPermitDeadline('');
            
        } catch (error: any) {
            console.error('❌ 签名存款过程出错:', error);
            
            // 检查是否是签名相关的错误
            if (error.message?.includes('expired deadline')) {
                alert('❌ 截止时间已过期，请重新尝试');
            } else if (error.message?.includes('permit failed')) {
                alert('❌ 签名验证失败，可能的原因：\n1. 签名参数无效\n2. 未在钱包中完成签名\n3. 截止时间已过期');
            } else if (error.message?.includes('transfer failed')) {
                alert('❌ 转账失败，可能是余额不足');
            } else if (error.message?.includes('User denied transaction')) {
                alert('❌ 您取消了存款交易');
            } else if (error.message?.includes('ERC2612')) {
                alert('❌ 签名相关错误，请确保：\n1. 在钱包中完成了签名操作\n2. 使用支持EIP-712签名的钱包');
            } else if (error.message?.includes('nonces is not in ABI')) {
                alert('❌ ABI配置错误：无法找到nonces函数，请检查代币合约ABI配置');
            } else if (error.message?.includes('Cannot convert undefined to a BigInt')) {
                alert('❌ 金额转换错误：请输入有效的存款金额和截止时间');
            } else if (error.message?.includes('金额转换')) {
                alert(`❌ ${error.message}`);
            } else if (error.message?.includes('截止时间格式错误')) {
                alert(`❌ ${error.message}`);
            } else if (error.message?.includes('签名参数不完整')) {
                alert(`❌ ${error.message}

请确保：
1. 在钱包中完成了签名操作
2. 使用支持EIP-712签名的钱包
3. 网络连接稳定`);
            } else if (error.message?.includes('签名解析失败')) {
                alert(`❌ 签名解析失败

可能的原因：
1. 钱包未正确返回签名
2. 网络连接不稳定
3. 钱包不支持EIP-712签名

详细信息：${error.message}`);
            } else {
                alert(`❌ 存款失败: ${error.message || '未知错误'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>TokenBank DApp</h1>
                <div className="wallet-section">
                    {!isConnected ? (
                        <button className="connect-btn" onClick={connectWallet}>
                            连接钱包
                        </button>
                    ) : (
                        <div className="wallet-info">
                            <button className="address-btn" onClick={disconnectWallet}>
                                {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : '未连接'}
                            </button>
                            <button className="refresh-btn" onClick={refreshBalances}>
                                刷新
                            </button>
                            <button className="disconnect-btn" onClick={disconnectWallet} title="断开钱包连接">
                                断开连接
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="main-content">
                {/* 调试面板 */}
                <section className="debug-panel">
                    <details>
                        <summary>🔍 调试信息</summary>
                        <div className="debug-info">
                            <p><strong>isConnected:</strong> {isConnected.toString()}</p>
                            <p><strong>userAddress:</strong> {userAddress || '空'}</p>
                            <p><strong>walletClientRef.current:</strong> {walletClientRef.current ? '存在' : 'null'}</p>
                            <p><strong>userDisconnectedRef.current:</strong> {userDisconnectedRef.current.toString()}</p>
                            <p><strong>localStorage.userDisconnected:</strong> {localStorage.getItem('userDisconnected') || '空'}</p>
                            <p><strong>window.ethereum:</strong> {typeof window.ethereum !== 'undefined' ? '存在' : '不存在'}</p>
                            <p><strong>TokenBank ABI:</strong> {abiLoading ? '加载中...' : (abiLoaded && tokenBankABI ? `已加载 (${tokenBankABI.length} 项)` : '未加载')}</p>
                            <p><strong>Token ABI:</strong> {abiLoading ? '加载中...' : (abiLoaded && tokenABI ? `已加载 (${tokenABI.length} 项)` : '未加载')}</p>
                            <p><strong>TokenBank地址:</strong> {TOKEN_BANK_ADDRESS === "0x0000000000000000000000000000000000000000" ? '未配置' : TOKEN_BANK_ADDRESS}</p>
                            {abiError && <p style={{ color: 'red' }}><strong>ABI错误:</strong> {abiError}</p>}
                        </div>
                    </details>
                </section>

                {!isConnected ? (
                    <div className="connect-prompt">
                        <p>请先连接您的钱包以使用TokenBank</p>
                    </div>
                ) : (
                    <>
                        {/* Token余额显示区域 */}
                        <section className="balance-section">
                            <div className="balance-card">
                                <h2>Token余额</h2>
                                <div className="balance-amount">
                                    <span className="amount">{tokenBalance}</span>
                                    <span className="unit">Token</span>
                                </div>
                            </div>

                            <div className="balance-card">
                                <h2>已存款金额</h2>
                                <div className="balance-amount">
                                    <span className="amount">{tokenbankBalance}</span>
                                    <span className="unit">Token</span>
                                </div>
                            </div>
                        </section>

                        {/* 存款区域 */}
                        <section className="operation-section">
                            <div className="operation-card">
                                <h3>存款到TokenBank</h3>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        placeholder="请输入存款金额"
                                        value={depositInput}
                                        onChange={(e) => setDepositInput(e.target.value)}
                                        className="amount-input"
                                        min="0"
                                        step="0.01"
                                    />
                                    <span className="input-unit">Token</span>
                                </div>
                                <button
                                    className="action-btn deposit-btn"
                                    onClick={handleDeposit}
                                    disabled={loading || !depositInput}
                                >
                                    {loading ? '处理中...' : '存款'}
                                </button>

                                <div className="approval-actions" style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button
                                        className="quick-btn"
                                        onClick={async () => {
                                            if (!depositInput || parseFloat(depositInput) <= 0) {
                                                alert('请先输入有效的存款金额');
                                                return;
                                            }
                                            const success = await requestTokenApproval(depositInput);
                                            if (success) {
                                                // 授权成功后提示用户等待
                                                alert('🎉 授权成功！\n\n' +
                                                    '⏳ 请等待15-30秒让授权交易在区块链上确认，\n' +
                                                    '然后您就可以进行存款操作了。\n\n' +
                                                    '💡 提示：您可以点击"刷新"按钮更新状态，\n' +
                                                    '或使用"检查授权状态"确认授权是否生效。');
                                            }
                                        }}
                                        disabled={loading || !depositInput}
                                        style={{ backgroundColor: '#4CAF50', color: 'white' }}
                                    >
                                        🔐 一键授权
                                    </button>

                                    <button
                                        className="quick-btn"
                                        onClick={async () => {
                                            // 检查具体金额的授权状态
                                            const checkAmount = depositInput || '1';
                                            const approvalResult = await isApproved(userAddress, checkAmount);
                                            
                                            let statusMessage = `📊 授权状态检查结果\n\n`;
                                            statusMessage += `检查金额: ${checkAmount} Token\n`;
                                            statusMessage += `当前授权额度: ${formatUnits(approvalResult.currentAllowance, 18)} Token\n`;
                                            statusMessage += `授权是否足够: ${approvalResult.approved ? '✅ 是' : '❌ 否'}\n\n`;
                                            
                                            if (approvalResult.approved) {
                                                statusMessage += `✅ 授权充足，可以进行 ${checkAmount} Token 的存款操作。`;
                                            } else {
                                                const needed = formatUnits(approvalResult.requiredAmountWei - approvalResult.currentAllowance, 18);
                                                statusMessage += `❌ 授权不足\n\n`;
                                                statusMessage += `还需授权: ${needed} Token\n\n`;
                                                statusMessage += `建议操作: 点击"一键授权"进行授权`;
                                            }
                                            
                                            alert(statusMessage);
                                            
                                            if (!approvalResult.approved) {
                                                const shouldShowGuide = window.confirm(
                                                    '是否查看详细的授权指导？'
                                                );
                                                if (shouldShowGuide) {
                                                    showApprovalGuide();
                                                }
                                            }
                                        }}
                                        style={{ fontSize: '12px' }}
                                    >
                                        🔍 检查授权状态
                                    </button>

                                    <button
                                        className="quick-btn"
                                        onClick={diagnoseNetworkIssue}
                                        style={{ fontSize: '12px', backgroundColor: '#FF5722', color: 'white' }}
                                    >
                                        🌐 网络诊断
                                    </button>

                                    <button
                                        className="quick-btn"
                                        onClick={diagnoseApprovalIssues}
                                        style={{ fontSize: '12px', backgroundColor: '#9C27B0', color: 'white' }}
                                    >
                                        🔍 高级诊断
                                    </button>
                                </div>
                                <p className="helper-text">
                                    当前Token余额: {tokenBalance} Token
                                </p>
                            </div>
                        </section>

                        {/* 通过签名存款区域 */}
                        <section className="operation-section">
                            <div className="operation-card">
                                <h3>通过签名存款到TokenBank</h3>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        placeholder="请输入存款金额"
                                        value={permitAmount}
                                        onChange={(e) => setPermitAmount(e.target.value)}
                                        className="amount-input"
                                        min="0"
                                        step="0.01"
                                    />
                                    <span className="input-unit">Token</span>
                                </div>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        placeholder="截止时间戳(可选，默认1小时后过期)"
                                        value={permitDeadline}
                                        onChange={(e) => setPermitDeadline(e.target.value)}
                                        className="amount-input"
                                    />
                                    <span className="input-unit">Unix时间戳</span>
                                </div>
                                <div className="helper-buttons">
                                    <button 
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline((Math.floor(Date.now() / 1000) + 3600).toString())}
                                    >
                                        1小时后
                                    </button>
                                    <button 
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline((Math.floor(Date.now() / 1000) + 86400).toString())}
                                    >
                                        1天后
                                    </button>
                                    <button 
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline((Math.floor(Date.now() / 1000) + 604800).toString())}
                                    >
                                        1周后
                                    </button>
                                    <button 
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline('')}
                                    >
                                        清除
                                    </button>
                                </div>
                                <div className="timestamp-info">
                                    <small>当前时间戳: {Math.floor(Date.now() / 1000)}</small>
                                    {permitDeadline && (
                                        <small>
                                            过期时间: {new Date(parseInt(permitDeadline) * 1000).toLocaleString()}
                                        </small>
                                    )}
                                </div>
                                <button
                                    className="action-btn deposit-btn"
                                    onClick={handlePermitDeposit}
                                    disabled={loading || !permitAmount}
                                >
                                    {loading ? '处理中...' : '签名存款'}
                                </button>
                                <div className="helper-text">
                                    <p><strong>工作原理：</strong>点击按钮后，系统将通过EIP-712标准请求钱包生成签名。</p>
                                    <p>签名包含存款金额、截止时间和用户nonce等信息，由钱包安全生成。</p>
                                    <p>这种方式无需预先授权代币，更加安全便捷。</p>
                                    <p className="warning-text">
                                        <strong>注意：</strong>请确保您使用的是支持EIP-712签名的现代钱包（如MetaMask）。
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 取款区域 */}
                        <section className="operation-section">
                            <div className="operation-card">
                                <h3>从TokenBank取款</h3>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        placeholder="请输入取款金额"
                                        value={withdrawInput}
                                        onChange={(e) => setWithdrawInput(e.target.value)}
                                        className="amount-input"
                                        min="0"
                                        step="0.01"
                                    />
                                    <span className="input-unit">Token</span>
                                </div>
                                <button
                                    className="action-btn withdraw-btn"
                                    onClick={handleWithdraw}
                                    disabled={loading || !withdrawInput}
                                >
                                    {loading ? '处理中...' : '取款'}
                                </button>
                                <p className="helper-text">
                                    可取款金额: {tokenbankBalance} Token
                                </p>
                            </div>
                        </section>

                        {/* 快捷操作按钮 */}
                        <section className="quick-actions">
                            <h3>快捷操作</h3>
                            <div className="quick-buttons">
                                <button
                                    className="quick-btn"
                                    onClick={() => setDepositInput(tokenBalance)}
                                >
                                    存入全部余额
                                </button>
                                <button
                                    className="quick-btn"
                                    onClick={() => setWithdrawInput(tokenbankBalance)}
                                >
                                    取出全部存款
                                </button>
                                <button
                                    className="quick-btn"
                                    onClick={async () => {
                                        if (parseFloat(tokenBalance) <= 0) {
                                            alert('您的 Token 余额为 0，无法授权');
                                            return;
                                        }
                                        await requestTokenApproval(tokenBalance);
                                    }}
                                    disabled={loading || parseFloat(tokenBalance) <= 0}
                                    style={{ backgroundColor: '#FF9800', color: 'white' }}
                                >
                                    🔐 授权全部余额
                                </button>
                                <button
                                    className="quick-btn"
                                    onClick={() => {
                                        setDepositInput('');
                                        setWithdrawInput('');
                                    }}
                                >
                                    清空输入
                                </button>
                            </div>
                        </section>

                        {/* 交易状态显示 */}
                        {loading && (
                            <section className="status-section">
                                <div className="status-card">
                                    <div className="loading-spinner"></div>
                                    <p>交易处理中，请稍候...</p>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>

            <footer className="app-footer">
                <p>TokenBank DApp - 安全的代币存取服务</p>
            </footer>
        </div>
    );
};

export default App;