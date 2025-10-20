import { keccak256, encodePacked } from 'viem';
import { MerkleTree } from "merkletreejs";

// 白名单地址（与合约中使用的相同）
const users = [
    "0x2B472592c4A67f890E823eb741942fce2ae474C1",
    "0xf6E14B5b166AeA7b02a1a77e88b14402fFE39e4D",
    "0x9d5cc9928CDb4eB943e2e716aa1c54c6c6eD2eFE"
];

// 生成Merkle树元素（使用viem的哈希函数）
const elements = users.map((x) =>
    keccak256(encodePacked(["address"], [x]))
);

// 创建Merkle树（使用viem的哈希函数）
const merkleTree = new MerkleTree(elements, keccak256, { sort: true });

// 获取Merkle根
const root = merkleTree.getHexRoot();
console.log("Generated Merkle Root:", root);

// 合约中使用的Merkle根
const contractMerkleRoot = "0xe77be144a7bde76710475a0d5db55211215dad96ea268f4b33a06cf3c3a82ce7";
console.log("Contract Merkle Root: ", contractMerkleRoot);

// 验证是否一致
if (root.toLowerCase() === contractMerkleRoot.toLowerCase()) {
    console.log("✓ Merkle根一致");
} else {
    console.log("✗ Merkle根不一致");
}

// 为第一个用户生成证明作为示例
const leaf = elements[0];
const proof = merkleTree.getHexProof(leaf);
console.log("Proof for first user:", proof);
console.log("Proof length:", proof.length);

export { merkleTree, users, elements, root };