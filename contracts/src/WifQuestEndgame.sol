// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface IQuest { function players(address) external view returns (uint8 level, uint8, uint8, uint8, uint16, uint16, uint16, uint64); function MAX_LEVEL() external view returns (uint8); }

/// @notice Endgame extension of WifQuest: records levels beyond the base quest's cap (7, 8, ...) with the same
/// server-signed Clear checkpoint. Levels 1..base cap stay in WifQuest, so no state migration and no progress loss.
contract WifQuestEndgame is EIP712 {
    bytes32 public constant CLEAR_TYPEHASH = keccak256(
        "Clear(address player,uint8 level,uint8 iron,uint8 hide,uint8 glow,uint64 nonce,uint64 deadline)");
    IQuest public immutable base;
    address public owner; address public signer; uint8 public maxLevel;
    mapping(address => uint8) public endLevel;
    mapping(address => uint64) public nonces;
    event LevelCleared(address indexed player, uint8 level, uint8 iron, uint8 hide, uint8 glow);

    constructor(IQuest _base, address _signer, address _owner, uint8 _max) EIP712("WifQuestEndgame", "1") { base = _base; signer = _signer; owner = _owner; maxLevel = _max; }
    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    function setSigner(address s) external onlyOwner { signer = s; }
    function setMaxLevel(uint8 m) external onlyOwner { maxLevel = m; }
    function setOwner(address o) external onlyOwner { owner = o; }

    /// @notice overall level: base progress, then endgame progress on top of it
    function levelOf(address a) public view returns (uint8) { uint8 e = endLevel[a]; if (e > 0) return e; (uint8 l,,,,,,,) = base.players(a); return l; }

    function recordClear(uint8 level, uint8 iron, uint8 hide, uint8 glow, uint64 deadline, bytes calldata sig) external {
        require(block.timestamp <= deadline, "expired");
        require(level > base.MAX_LEVEL() && level <= maxLevel && level == levelOf(msg.sender) + 1, "wrong level");
        bytes32 h = keccak256(abi.encode(CLEAR_TYPEHASH, msg.sender, level, iron, hide, glow, nonces[msg.sender]++, deadline));
        require(ECDSA.recover(_hashTypedDataV4(h), sig) == signer, "bad sig");
        endLevel[msg.sender] = level;
        emit LevelCleared(msg.sender, level, iron, hide, glow);
    }
}
