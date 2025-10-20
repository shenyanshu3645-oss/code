// 格式化代币金额
export const formatTokenAmount = (amount: string | bigint, decimals: number = 18): string => {
  // TODO: 实现金额格式化逻辑
  return amount.toString();
};

// 解析代币金额
export const parseTokenAmount = (amount: string, decimals: number = 18): bigint => {
  // TODO: 实现金额解析逻辑
  return BigInt(0);
};

// 格式化地址显示
export const formatAddress = (address: string, startLength: number = 6, endLength: number = 4): string => {
  if (!address || address.length < startLength + endLength) {
    return address;
  }
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
};