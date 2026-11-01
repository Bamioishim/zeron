// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NameRegistryV2} from "../src/NameRegistryV2.sol";
/// env: WIF_TOKEN, TREASURY, USE_BURN
contract DeployNamesV2 is Script {
    function run() external {
        vm.startBroadcast();
        NameRegistryV2 r = new NameRegistryV2(IERC20(vm.envAddress("WIF_TOKEN")), vm.envOr("USE_BURN", true), 5000, 50 ether, vm.envAddress("TREASURY"), msg.sender);
        vm.stopBroadcast();
        console.log("NAMES", address(r));
    }
}
