// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FeeSink} from "./FeeSink.sol";

/// @notice @username -> wallet. One name per wallet, names unique, 3-15 chars [a-z0-9_].
contract NameRegistry is FeeSink {
    uint256 public nameFee;
    address public treasury;
    mapping(bytes32 => address) public ownerOf;
    mapping(address => string) public nameOf;
    event NameClaimed(address indexed who, string name);
    event SentToName(address indexed from, address indexed to, string name, uint256 amount);

    constructor(IERC20 _wif, bool _useBurn, uint16 _burnBps, uint256 _fee, address _treasury, address _owner)
        FeeSink(_wif, _useBurn, _burnBps, _owner) { nameFee = _fee; treasury = _treasury; }

    function setNameFee(uint256 f) external onlyOwner { nameFee = f; }
    function setTreasury(address t) external onlyOwner { treasury = t; }

    function valid(string memory n) public pure returns (bool) {
        bytes memory b = bytes(n);
        if (b.length < 3 || b.length > 15) return false;
        for (uint256 i; i < b.length; i++) {
            bytes1 c = b[i];
            if (!((c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x5f)) return false;
        }
        return true;
    }
    function resolve(string calldata n) public view returns (address) { return ownerOf[keccak256(bytes(n))]; }

    function claim(string calldata n) external {
        require(valid(n), "name: invalid");
        bytes32 k = keccak256(bytes(n));
        require(ownerOf[k] == address(0), "name: taken");
        require(bytes(nameOf[msg.sender]).length == 0, "name: already have one");
        ownerOf[k] = msg.sender; nameOf[msg.sender] = n;
        if (nameFee > 0) {
            uint256 kept = _takeFee(msg.sender, nameFee);
            if (kept > 0) require(wif.transfer(treasury, kept), "treasury");
        }
        emit NameClaimed(msg.sender, n);
    }

    /// @notice send WIF to @name (needs allowance to this registry)
    function sendToName(string calldata n, uint256 amount) external {
        address to = resolve(n);
        require(to != address(0), "name: unknown");
        require(wif.transferFrom(msg.sender, to, amount), "send");
        emit SentToName(msg.sender, to, n, amount);
    }
}
