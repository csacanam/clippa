// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Clippa} from "../src/Clippa.sol";

/// @notice Deploys Clippa. Configure via env vars:
///   USDT_ADDRESS  - USDT token address for the target network
///   CREATION_FEE  - creation fee in USDT base units (e.g. 10000000 for $10 at 6 decimals)
///   PAYER_ADDRESS - address allowed to record payouts (the payout agent wallet)
/// Run: forge script script/DeployClippa.s.sol --rpc-url <rpc> --broadcast
contract DeployClippa is Script {
    function run() external returns (Clippa clippa) {
        address usdt = vm.envAddress("USDT_ADDRESS");
        uint256 creationFee = vm.envUint("CREATION_FEE");
        address payer = vm.envAddress("PAYER_ADDRESS");

        vm.startBroadcast();
        clippa = new Clippa(usdt, creationFee, payer);
        vm.stopBroadcast();

        console.log("Clippa deployed at:", address(clippa));
        console.log("  usdt:        ", usdt);
        console.log("  creationFee: ", creationFee);
        console.log("  payer:       ", payer);
        console.log("  owner:       ", clippa.owner());
    }
}
