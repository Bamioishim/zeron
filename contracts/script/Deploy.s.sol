// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockWIF} from "../src/MockWIF.sol";
import {WifDepths} from "../src/WifDepths.sol";
import {NameRegistry} from "../src/NameRegistry.sol";
import {WifAccount} from "../src/WifAccount.sol";

/// env: WIF_TOKEN (empty = deploy MockWIF), RUN_SIGNER, TREASURY, USE_BURN (true/false)
contract Deploy is Script {
    function run() external {
        address token = vm.envOr("WIF_TOKEN", address(0));
        address signer = vm.envAddress("RUN_SIGNER");
        bool useBurn = vm.envOr("USE_BURN", true);
        vm.startBroadcast();
        address me = msg.sender;
        address treasury = vm.envOr("TREASURY", me);
        if (token == address(0)) token = address(new MockWIF());
        // fees: ranked entry 100 WIF, 20% destroyed / 80% to daily prize pool
        WifDepths game = new WifDepths(IERC20(token), useBurn, 2000, 100 ether, signer, me);
        game.setItemPrice(1, 25 ether);  // potion
        game.setItemPrice(2, 40 ether);  // whetstone
        game.setItemPrice(3, 40 ether);  // ward charm
        // @name: 50 WIF, 50% destroyed / 50% treasury
        NameRegistry reg = new NameRegistry(IERC20(token), useBurn, 5000, 50 ether, treasury, me);
        WifAccount acct = new WifAccount();
        vm.stopBroadcast();
        console.log("WIF", token);
        console.log("GAME", address(game));
        console.log("NAMES", address(reg));
        console.log("ACCOUNT_IMPL", address(acct));
    }
}
