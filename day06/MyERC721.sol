// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "forge-std/console.sol";

interface IERC721 {
    function balanceOf(address owner) external returns (uint256);

    function ownerOf(uint256 tokenId) external returns (address);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) external;

    function transferFrom(address from, address to, uint256 tokenId) external;

    function approve(address to, uint256 tokenId) external;

    function setApprovalForAll(address operator, bool approved) external;

    function getApproved(uint256 tokenId) external returns (address);

    function isApprovedForAll(
        address owner,
        address operator
    ) external returns (bool);
}

contract MyERC721 is IERC721 {
    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    // Token baseURI
    // string private _baseURI;

    mapping(uint256 => address) private _owners;

    mapping(address => uint256) private _balances;

    mapping(uint256 => address) private _tokenApprovals;

    mapping(address => mapping(address => bool)) private _operatorApprovals;

    mapping(uint256 => string) private _tokenURIs;

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );

    event Approval(
        address indexed owner,
        address indexed approved,
        uint256 indexed tokenId
    );

    event ApprovalForAll(
        address indexed owner,
        address indexed operator,
        bool approved
    );

    constructor() {
        _name = "MyFirstNft";
        _symbol = "MyFirstNft";
    }

    function balanceOf(address owner) external returns (uint256) {
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) external returns (address) {
        // console.log("ownerOf:", tokenId);
        return _owners[tokenId];
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external {
        this.safeTransferFrom(from, to, tokenId, "");
    }

    function _isApprovedOrOwner(
        address spender,
        uint256 tokenId
    ) public returns (bool) {
        console.log("_isApprovedOrOwner:", spender, tokenId);
        console.log("_isApprovedOrOwner _owners:", _owners[tokenId]);
        require(
            /**code*/
            this.ownerOf(tokenId) != address(0),
            "ERC721: operator query for nonexistent token"
        );

        /**code*/
        if (this.ownerOf(tokenId) == spender) {
            console.log("_isApprovedOrOwner owner");
            //owner
            return true;
        }
        if (this.getApproved(tokenId) == spender) {
            console.log("_isApprovedOrOwner approved");
            //approved
            return true;
        }

        if (this.isApprovedForAll(this.ownerOf(tokenId), spender)) {
            console.log("_isApprovedOrOwner ApprovedForAll");
            return true;
        }

        console.log("_isApprovedOrOwner not approved");
        return false;
    }

    function _safeTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) internal {
        _transfer(from, to, tokenId);
        require(
            _checkOnERC721Received(from, to, tokenId, _data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (to.code.length > 0) {
            try
                IERC721Receiver(to).onERC721Received(
                    msg.sender,
                    from,
                    tokenId,
                    _data
                )
            returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert(
                        "ERC721: transfer to non ERC721Receiver implementer"
                    );
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) external {
        console.log("safeTransferFrom:", from, to, tokenId);
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );
        _safeTransfer(from, to, tokenId, data);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(
            /**code*/
            this.ownerOf(tokenId) == from,
            "ERC721: transfer from incorrect owner"
        );

        require(
            /**code*/
            to != address(0),
            "ERC721: transfer to the zero address"
        );

        /**code*/
        if (_balances[from] >= 1) {
            _balances[from] -= 1;
        }

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        /**code*/
        _tokenApprovals[tokenId] = to;
        emit Approval(this.ownerOf(tokenId), to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        console.log("transferFrom caller:", msg.sender);
        
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );

        

        _transfer(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) external {
        address owner = this.ownerOf(tokenId); //alice
        require(
            /**code*/
            owner != address(0),
            "ERC721: approval to current owner"
        );

        require( // to bob
            /**code*/
            msg.sender == owner,
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(
            _owners[tokenId] != address(0),
            "ERC721: URI query for nonexistent token"
        );
        return _tokenURIs[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        address sender = msg.sender;
        require(
            /**code*/
            operator != sender,
            "ERC721: approve to caller"
        );

        /**code*/
        _operatorApprovals[sender][operator] = approved;

        emit ApprovalForAll(sender, operator, approved);
    }

    function getApproved(uint256 tokenId) external virtual returns (address) {
        require(
            /**code*/
            this.ownerOf(tokenId) != address(0),
            "ERC721: approved query for nonexistent token"
        );

        /**code*/
        address appaddress = _tokenApprovals[tokenId];
        console.log("getApproved:", appaddress);
        return appaddress;
    }

    function isApprovedForAll(
        address owner,
        address operator
    ) external virtual returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function _exists(uint256 tokenId) internal returns (bool) {
        /**code*/
        bool exist = this.ownerOf(tokenId) != address(0);
        console.log("_exists:", exist);
        return exist;
    }

    function mint(address to, uint256 tokenId, string memory uri) public {
        require(
            /**code*/
            to != address(0),
            "ERC721: mint to the zero address"
        );

        require(
            /**code*/
            !_exists(tokenId),
            "ERC721: token already minted"
        );

        // address from = this.ownerOf(tokenId);
        // // console.log("from:", from);
        // //先授权
        // // _approve(address(0), tokenId);
        // if (_balances[from] >= 1) {
        //     _balances[from] -= 1;
        // }

        _balances[to] += 1;
        _owners[tokenId] = to;

        _tokenURIs[tokenId] = uri; // 设置图片等元数据
        emit Transfer(address(0), to, tokenId);
    }
}
