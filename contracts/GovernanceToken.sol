// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Chain138Token is ERC20Votes, Ownable {
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100 million tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    // Emission rate: 2% per year
    uint256 public constant EMISSION_RATE = 2;
    uint256 public constant EMISSION_PERIOD = 365 days;
    uint256 public lastEmissionTime;

    constructor(address initialOwner)
        ERC20("Chain138 Governance Token", "C138")
        ERC20Permit("Chain138 Governance Token")
        Ownable(initialOwner)
    {
        _mint(initialOwner, INITIAL_SUPPLY);
        lastEmissionTime = block.timestamp;
    }

    error ExceedsMaxSupply(uint256 requested, uint256 maxSupply);
    error EmissionPeriodNotElapsed(uint256 nextEmissionTime);
    error ArrayLengthMismatch(uint256 recipientsLength, uint256 amountsLength);
    error InsufficientBalance(uint256 requested, uint256 available);

    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, MAX_SUPPLY);
        }
        _mint(to, amount);
    }

    function emitTokens() external {
        if (block.timestamp < lastEmissionTime + EMISSION_PERIOD) {
            revert EmissionPeriodNotElapsed(lastEmissionTime + EMISSION_PERIOD);
        }

        uint256 currentSupply = totalSupply();
        uint256 emissionAmount = (currentSupply * EMISSION_RATE) / 100;
        
        if (currentSupply + emissionAmount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(emissionAmount, MAX_SUPPLY - currentSupply);
        }

        _mint(address(this), emissionAmount);
        lastEmissionTime = block.timestamp;
    }

    function distributeEmission(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (recipients.length != amounts.length) {
            revert ArrayLengthMismatch(recipients.length, amounts.length);
        }

        uint256 totalAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        if (balanceOf(address(this)) < totalAmount) {
            revert InsufficientBalance(totalAmount, balanceOf(address(this)));
        }

        for (uint256 i = 0; i < recipients.length; i++) {
            _transfer(address(this), recipients[i], amounts[i]);
        }
    }

    // Governance token specific functions
    function _update(address from, address to, uint256 amount) internal virtual override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }
}                            