import { toHex, encodePacked, keccak256 } from 'viem';
import { MerkleTree } from "merkletreejs";

const users = [
    "0x2B472592c4A67f890E823eb741942fce2ae474C1",
    "0xf6E14B5b166AeA7b02a1a77e88b14402fFE39e4D",
    "0x9d5cc9928CDb4eB943e2e716aa1c54c6c6eD2eFE"
];

// equal to MerkleDistributor.sol #keccak256(abi.encodePacked(account, amount));
const elements = users.map((x) =>
    keccak256(encodePacked(["address"], [/** @type {`0x${string}`} */(x)]))
);

console.log(elements);

const merkleTree = new MerkleTree(elements, keccak256, { sort: true });

const root = merkleTree.getHexRoot();
console.log("root:" + root);

const leaf = elements[1];
console.log("leaf:" + leaf);
const proof = merkleTree.getHexProof(leaf);
console.log("proof:" + proof);


// 0xa8532aAa27E9f7c3a96d754674c99F1E2f824800, 30, [0xd24d002c88a75771fc4516ed00b4f3decb98511eb1f7b968898c2f454e34ba23,0x4e48d103859ea17962bdf670d374debec88b8d5f0c1b6933daa9eee9c7f4365b]

export { merkleTree, users, elements };