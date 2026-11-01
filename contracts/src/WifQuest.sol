// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {FeeSink} from "./FeeSink.sol";

interface IPool { function addToPool(uint256) external; }

/// @notice Level progression (server-signed boss-clear checkpoints), crafting, and async PvP.
/// Gas-light: one write per boss clear and per craft; battles are commit (challenge) + server-signed reveal (resolve).
contract WifQuest is FeeSink, EIP712 {
    bytes32 public constant CLEAR_TYPEHASH = keccak256(
        "Clear(address player,uint8 level,uint8 iron,uint8 hide,uint8 glow,uint64 nonce,uint64 deadline)");
    uint8 public constant MAX_LEVEL = 6;
    uint8 public constant MAX_TIER = 3;

    IPool public immutable game;
    address public signer;
    uint256 public craftFee;   // per tier
    uint256 public pvpStake;   // fixed challenger stake
    uint16 public pvpBurnBps = 1000; // share of a lost/won stake destroyed

    struct Player { uint8 level; uint8 sword; uint8 armor; uint8 charm; uint16 iron; uint16 hide; uint16 glow; uint64 nonce; }
    struct Fighter { uint16 atk; uint16 def; uint16 hp; bool npc; uint16 rating; uint16 wins; uint16 losses; uint32 battles; }
    mapping(address => Player) public players;
    mapping(address => Fighter) public fighters;
    address[] public fighterList;

    event LevelCleared(address indexed player, uint8 level, uint8 iron, uint8 hide, uint8 glow);
    event Crafted(address indexed player, uint8 kind, uint8 tier, uint256 fee);
    event Registered(address indexed fighter, uint16 atk, uint16 def, uint16 hp, bool npc);
    event Battle(address indexed challenger, address indexed defender, bool challengerWon, bytes32 seed, uint256 stake, uint16 cRating, uint16 dRating);

    constructor(IERC20 _wif, IPool _game, bool _useBurn, uint16 _burnBps, uint256 _craftFee, uint256 _pvpStake, address _signer, address _owner)
        FeeSink(_wif, _useBurn, _burnBps, _owner) EIP712("WifQuest", "1") {
        game = _game; craftFee = _craftFee; pvpStake = _pvpStake; signer = _signer;
        _wif.approve(address(_game), type(uint256).max);
    }
    function setSigner(address s) external onlyOwner { signer = s; }
    function setFees(uint256 c, uint256 s, uint16 b) external onlyOwner { require(b <= 10_000, "bps"); craftFee = c; pvpStake = s; pvpBurnBps = b; }

    /* ---------- level progression ---------- */
    function recordClear(uint8 level, uint8 iron, uint8 hide, uint8 glow, uint64 deadline, bytes calldata sig) external {
        require(block.timestamp <= deadline, "expired");
        Player storage p = players[msg.sender];
        require(level == p.level + 1 && level <= MAX_LEVEL, "wrong level");
        bytes32 h = keccak256(abi.encode(CLEAR_TYPEHASH, msg.sender, level, iron, hide, glow, p.nonce++, deadline));
        require(ECDSA.recover(_hashTypedDataV4(h), sig) == signer, "bad sig");
        p.level = level; p.iron += iron; p.hide += hide; p.glow += glow;
        emit LevelCleared(msg.sender, level, iron, hide, glow);
    }

    /* ---------- crafting: 0 sword (+2 ATK), 1 armor (+1 DEF), 2 charm (+8 HP) per tier ---------- */
    function recipe(uint8 kind, uint8 tier) public view returns (uint16 iron, uint16 hide, uint16 glow, uint256 fee) {
        fee = craftFee * tier;
        if (kind == 0) iron = 2 * tier;
        else if (kind == 1) hide = 2 * tier;
        else { glow = tier; iron = 1; }
    }
    function craft(uint8 kind) external {
        require(kind < 3, "kind");
        Player storage p = players[msg.sender];
        uint8 tier = (kind == 0 ? p.sword : kind == 1 ? p.armor : p.charm) + 1;
        require(tier <= MAX_TIER, "max tier");
        (uint16 i, uint16 h, uint16 g, uint256 fee) = recipe(kind, tier);
        require(p.iron >= i && p.hide >= h && p.glow >= g, "materials");
        p.iron -= i; p.hide -= h; p.glow -= g;
        if (kind == 0) p.sword = tier; else if (kind == 1) p.armor = tier; else p.charm = tier;
        uint256 kept = _takeFee(msg.sender, fee);
        if (kept > 0) game.addToPool(kept);
        emit Crafted(msg.sender, kind, tier, fee);
    }
    function stats(address a) public view returns (uint16 atk, uint16 def, uint16 hp) {
        Player memory p = players[a];
        atk = 6 + 2 * p.sword + p.level; def = 1 + p.armor; hp = 60 + 8 * p.charm + 4 * p.level;
    }

    /* ---------- PvP ---------- */
    /// register (or refresh) your fighter snapshot. Needs at least one cleared level. Defending is free:
    /// a defender never loses WIF, and wins most of a losing challenger's stake.
    function register() external {
        require(players[msg.sender].level >= 1, "clear level 1 first");
        (uint16 a, uint16 d, uint16 h) = stats(msg.sender);
        _setFighter(msg.sender, a, d, h, false);
    }
    function setNpc(address id, uint16 a, uint16 d, uint16 h) external onlyOwner {
        require(uint160(id) < 1000, "npc ids are 1..999");
        _setFighter(id, a, d, h, true);
    }
    function _setFighter(address id, uint16 a, uint16 d, uint16 h, bool npc) internal {
        Fighter storage f = fighters[id];
        if (f.hp == 0) { fighterList.push(id); f.rating = 1000; }
        f.atk = a; f.def = d; f.hp = h; f.npc = npc;
        emit Registered(id, a, d, h, npc);
    }
    function fighterCount() external view returns (uint256) { return fighterList.length; }

    /// pure, deterministic battle shared with the frontend replay. Returns challenger win.
    function simulate(uint16 aA, uint16 aD, uint16 aH, uint16 bA, uint16 bD, uint16 bH, bytes32 seed) public pure returns (bool) {
        int256 ha = int256(uint256(aH)); int256 hb = int256(uint256(bH));
        for (uint256 i; i < 60; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, i))) % 100;
            bool aTurn = i % 2 == 0;
            (uint16 atk, uint16 def) = aTurn ? (aA, bD) : (bA, aD);
            if (r < 10) continue; // miss
            int256 dmg = int256(uint256(atk)) + int256(r % 4) - int256(uint256(def));
            if (dmg < 1) dmg = 1;
            if (r >= 92) dmg *= 2; // crit
            if (aTurn) { hb -= dmg; if (hb <= 0) return true; } else { ha -= dmg; if (ha <= 0) return false; }
        }
        return ha * int256(uint256(bH)) > hb * int256(uint256(aH)); // higher hp% wins, ties to defender
    }

    /// PvP is commit then reveal: challenge() locks the stake and snapshots both fighters; the server then
    /// signs Duel(challenger, defender, battle) and anyone submits it to resolve(). The seed is the hash of that
    /// signature, so nobody (including the player) can predict the outcome before the stake is locked.
    bytes32 public constant DUEL_TYPEHASH = keccak256("Duel(address challenger,address defender,uint32 battle)");
    struct Pending { address defender; uint64 at; uint16 aA; uint16 aD; uint16 aH; uint16 bA; uint16 bD; uint16 bH; uint256 stake; }
    mapping(address => Pending) public pending;
    event Challenged(address indexed challenger, address indexed defender, uint32 battle);

    function challenge(address defender) external {
        require(defender != msg.sender, "self");
        Fighter storage c = fighters[msg.sender]; Fighter storage d = fighters[defender];
        require(c.hp > 0 && !c.npc, "register first");
        require(d.hp > 0, "no such fighter");
        require(pending[msg.sender].defender == address(0), "battle pending");
        uint256 s = pvpStake;
        require(wif.transferFrom(msg.sender, address(this), s), "stake");
        pending[msg.sender] = Pending(defender, uint64(block.timestamp), c.atk, c.def, c.hp, d.atk, d.def, d.hp, s);
        emit Challenged(msg.sender, defender, c.battles);
    }

    function resolve(address challenger, bytes calldata sig) external returns (bool won) {
        Pending memory p = pending[challenger];
        require(p.defender != address(0), "no battle");
        Fighter storage c = fighters[challenger]; Fighter storage d = fighters[p.defender];
        bytes32 h = keccak256(abi.encode(DUEL_TYPEHASH, challenger, p.defender, c.battles));
        require(ECDSA.recover(_hashTypedDataV4(h), sig) == signer, "bad sig");
        delete pending[challenger];
        bytes32 seed = keccak256(sig);
        won = simulate(p.aA, p.aD, p.aH, p.bA, p.bD, p.bH, seed);
        uint256 burnAmt = p.stake * pvpBurnBps / 10_000;
        _destroy(burnAmt);
        uint256 rest = p.stake - burnAmt;
        if (won) { require(wif.transfer(challenger, rest), "pay"); c.wins++; d.losses++; }
        else {
            c.losses++; d.wins++;
            if (d.npc) game.addToPool(rest); else require(wif.transfer(p.defender, rest), "pay");
        }
        c.battles++; d.battles++;
        (c.rating, d.rating) = won ? (c.rating + 16, d.rating > 16 ? d.rating - 16 : 0) : (c.rating > 16 ? c.rating - 16 : 0, d.rating + 16);
        emit Battle(challenger, p.defender, won, seed, p.stake, c.rating, d.rating);
    }

    /// if the server never resolves, the challenger can take the stake back after an hour
    function cancelChallenge() external {
        Pending memory p = pending[msg.sender];
        require(p.defender != address(0) && block.timestamp > p.at + 1 hours, "not yet");
        delete pending[msg.sender];
        require(wif.transfer(msg.sender, p.stake), "refund");
    }
}
