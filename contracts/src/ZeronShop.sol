// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {FeeSink} from "./FeeSink.sol";

/// @notice Zeron shop: costumes (owned + equipped on-chain), event drops, and the one-time starter grant.
/// Purchases: burnBps of the price is destroyed, the rest goes to the treasury.
contract ZeronShop is FeeSink, EIP712 {
    uint256 public starterAmount = 5 ether; // owner-settable; 0 disables the grant
    bytes32 public constant DROP_TYPEHASH = keccak256("Drop(address player,uint8 id,uint256 deadline)");
    address public treasury;
    address public signer;
    mapping(uint8 => uint256) public price;           // 0 = not for sale
    mapping(address => mapping(uint8 => bool)) public owns;
    mapping(address => uint8) public equipped;        // 0 = knight (free default)
    mapping(address => bool) public gotStarter;
    event Bought(address indexed who, uint8 id, uint256 price);
    event Equipped(address indexed who, uint8 id);
    event Dropped(address indexed who, uint8 id);
    event Starter(address indexed who, uint256 amount);

    constructor(IERC20 _wif, bool _useBurn, uint16 _burnBps, address _treasury, address _signer, address _owner)
        FeeSink(_wif, _useBurn, _burnBps, _owner) EIP712("ZeronShop", "1") { treasury = _treasury; signer = _signer; }
    function setPrice(uint8 id, uint256 p) external onlyOwner { price[id] = p; }
    function setPrices(uint8[] calldata ids, uint256[] calldata ps) external onlyOwner { for (uint256 i; i < ids.length; i++) price[ids[i]] = ps[i]; }
    function setTreasury(address t) external onlyOwner { treasury = t; }
    function setSigner(address s) external onlyOwner { signer = s; }
    function setStarter(uint256 a) external onlyOwner { starterAmount = a; }

    /// @notice one-time small WIF welcome grant for a new wallet, paid from this contract's finite pool
    function starter() external {
        uint256 a = starterAmount;
        require(a > 0, "starter: off");
        require(!gotStarter[msg.sender], "starter: claimed");
        require(wif.balanceOf(address(this)) >= a, "starter: empty");
        gotStarter[msg.sender] = true;
        require(wif.transfer(msg.sender, a), "starter: transfer");
        emit Starter(msg.sender, a);
    }
    function buy(uint8 id) external {
        uint256 p = price[id];
        require(p > 0, "shop: not for sale");
        require(!owns[msg.sender][id], "shop: owned");
        uint256 kept = _takeFee(msg.sender, p);
        if (kept > 0) require(wif.transfer(treasury, kept), "shop: treasury");
        owns[msg.sender][id] = true;
        emit Bought(msg.sender, id, p);
        equipped[msg.sender] = id; emit Equipped(msg.sender, id);
    }
    function equip(uint8 id) external {
        require(id == 0 || owns[msg.sender][id], "shop: not owned");
        equipped[msg.sender] = id; emit Equipped(msg.sender, id);
    }
    /// @notice event drop (e.g. Pumpkin King), signed by the game server after a verified clear
    function claimDrop(uint8 id, uint256 deadline, bytes calldata sig) external {
        require(block.timestamp <= deadline, "drop: expired");
        require(!owns[msg.sender][id], "shop: owned");
        bytes32 h = _hashTypedDataV4(keccak256(abi.encode(DROP_TYPEHASH, msg.sender, id, deadline)));
        require(ECDSA.recover(h, sig) == signer, "drop: bad sig");
        owns[msg.sender][id] = true; emit Dropped(msg.sender, id);
        equipped[msg.sender] = id; emit Equipped(msg.sender, id);
    }
    /// @notice bitmask of owned costumes (ids 0..31) + equipped, for one cheap read
    function wardrobe(address who) external view returns (uint32 mask, uint8 eq, bool starterUsed) {
        mask = 1;
        for (uint8 i = 1; i < 32; i++) if (owns[who][i]) mask |= uint32(1) << i;
        return (mask, equipped[who], gotStarter[who]);
    }
}
