// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NameRegistryV2} from "../src/NameRegistryV2.sol";
contract T is ERC20Burnable { constructor() ERC20("t","t") { _mint(msg.sender, 1e24); } }
contract NamesV2Test is Test {
    function test_flow() public {
        T t = new T(); address tr = address(0xBEEF); address a = address(0xA11CE);
        NameRegistryV2 r = new NameRegistryV2(IERC20(address(t)), true, 5000, 50 ether, tr, address(this));
        t.transfer(a, 100 ether);
        vm.startPrank(a);
        r.claim("alice"); assertEq(t.balanceOf(a), 100 ether);
        assertEq(r.check("alice"), 2); assertEq(r.check("Bob"), 1); assertEq(r.feeFor(a), 50 ether);
        t.approve(address(r), 50 ether); r.claim("alice2");
        assertEq(t.balanceOf(a), 50 ether); assertEq(t.balanceOf(tr), 25 ether);
        assertEq(r.resolve("alice"), address(0)); assertEq(r.resolve("alice2"), a);
        vm.expectRevert(bytes("name: unknown")); r.sendToName("nobody", 1);
        vm.stopPrank();
    }
}
