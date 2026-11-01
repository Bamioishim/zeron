// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WifQuest, IPool} from "../src/WifQuest.sol";

/// v3: new quest only (PvP commit + server-signed reveal). Reuses token, game, names, account impl.
/// env: WIF_TOKEN, GAME, RUN_SIGNER, USE_BURN
contract DeployV3 is Script {
    function run() external {
        vm.startBroadcast();
        WifQuest q = new WifQuest(IERC20(vm.envAddress("WIF_TOKEN")), IPool(vm.envAddress("GAME")), vm.envOr("USE_BURN", true), 2000, 20 ether, 10 ether, vm.envAddress("RUN_SIGNER"), msg.sender);
        q.setNpc(address(1), 7, 0, 40); q.setNpc(address(2), 9, 1, 55); q.setNpc(address(3), 11, 2, 70);
        q.setNpc(address(4), 13, 4, 85); q.setNpc(address(5), 16, 3, 100); q.setNpc(address(6), 20, 6, 130);
        vm.stopBroadcast();
        console.log("QUEST", address(q));
    }
}
