// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WifDepths} from "../src/WifDepths.sol";
import {WifQuest, IPool} from "../src/WifQuest.sol";
import {WifQuestEndgame, IQuest} from "../src/WifQuestEndgame.sol";
import {NameRegistryV2} from "../src/NameRegistryV2.sol";
import {WifAccount} from "../src/WifAccount.sol";
import {ZeronShop} from "../src/ZeronShop.sol";
import {ZeronArmory} from "../src/ZeronArmory.sol";

/// Mainnet (Robinhood Chain 4663): real WIF, no MockWIF, burn share sent to 0x...dEaD (USE_BURN=false).
/// Prices are 1/10 of testnet, sized for real money and a tiny reward pool.
/// env: WIF_TOKEN, RUN_SIGNER, TREASURY
contract DeployMainnet is Script {
    function run() external {
        IERC20 t = IERC20(vm.envAddress("WIF_TOKEN"));
        address signer = vm.envAddress("RUN_SIGNER");
        address treasury = vm.envAddress("TREASURY");
        vm.startBroadcast();
        address me = msg.sender;
        WifAccount acct = new WifAccount();
        WifDepths game = new WifDepths(t, false, 2000, 10 ether, signer, me);
        game.setItemPrice(1, 2.5 ether); game.setItemPrice(2, 4 ether); game.setItemPrice(3, 4 ether);
        WifQuest q = new WifQuest(t, IPool(address(game)), false, 2000, 2 ether, 1 ether, signer, me);
        q.setNpc(address(1), 7, 0, 40); q.setNpc(address(2), 9, 1, 55); q.setNpc(address(3), 11, 2, 70);
        q.setNpc(address(4), 13, 4, 85); q.setNpc(address(5), 16, 3, 100); q.setNpc(address(6), 20, 6, 130);
        WifQuestEndgame qx = new WifQuestEndgame(IQuest(address(q)), signer, me, 8);
        NameRegistryV2 names = new NameRegistryV2(t, false, 5000, 5 ether, treasury, me);
        names.closeSeeding();
        ZeronShop s = new ZeronShop(t, false, 5000, treasury, signer, me);
        uint8[] memory ids = new uint8[](6); uint256[] memory ps = new uint256[](6);
        ids[0] = 1; ps[0] = 6 ether; ids[1] = 2; ps[1] = 8 ether; ids[2] = 3; ps[2] = 12 ether;
        ids[3] = 4; ps[3] = 10 ether; ids[4] = 5; ps[4] = 10 ether; ids[5] = 6; ps[5] = 15 ether;
        s.setPrices(ids, ps);
        ZeronArmory a = new ZeronArmory(t, false, 5000, treasury, signer, me);
        a.setWeapon(1, 6 ether, false); a.setWeapon(2, 9 ether, false); a.setWeapon(3, 12 ether, false);
        a.setWeapon(4, 15 ether, false); a.setWeapon(5, 20 ether, true); a.setWeapon(6, 25 ether, false);
        a.setWeapon(7, 18 ether, true);
        a.setCap(10 ether); a.setAmmoPrice(1.5 ether);
        vm.stopBroadcast();
        console.log("ACCOUNT_IMPL", address(acct)); console.log("GAME", address(game)); console.log("QUEST", address(q));
        console.log("QUESTX", address(qx)); console.log("NAMES", address(names)); console.log("SHOP", address(s)); console.log("ARMORY", address(a));
    }
}
