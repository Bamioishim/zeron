// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IBurnable { function burn(uint256) external; }

/// @notice Shared fee logic: pull WIF, destroy `burnBps` of it, keep the rest.
abstract contract FeeSink is Ownable {
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    IERC20 public immutable wif;
    /// true = call token.burn() (reduces totalSupply); false = send to 0x...dEaD
    bool public useBurn;
    uint16 public burnBps; // out of 10_000
    uint256 public totalDestroyed;
    event Destroyed(uint256 amount, bool viaBurn);

    constructor(IERC20 _wif, bool _useBurn, uint16 _burnBps, address _owner) Ownable(_owner) {
        require(_burnBps <= 10_000, "bps");
        wif = _wif; useBurn = _useBurn; burnBps = _burnBps;
    }
    function setBurnConfig(bool _useBurn, uint16 _burnBps) external onlyOwner {
        require(_burnBps <= 10_000, "bps");
        useBurn = _useBurn; burnBps = _burnBps;
    }
    /// @return kept amount retained by this contract after destroying the burn share
    function _takeFee(address from, uint256 amount) internal returns (uint256 kept) {
        require(wif.transferFrom(from, address(this), amount), "transferFrom");
        uint256 d = amount * burnBps / 10_000;
        _destroy(d);
        kept = amount - d;
    }
    function _destroy(uint256 d) internal {
        if (d == 0) return;
        if (useBurn) IBurnable(address(wif)).burn(d);
        else require(wif.transfer(DEAD, d), "dead");
        totalDestroyed += d;
        emit Destroyed(d, useBurn);
    }
}
