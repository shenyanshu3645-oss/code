import React, { useState, useEffect, useRef, FC } from 'react';
import './App.css';
import { createPublicClient, createWalletClient, custom, formatUnits, http, hexToSignature } from 'viem';
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

const App: FC<TokenBankProps> = () => {


    // 状态管理
    const [tokenBalance, setTokenBalance] = useState<string>('0');
    const [tokenbankBalance, setTokenbankBalance] = useState<string>('0');
    const [depositInput, setDepositInput] = useState<string>('');
    const [withdrawInput, setWithdrawInput] = useState<string>('');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [userAddress, setUserAddress] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    // 添加permitDeposit相关的状态
    const [permitAmount, setPermitAmount] = useState<string>('');
    const [permitDeadline, setPermitDeadline] = useState<string>('');

    // 添加Permit2相关的状态
    const [permit2Amount, setPermit2Amount] = useState<string>('');
    const [permit2Expiration, setPermit2Expiration] = useState<string>('');
    // 移除了permit2Nonce状态变量，因为nonce从Permit2合约获取

    // TODO: 更换为实际部署的合约地址
    const TOKEN_BANK_ADDRESS = "0x957907F8ce78560B3dFeC943E6768A48E97e0523" as `0x${string}`; // TokenBank合约地址
    const TOKEN_ADDRESS = "0xe7F07a03404AF7b5d205Ec15b09474c0AA664Be5" as `0x${string}`; // ERC20代币合约地址 (正确的MyToken地址)


    // 使用useState来管理ABI加载状态
    const [tokenBankABI, setTokenBankABI] = useState<any>(null);
    const [tokenABI, setTokenABI] = useState<any>(null);
    const [tokenBankPermitABI, setTokenBankPermitABI] = useState<any>(null);
    const [tokenBankPermit2ABI, setTokenBankPermit2ABI] = useState<any>(null);
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

            // 尝试加载TokenBankPermit2 ABI
            try {
                const permit2ABI = loadABIFromSrc('TokenBankPermit2');
                setTokenBankPermit2ABI(permit2ABI);
                console.log('✅ TokenBankPermit2 ABI loaded:', permit2ABI.length, 'items');
            } catch (err) {
                console.log('ℹ️ TokenBankPermit2 ABI未找到');
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
        // 检查是否加载了TokenBankPermit2 ABI，如果有的话优先使用
        const abiToUse = tokenBankPermit2ABI || tokenBankPermitABI || tokenBankABI;

        if (!abiToUse || !abiLoaded) {
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
            console.log('使用的ABI类型:', tokenBankPermit2ABI ? 'TokenBankPermit2' : tokenBankPermitABI ? 'TokenBankPermit' : 'TokenBank');

            // 使用publicClient的readContract方法 - 正确的viem v2语法
            // 先尝试使用getDeposit函数
            try {
                const balance = await (publicClient as any).readContract({
                    address: TOKEN_BANK_ADDRESS,
                    abi: abiToUse,
                    functionName: 'getDeposit',
                    args: [userAddress as `0x${string}`]
                });

                console.log('通过getDeposit查询到的原始余额:', balance);

                // 转换为eth格式
                const formattedBalance = formatUnits(balance as bigint, 18);
                console.log('格式化后的余额:', formattedBalance);

                return formattedBalance;
            } catch (getError) {
                console.warn('getDeposit函数调用失败，尝试使用deposits映射:', getError);

                // 如果getDeposit失败，尝试直接读取deposits映射
                const balance = await (publicClient as any).readContract({
                    address: TOKEN_BANK_ADDRESS,
                    abi: abiToUse,
                    functionName: 'deposits',
                    args: [userAddress as `0x${string}`]
                });

                console.log('通过deposits映射查询到的原始余额:', balance);

                // 转换为eth格式
                const formattedBalance = formatUnits(balance as bigint, 18);
                console.log('格式化后的余额:', formattedBalance);

                return formattedBalance;
            }

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
                alert('✅ 授权成功！\n\n' +
                    '⏳ 请等待15-30秒让授权交易在区块链上确认，\n' +
                    '然后您就可以进行存款操作了。\n\n' +
                    '💡 提示：您可以点击"刷新"按钮更新状态，\n' +
                    '或使用"检查授权状态"确认授权是否生效。');
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
        let deadlineTime = BigInt(0);
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

            deadlineTime = BigInt(deadlineNum);
        } else {
            // 默认设置为1小时后过期
            deadlineTime = BigInt(Math.floor(Date.now() / 1000) + 3600);
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

            // 确定使用的ABI
            const abiToUse = tokenBankPermitABI || tokenBankABI;
            console.log('使用的ABI类型:', tokenBankPermitABI ? 'TokenBankPermit' : 'TokenBank');

            // 生成EIP-712签名数据
            alert('请在钱包中完成签名授权...');

            // 使用viem的signTypedData方法生成EIP-712签名
            const domain = {
                name: 'MyToken', // 需要与代币合约名称一致
                version: '1',
                chainId: 11155111, // Sepolia测试网
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

            // 获取nonce值
            let nonceValue = BigInt(0);
            try {
                const publicClient = createPublicClient({
                    chain: sepolia,
                    transport: http()
                });

                const nonceResult: any = await (publicClient as any).readContract({
                    address: TOKEN_ADDRESS,
                    abi: tokenABI,
                    functionName: 'nonces',
                    args: [userAddress as `0x${string}`]
                });

                nonceValue = BigInt(nonceResult);
                console.log('获取到的nonce值:', nonceValue.toString());
            } catch (nonceError) {
                console.warn('获取nonce失败，使用默认值0:', nonceError);
            }

            // 生成签名
            const signature = await walletClientRef.current.signTypedData({
                domain,
                types,
                primaryType: 'Permit',
                message: {
                    owner: userAddress,
                    spender: TOKEN_BANK_ADDRESS,
                    value: amountInWei.toString(),
                    nonce: nonceValue.toString(),
                    deadline: deadlineTime.toString(),
                },
                account: userAddress as `0x${string}`,
            });

            // 分解签名
            const { v, r, s } = hexToSignature(signature);

            // 调用合约的permitDeposit方法
            const hash = await walletClientRef.current.writeContract({
                address: TOKEN_BANK_ADDRESS,
                abi: abiToUse,
                functionName: 'permitDeposit',
                args: [amountInWei, deadlineTime, v, r, s],
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
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            if (error.message?.includes('User denied transaction') || error.code === 4001) {
                alert('❌ 您拒绝了签名存款交易。');
            } else if (error.message?.includes('insufficient funds') || error.code === -32000) {
                alert('❌ Gas 费用不足，请确保钱包中有足够的 ETH 支付交易费用。');
            } else if (error.message?.includes('execution reverted')) {
                alert('❌ 合约执行失败，请检查：\n1. 合约地址是否正确\n2. 网络是否为 Sepolia 测试网\n3. 合约是否已正确部署');
            } else if (error.message?.includes('network')) {
                alert('❌ 网络连接错误，请检查网络连接并确认切换到 Sepolia 测试网。');
            } else if (error.message?.includes('account')) {
                alert('❌ 钱包账户错误，请重新连接钱包。');
            } else {
                alert(`❌ 签名存款失败: ${error.message || '未知错误'}

请检查：
1. 钱包是否连接到 Sepolia 测试网
2. 账户余额是否足够
3. 合约地址是否正确`);
            }
        } finally {
            setLoading(false);
        }
    };

    // 添加通过Permit2签名存款的函数
    const handlePermit2Deposit = async () => {
        console.log('开始处理Permit2签名存款，输入参数:', { permit2Amount, permit2Expiration });

        // 检查输入值
        if (!permit2Amount || permit2Amount.trim() === '') {
            alert('请输入存款金额');
            return;
        }

        const amountNum = parseFloat(permit2Amount);
        console.log('解析的金额数值:', amountNum);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert('请输入有效的存款金额（大于0的数字）');
            return;
        }

        // 验证截止时间（如果提供了的话）
        let expirationTime = BigInt(0);
        if (permit2Expiration && permit2Expiration.trim() !== '') {
            const expirationNum = parseInt(permit2Expiration, 10);
            console.log('解析的过期时间数值:', expirationNum);
            if (isNaN(expirationNum)) {
                alert('过期时间格式错误，请输入有效的时间戳（Unix时间戳）');
                return;
            }

            const currentTime = Math.floor(Date.now() / 1000);
            console.log('当前时间戳:', currentTime, '输入的过期时间:', expirationNum);
            if (expirationNum <= currentTime) {
                alert(`过期时间必须是未来时间，当前时间戳：${currentTime}`);
                return;
            }

            expirationTime = BigInt(expirationNum);
        } else {
            // 默认设置为1小时后过期
            expirationTime = BigInt(Math.floor(Date.now() / 1000) + 3600);
        }

        console.log('最终使用的过期时间戳:', expirationTime.toString());

        // 检查连接状态 - 修正检查逻辑，逐一检查每个必要条件
        if (!isConnected) {
            alert('请先连接钱包');
            return;
        }

        if (!userAddress) {
            alert('请先连接钱包');
            return;
        }

        if (!walletClientRef.current) {
            alert('钱包客户端未初始化，请重新连接钱包');
            return;
        }

        if (!abiLoaded) {
            alert('ABI加载中，请稍候...');
            return;
        }

        if (!tokenBankPermit2ABI) {
            alert('TokenBank Permit2 ABI未加载，请刷新页面重试');
            return;
        }

        try {
            setLoading(true);

            // 转换存款金额
            let amountInWei: bigint;
            try {
                console.log('开始转换存款金额，输入值:', permit2Amount);
                amountInWei = parseTokenAmount(permit2Amount);
                console.log('转换后的Wei金额:', amountInWei.toString());
                if (amountInWei <= BigInt(0)) {
                    throw new Error('金额转换结果无效');
                }
            } catch (parseError: any) {
                console.error('金额转换失败:', parseError);
                throw new Error('存款金额格式错误，请输入有效的数字');
            }

            // 确保amount是uint160类型 (最大值为2^160 - 1)
            const amountAsUint160 = amountInWei > BigInt(2 ** 160 - 1) ? BigInt(2 ** 160 - 1) : amountInWei;


            // 从Permit2合约获取nonce值 - 使用nonceBitmap函数
            let nonceValue = BigInt(0);
            try {
                console.log('从Permit2合约获取nonce值...');
                console.log('用户地址:', userAddress);
                console.log('Permit2合约地址:', '0x000000000022D473030F116dDEE9F6B43aC78BA3');

                const publicClient = createPublicClient({
                    chain: sepolia,
                    transport: http()
                });

                // 使用Permit2合约的nonceBitmap函数获取nonce值
                console.log('尝试使用nonceBitmap函数获取nonce...');
                // 首先获取bitmap
                const nonceBitmap: any = await (publicClient as any).readContract({
                    address: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
                    abi: [
                        {
                            "inputs": [
                                {
                                    "internalType": "address",
                                    "name": "owner",
                                    "type": "address"
                                },
                                {
                                    "internalType": "uint256",
                                    "name": "wordPos",
                                    "type": "uint256"
                                }
                            ],
                            "name": "nonceBitmap",
                            "outputs": [
                                {
                                    "internalType": "uint256",
                                    "name": "",
                                    "type": "uint256"
                                }
                            ],
                            "stateMutability": "view",
                            "type": "function"
                        }
                    ],
                    functionName: 'nonceBitmap',
                    args: [userAddress as `0x${string}`, BigInt(0)] // wordPos通常从0开始
                });

                console.log('获取到的nonceBitmap值:', nonceBitmap.toString());

                // 从bitmap中找到第一个未使用的nonce值
                // 这里我们简单地使用bitmap中最低位的0作为nonce值
                const bitmap = BigInt(nonceBitmap);
                let nonce = BigInt(0);

                // 找到第一个未设置的位（即值为0的位）
                while ((bitmap >> nonce) & BigInt(1)) {
                    nonce++;
                }

                nonceValue = nonce;
                console.log('从bitmap计算出的nonce值:', nonceValue.toString());
            } catch (nonceError: any) {
                console.error('获取nonce值时出错:', nonceError);
                console.error('错误详情:', {
                    name: nonceError.name,
                    message: nonceError.message,
                    code: nonceError.code,
                    stack: nonceError.stack
                });

                // 如果获取nonce失败，使用默认值0
                console.warn('获取nonce失败，使用默认值0');
                nonceValue = BigInt(0);
            }

            // 构建PermitTransferFrom结构
            // 直接使用用户输入的时间
            const currentTime = Math.floor(Date.now() / 1000);
            console.log('当前时间戳:', currentTime);
            console.log('用户输入的过期时间戳:', expirationTime.toString());

            console.log('当前区块时间:', currentTime);
            console.log('过期时间:', expirationTime.toString());
            console.log('使用的nonce值:', nonceValue.toString());

            // 请求钱包签名前，先确保用户已授权Permit2合约转移代币
            try {
                console.log('检查用户是否已授权Permit2合约...');
                const publicClient = createPublicClient({
                    chain: sepolia,
                    transport: http()
                });

                // 查询用户对Permit2合约的授权额度
                const permit2AllowanceAny: any = await (publicClient as any).readContract({
                    address: TOKEN_ADDRESS,
                    abi: tokenABI,
                    functionName: 'allowance',
                    args: [userAddress as `0x${string}`, '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`]
                });

                const permit2Allowance = BigInt(permit2AllowanceAny);
                console.log('用户对Permit2合约的授权额度:', permit2Allowance.toString());

                // 如果授权额度不足，需要用户先授权
                if (permit2Allowance < amountAsUint160) {
                    alert('请先授权Permit2合约可以转移您的代币...');
                    // 调用代币合约的approve方法，授权Permit2合约转移代币
                    const approveHash = await walletClientRef.current.writeContract({
                        address: TOKEN_ADDRESS,
                        abi: tokenABI,
                        functionName: 'approve',
                        args: ['0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`, amountAsUint160],
                    });

                    console.log('授权交易已提交，交易哈希:', approveHash);
                    alert(`✅ 已提交授权交易，请等待确认后再继续...\n交易哈希: ${approveHash}`);

                    // 等待授权交易确认
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (approvalError: any) {
                console.error('检查或设置Permit2授权时出错:', approvalError);
                alert('检查或设置Permit2授权时出错，请确保您已连接钱包并有足够的代币余额。');
                setLoading(false);
                return;
            }

            // 请求钱包签名
            alert('请在钱包中完成Permit2签名授权...');

            // 使用viem的signTypedData方法生成EIP-712签名
            // 首先需要构造EIP-712域分隔符和消息类型
            // 根据新合约的Permit2接口定义
            const domain = {
                name: 'Permit2',
                chainId: 11155111, // Sepolia测试网
                verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`, // Permit2合约地址
            };

            // 根据新合约的Permit2接口定义类型
            // const types = {
            //     PermitTransferFrom: [
            //         { name: 'permitted', type: 'TokenPermissions' },
            //         { name: 'nonce', type: 'uint256' },
            //         { name: 'deadline', type: 'uint256' },
            //     ],
            //     TokenPermissions: [
            //         { name: 'token', type: 'address' },
            //         { name: 'amount', type: 'uint256' },
            //     ],
            // };

            const types = {
                PermitTransferFrom: [
                    { name: 'permitted', type: 'TokenPermissions' },
                    { name: 'spender', type: 'address' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
                TokenPermissions: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                ],
            };

            

            // 构建PermitTransferFrom结构
            // 直接使用用户输入的时间，确保不会使用过去的时间
            console.log('构建签名消息前的参数:', {
                TOKEN_ADDRESS,
                amountInWei: amountInWei.toString(),
                nonceValue: nonceValue.toString(),
                expirationTime: expirationTime.toString()
            });

            const permitTransferFrom = {
                permitted: {
                    token: TOKEN_ADDRESS,
                    amount: amountInWei,
                },
                nonce: nonceValue,
                deadline: expirationTime,
            };

            // 准备调用合约的参数
            // 根据新合约的depositWithPermit2方法签名调整参数结构
            // const permitParam = {
            //     permitted: {
            //         token: TOKEN_ADDRESS,
            //         amount: amountInWei,
            //     },
            //     nonce: nonceValue,
            //     deadline: expirationTime,
            // };

            const message = {
                permitted: {
                    token: TOKEN_ADDRESS,
                    amount: amountInWei.toString(),
                },
                // spender: TOKEN_BANK_ADDRESS,
                nonce: nonceValue,
                deadline: expirationTime,
            };

            console.log('构建的PermitTransferFrom结构:', permitTransferFrom);
            console.log('使用的nonce值:', nonceValue.toString());
            console.log('存款金额(Wei):', amountInWei.toString());
            console.log('存款金额(Token):', formatUnits(amountInWei, 18));
            console.log('使用的deadline时间戳:', expirationTime.toString());

            // 生成签名
            console.log('准备生成EIP-712签名...');
            console.log('签名域:', domain);
            console.log('签名类型:', types);
            console.log('签名消息内容:', permitTransferFrom);

            const signature = await walletClientRef.current.signTypedData({
                // account: userAddress as `0x${string}`,
                domain,
                types,
                primaryType: 'PermitTransferFrom',
                message
            });

            console.log('生成的签名:', signature);

            // 使用之前定义的permitParam

            console.log('准备调用合约的参数:', {
                permit: message,
                signature: signature,
                depositor: userAddress
            });

            // 调用合约的depositWithPermit2方法
            // 确保参数顺序与合约ABI一致
            const hash = await walletClientRef.current.writeContract({
                address: TOKEN_BANK_ADDRESS,
                abi: tokenBankPermit2ABI,
                functionName: 'depositWithPermit2',
                args: [
                    message,     // PermitTransferFrom结构
                    signature,       // 签名
                    userAddress      // depositor地址
                ],
                gas: BigInt(300000), // 设置gas限制，避免超过上限
            });

            console.log('✅ Permit2签名存款交易已提交，交易哈希:', hash);

            // 等待交易确认
            await new Promise(resolve => setTimeout(resolve, 4000));

            alert(`✅ Permit2签名存款成功！

交易哈希: ${hash}

请等待区块链确认后刷新余额。`);

            // 自动刷新余额
            setTimeout(async () => {
                await refreshBalances();
                console.log('✅ 余额已自动刷新');
            }, 2000);

            // 清空输入
            setPermit2Amount('');
            setPermit2Expiration('');

        } catch (error: any) {
            console.error('❌ Permit2签名存款过程出错:', error);
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            if (error.message?.includes('User denied transaction') || error.code === 4001) {
                alert('❌ 您拒绝了Permit2签名存款交易。');
            } else if (error.message?.includes('insufficient funds') || error.code === -32000) {
                alert('❌ Gas 费用不足，请确保钱包中有足够的 ETH 支付交易费用。');
            } else if (error.message?.includes('execution reverted')) {
                alert('❌ 合约执行失败，请检查：\n1. 合约地址是否正确\n2. 网络是否为 Sepolia 测试网\n3. 合约是否已正确部署');
            } else if (error.message?.includes('network')) {
                alert('❌ 网络连接错误，请检查网络连接并确认切换到 Sepolia 测试网。');
            } else if (error.message?.includes('account')) {
                alert('❌ 钱包账户错误，请重新连接钱包。');
            } else {
                alert(`❌ Permit2签名存款失败: ${error.message || '未知错误'}

请检查：
1. 钱包是否连接到 Sepolia 测试网
2. 账户余额是否足够
3. 合约地址是否正确`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>TokenBank</h1>
                <button className="disconnect-btn" onClick={disconnectWallet}>
                    断开钱包
                </button>
                <button className="connect-btn" onClick={connectWallet}>
                    连接钱包
                </button>
            </header>

            <main className="app-main">
                <section className="debug-section">
                    <details>
                        <summary>调试信息</summary>
                        <div className="debug-content">
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
                                            if (!depositInput || parseFloat(depositInput) <= 0) {
                                                alert('请先输入有效的存款金额');
                                                return;
                                            }
                                            // 修复：将checkTokenApproval替换为isApproved
                                            const approvalResult = await isApproved(userAddress, depositInput);

                                            if (approvalResult.approved) {
                                                alert('✅ 授权已生效，您可以进行存款操作了。');
                                            } else {
                                                alert('❌ 授权未生效，请先进行授权。');
                                            }
                                        }}
                                        disabled={loading || !depositInput}
                                        style={{ backgroundColor: '#2196F3', color: 'white' }}
                                    >
                                        🔍 检查授权状态
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
                                </div>
                            </div>

                            {/* 通过签名存款区域 */}
                            <div className="operation-card" style={{ marginTop: '20px' }}>
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
                                <div className="input-group" style={{ marginTop: '10px' }}>
                                    <input
                                        type="number"
                                        placeholder="截止时间 (Unix时间戳，可选)"
                                        value={permitDeadline}
                                        onChange={(e) => setPermitDeadline(e.target.value)}
                                        className="amount-input"
                                        min="0"
                                    />
                                    <span className="input-unit">时间戳</span>
                                </div>
                                {/* 便捷时间选择按钮 */}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline(Math.floor(Date.now() / 1000 + 1800).toString())} // 30分钟后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        30分钟后
                                    </button>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline(Math.floor(Date.now() / 1000 + 3600).toString())} // 1小时后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        1小时后
                                    </button>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline(Math.floor(Date.now() / 1000 + 7200).toString())} // 2小时后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        2小时后
                                    </button>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermitDeadline(Math.floor(Date.now() / 1000 + 86400).toString())} // 24小时后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        24小时后
                                    </button>
                                </div>
                                <button
                                    className="action-btn deposit-btn"
                                    onClick={handlePermitDeposit}
                                    disabled={loading || !permitAmount}
                                    style={{ backgroundColor: '#9C27B0' }}
                                >
                                    {loading ? '处理中...' : '通过签名存款'}
                                </button>
                                <p className="helper-text">
                                    无需预先授权，直接通过签名完成存款
                                </p>
                            </div>

                            {/* 通过Permit2签名存款区域 */}
                            <div className="operation-card" style={{ marginTop: '20px' }}>
                                <h3>通过Permit2签名存款到TokenBank</h3>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        placeholder="请输入存款金额"
                                        value={permit2Amount}
                                        onChange={(e) => setPermit2Amount(e.target.value)}
                                        className="amount-input"
                                        min="0"
                                        step="0.01"
                                    />
                                    <span className="input-unit">Token</span>
                                </div>
                                <div className="input-group" style={{ marginTop: '10px' }}>
                                    <input
                                        type="number"
                                        placeholder="过期时间 (Unix时间戳，可选，默认1小时后)"
                                        value={permit2Expiration}
                                        onChange={(e) => setPermit2Expiration(e.target.value)}
                                        className="amount-input"
                                        min="0"
                                    />
                                    <span className="input-unit">时间戳</span>
                                </div>
                                {/* 便捷时间选择按钮 */}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermit2Expiration(Math.floor(Date.now() / 1000 + 1800).toString())} // 30分钟后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        30分钟后
                                    </button>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermit2Expiration(Math.floor(Date.now() / 1000 + 3600).toString())} // 1小时后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        1小时后
                                    </button>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermit2Expiration(Math.floor(Date.now() / 1000 + 7200).toString())} // 2小时后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        2小时后
                                    </button>
                                    <button
                                        className="quick-btn"
                                        onClick={() => setPermit2Expiration(Math.floor(Date.now() / 1000 + 86400).toString())} // 24小时后
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        24小时后
                                    </button>
                                </div>
                                {/* 移除了nonce输入框，因为我们从Permit2合约获取nonce */}
                                <button
                                    className="action-btn deposit-btn"
                                    onClick={handlePermit2Deposit}
                                    disabled={loading || !permit2Amount}
                                    style={{ backgroundColor: '#673AB7' }}
                                >
                                    {loading ? '处理中...' : '通过Permit2签名存款'}
                                </button>
                                <p className="helper-text">
                                    使用Uniswap Permit2标准进行存款，提供更好的安全性和用户体验
                                </p>
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
