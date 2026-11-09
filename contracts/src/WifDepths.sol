// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {FeeSink} from "./FeeSink.sol";

/// @notice Daily dungeon. Fees: burnBps destroyed, remainder to that day's prize pool.
/// Settlement pays the top three ranked scores (configurable place bps, default 50/30/20).
contract WifDepths is FeeSink, EIP712 {
    bytes32 public constant RUN_TYPEHASH =
        keccak256("Run(address player,uint64 day,uint32 score,uint32 xp,uint64 nonce,uint64 deadline,bytes32 used)");

    address public signer;
    uint256 public entryFee;
    mapping(uint8 => uint256) public itemPrice;
    mapping(address => mapping(uint8 => uint256)) public items;
    mapping(uint64 => mapping(address => bool)) public entered;
    mapping(uint64 => uint256) public pool;
    mapping(uint64 => address) public leader; // backward-compat: = place1
    mapping(uint64 => uint32) public topScore; // backward-compat: = place1 score
    mapping(uint64 => bool) public settled;
    mapping(uint64 => mapping(address => uint32)) public bestScore;
    mapping(address => uint64) public nonces;
    mapping(address => uint256) public xp;
    mapping(address => uint64) public lastRunDay;
    mapping(address => uint32) public streak;

    mapping(uint64 => address[3]) public places; // day => top3 addresses
    mapping(uint64 => uint32[3]) public placeScores;
    uint16[3] public placeBps; // default 5000/3000/2000

    event Entered(address indexed player, uint64 indexed day, uint256 fee, uint256 toPool);
    event Bought(address indexed player, uint8 indexed item, uint256 qty, uint256 cost);
    event ItemUsed(address indexed player, uint8 indexed item);
    event RunRecorded(address indexed player, uint64 indexed day, uint32 score, uint32 xp, uint32 streak, bool newLeader);
    event Settled(uint64 indexed day, address indexed winner, uint256 prize);
    event SettledPodium(uint64 indexed day, address place1, address place2, address place3, uint256 paid1, uint256 paid2, uint256 paid3);
    event PlaceBpsSet(uint16 p1, uint16 p2, uint16 p3);

    constructor(IERC20 _wif, bool _useBurn, uint16 _burnBps, uint256 _entryFee, address _signer, address _owner)
        FeeSink(_wif, _useBurn, _burnBps, _owner) EIP712("WifDepths", "1") {
        entryFee = _entryFee;
        signer = _signer;
        placeBps[0] = 5000;
        placeBps[1] = 3000;
        placeBps[2] = 2000;
    }

    function today() public view returns (uint64) { return uint64(block.timestamp / 1 days); }
    function setSigner(address s) external onlyOwner { signer = s; }
    function setEntryFee(uint256 f) external onlyOwner { entryFee = f; }
    function setItemPrice(uint8 id, uint256 p) external onlyOwner { itemPrice[id] = p; }
    function setPlaceBps(uint16 p1, uint16 p2, uint16 p3) external onlyOwner {
        require(uint256(p1) + p2 + p3 == 10_000, "bps sum");
        placeBps[0] = p1; placeBps[1] = p2; placeBps[2] = p3;
        emit PlaceBpsSet(p1, p2, p3);
    }

    function enterRanked() external {
        uint64 d = today();
        require(!entered[d][msg.sender], "already entered");
        entered[d][msg.sender] = true;
        uint256 kept = _takeFee(msg.sender, entryFee);
        pool[d] += kept;
        emit Entered(msg.sender, d, entryFee, kept);
    }

    function buy(uint8 id, uint256 qty) external {
        uint256 p = itemPrice[id];
        require(p > 0, "not for sale");
        require(qty > 0 && qty <= 20, "qty");
        uint256 cost = p * qty;
        pool[today()] += _takeFee(msg.sender, cost);
        items[msg.sender][id] += qty;
        emit Bought(msg.sender, id, qty, cost);
    }

    function addToPool(uint256 amt) external {
        require(wif.transferFrom(msg.sender, address(this), amt), "transferFrom");
        pool[today()] += amt;
    }

    function runDigest(address player, uint64 day, uint32 score, uint32 xp_, uint64 nonce, uint64 deadline, uint8[] calldata used)
        public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RUN_TYPEHASH, player, day, score, xp_, nonce, deadline, keccak256(abi.encodePacked(used)))));
    }

    function _updatePodium(uint64 day, address player, uint32 score) internal returns (bool newLeader) {
        address[3] storage pl = places[day];
        uint32[3] storage sc = placeScores[day];
        // Remove existing seat for this player (score update)
        for (uint256 i; i < 3; i++) {
            if (pl[i] == player) {
                for (uint256 j = i; j < 2; j++) { pl[j] = pl[j + 1]; sc[j] = sc[j + 1]; }
                pl[2] = address(0); sc[2] = 0;
                break;
            }
        }
        // Insert if qualifies
        for (uint256 i; i < 3; i++) {
            if (score > sc[i] || pl[i] == address(0)) {
                for (uint256 j = 2; j > i; j--) { pl[j] = pl[j - 1]; sc[j] = sc[j - 1]; }
                pl[i] = player; sc[i] = score;
                break;
            }
        }
        leader[day] = pl[0];
        topScore[day] = sc[0];
        newLeader = (pl[0] == player);
    }

    function recordRun(uint64 day, uint32 score, uint32 xp_, uint64 deadline, uint8[] calldata used, bytes calldata sig)
        external {
        require(block.timestamp <= deadline, "expired");
        require(day == today(), "wrong day");
        uint64 n = nonces[msg.sender]++;
        bytes32 h = keccak256(abi.encode(RUN_TYPEHASH, msg.sender, day, score, xp_, n, deadline, keccak256(abi.encodePacked(used))));
        require(ECDSA.recover(_hashTypedDataV4(h), sig) == signer, "bad sig");
        for (uint256 i; i < used.length; i++) {
            require(items[msg.sender][used[i]] > 0, "item missing");
            items[msg.sender][used[i]] -= 1;
            emit ItemUsed(msg.sender, used[i]);
        }
        xp[msg.sender] += xp_;
        uint64 last = lastRunDay[msg.sender];
        if (last + 1 == day) streak[msg.sender] += 1;
        else if (last != day) streak[msg.sender] = 1;
        lastRunDay[msg.sender] = day;
        bool lead;
        if (entered[day][msg.sender] && score > bestScore[day][msg.sender]) {
            bestScore[day][msg.sender] = score;
            lead = _updatePodium(day, msg.sender, score);
        }
        emit RunRecorded(msg.sender, day, score, xp_, streak[msg.sender], lead);
    }

    /// @notice After a day ends, pay the top three by `placeBps`. Empty podium seats roll their share to today.
    function settle(uint64 day) external {
        require(day < today(), "day not over");
        require(!settled[day], "settled");
        settled[day] = true;
        uint256 amt = pool[day];
        pool[day] = 0;
        address[3] memory pl = places[day];
        uint256 paid1; uint256 paid2; uint256 paid3;
        if (amt == 0) {
            emit Settled(day, pl[0], 0);
            emit SettledPodium(day, pl[0], pl[1], pl[2], 0, 0, 0);
            return;
        }
        uint256 roll;
        uint256 p1 = amt * placeBps[0] / 10_000;
        uint256 p2 = amt * placeBps[1] / 10_000;
        uint256 p3 = amt - p1 - p2; // remainder to 3rd to avoid dust
        if (pl[0] == address(0)) roll += p1; else { paid1 = p1; require(wif.transfer(pl[0], p1), "prize1"); }
        if (pl[1] == address(0)) roll += p2; else { paid2 = p2; require(wif.transfer(pl[1], p2), "prize2"); }
        if (pl[2] == address(0)) roll += p3; else { paid3 = p3; require(wif.transfer(pl[2], p3), "prize3"); }
        if (roll > 0) pool[today()] += roll;
        emit Settled(day, pl[0], paid1);
        emit SettledPodium(day, pl[0], pl[1], pl[2], paid1, paid2, paid3);
    }

    function domainSeparator() external view returns (bytes32) { return _domainSeparatorV4(); }
}
