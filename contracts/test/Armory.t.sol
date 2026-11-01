// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Test} from "forge-std/Test.sol";
import {ZeronArmory} from "../src/ZeronArmory.sol";
import {MockWIF} from "../src/MockWIF.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
contract ArmoryTest is Test {
    MockWIF w; ZeronArmory a; uint256 sk = 0xA11CE; address p = address(0xBEEF); address tr = address(0x7777);
    function setUp() public {
        vm.warp(2 days); w = new MockWIF(); a = new ZeronArmory(IERC20(address(w)), true, 5000, tr, vm.addr(sk), address(this));
        a.setWeapon(5, 200 ether, true); w.faucet(); w.transfer(address(a), 1000 ether); w.transfer(p, 1000 ether);
    }
    function sig(uint256 amt, uint8 used, uint8 drop, uint256 n, uint256 dl) internal view returns (bytes memory) {
        bytes32 sh = keccak256(abi.encode(a.CLAIM_TYPEHASH(), p, amt, used, drop, n, dl));
        bytes32 dom = keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"), keccak256("ZeronArmory"), keccak256("1"), block.chainid, address(a)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sk, keccak256(abi.encodePacked("\x19\x01", dom, sh))); return abi.encodePacked(r, s, v);
    }
    function testFlow() public {
        vm.startPrank(p); w.approve(address(a), type(uint256).max); a.buy(5);
        assertEq(w.balanceOf(tr), 100 ether); assertEq(a.ammo(p), 3); assertEq(a.equipped(p), 5);
        uint256 b0 = w.balanceOf(p);
        a.claim(100 ether, 2, 7, block.timestamp + 60, sig(100 ether, 2, 7, 0, block.timestamp + 60));
        assertEq(w.balanceOf(p) - b0, 100 ether); assertEq(a.ammo(p), 1); assertTrue(a.owns(p, 7));
        a.claim(100 ether, 0, 0, block.timestamp + 60, sig(100 ether, 0, 0, 1, block.timestamp + 60));
        assertEq(w.balanceOf(p) - b0, 150 ether); // capped
        bytes memory bad = sig(1, 0, 0, 1, block.timestamp + 60); vm.expectRevert(); a.claim(1, 0, 0, block.timestamp + 60, bad); // replay
        a.refill(); assertEq(a.ammo(p), 3);
    }
}
