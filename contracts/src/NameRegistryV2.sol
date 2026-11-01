// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FeeSink} from "./FeeSink.sol";

/// @notice @name = player identity. First claim free; rename costs renameFee (burnBps destroyed, rest to treasury).
contract NameRegistryV2 is FeeSink {
    uint256 public renameFee;
    address public treasury;
    bool public seeding = true;
    mapping(bytes32 => address) public ownerOf;
    mapping(address => string) public nameOf;
    event NameClaimed(address indexed who, string name);
    event NameChanged(address indexed who, string oldName, string newName);
    event SentToName(address indexed from, address indexed to, string name, uint256 amount);

    constructor(IERC20 _wif, bool _useBurn, uint16 _burnBps, uint256 _fee, address _treasury, address _owner)
        FeeSink(_wif, _useBurn, _burnBps, _owner) { renameFee = _fee; treasury = _treasury; }

    function setRenameFee(uint256 f) external onlyOwner { renameFee = f; }
    function setTreasury(address t) external onlyOwner { treasury = t; }
    /// one-time migration of names from v1; owner can close it forever
    function seed(address[] calldata who, string[] calldata n) external onlyOwner {
        require(seeding, "name: seeding closed");
        for (uint256 i; i < who.length; i++) {
            bytes32 k = keccak256(bytes(n[i]));
            if (ownerOf[k] != address(0) || bytes(nameOf[who[i]]).length != 0 || !valid(n[i])) continue;
            ownerOf[k] = who[i]; nameOf[who[i]] = n[i];
            emit NameClaimed(who[i], n[i]);
        }
    }
    function closeSeeding() external onlyOwner { seeding = false; }

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
    /// 0 = ok, 1 = invalid, 2 = taken
    function check(string calldata n) external view returns (uint8) {
        if (!valid(n)) return 1;
        return ownerOf[keccak256(bytes(n))] == address(0) ? 0 : 2;
    }
    function feeFor(address who) external view returns (uint256) { return bytes(nameOf[who]).length == 0 ? 0 : renameFee; }

    function claim(string calldata n) external {
        require(valid(n), "name: invalid");
        bytes32 k = keccak256(bytes(n));
        require(ownerOf[k] == address(0), "name: taken");
        string memory old = nameOf[msg.sender];
        ownerOf[k] = msg.sender; nameOf[msg.sender] = n;
        if (bytes(old).length == 0) { emit NameClaimed(msg.sender, n); return; }
        delete ownerOf[keccak256(bytes(old))];
        if (renameFee > 0) {
            uint256 kept = _takeFee(msg.sender, renameFee);
            if (kept > 0) require(wif.transfer(treasury, kept), "treasury");
        }
        emit NameChanged(msg.sender, old, n);
    }

    function sendToName(string calldata n, uint256 amount) external {
        address to = resolve(n);
        require(to != address(0), "name: unknown");
        require(to != msg.sender, "name: self");
        require(wif.transferFrom(msg.sender, to, amount), "send");
        emit SentToName(msg.sender, to, n, amount);
    }
}
