// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice EIP-7702 delegate: a player's EOA (holding 0 ETH) points its code here once.
/// Anyone (our gas sponsor/relayer) may then submit a batch the EOA signed. Signature binds
/// chain, this account, nonce, deadline and the exact calls, so the relayer cannot alter or replay it.
contract WifAccount {
    struct Call { address to; uint256 value; bytes data; }
    // ERC-7201 style slot so it never clashes with other storage
    bytes32 private constant NONCE_SLOT = keccak256("wif.account.nonce");
    bytes32 public constant BATCH_TYPEHASH = keccak256("Batch(uint256 nonce,uint256 deadline,bytes32 callsHash)");
    bytes32 private constant SPONSOR_SLOT = keccak256("wif.account.sponsored"); // packed: day << 32 | count
    uint256 public constant SPONSORED_PER_DAY = 20;
    event Executed(uint256 nonce, uint256 calls);

    function nonce() public view returns (uint256 n) { bytes32 s = NONCE_SLOT; assembly { n := sload(s) } }

    /// sponsored (third-party submitted) batches used today; enforced here so no off-chain cache can be bypassed
    function sponsoredToday() public view returns (uint256) {
        bytes32 s = SPONSOR_SLOT; uint256 v; assembly { v := sload(s) }
        return (v >> 32) == block.timestamp / 1 days ? uint32(v) : 0;
    }
    function _domain() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("WifAccount"), keccak256("1"), block.chainid, address(this)));
    }
    function callsHash(Call[] calldata calls) public pure returns (bytes32) {
        bytes32[] memory hs = new bytes32[](calls.length);
        for (uint256 i; i < calls.length; i++)
            hs[i] = keccak256(abi.encode(calls[i].to, calls[i].value, keccak256(calls[i].data)));
        return keccak256(abi.encodePacked(hs));
    }
    function digest(Call[] calldata calls, uint256 n, uint256 deadline) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domain(),
            keccak256(abi.encode(BATCH_TYPEHASH, n, deadline, callsHash(calls)))));
    }

    function execute(Call[] calldata calls, uint256 deadline, bytes calldata sig) external {
        require(block.timestamp <= deadline, "expired");
        uint256 n = nonce();
        require(ECDSA.recover(digest(calls, n, deadline), sig) == address(this), "bad sig");
        bytes32 s = NONCE_SLOT; assembly { sstore(s, add(n, 1)) }
        if (msg.sender != address(this)) {
            uint256 c = sponsoredToday() + 1;
            require(c <= SPONSORED_PER_DAY, "daily sponsored cap");
            uint256 v = ((block.timestamp / 1 days) << 32) | c; bytes32 ss = SPONSOR_SLOT; assembly { sstore(ss, v) }
        }
        for (uint256 i; i < calls.length; i++) {
            (bool ok, bytes memory r) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            if (!ok) assembly { revert(add(r, 32), mload(r)) }
        }
        emit Executed(n, calls.length);
    }
    receive() external payable {}
}
