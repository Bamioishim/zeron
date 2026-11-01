// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Test} from "forge-std/Test.sol";
import {MockWIF} from "../src/MockWIF.sol";
import {ZeronShop} from "../src/ZeronShop.sol";
contract ShopTest is Test {
    function test_flow() public {
        MockWIF w = new MockWIF(); address tr = address(0xBEEF);
        ZeronShop s = new ZeronShop(w, true, 5000, tr, address(this), address(this));
        s.setPrice(1, 60 ether); s.setStarter(350 ether);
        vm.warp(2 days); w.faucet(); w.transfer(address(s), 1000 ether);
        address p = address(0xA11CE);
        vm.startPrank(p); s.starter(); assertEq(w.balanceOf(p), 350 ether);
        vm.expectRevert(bytes("starter: claimed")); s.starter();
        w.approve(address(s), type(uint256).max); s.buy(1); vm.stopPrank();
        assertEq(w.balanceOf(tr), 30 ether); assertEq(w.balanceOf(p), 290 ether); assertEq(s.equipped(p), 1);
        (uint32 m,,) = s.wardrobe(p); assertEq(m, 3);
        vm.prank(p); vm.expectRevert(bytes("shop: not owned")); s.equip(2);
    }
}
