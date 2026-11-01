// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {FeeSink} from "./FeeSink.sol";

/// @notice Zeron armory: weapons (owned + equipped on-chain), launcher ammo, and play-to-earn rewards.
/// Purchases: burnBps destroyed, the rest to the treasury. Rewards are paid from a pre-funded pool
/// (never minted), batched into one signed claim per run and capped per wallet per day.
contract ZeronArmory is FeeSink, EIP712 {
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address player,uint256 amount,uint8 ammoUsed,uint8 drop,uint256 nonce,uint256 deadline)");
    uint8 public constant START_AMMO = 3;
    address public treasury;
    address public signer;
    uint256 public dailyCap = 150 ether;
    uint256 public ammoPrice = 15 ether;     // refill to START_AMMO
    mapping(uint8 => uint256) public price;  // 0 = not for sale
    mapping(uint8 => bool) public usesAmmo;
    mapping(address => mapping(uint8 => bool)) public owns;
    mapping(address => uint8) public equipped; // 0 = sword (default)
    mapping(address => uint8) public ammo;
    mapping(address => uint256) public nonces;
    mapping(address => mapping(uint256 => uint256)) public earnedOn; // day => paid
    event Bought(address indexed who, uint8 id, uint256 price);
    event Equipped(address indexed who, uint8 id);
    event Refilled(address indexed who, uint256 price);
    event Rewarded(address indexed who, uint256 amount, uint8 ammoUsed, uint8 drop);

    constructor(IERC20 _wif, bool _useBurn, uint16 _burnBps, address _treasury, address _signer, address _owner)
        FeeSink(_wif, _useBurn, _burnBps, _owner) EIP712("ZeronArmory", "1") { treasury = _treasury; signer = _signer; }
    function setWeapon(uint8 id, uint256 p, bool ammo_) external onlyOwner { price[id] = p; usesAmmo[id] = ammo_; }
    function setCap(uint256 c) external onlyOwner { dailyCap = c; }
    function setAmmoPrice(uint256 p) external onlyOwner { ammoPrice = p; }
    function setSigner(address s) external onlyOwner { signer = s; }
    function setTreasury(address t) external onlyOwner { treasury = t; }

    function _pay(uint256 p) internal { uint256 kept = _takeFee(msg.sender, p); if (kept > 0) require(wif.transfer(treasury, kept), "armory: treasury"); }
    function buy(uint8 id) external {
        uint256 p = price[id];
        require(p > 0, "armory: not for sale");
        require(!owns[msg.sender][id], "armory: owned");
        _pay(p);
        owns[msg.sender][id] = true; emit Bought(msg.sender, id, p);
        if (usesAmmo[id] && ammo[msg.sender] < START_AMMO) ammo[msg.sender] = START_AMMO;
        equipped[msg.sender] = id; emit Equipped(msg.sender, id);
    }
    function equip(uint8 id) external { require(id == 0 || owns[msg.sender][id], "armory: not owned"); equipped[msg.sender] = id; emit Equipped(msg.sender, id); }
    function refill() external { require(ammo[msg.sender] < START_AMMO, "armory: full"); _pay(ammoPrice); ammo[msg.sender] = START_AMMO; emit Refilled(msg.sender, ammoPrice); }

    /// @notice one batched claim per verified run: WIF earned (kills + clear), ammo spent, optional event drop
    function claim(uint256 amount, uint8 ammoUsed, uint8 drop, uint256 deadline, bytes calldata sig) external {
        require(block.timestamp <= deadline, "claim: expired");
        uint256 n = nonces[msg.sender]++;
        bytes32 h = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, amount, ammoUsed, drop, n, deadline)));
        require(ECDSA.recover(h, sig) == signer, "claim: bad sig");
        ammo[msg.sender] = ammo[msg.sender] > ammoUsed ? ammo[msg.sender] - ammoUsed : 0;
        if (drop != 0 && !owns[msg.sender][drop]) { owns[msg.sender][drop] = true; if (usesAmmo[drop] && ammo[msg.sender] < START_AMMO) ammo[msg.sender] = START_AMMO; }
        uint256 d = block.timestamp / 1 days;
        uint256 room = dailyCap > earnedOn[msg.sender][d] ? dailyCap - earnedOn[msg.sender][d] : 0;
        uint256 pay = amount < room ? amount : room;
        uint256 bal = wif.balanceOf(address(this));
        if (pay > bal) pay = bal;
        if (pay > 0) { earnedOn[msg.sender][d] += pay; require(wif.transfer(msg.sender, pay), "claim: transfer"); }
        emit Rewarded(msg.sender, pay, ammoUsed, drop);
    }
    function arsenal(address who) external view returns (uint32 mask, uint8 eq, uint8 ammo_, uint256 earnedToday, uint256 nonce) {
        mask = 1;
        for (uint8 i = 1; i < 32; i++) if (owns[who][i]) mask |= uint32(1) << i;
        return (mask, equipped[who], ammo[who], earnedOn[who][block.timestamp / 1 days], nonces[who]);
    }
}
