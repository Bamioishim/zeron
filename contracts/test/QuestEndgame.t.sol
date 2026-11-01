// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "forge-std/Test.sol";
import {WifQuestEndgame, IQuest} from "../src/WifQuestEndgame.sol";
contract MockQ { mapping(address=>uint8) public lv; uint8 public constant MAX_LEVEL = 6; function set(address a, uint8 l) external { lv[a]=l; }
  function players(address a) external view returns (uint8,uint8,uint8,uint8,uint16,uint16,uint16,uint64) { return (lv[a],0,0,0,0,0,0,0); } }
contract QuestEndgameTest is Test {
  function _sig(WifQuestEndgame x, uint256 pk, address p, uint8 l, uint64 n, uint64 d) internal view returns (bytes memory) {
    bytes32 h = keccak256(abi.encode(x.CLEAR_TYPEHASH(), p, l, uint8(4), uint8(4), uint8(5), n, d));
    bytes32 ds = keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"), keccak256("WifQuestEndgame"), keccak256("1"), block.chainid, address(x)));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", ds, h))); return abi.encodePacked(r, s, v);
  }
  function test_flow() public {
    MockQ q = new MockQ(); uint256 pk = 0xA11CE; WifQuestEndgame x = new WifQuestEndgame(IQuest(address(q)), vm.addr(pk), address(this), 8);
    address p = address(0xBEEF); uint64 d = uint64(block.timestamp + 60);
    bytes memory s7 = _sig(x, pk, p, 7, 0, d); bytes memory s8 = _sig(x, pk, p, 8, 1, d); bytes memory s9 = _sig(x, pk, p, 9, 2, d);
    q.set(p, 5); vm.expectRevert(bytes("wrong level")); vm.prank(p); x.recordClear(7, 4, 4, 5, d, s7);
    q.set(p, 6); vm.prank(p); x.recordClear(7, 4, 4, 5, d, s7); assertEq(x.levelOf(p), 7);
    vm.prank(p); x.recordClear(8, 4, 4, 5, d, s8); assertEq(x.levelOf(p), 8);
    vm.expectRevert(bytes("wrong level")); vm.prank(p); x.recordClear(9, 4, 4, 5, d, s9);
  }
}
