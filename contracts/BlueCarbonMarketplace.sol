// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title BlueCarbonMarketplace
/// @notice Official non-custodial escrow trading marketplace for tokenized blue carbon credits on Polygon Amoy.
contract BlueCarbonMarketplace is ReentrancyGuard, Ownable {
    enum ListingStatus { Active, Sold, Cancelled }

    struct Listing {
        uint256 listingId;
        address tokenAddress;
        uint256 tokenId;
        uint256 quantity;
        uint256 pricePerCredit; // In wei per credit unit
        address payable seller;
        ListingStatus status;
        uint64 createdAt;
    }

    uint256 public feeBps = 100; // 1.00% registry fee (100 basis points)
    uint256 public nextListingId = 1;

    mapping(uint256 => Listing) public listings;

    event ListingCreated(uint256 indexed listingId, address indexed seller, address indexed tokenAddress, uint256 tokenId, uint256 quantity, uint256 pricePerCredit);
    event ListingPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 quantity, uint256 totalPrice);
    event ListingCancelled(uint256 indexed listingId, address indexed seller);

    constructor() Ownable(msg.sender) {}

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee too high"); // Max 10%
        feeBps = _feeBps;
    }

    function createListing(
        address tokenAddress,
        uint256 tokenId,
        uint256 quantity,
        uint256 pricePerCredit
    ) external returns (uint256) {
        require(tokenAddress != address(0), "invalid token address");
        require(quantity > 0, "quantity required");
        require(pricePerCredit > 0, "price required");

        IERC1155 token = IERC1155(tokenAddress);
        require(token.balanceOf(msg.sender, tokenId) >= quantity, "insufficient token balance");
        require(token.isApprovedForAll(msg.sender, address(this)), "marketplace not approved");

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            listingId: listingId,
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            quantity: quantity,
            pricePerCredit: pricePerCredit,
            seller: payable(msg.sender),
            status: ListingStatus.Active,
            createdAt: uint64(block.timestamp)
        });

        emit ListingCreated(listingId, msg.sender, tokenAddress, tokenId, quantity, pricePerCredit);
        return listingId;
    }

    function buyCredits(uint256 listingId) external payable nonReentrant {
        Listing storage item = listings[listingId];
        require(item.status == ListingStatus.Active, "listing not active");
        uint256 totalPrice = item.quantity * item.pricePerCredit;
        require(msg.value >= totalPrice, "insufficient MATIC payment");

        item.status = ListingStatus.Sold;

        uint256 feeAmount = (totalPrice * feeBps) / 10000;
        uint256 sellerProceeds = totalPrice - feeAmount;

        // Transfer funds
        if (feeAmount > 0) {
            payable(owner()).transfer(feeAmount);
        }
        item.seller.transfer(sellerProceeds);

        // Refund excess MATIC
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }

        // Transfer tokens from seller to buyer
        IERC1155(item.tokenAddress).safeTransferFrom(item.seller, msg.sender, item.tokenId, item.quantity, "");

        emit ListingPurchased(listingId, msg.sender, item.seller, item.quantity, totalPrice);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage item = listings[listingId];
        require(item.seller == msg.sender || msg.sender == owner(), "seller or owner only");
        require(item.status == ListingStatus.Active, "listing not active");

        item.status = ListingStatus.Cancelled;
        emit ListingCancelled(listingId, msg.sender);
    }
}
