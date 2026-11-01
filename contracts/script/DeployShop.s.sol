// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZeronShop} from "../src/ZeronShop.sol";
/// env: WIF_TOKEN, TREASURY, RUN_SIGNER
contract DeployShop is Script {
    function run() external {
        vm.startBroadcast();
        ZeronShop s = new ZeronShop(IERC20(vm.envAddress("WIF_TOKEN")), true, 5000, vm.envAddress("TREASURY"), vm.envAddress("RUN_SIGNER"), msg.sender);
        uint8[] memory ids = new uint8[](6); uint256[] memory ps = new uint256[](6);
        ids[0] = 1; ps[0] = 60 ether;  // rogue
        ids[1] = 2; ps[1] = 80 ether;  // mage robe
        ids[2] = 3; ps[2] = 120 ether; // pumpkin head
        ids[3] = 4; ps[3] = 100 ether; // skeleton
        ids[4] = 5; ps[4] = 100 ether; // witch hat
        ids[5] = 6; ps[5] = 150 ether; // vampire cape
        s.setPrices(ids, ps); // id 7 (King's Lantern) is drop-only
        vm.stopBroadcast();
        console.log("SHOP", address(s));
    }
}
