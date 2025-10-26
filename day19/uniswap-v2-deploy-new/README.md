# Uniswap V2 本地部署

这个项目提供了一个在本地环境中部署 Uniswap V2 合约的解决方案。

## 项目结构

```
.
├── lib/
│   ├── forge-std/          # Foundry 标准库
│   ├── v2-core/            # Uniswap V2 核心合约
│   ├── v2-periphery/       # Uniswap V2 外围合约
│   └── uniswap-lib/        # Uniswap 工具库
├── script/
│   └── Counter.s.sol       # 部署脚本
└── foundry.toml            # Foundry 配置文件
```

## 部署步骤

1. 确保已安装 Foundry 工具链
2. 克隆项目并安装依赖
3. 运行部署脚本

### 安装 Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 克隆项目

```bash
git clone <repository-url>
cd uniswap-v2-deploy-new
```

### 安装依赖

```bash
git submodule update --init --recursive
```

### 编译合约

```bash
forge build
```

### 部署合约

由于Uniswap V2官方合约使用了不同版本的Solidity编译器（0.5.16和0.6.6），直接部署可能会遇到版本兼容性问题。为了解决这个问题，我们提供了以下两种部署方案：

#### 方案一：使用兼容的Solidity版本部署脚本

创建一个使用Solidity 0.6.12版本的部署脚本（这是系统上安装的版本）：

1. 创建一个新的部署脚本文件，例如 `UniswapV2Deploy.s.sol`
2. 在脚本中使用 `pragma solidity =0.6.12;`
3. 导入并部署官方合约

#### 方案二：使用Docker容器部署

使用包含正确Solidity版本的Docker容器来部署合约：

```bash
# 使用包含Solidity 0.5.16和0.6.6的Docker镜像
docker run -v $PWD:/contract -it ghcr.io/foundry-rs/foundry:nightly forge build
```

## 官方合约说明

本项目使用了以下官方Uniswap V2合约：

- **v2-core**: 包含核心的Uniswap V2工厂合约和交易对合约
- **v2-periphery**: 包含路由器合约和其他外围合约
- **uniswap-lib**: 包含工具库和辅助函数

## 注意事项

1. 由于Solidity版本兼容性问题，直接部署官方合约可能需要特殊配置
2. 生产环境请使用官方的Uniswap V2合约
3. 部署时请确保使用正确的网络配置

## 许可证

本项目采用 MIT 许可证。