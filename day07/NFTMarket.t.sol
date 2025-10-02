// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/NFTMarket.sol";

// Mock ERC20 Token for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**18); // Mint 1M tokens to deployer
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Mock ERC721 NFT for testing
contract MockERC721 is ERC721URIStorage {
    uint256 private _tokenIdCounter;
    
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}
    
    function mint(address to, string memory uri) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }
}

contract NFTMarketTest is Test {
    NFTMarket public market;
    MockERC20 public token;
    MockERC721 public nft;
    
    address public owner;
    address public seller;
    address public buyer;
    address public randomUser;
    
    uint256 public tokenId1;
    uint256 public tokenId2;
    uint256 public constant INITIAL_BALANCE = 10000 * 10**18;
    
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    
    function setUp() public {
        owner = address(this);
        seller = makeAddr("seller");
        buyer = makeAddr("buyer");
        randomUser = makeAddr("randomUser");
        
        // Deploy mock contracts
        token = new MockERC20("TestToken", "TT");
        nft = new MockERC721("TestNFT", "TNFT");
        
        // Deploy NFTMarket
        market = new NFTMarket(IERC20(address(token)), ERC721URIStorage(address(nft)));
        
        // Mint NFTs to seller
        vm.startPrank(seller);
        tokenId1 = nft.mint(seller, "ipfs://test1");
        tokenId2 = nft.mint(seller, "ipfs://test2");
        vm.stopPrank();
        
        // Distribute tokens
        token.mint(buyer, INITIAL_BALANCE);
        token.mint(seller, INITIAL_BALANCE);
        token.mint(randomUser, INITIAL_BALANCE);
    }
    
    // ===== NFT上架测试 =====
    
    function test_ListNFTSuccess() public {
        uint256 price = 100 * 10**18; // 100 tokens
        
        // Approve NFT to market
        vm.prank(seller);
        nft.approve(address(market), tokenId1);
        
        // Expect event emission
        vm.expectEmit(true, true, false, true);
        emit NFTListed(tokenId1, seller, price);
        
        // List NFT
        vm.prank(seller);
        market.list(tokenId1, price);
        
        // Verify listing
        (uint256 listedTokenId, uint256 listedPrice, address listedSeller) = market.sellnft(tokenId1);
        assertEq(listedTokenId, tokenId1, "Token ID should match");
        assertEq(listedPrice, price, "Price should match");
        assertEq(listedSeller, seller, "Seller should match");
    }
    
    function test_ListNFT_NotOwner() public {
        uint256 price = 100 * 10**18;
        
        // Try to list NFT as non-owner
        vm.prank(buyer);
        vm.expectRevert("Not the owner of this NFT");
        market.list(tokenId1, price);
    }
    
    function test_ListNFT_ZeroPrice() public {
        vm.prank(seller);
        nft.approve(address(market), tokenId1);
        
        // Try to list with zero price
        vm.prank(seller);
        vm.expectRevert("Price must be greater than zero");
        market.list(tokenId1, 0);
    }
    
    function test_ListNFT_VariousPrices() public {
        uint256[] memory prices = new uint256[](5);
        prices[0] = 0.01 * 10**18;   // 0.01 tokens
        prices[1] = 1 * 10**18;     // 1 token
        prices[2] = 100 * 10**18;   // 100 tokens
        prices[3] = 1000 * 10**18;  // 1000 tokens
        prices[4] = 10000 * 10**18; // 10000 tokens
        
        for (uint i = 0; i < prices.length; i++) {
            uint256 newTokenId = nft.mint(seller, string.concat("ipfs://test", vm.toString(i)));
            
            vm.startPrank(seller);
            nft.approve(address(market), newTokenId);
            
            vm.expectEmit(true, true, false, true);
            emit NFTListed(newTokenId, seller, prices[i]);
            
            market.list(newTokenId, prices[i]);
            vm.stopPrank();
            
            // Verify listing
            (, uint256 listedPrice,) = market.sellnft(newTokenId);
            assertEq(listedPrice, prices[i], "Price should match for index");
        }
    }
    
    // ===== NFT购买测试 =====
    
    function test_BuyNFTSuccess() public {
        uint256 price = 100 * 10**18;
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        vm.stopPrank();
        
        // Approve tokens for market
        vm.prank(buyer);
        token.approve(address(market), price);
        
        // Approve NFT transfer from seller to market
        vm.prank(seller);
        nft.approve(address(market), tokenId1);
        
        uint256 sellerBalanceBefore = token.balanceOf(seller);
        uint256 buyerBalanceBefore = token.balanceOf(buyer);
        
        // Expect event emission
        vm.expectEmit(true, true, true, true);
        emit NFTSold(tokenId1, buyer, seller, price);
        
        // Buy NFT
        vm.prank(buyer);
        market.buyNFT(tokenId1);
        
        // Verify NFT ownership transfer
        assertEq(nft.ownerOf(tokenId1), buyer, "Buyer should own the NFT");
        
        // Verify token transfer
        assertEq(token.balanceOf(seller), sellerBalanceBefore + price, "Seller should receive payment");
        assertEq(token.balanceOf(buyer), buyerBalanceBefore - price, "Buyer should pay the price");
        
        // Verify listing is cleared
        (, uint256 listedPrice, address listedSeller) = market.sellnft(tokenId1);
        assertEq(listedPrice, 0, "Price should be cleared");
        assertEq(listedSeller, address(0), "Seller should be cleared");
    }
    
    function test_BuyNFT_SelfPurchase() public {
        uint256 price = 100 * 10**18;
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        vm.stopPrank();
        
        // Try to buy own NFT
        vm.prank(seller);
        vm.expectRevert("Cannot buy your own NFT");
        market.buyNFT(tokenId1);
    }
    
    function test_BuyNFT_NotListed() public {
        // Try to buy unlisted NFT
        vm.prank(buyer);
        vm.expectRevert("nft not exist!");
        market.buyNFT(tokenId1);
    }
    
    function test_BuyNFT_DoublePurchase() public {
        uint256 price = 100 * 10**18;
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        vm.stopPrank();
        
        // First purchase
        vm.prank(buyer);
        token.approve(address(market), price);
        vm.prank(seller);
        nft.approve(address(market), tokenId1);
        vm.prank(buyer);
        market.buyNFT(tokenId1);
        
        // Try second purchase
        vm.prank(randomUser);
        vm.expectRevert("nft not exist!");
        market.buyNFT(tokenId1);
    }
    
    function test_BuyNFT_InsufficientAllowance() public {
        uint256 price = 100 * 10**18;
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        vm.stopPrank();
        
        // Approve insufficient tokens
        vm.prank(buyer);
        token.approve(address(market), price - 1);
        
        // Try to buy with insufficient allowance
        vm.prank(buyer);
        vm.expectRevert("Insufficient token allowance. Please approve tokens first");
        market.buyNFT(tokenId1);
    }
    
    function test_BuyNFT_InsufficientBalance() public {
        uint256 price = INITIAL_BALANCE + 1; // More than buyer has
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        vm.stopPrank();
        
        // Approve tokens
        vm.prank(buyer);
        token.approve(address(market), price);
        
        // Try to buy with insufficient balance
        vm.prank(buyer);
        vm.expectRevert("Insufficient token balance");
        market.buyNFT(tokenId1);
    }
    
    // ===== 模糊测试 =====
    
    function testFuzz_ListAndBuyNFT(uint256 price, address fuzzBuyer) public {
        // Bound price between 0.01 and 10000 tokens
        price = bound(price, 0.01 * 10**18, 10000 * 10**18);
        
        // Ensure fuzzBuyer is not seller and is valid
        vm.assume(fuzzBuyer != seller);
        vm.assume(fuzzBuyer != address(0));
        vm.assume(fuzzBuyer.code.length == 0); // EOA only
        
        // Mint tokens to fuzz buyer
        token.mint(fuzzBuyer, price + 1000 * 10**18);
        
        // Create new NFT for this test
        uint256 fuzzTokenId = nft.mint(seller, "ipfs://fuzz");
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), fuzzTokenId);
        market.list(fuzzTokenId, price);
        vm.stopPrank();
        
        // Verify listing
        (, uint256 listedPrice,) = market.sellnft(fuzzTokenId);
        assertEq(listedPrice, price, "Fuzz: Listed price should match");
        
        // Buy NFT
        vm.prank(fuzzBuyer);
        token.approve(address(market), price);
        vm.prank(seller);
        nft.approve(address(market), fuzzTokenId);
        
        uint256 buyerBalanceBefore = token.balanceOf(fuzzBuyer);
        uint256 sellerBalanceBefore = token.balanceOf(seller);
        
        vm.prank(fuzzBuyer);
        market.buyNFT(fuzzTokenId);
        
        // Verify purchase
        assertEq(nft.ownerOf(fuzzTokenId), fuzzBuyer, "Fuzz: Buyer should own NFT");
        assertEq(token.balanceOf(fuzzBuyer), buyerBalanceBefore - price, "Fuzz: Buyer balance should decrease");
        assertEq(token.balanceOf(seller), sellerBalanceBefore + price, "Fuzz: Seller balance should increase");
        
        // Verify listing cleared
        (, uint256 clearedPrice, address clearedSeller) = market.sellnft(fuzzTokenId);
        assertEq(clearedPrice, 0, "Fuzz: Price should be cleared");
        assertEq(clearedSeller, address(0), "Fuzz: Seller should be cleared");
    }
    
    // ===== 不变量测试 =====
    
    function invariant_MarketHasNoTokenBalance() public {
        assertEq(token.balanceOf(address(market)), 0, "Market should never hold tokens");
    }
    
    function test_MultipleTransactions_MarketTokenBalance() public {
        uint256[] memory prices = new uint256[](3);
        prices[0] = 50 * 10**18;
        prices[1] = 100 * 10**18;
        prices[2] = 200 * 10**18;
        
        address[] memory buyers = new address[](3);
        buyers[0] = buyer;
        buyers[1] = randomUser;
        buyers[2] = makeAddr("buyer3");
        
        // Give tokens to all buyers
        for (uint i = 0; i < buyers.length; i++) {
            token.mint(buyers[i], INITIAL_BALANCE);
        }
        
        // Create and list multiple NFTs
        uint256[] memory tokenIds = new uint256[](3);
        for (uint i = 0; i < 3; i++) {
            tokenIds[i] = nft.mint(seller, string.concat("ipfs://multi", vm.toString(i)));
            
            vm.startPrank(seller);
            nft.approve(address(market), tokenIds[i]);
            market.list(tokenIds[i], prices[i]);
            vm.stopPrank();
            
            // Verify market has no tokens after listing
            assertEq(token.balanceOf(address(market)), 0, "Market should have no tokens after listing");
        }
        
        // Buy all NFTs
        for (uint i = 0; i < 3; i++) {
            vm.prank(buyers[i]);
            token.approve(address(market), prices[i]);
            vm.prank(seller);
            nft.approve(address(market), tokenIds[i]);
            
            vm.prank(buyers[i]);
            market.buyNFT(tokenIds[i]);
            
            // Verify market has no tokens after each purchase
            assertEq(token.balanceOf(address(market)), 0, "Market should have no tokens after purchase");
        }
        
        // Final verification
        assertEq(token.balanceOf(address(market)), 0, "Market should never accumulate tokens");
    }
    
    // ===== 边界情况测试 =====
    
    function test_ListNFT_MinimumPrice() public {
        uint256 minPrice = 1; // Minimum possible price
        
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, minPrice);
        vm.stopPrank();
        
        (, uint256 listedPrice,) = market.sellnft(tokenId1);
        assertEq(listedPrice, minPrice, "Should accept minimum price");
    }
    
    function test_BuyNFT_ExactAllowance() public {
        uint256 price = 100 * 10**18;
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        vm.stopPrank();
        
        // Approve exact amount
        vm.prank(buyer);
        token.approve(address(market), price);
        vm.prank(seller);
        nft.approve(address(market), tokenId1);
        
        // Should succeed with exact allowance
        vm.prank(buyer);
        market.buyNFT(tokenId1);
        
        assertEq(nft.ownerOf(tokenId1), buyer, "Purchase should succeed with exact allowance");
        assertEq(token.balanceOf(address(market)), 0, "Market should have no token balance");
    }
    
    function test_MarketTokenBalance_AfterFailedPurchase() public {
        uint256 price = 100 * 10**18;
        
        // List NFT
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        vm.stopPrank();
        
        // Try to buy without approval (should fail)
        vm.prank(buyer);
        vm.expectRevert("Insufficient token allowance. Please approve tokens first");
        market.buyNFT(tokenId1);
        
        // Market should still have no tokens after failed purchase
        assertEq(token.balanceOf(address(market)), 0, "Market should have no tokens after failed purchase");
    }
}