// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Test} from "forge-std/Test.sol";
import {MockWIF} from "../src/MockWIF.sol";
import {WifDepths} from "../src/WifDepths.sol";
import {NameRegistry} from "../src/NameRegistry.sol";
import {WifAccount} from "../src/WifAccount.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WifTest is Test {
    MockWIF wif; WifDepths game; NameRegistry reg; bytes32 dom; bytes32 TH;
    uint256 signerPk = 0xA11CE; address signer;
    address owner = address(0x0A); address alice = address(0xA1); address bob = address(0xB0);
    address treasury = address(0x7E);
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        vm.warp(100 days);
        signer = vm.addr(signerPk);
        wif = new MockWIF();
        game = new WifDepths(IERC20(address(wif)), true, 2000, 100 ether, signer, owner);
        reg = new NameRegistry(IERC20(address(wif)), true, 5000, 50 ether, treasury, owner);
        vm.prank(owner); game.setItemPrice(1, 20 ether);
        dom = game.domainSeparator(); TH = game.RUN_TYPEHASH();
        for (uint256 i; i < 2; i++) {
            address u = i == 0 ? alice : bob;
            vm.startPrank(u); wif.faucet(); wif.approve(address(game), type(uint256).max); wif.approve(address(reg), type(uint256).max); vm.stopPrank();
        }
    }

    function _sign(address p, uint64 day, uint32 score, uint32 xp, uint64 n, uint64 dl, uint8[] memory used) internal view returns (bytes memory) {
        bytes32 sh = keccak256(abi.encode(TH, p, day, score, xp, n, dl, keccak256(abi.encodePacked(used))));
        bytes32 h = keccak256(abi.encodePacked("\x19\x01", dom, sh));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, h);
        return abi.encodePacked(r, s, v);
    }

    function test_entryFeeSplitAndBurn() public {
        uint256 supply = wif.totalSupply();
        vm.prank(alice); game.enterRanked();
        uint64 d = game.today();
        assertEq(game.pool(d), 80 ether);
        assertEq(wif.totalSupply(), supply - 20 ether, "burn reduces supply");
        assertEq(game.totalDestroyed(), 20 ether);
        assertEq(wif.balanceOf(address(game)), 80 ether);
    }
    function test_deadModeWhenBurnOff() public {
        vm.prank(owner); game.setBurnConfig(false, 1000);
        uint256 supply = wif.totalSupply();
        vm.prank(alice); game.enterRanked();
        assertEq(wif.balanceOf(DEAD), 10 ether);
        assertEq(wif.totalSupply(), supply);
    }
    function test_enterOncePerDay() public {
        vm.startPrank(alice); game.enterRanked();
        vm.expectRevert(bytes("already entered")); game.enterRanked();
        vm.warp(block.timestamp + 1 days); game.enterRanked(); vm.stopPrank();
    }
    function test_noWifNoEntry() public {
        address c = address(0xC0);
        vm.prank(c); wif.approve(address(game), type(uint256).max);
        vm.prank(c); vm.expectRevert(); game.enterRanked();
    }
    function test_shop() public {
        vm.prank(alice); game.buy(1, 3);
        assertEq(game.items(alice, 1), 3);
        assertEq(game.pool(game.today()), 48 ether);
        vm.prank(alice); vm.expectRevert(bytes("not for sale")); game.buy(9, 1);
        vm.prank(alice); vm.expectRevert(bytes("qty")); game.buy(1, 0);
    }
    function test_accessControl() public {
        vm.prank(alice); vm.expectRevert(); game.setItemPrice(1, 1);
        vm.prank(alice); vm.expectRevert(); game.setSigner(alice);
        vm.prank(alice); vm.expectRevert(); game.setBurnConfig(false, 0);
        vm.prank(alice); vm.expectRevert(); reg.setNameFee(0);
        vm.prank(owner); vm.expectRevert(bytes("bps")); game.setBurnConfig(true, 10_001);
    }
    function test_recordRunReplayAndLeader() public {
        uint64 d = game.today(); uint64 dl = uint64(block.timestamp + 600);
        uint8[] memory none = new uint8[](0);
        vm.prank(alice); game.enterRanked();
        bytes memory sig = _sign(alice, d, 500, 40, 0, dl, none);
        vm.prank(alice); game.recordRun(d, 500, 40, dl, none, sig);
        assertEq(game.leader(d), alice); assertEq(game.xp(alice), 40); assertEq(game.streak(alice), 1);
        vm.prank(alice); vm.expectRevert(bytes("bad sig")); game.recordRun(d, 500, 40, dl, none, sig); // replay
        bytes memory forged = _sign(bob, d, 900, 40, 0, dl, none);
        vm.prank(alice); vm.expectRevert(bytes("bad sig")); game.recordRun(d, 900, 40, dl, none, forged); // other player's sig
        vm.prank(alice); vm.expectRevert(bytes("bad sig")); game.recordRun(d, 9999, 40, dl, none, _sign(alice, d, 500, 40, 1, dl, none)); // tampered score
        // unranked bob with higher score doesn't lead
        vm.prank(bob); game.recordRun(d, 900, 10, dl, none, _sign(bob, d, 900, 10, 0, dl, none));
        assertEq(game.leader(d), alice);
    }
    function test_expiredAndWrongDay() public {
        uint64 d = game.today(); uint8[] memory none = new uint8[](0);
        uint64 dl = uint64(block.timestamp - 1);
        vm.prank(alice); vm.expectRevert(bytes("expired")); game.recordRun(d, 1, 1, dl, none, _sign(alice, d, 1, 1, 0, dl, none));
        dl = uint64(block.timestamp + 10);
        vm.prank(alice); vm.expectRevert(bytes("wrong day")); game.recordRun(d - 1, 1, 1, dl, none, _sign(alice, d - 1, 1, 1, 0, dl, none));
    }
    function test_itemsConsumed() public {
        uint64 d = game.today(); uint64 dl = uint64(block.timestamp + 600);
        uint8[] memory used = new uint8[](1); used[0] = 1;
        vm.prank(alice); vm.expectRevert(bytes("item missing")); game.recordRun(d, 1, 1, dl, used, _sign(alice, d, 1, 1, 0, dl, used));
        vm.prank(alice); game.buy(1, 1);
        vm.prank(alice); game.recordRun(d, 1, 1, dl, used, _sign(alice, d, 1, 1, 0, dl, used));
        assertEq(game.items(alice, 1), 0);
    }
    function test_streak() public {
        uint8[] memory none = new uint8[](0);
        uint256 t = 100 days;
        for (uint64 i = 0; i < 3; i++) {
            vm.warp(t + uint256(i) * 1 days);
            uint64 d = uint64((t + uint256(i) * 1 days) / 1 days); uint64 dl = uint64(t + uint256(i) * 1 days + 600);
            bytes memory sg = _sign(alice, d, 1, 1, i, dl, none);
            vm.prank(alice); game.recordRun(d, 1, 1, dl, none, sg);
        }
        assertEq(game.streak(alice), 3);
        vm.warp(t + 5 days);
        uint64 d2 = uint64((t + 5 days) / 1 days); uint64 dl2 = uint64(t + 5 days + 600);
        bytes memory sg2 = _sign(alice, d2, 1, 1, 3, dl2, none);
        vm.prank(alice); game.recordRun(d2, 1, 1, dl2, none, sg2);
        assertEq(game.streak(alice), 1);
    }
    function test_settle() public {
        uint64 d = game.today(); uint64 dl = uint64(block.timestamp + 600); uint8[] memory none = new uint8[](0);
        vm.prank(alice); game.enterRanked();
        vm.prank(bob); game.enterRanked();
        vm.prank(bob); game.recordRun(d, 300, 1, dl, none, _sign(bob, d, 300, 1, 0, dl, none));
        vm.expectRevert(bytes("day not over")); game.settle(d);
        vm.warp(block.timestamp + 1 days);
        uint256 before = wif.balanceOf(bob);
        game.settle(d);
        assertEq(wif.balanceOf(bob) - before, 80 ether); // 50% of 160 pool; empty seats roll rest
        assertEq(game.pool(game.today()), 80 ether);
        vm.expectRevert(bytes("settled")); game.settle(d);
    }
    function test_settleNoLeaderRolls() public {
        uint64 d = game.today();
        vm.prank(alice); game.enterRanked();
        vm.warp(block.timestamp + 1 days);
        game.settle(d);
        assertEq(game.pool(game.today()), 80 ether);
    }
    function test_names() public {
        uint256 supply = wif.totalSupply();
        vm.prank(alice); reg.claim("bamio");
        assertEq(reg.resolve("bamio"), alice);
        assertEq(wif.totalSupply(), supply - 25 ether);
        assertEq(wif.balanceOf(treasury), 25 ether);
        vm.prank(bob); vm.expectRevert(bytes("name: taken")); reg.claim("bamio");
        vm.prank(alice); vm.expectRevert(bytes("name: already have one")); reg.claim("other");
        vm.prank(bob); vm.expectRevert(bytes("name: invalid")); reg.claim("Bamio");
        vm.prank(bob); vm.expectRevert(bytes("name: invalid")); reg.claim("ab");
        vm.prank(bob); vm.expectRevert(bytes("name: invalid")); reg.claim("a-b-c");
        uint256 b = wif.balanceOf(alice);
        vm.prank(bob); reg.sendToName("bamio", 7 ether);
        assertEq(wif.balanceOf(alice) - b, 7 ether);
        vm.prank(bob); vm.expectRevert(bytes("name: unknown")); reg.sendToName("nobody", 1);
    }

    // ---- EIP-7702 sponsored batch ----
    function _batchSig(uint256 pk, address acct, WifAccount.Call[] memory calls, uint256 dl) internal view returns (bytes memory) {
        bytes32 h = WifAccount(payable(acct)).digest(calls, WifAccount(payable(acct)).nonce(), dl);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, h);
        return abi.encodePacked(r, s, v);
    }
    function test_7702SponsoredBatch() public {
        WifAccount impl = new WifAccount();
        uint256 pk = 0xBEEF; address player = vm.addr(pk);
        assertEq(player.balance, 0);
        vm.signAndAttachDelegation(address(impl), pk);
        WifAccount.Call[] memory calls = new WifAccount.Call[](3);
        calls[0] = WifAccount.Call(address(wif), 0, abi.encodeCall(MockWIF.faucet, ()));
        calls[1] = WifAccount.Call(address(wif), 0, abi.encodeCall(IERC20.approve, (address(game), type(uint256).max)));
        calls[2] = WifAccount.Call(address(game), 0, abi.encodeCall(WifDepths.enterRanked, ()));
        uint256 dl = block.timestamp + 300;
        bytes memory sig = _batchSig(pk, player, calls, dl);
        address relayer = address(0x5E1A);
        vm.prank(relayer); WifAccount(payable(player)).execute(calls, dl, sig);
        assertTrue(game.entered(game.today(), player));
        assertEq(player.balance, 0);
        vm.prank(relayer); vm.expectRevert(bytes("bad sig")); WifAccount(payable(player)).execute(calls, dl, sig); // replay
        calls[2] = WifAccount.Call(address(wif), 0, abi.encodeCall(IERC20.transfer, (relayer, 1 ether)));
        vm.prank(relayer); vm.expectRevert(bytes("bad sig")); WifAccount(payable(player)).execute(calls, dl, sig); // tampered
    }

    function test_7702DailyCap() public {
        WifAccount impl = new WifAccount();
        uint256 pk = 0xCAFE; address player = vm.addr(pk);
        vm.signAndAttachDelegation(address(impl), pk);
        WifAccount.Call[] memory calls = new WifAccount.Call[](1);
        calls[0] = WifAccount.Call(address(game), 0, abi.encodeCall(WifDepths.today, ()));
        uint256 dl = block.timestamp + 300;
        for (uint256 i; i < 20; i++) { bytes memory sg = _batchSig(pk, player, calls, dl); vm.prank(address(0x5E1A)); WifAccount(payable(player)).execute(calls, dl, sg); }
        assertEq(WifAccount(payable(player)).sponsoredToday(), 20);
        bytes memory sig = _batchSig(pk, player, calls, dl);
        vm.prank(address(0x5E1A)); vm.expectRevert(bytes("daily sponsored cap")); WifAccount(payable(player)).execute(calls, dl, sig);
        uint256 t2 = vm.getBlockTimestamp() + 1 days; vm.warp(t2); dl = t2 + 300; sig = _batchSig(pk, player, calls, dl);
        vm.prank(address(0x5E1A)); WifAccount(payable(player)).execute(calls, dl, sig);
        assertEq(WifAccount(payable(player)).sponsoredToday(), 1);
    }
}
