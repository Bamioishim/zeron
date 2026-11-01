// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @notice TESTNET ONLY stand-in for $wif (18 decimals, burnable, no permit like the real token).
contract MockWIF is ERC20, ERC20Burnable {
    uint256 public constant DRIP = 10_000 ether;
    mapping(address => uint256) public lastDrip;
    constructor() ERC20("Mock WIF (testnet)", "WIF") {}
    /// @notice Anyone can take 10k test WIF once per day.
    function faucet() external {
        require(block.timestamp >= lastDrip[msg.sender] + 1 days, "drip: wait");
        lastDrip[msg.sender] = block.timestamp;
        _mint(msg.sender, DRIP);
    }
}
