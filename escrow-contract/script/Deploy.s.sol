// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {JobEscrow} from "../src/JobEscrow.sol";

contract Deploy is Script {
    function run() external returns (JobEscrow deployed) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        deployed = new JobEscrow();
        vm.stopBroadcast();
    }
}


