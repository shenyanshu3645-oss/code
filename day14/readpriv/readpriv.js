const { createPublicClient, http, keccak256, encodePacked } = require('viem');
const { sepolia } = require('viem/chains');

async function readLocks() {
  const client = createPublicClient({
    chain: sepolia,
    transport: http("https://sepolia.infura.io/v3/96cccf096cc34e82a7f6a132994f4898")
  });

  const contractAddress = '0xE79dEf4De8F9abb5B4eE3CB9E16714f8d2669024';

  // 读取数组长度
  const lengthSlot = await client.getStorageAt({ address: contractAddress, slot: '0x0' });
  const length = lengthSlot ? BigInt(lengthSlot) : 0n;
  console.log('Found', length.toString(), 'locks');

  // 计算数组起始槽
  const startSlot = keccak256(encodePacked(['uint256'], [0n]));

  console.log('Starting from slot', startSlot);
  
  const locks = [];
  for (let i = 0; i < Number(length); i++) {
    const base = BigInt(startSlot) + BigInt(i * 2);
    
    const [slot1, slot2] = await Promise.all([
      client.getStorageAt({ address: contractAddress, slot: `0x${base.toString(16)}` }),
      client.getStorageAt({ address: contractAddress, slot: `0x${(base + 1n).toString(16)}` })
    ]);
    
    if (slot1 && slot2) {
      const slot1Val = BigInt(slot1);
      locks.push({
        user: `0x${slot1.slice(-40)}`,
        startTime: (slot1Val >> 160n) & BigInt("0xFFFFFFFFFFFFFFFF"),
        amount: BigInt(slot2)
      });
    }
  }
  
  return locks;
}

readLocks().then(locks => {
  console.log('All locks:', locks);
}).catch(console.error);