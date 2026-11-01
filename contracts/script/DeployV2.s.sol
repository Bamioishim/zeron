// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WifDepths} from "../src/WifDepths.sol";
import {WifQuest, IPool} from "../src/WifQuest.sol";

/// v2: game (adds addToPool) + quest (levels, crafting, PvP) + NPC fighters. Reuses token, names, account impl.
/// env: WIF_TOKEN, RUN_SIGNER, USE_BURN
contract DeployV2 is Script {
    function run() external {
        address token = vm.envAddress("WIF_TOKEN");
        address signer = vm.envAddress("RUN_SIGNER");
        bool useBurn = vm.envOr("USE_BURN", true);
        vm.startBroadcast();
        address me = msg.sender;
        WifDepths game = new WifDepths(IERC20(token), useBurn, 2000, 100 ether, signer, me);
        game.setItemPrice(1, 25 ether); game.setItemPrice(2, 40 ether); game.setItemPrice(3, 40 ether);
        // crafting 20 WIF per tier, PvP stake 10 WIF; 20% of craft fees destroyed, rest to the prize pool
        WifQuest q = new WifQuest(IERC20(token), IPool(address(game)), useBurn, 2000, 20 ether, 10 ether, signer, me);
        q.setNpc(address(1), 7, 0, 40);    // Puddle Pup (easy)
        q.setNpc(address(2), 9, 1, 55);    // Dune Rat
        q.setNpc(address(3), 11, 2, 70);   // Cliff Goat
        q.setNpc(address(4), 13, 4, 85);   // Rust Knight
        q.setNpc(address(5), 16, 3, 100);  // Lantern Witch
        q.setNpc(address(6), 20, 6, 130);  // The Rim Colossus (hard)
        vm.stopBroadcast();
        console.log("GAME", address(game));
        console.log("QUEST", address(q));
    }
}
