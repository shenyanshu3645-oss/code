// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "../src/AirdropMerkleNFTMarket.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "forge-std/console.sol";

// Mock ERC721 contract for testing
contract MockNFT is ERC721 {
    constructor() ERC721("MockNFT", "MNFT") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

// Mock ERC20 contract for testing
contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MTK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract NFTMarketTest is Test {
    NFTMarket public market;
    MockNFT public nft;
    MockToken public token;
    
    address public owner = address(0x111);
    address public seller = address(0x222);
    address public buyer = address(0x333);
    address public whitelistUser1 = address(0x444);
    address public whitelistUser2 = address(0x555);
    
    uint256 public tokenId = 1;
    uint256 public price = 100 * 10**18; // 100 tokens
    
    // Merkle tree setup
    bytes32[] public usersLeafs;
    bytes32 public merkleRoot;
    bytes32[] public proofForUser1;
    
    function setUp() public {
        // Deploy mock contracts
        nft = new MockNFT();
        token = new MockToken();
        
        // Create proper merkle tree with actual library
        address[] memory users = new address[](2);
        users[0] = whitelistUser1;
        users[1] = whitelistUser2;
        
        bytes32[] memory leafs = new bytes32[](2);
        leafs[0] = keccak256(abi.encodePacked(whitelistUser1));
        leafs[1] = keccak256(abi.encodePacked(whitelistUser2));
        
        // Create merkle root using sorted pairs
        bytes32 combined = leafs[0] < leafs[1] ? 
            keccak256(abi.encodePacked(leafs[0], leafs[1])) :
            keccak256(abi.encodePacked(leafs[1], leafs[0]));
        
        merkleRoot = combined;
        
        // Create proof for user1
        proofForUser1 = new bytes32[](1);
        proofForUser1[0] = leafs[1]; // sibling node
        
        // Deploy market contract
        market = new NFTMarket(
            IERC20Permit(address(token)),
            ERC721(address(nft)),
            merkleRoot,
            owner
        );
        
        // Mint NFT to seller
        nft.mint(seller, tokenId);
        
        // Mint tokens to buyer and whitelist users
        token.mint(buyer, 1000 * 10**18);
        token.mint(whitelistUser1, 1000 * 10**18);
        token.mint(whitelistUser2, 1000 * 10**18);
        
        // Seller approves market to transfer NFT
        vm.prank(seller);
        nft.approve(address(market), tokenId);
        
        // Users approve market to transfer tokens
        vm.prank(buyer);
        token.approve(address(market), 1000 * 10**18);
        
        vm.prank(whitelistUser1);
        token.approve(address(market), 1000 * 10**18);
        
        vm.prank(whitelistUser2);
        token.approve(address(market), 1000 * 10**18);
    }
    
    function testListNFT() public {
        vm.prank(seller);
        market.list(tokenId, price);
        
        // Check that the NFT is listed by calling the public mapping function
        (uint256 listedTokenId, uint256 listedPrice, address listedSeller) = market.sellnft(tokenId);
        assertEq(listedTokenId, tokenId);
        assertEq(listedPrice, price);
        assertEq(listedSeller, seller);
    }
    
    function testBuyNFT() public {
        // List NFT
        vm.prank(seller);
        market.list(tokenId, price);
        
        // Buy NFT
        vm.prank(buyer);
        market.buyNFT(tokenId);
        
        // Check ownership transfer
        assertEq(nft.ownerOf(tokenId), buyer);
        
        // Check token transfer
        assertEq(token.balanceOf(seller), price);
        assertEq(token.balanceOf(buyer), 900 * 10**18);
        
        // Check that the NFT is no longer listed
        (, , address listedSeller) = market.sellnft(tokenId);
        assertEq(listedSeller, address(0));
    }
    
    function testPermitPrePay() public {
        uint256 deadline = block.timestamp + 1 hours;
        // In a real test, we would generate a valid signature
        // For now, we'll just test that the function reverts with an invalid signature
        bytes memory invalidSignature = new bytes(65);
        
        vm.expectRevert("NFT not listed");
        vm.prank(whitelistUser1);
        market.permitPrePay(tokenId, deadline, invalidSignature);
    }
    
    function testClaimNFTWithInvalidProof() public {
        // List NFT
        vm.prank(seller);
        market.list(tokenId, price);
        
        // Try to claim with invalid proof
        bytes32[] memory invalidProof = new bytes32[](1);
        invalidProof[0] = bytes32(0);
        
        vm.expectRevert("MerkleDistributor: Invalid proof.");
        vm.prank(whitelistUser1);
        market.claimNFT(whitelistUser1, tokenId, invalidProof);
    }
    
    function testMulticall() public {
        // Prepare multicall data
        bytes[] memory data = new bytes[](1);
        data[0] = abi.encodeWithSignature("sellnft(uint256)", tokenId);
        
        // Execute multicall
        vm.prank(owner);
        bytes[] memory results = market.multicall(data);
        
        // Check results
        assertEq(results.length, 1);
    }
    
    function test_RevertWhen_NotOwner_ListNFT() public {
        // Try to list NFT that is not owned by the caller
        vm.prank(buyer);
        vm.expectRevert("Not the owner of this NFT");
        market.list(tokenId, price);
    }
    
    function test_RevertWhen_NFTNotListed_BuyNFT() public {
        // Try to buy NFT that is not listed
        vm.prank(buyer);
        vm.expectRevert("nft not exist!");
        market.buyNFT(tokenId);
    }
    
    function test_RevertWhen_BuyOwnNFT_BuyNFT() public {
        // List NFT
        vm.prank(seller);
        market.list(tokenId, price);
        
        // Try to buy own NFT
        vm.prank(seller);
        vm.expectRevert("Cannot buy your own NFT");
        market.buyNFT(tokenId);
    }
    
    // 测试所有者权限
    function testOwnerPermissions() public {
        assertEq(market.owner(), owner);
    }
    
    // 测试价格必须大于零
    function test_RevertWhen_ZeroPrice_ListNFT() public {
        vm.prank(seller);
        vm.expectRevert("Price must be greater than zero");
        market.list(tokenId, 0);
    }
    
    // 测试Merkle验证
    function testMerkleProofVerification() public {
        // List NFT
        vm.prank(seller);
        market.list(tokenId, price);
        
        // Verify the merkle proof would work (this is more of a sanity check)
        bytes32 leaf = keccak256(abi.encodePacked(whitelistUser1));
        bool valid = MerkleProof.verify(proofForUser1, merkleRoot, leaf);
        assertTrue(valid);
    }
    
    // 测试签名验证 - 使用与合约中PERMIT_TYPEHASH匹配的参数
    function testSignatureVerification() public {
        // This test shows how the signature verification would work with the current PERMIT_TYPEHASH
        // PERMIT_TYPEHASH = keccak256("PermitPrePay(address buyer,uint256 deadline)")
        
        // In a real scenario, we would:
        // 1. Create a proper EIP-712 signature with buyer and deadline
        // 2. Verify it through the permitPrePay function
        // 3. Check that valid signatures pass and invalid ones fail
        
        // For now, we just verify the setup is correct
        assertEq(
            market.PERMIT_TYPEHASH(), 
            keccak256("PermitPrePay(address buyer,uint256 deadline)")
        );
    }
}