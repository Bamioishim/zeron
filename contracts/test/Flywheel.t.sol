// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Test} from "forge-std/Test.sol";
import {ZeronArmory} from "../src/ZeronArmory.sol";
import {WifDepths} from "../src/WifDepths.sol";
import {MockWIF} from "../src/MockWIF.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FlywheelTest is Test {
    MockWIF w;
    ZeronArmory armory;
    WifDepths game;
    uint256 sk = 0xA11CE;
    address signer;
    address p1 = address(0xBEEF);
    address p2 = address(0xCAFE);
    address p3 = address(0xF00D);
    address p4 = address(0xD00D);

    function setUp() public {
        vm.warp(10 days);
        signer = vm.addr(sk);
        w = new MockWIF();
        armory = new ZeronArmory(IERC20(address(w)), false, 5000, address(0x7777), signer, address(this));
        game = new WifDepths(IERC20(address(w)), false, 2000, 10 ether, signer, address(this));
        w.faucet();
        w.transfer(p1, 500 ether);
        w.transfer(p2, 500 ether);
        w.transfer(p3, 500 ether);
        w.transfer(p4, 500 ether);
        armory.setWeapon(1, 100 ether, false);
        armory.setCap(1000 ether);
    }

    function _armSig(address player, uint256 amt, uint8 used, uint8 drop, uint256 n, uint256 dl) internal view returns (bytes memory) {
        bytes32 sh = keccak256(abi.encode(armory.CLAIM_TYPEHASH(), player, amt, used, drop, n, dl));
        bytes32 dom = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("ZeronArmory")), keccak256(bytes("1")), block.chainid, address(armory)
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sk, keccak256(abi.encodePacked("\x19\x01", dom, sh)));
        return abi.encodePacked(r, s, v);
    }

    function _runSig(address player, uint64 day, uint32 score, uint32 xp_, uint64 n, uint64 dl, uint8[] memory used)
        internal view returns (bytes memory)
    {
        bytes32 digest = game.runDigest(player, day, score, xp_, n, dl, used);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testArmoryKeepsPurchaseInPool() public {
        vm.startPrank(p1);
        w.approve(address(armory), type(uint256).max);
        uint256 before = w.balanceOf(address(armory));
        armory.buy(1);
        assertEq(w.balanceOf(address(armory)) - before, 50 ether);
        assertEq(armory.inflow24h(), 50 ether);
        assertEq(armory.rollingPayoutRoom(), 32.5 ether);
        vm.stopPrank();
    }

    function testArmoryFlywheelCapsClaims() public {
        vm.startPrank(p1);
        w.approve(address(armory), type(uint256).max);
        armory.buy(1);
        uint256 b0 = w.balanceOf(p1);
        uint256 dl = block.timestamp + 60;
        armory.claim(100 ether, 0, 0, dl, _armSig(p1, 100 ether, 0, 0, 0, dl));
        assertEq(w.balanceOf(p1) - b0, 32.5 ether);
        assertEq(armory.rollingPayoutRoom(), 0);
        vm.stopPrank();
    }

    function testArmoryHourRotationClearsOldInflows() public {
        vm.startPrank(p1);
        w.approve(address(armory), type(uint256).max);
        armory.buy(1);
        assertEq(armory.inflow24h(), 50 ether);
        vm.warp(block.timestamp + 25 hours);
        assertEq(armory.inflow24h(), 0);
        vm.stopPrank();
    }

    function testRankedTop3Split() public {
        uint64 day = game.today();
        uint64 dl = uint64(block.timestamp + 600);
        uint8[] memory used = new uint8[](0);
        address[4] memory ps = [p1, p2, p3, p4];
        for (uint256 i; i < 4; i++) {
            vm.startPrank(ps[i]);
            w.approve(address(game), type(uint256).max);
            game.enterRanked();
            vm.stopPrank();
        }
        assertEq(game.pool(day), 32 ether);

        bytes memory s1 = _runSig(p1, day, 300, 1, 0, dl, used);
        bytes memory s2 = _runSig(p2, day, 200, 1, 0, dl, used);
        bytes memory s3 = _runSig(p3, day, 100, 1, 0, dl, used);
        bytes memory s4 = _runSig(p4, day, 50, 1, 0, dl, used);
        vm.prank(p1); game.recordRun(day, 300, 1, dl, used, s1);
        vm.prank(p2); game.recordRun(day, 200, 1, dl, used, s2);
        vm.prank(p3); game.recordRun(day, 100, 1, dl, used, s3);
        vm.prank(p4); game.recordRun(day, 50, 1, dl, used, s4);

        assertEq(game.places(day, 0), p1);
        assertEq(game.places(day, 1), p2);
        assertEq(game.places(day, 2), p3);

        vm.warp(block.timestamp + 1 days);
        uint256 b1 = w.balanceOf(p1);
        uint256 b2 = w.balanceOf(p2);
        uint256 b3 = w.balanceOf(p3);
        uint256 b4 = w.balanceOf(p4);
        game.settle(day);
        assertEq(w.balanceOf(p1) - b1, 16 ether);
        assertEq(w.balanceOf(p2) - b2, 9.6 ether);
        assertEq(w.balanceOf(p3) - b3, 6.4 ether);
        assertEq(w.balanceOf(p4) - b4, 0);
    }

    function testRankedPlaceBpsMustSum10000() public {
        game.setPlaceBps(6000, 2500, 1500);
        vm.expectRevert();
        game.setPlaceBps(5000, 3000, 1000);
    }
}
