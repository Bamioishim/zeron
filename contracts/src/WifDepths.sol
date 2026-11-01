// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {FeeSink} from "./FeeSink.sol";

/// @notice Daily dungeon. Free play is offchain. $wif: ranked entry, shop. Runs are verified
/// offchain (deterministic replay) and the result is signed by `signer`; signed runs are
/// replay-protected by a per-player nonce. Fees: burnBps destroyed, the rest goes to that day's prize pool.
contract WifDepths is FeeSink, EIP712 {
    bytes32 public constant RUN_TYPEHASH =
        keccak256("Run(address player,uint64 day,uint32 score,uint32 xp,uint64 nonce,uint64 deadline,bytes32 used)");

    address public signer;
    uint256 public entryFee;
    mapping(uint8 => uint256) public itemPrice; // 0 = not for sale
    mapping(address => mapping(uint8 => uint256)) public items;
    mapping(uint64 => mapping(address => bool)) public entered;
    mapping(uint64 => uint256) public pool;
    mapping(uint64 => address) public leader;
    mapping(uint64 => uint32) public topScore;
    mapping(uint64 => bool) public settled;
    mapping(uint64 => mapping(address => uint32)) public bestScore;
    mapping(address => uint64) public nonces;
    mapping(address => uint256) public xp;
    mapping(address => uint64) public lastRunDay;
    mapping(address => uint32) public streak;

    event Entered(address indexed player, uint64 indexed day, uint256 fee, uint256 toPool);
    event Bought(address indexed player, uint8 indexed item, uint256 qty, uint256 cost);
    event ItemUsed(address indexed player, uint8 indexed item);
    event RunRecorded(address indexed player, uint64 indexed day, uint32 score, uint32 xp, uint32 streak, bool newLeader);
    event Settled(uint64 indexed day, address indexed winner, uint256 prize);

    constructor(IERC20 _wif, bool _useBurn, uint16 _burnBps, uint256 _entryFee, address _signer, address _owner)
        FeeSink(_wif, _useBurn, _burnBps, _owner) EIP712("WifDepths", "1") {
        entryFee = _entryFee; signer = _signer;
    }

    function today() public view returns (uint64) { return uint64(block.timestamp / 1 days); }
    function setSigner(address s) external onlyOwner { signer = s; }
    function setEntryFee(uint256 f) external onlyOwner { entryFee = f; }
    function setItemPrice(uint8 id, uint256 p) external onlyOwner { itemPrice[id] = p; }

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

    /// @notice anyone (e.g. the crafting/PvP contract) can add WIF to today's prize pool
    function addToPool(uint256 amt) external {
        require(wif.transferFrom(msg.sender, address(this), amt), "transferFrom");
        pool[today()] += amt;
    }

    function runDigest(address player, uint64 day, uint32 score, uint32 xp_, uint64 nonce, uint64 deadline, uint8[] calldata used)
        public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RUN_TYPEHASH, player, day, score, xp_, nonce, deadline, keccak256(abi.encodePacked(used)))));
    }

    /// @notice record a server-verified run. Ranked only counts for the leaderboard if entered that day.
    /// `used` lists consumables spent in the run (verified offchain, burned from inventory here).
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
            if (score > topScore[day]) { topScore[day] = score; leader[day] = msg.sender; lead = true; }
        }
        emit RunRecorded(msg.sender, day, score, xp_, streak[msg.sender], lead);
    }

    /// @notice after a day ends anyone can pay its pool to the leader. No leader: pool rolls to today.
    function settle(uint64 day) external {
        require(day < today(), "day not over");
        require(!settled[day], "settled");
        settled[day] = true;
        uint256 amt = pool[day]; pool[day] = 0;
        address w = leader[day];
        if (w == address(0)) pool[today()] += amt;
        else if (amt > 0) require(wif.transfer(w, amt), "prize");
        emit Settled(day, w, amt);
    }

    function domainSeparator() external view returns (bytes32) { return _domainSeparatorV4(); }
}
