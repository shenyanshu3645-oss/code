# TokenBank DApp 前端界面

这是一个基于 React + TypeScript 的 TokenBank DApp 前端界面，用于与 TokenBank 智能合约进行交互。

## 功能特性

### 🎯 主要功能
- **Token余额显示**: 实时显示用户当前的Token余额
- **存款功能**: 支持将Token存入TokenBank合约
- **取款功能**: 支持从TokenBank合约中取出已存款的Token
- **已存款余额**: 显示用户在TokenBank中的存款金额

### 🎨 界面特性
- **现代化设计**: 使用渐变背景和毛玻璃效果
- **响应式布局**: 支持桌面端和移动端设备
- **交互反馈**: 按钮悬停效果和加载状态
- **快捷操作**: 一键存入/取出全部金额
- **实时状态**: 显示交易处理状态

## 项目结构

```
frontend/
├── public/
│   └── index.html          # HTML模板
├── src/
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 主样式文件
│   ├── index.tsx          # 应用入口
│   └── index.css          # 全局样式
├── package.json           # 项目依赖
├── tsconfig.json          # TypeScript配置
└── README.md             # 项目说明
```

## 安装和运行

### 1. 安装依赖
```bash
cd frontend
npm install
```

### 2. 启动开发服务器
```bash
npm start
```

应用将在 `http://localhost:3000` 上运行。

### 3. 构建生产版本
```bash
npm run build
```

## 组件说明

### App.tsx
主应用组件，包含以下功能区域：

#### 🔗 钱包连接区域
- 连接/断开钱包按钮
- 显示当前连接的钱包地址
- 刷新余额按钮

#### 💰 余额显示区域
- **Token余额卡片**: 显示用户钱包中的Token数量
- **已存款金额卡片**: 显示在TokenBank中的存款数量

#### 📥 存款操作区域
- 存款金额输入框
- 存款按钮
- 当前余额提示

#### 📤 取款操作区域
- 取款金额输入框
- 取款按钮
- 可取款金额提示

#### ⚡ 快捷操作区域
- 存入全部余额按钮
- 取出全部存款按钮
- 清空输入按钮

#### 📊 状态显示区域
- 交易处理中的加载动画
- 交易状态提示

## 样式设计

### 设计理念
- **渐变背景**: 使用紫色到蓝色的渐变营造科技感
- **毛玻璃效果**: 卡片使用半透明背景和模糊效果
- **绿色主题**: 存款相关使用绿色，表示增长和安全
- **橙色主题**: 取款相关使用橙色，表示提醒和操作

### 响应式设计
- **桌面端**: 双列布局，最大宽度1200px
- **平板端**: 单列布局，保持卡片间距
- **移动端**: 紧凑布局，垂直排列所有元素

## 待实现功能

以下函数框架已准备好，需要后续添加Web3集成：

### 🔗 钱包集成
```typescript
const connectWallet = async () => {
  // TODO: 集成MetaMask或其他钱包
  // - 检测钱包是否安装
  // - 请求连接授权
  // - 获取用户地址
  // - 监听账户变化
};
```

### 💰 余额查询
```typescript
const refreshBalances = async () => {
  // TODO: 查询区块链余额
  // - 获取Token合约余额
  // - 获取TokenBank存款余额
  // - 更新状态显示
};
```

### 📥 存款功能
```typescript
const handleDeposit = async () => {
  // TODO: 执行存款交易
  // - 检查Token授权
  // - 调用TokenBank.deposit()
  // - 监听交易状态
  // - 更新余额显示
};
```

### 📤 取款功能
```typescript
const handleWithdraw = async () => {
  // TODO: 执行取款交易
  // - 调用TokenBank.withdraw()
  // - 监听交易状态
  // - 更新余额显示
};
```

## 集成建议

### Web3库推荐
- **ethers.js**: 轻量级Web3库
- **web3.js**: 传统Web3库
- **wagmi**: React hooks for Ethereum

### 状态管理
- **React Context**: 简单的全局状态管理
- **Redux Toolkit**: 复杂应用状态管理
- **Zustand**: 轻量级状态管理

### 错误处理
建议添加以下错误处理机制：
- 网络连接错误
- 交易失败处理
- 用户拒绝交易
- 余额不足提示
- 合约调用错误

## 安全注意事项

1. **输入验证**: 确保用户输入的金额有效
2. **交易确认**: 显示交易详情供用户确认
3. **错误提示**: 清晰的错误信息和解决建议
4. **加载状态**: 防止重复提交交易
5. **余额检查**: 交易前验证用户余额

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 许可证

MIT License