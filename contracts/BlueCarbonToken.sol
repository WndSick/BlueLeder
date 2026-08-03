// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BlueCarbonToken
/// @notice Official OpenZeppelin ERC-1155 multi-token contract for tokenized blue carbon credits on Polygon Amoy.
/// @dev TokenID is derived from keccak256(abi.encode(projectId, periodKey)).
contract BlueCarbonToken is ERC1155, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    string public name = "BlueCarbon Credit Tokens";
    string public symbol = "BLUE-CARBON";
    address public registryAddress;

    mapping(uint256 => uint256) private _totalSupply;
    mapping(uint256 => bytes32) public tokenReportHashes;
    mapping(uint256 => bytes32) public tokenProjectIds;
    mapping(uint256 => bytes32) public tokenPeriodKeys;

    event CreditsMinted(uint256 indexed tokenId, bytes32 indexed projectId, bytes32 indexed periodKey, address recipient, uint256 quantity);
    event CreditsRetired(uint256 indexed tokenId, address indexed holder, uint256 quantity, bytes32 retirementReasonHash);

    constructor(address _registryAddress) ERC1155("https://blueledger.registry/api/mrv/tokens/{id}") {
        registryAddress = _registryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    function computeTokenId(bytes32 projectId, bytes32 periodKey) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(projectId, periodKey)));
    }

    function totalSupply(uint256 id) public view returns (uint256) {
        return _totalSupply[id];
    }

    function mintBatchTokens(
        address recipient,
        bytes32 projectId,
        bytes32 periodKey,
        uint256 quantity,
        bytes32 reportHash
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(recipient != address(0), "invalid recipient");
        require(quantity > 0, "quantity required");
        uint256 tokenId = computeTokenId(projectId, periodKey);

        if (tokenReportHashes[tokenId] == bytes32(0)) {
            tokenReportHashes[tokenId] = reportHash;
            tokenProjectIds[tokenId] = projectId;
            tokenPeriodKeys[tokenId] = periodKey;
        }

        _mint(recipient, tokenId, quantity, "");
        _totalSupply[tokenId] += quantity;

        emit CreditsMinted(tokenId, projectId, periodKey, recipient, quantity);
        return tokenId;
    }

    function retireTokens(uint256 id, uint256 amount, bytes32 retirementReasonHash) external nonReentrant {
        require(balanceOf(msg.sender, id) >= amount, "insufficient balance to retire");
        require(amount > 0, "amount required");

        _burn(msg.sender, id, amount);
        _totalSupply[id] -= amount;

        emit CreditsRetired(id, msg.sender, amount, retirementReasonHash);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
