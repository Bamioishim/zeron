// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZeronArmory} from "../src/ZeronArmory.sol";
contract DeployArmory is Script {
    function run() external {
        vm.startBroadcast();
        ZeronArmory a = new ZeronArmory(IERC20(vm.envAddress("WIF_TOKEN")), true, 5000, vm.envAddress("TREASURY"), vm.envAddress("RUN_SIGNER"), msg.sender);
        a.setWeapon(1, 60 ether, false);  // bow
        a.setWeapon(2, 90 ether, false);  // spear
        a.setWeapon(3, 120 ether, false); // twin daggers
        a.setWeapon(4, 150 ether, false); // fire staff
        a.setWeapon(5, 200 ether, true);  // bazooka
        a.setWeapon(6, 250 ether, false); // war hammer
        a.setWeapon(7, 180 ether, true);  // pumpkin launcher (also a Pumpkin King drop)
        vm.stopBroadcast();
        console.log("ARMORY", address(a));
    }
}
