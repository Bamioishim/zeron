// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Test} from "forge-std/Test.sol";
import {MockWIF} from "../src/MockWIF.sol";
import {WifDepths} from "../src/WifDepths.sol";
import {WifQuest, IPool} from "../src/WifQuest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract QuestTest is Test {
    MockWIF wif; WifDepths game; WifQuest q;
    uint256 signerPk = 0x5157; address signer;
    address owner = address(0x0A); address alice = address(0xA1); address bob = address(0xB0);

    function setUp() public {
        vm.warp(100 days);
        signer = vm.addr(signerPk);
        wif = new MockWIF();
        game = new WifDepths(IERC20(address(wif)), true, 2000, 100 ether, signer, owner);
        q = new WifQuest(IERC20(address(wif)), IPool(address(game)), true, 2000, 20 ether, 10 ether, signer, owner);
        address[2] memory us = [alice, bob];
        for (uint256 i; i < 2; i++) { vm.startPrank(us[i]); wif.faucet(); wif.approve(address(q), type(uint256).max); vm.stopPrank(); }
    }
    function _clear(address p, uint8 lvl, uint8 i, uint8 h, uint8 g) internal {
        (,,,,,,, uint64 n) = q.players(p);
        uint64 dl = uint64(vm.getBlockTimestamp() + 600);
        bytes32 sh = keccak256(abi.encode(q.CLEAR_TYPEHASH(), p, lvl, i, h, g, n, dl));
        bytes32 dom = keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("WifQuest"), keccak256("1"), block.chainid, address(q)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, keccak256(abi.encodePacked("\x19\x01", dom, sh)));
        vm.prank(p); q.recordClear(lvl, i, h, g, dl, abi.encodePacked(r, s, v));
    }

    function test_levelsInOrderAndNoReplay() public {
        _clear(alice, 1, 2, 1, 0);
        (uint8 lvl,,,, uint16 iron,,,) = q.players(alice);
        assertEq(lvl, 1); assertEq(iron, 2);
        vm.expectRevert(bytes("wrong level")); vm.prank(alice); q.recordClear(3, 0, 0, 0, uint64(vm.getBlockTimestamp() + 9), "");
        // reusing a level-2 sig after it's been used fails (level + nonce move on)
        _clear(alice, 2, 1, 1, 0);
        (uint8 l2,,,,,,,) = q.players(alice); assertEq(l2, 2);
        uint64 dl = uint64(vm.getBlockTimestamp() + 9);
        vm.expectRevert(bytes("wrong level")); vm.prank(alice); q.recordClear(2, 1, 1, 0, dl, new bytes(65));
        // forged loot amounts fail
        vm.expectRevert(); vm.prank(alice); q.recordClear(3, 99, 0, 0, dl, new bytes(65));
    }
    function test_craftFeeSplitAndMaterials() public {
        _clear(alice, 1, 4, 0, 0);
        uint256 supply = wif.totalSupply(); uint64 d = game.today();
        vm.prank(alice); q.craft(0); // sword t1: 2 iron, 20 WIF
        (,uint8 sword,,,uint16 iron,,,) = q.players(alice);
        assertEq(sword, 1); assertEq(iron, 2);
        assertEq(wif.totalSupply(), supply - 4 ether, "20% destroyed");
        assertEq(game.pool(d), 16 ether, "rest to prize pool");
        (uint16 atk,,) = q.stats(alice); assertEq(atk, 6 + 2 + 1);
        vm.expectRevert(bytes("materials")); vm.prank(alice); q.craft(0); // t2 needs 4 iron, has 2
    }
    function test_craftNeedsMaterials() public {
        _clear(alice, 1, 3, 0, 0);
        vm.prank(alice); q.craft(0);
        vm.expectRevert(bytes("materials")); vm.prank(alice); q.craft(0);
        vm.expectRevert(bytes("materials")); vm.prank(alice); q.craft(2);
    }
    function _duel(address who, address def) internal returns (bool) {
        vm.prank(who); q.challenge(def);
        (,,,,,,, uint32 n) = q.fighters(who);
        bytes32 dom = keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("WifQuest"), keccak256("1"), block.chainid, address(q)));
        bytes32 sh = keccak256(abi.encode(q.DUEL_TYPEHASH(), who, def, n));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, keccak256(abi.encodePacked("\x19\x01", dom, sh)));
        return q.resolve(who, abi.encodePacked(r, s, v));
    }
    function test_pvpCommitReveal() public {
        vm.prank(owner); q.setNpc(address(1), 5, 0, 30); vm.prank(owner); q.setNpc(address(2), 5, 0, 30);
        _clear(alice, 1, 0, 0, 0); vm.prank(alice); q.register();
        vm.prank(alice); q.challenge(address(1));
        vm.expectRevert(bytes("battle pending")); vm.prank(alice); q.challenge(address(2));
        vm.expectRevert(bytes("bad sig")); q.resolve(alice, abi.encodePacked(bytes32(uint256(1)), bytes32(uint256(2)), uint8(27)));
        vm.expectRevert(bytes("not yet")); vm.prank(alice); q.cancelChallenge();
        uint256 b = wif.balanceOf(alice); vm.warp(block.timestamp + 2 hours);
        vm.prank(alice); q.cancelChallenge(); assertEq(wif.balanceOf(alice), b + 10 ether, "refund");
        vm.expectRevert(bytes("no battle")); q.resolve(alice, "");
    }
    function test_pvpNpcAndPlayers() public {
        vm.expectRevert(bytes("clear level 1 first")); vm.prank(alice); q.register();
        vm.prank(owner); q.setNpc(address(1), 5, 0, 30); // weak NPC
        vm.prank(owner); q.setNpc(address(2), 40, 20, 400); // boss NPC
        vm.expectRevert(); vm.prank(alice); q.setNpc(address(3), 1, 1, 1);
        _clear(alice, 1, 0, 0, 0); vm.prank(alice); q.register();
        uint256 b0 = wif.balanceOf(alice); uint256 s0 = wif.totalSupply();
        bool w = _duel(alice, address(1));
        assertTrue(w); assertEq(wif.balanceOf(alice), b0 - 1 ether, "winner keeps 90%"); assertEq(wif.totalSupply(), s0 - 1 ether);
        w = _duel(alice, address(2));
        assertFalse(w); assertEq(game.pool(game.today()), 9 ether, "npc win -> pool");
        (,,,, uint16 rating, uint16 wins, uint16 losses,) = q.fighters(alice);
        assertEq(wins, 1); assertEq(losses, 1); assertEq(rating, 1000);
        // player vs player: defender stakes nothing, gets 90% if they win
        _clear(bob, 1, 0, 0, 0); vm.prank(bob); q.register();
        uint256 bb = wif.balanceOf(bob); uint256 ab = wif.balanceOf(alice);
        w = _duel(alice, bob);
        if (w) assertEq(wif.balanceOf(bob), bb); else assertEq(wif.balanceOf(bob), bb + 9 ether);
        assertEq(ab - wif.balanceOf(alice), w ? 1 ether : 10 ether);
        vm.expectRevert(bytes("register first")); vm.prank(address(0xC0)); q.challenge(bob);
        vm.expectRevert(bytes("self")); vm.prank(alice); q.challenge(alice);
    }
    function test_battleDeterministic() public view {
        bytes32 s = keccak256("x");
        assertEq(q.simulate(9, 2, 70, 8, 2, 66, s), q.simulate(9, 2, 70, 8, 2, 66, s));
        assertTrue(q.simulate(50, 10, 200, 3, 0, 20, s));
        assertFalse(q.simulate(3, 0, 20, 50, 10, 200, s));
    }
}
