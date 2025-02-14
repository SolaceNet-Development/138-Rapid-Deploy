// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Chain138Token is ERC20Votes, Ownable {
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100 million tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    // Emission rate: 2% per year
    uint256 public constant EMISSION_RATE = 2;
    uint256 public constant EMISSION_PERIOD = 365 days;
    uint256 public lastEmissionTime;

    constructor()
        ERC20("Chain138 Governance Token", "C138")
        ERC20Permit("Chain138 Governance Token")
    {
        _mint(msg.sender, INITIAL_SUPPLY);
        lastEmissionTime = block.timestamp;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    function emitTokens() external {
        require(
            block.timestamp >= lastEmissionTime + EMISSION_PERIOD,
            "Emission period not elapsed"
        );

        uint256 currentSupply = totalSupply();
        uint256 emissionAmount = (currentSupply * EMISSION_RATE) / 100;
        
        require(
            currentSupply + emissionAmount <= MAX_SUPPLY,
            "Emission would exceed max supply"
        );

        _mint(address(this), emissionAmount);
        lastEmissionTime = block.timestamp;
    }

    function distributeEmission(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(
            recipients.length == amounts.length,
            "Arrays length mismatch"
        );

        uint256 totalAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(
            balanceOf(address(this)) >= totalAmount,
            "Insufficient balance for distribution"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            _transfer(address(this), recipients[i], amounts[i]);
        }
    }

    // Governance token specific functions
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20Votes) {
        super._burn(account, amount);
    }
} 