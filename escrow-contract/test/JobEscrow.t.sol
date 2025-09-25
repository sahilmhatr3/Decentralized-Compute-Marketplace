// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {JobEscrow} from "../src/JobEscrow.sol";

contract JobEscrowTest is Test {
    JobEscrow escrow;
    address requester = address(0xA11CE);
    address other = address(0xB0B);
    address provider = address(0xC0FFEE);
    bytes32 jobId = keccak256(abi.encodePacked("job-1"));

    function setUp() public {
        escrow = new JobEscrow();
        vm.deal(requester, 10 ether);
        vm.deal(other, 10 ether);
    }

    function test_DepositOnceSetsRequesterAndAmount() public {
        vm.prank(requester);
        escrow.deposit{value: 1 ether}(jobId);
        assertEq(escrow.escrowOf(jobId), 1 ether);
        assertEq(escrow.requesterOf(jobId), requester);
    }

    function test_RevertOnDoubleDeposit() public {
        vm.prank(requester);
        escrow.deposit{value: 1 ether}(jobId);
        vm.prank(requester);
        vm.expectRevert(bytes("already funded"));
        escrow.deposit{value: 1 ether}(jobId);
    }

    function test_RevertOnDifferentRequesterSecondDeposit() public {
        vm.prank(requester);
        escrow.deposit{value: 1 ether}(jobId);
        vm.prank(other);
        vm.expectRevert(bytes("different requester"));
        escrow.deposit{value: 1 ether}(jobId);
    }

    function test_CancelRefundsRequester() public {
        vm.prank(requester);
        escrow.deposit{value: 1 ether}(jobId);
        uint256 balBefore = requester.balance;
        vm.prank(requester);
        escrow.cancel(jobId);
        assertEq(escrow.escrowOf(jobId), 0);
        assertGt(requester.balance, balBefore);
    }

    function test_ReleasePaysProvider() public {
        vm.prank(requester);
        escrow.deposit{value: 2 ether}(jobId);
        uint256 balBefore = provider.balance;
        vm.prank(requester);
        escrow.release(jobId, provider);
        assertEq(escrow.escrowOf(jobId), 0);
        assertEq(provider.balance, balBefore + 2 ether);
    }

    function test_RevertNonRequesterOnReleaseOrCancel() public {
        vm.prank(requester);
        escrow.deposit{value: 1 ether}(jobId);

        vm.prank(other);
        vm.expectRevert(bytes("not requester"));
        escrow.release(jobId, provider);

        vm.prank(other);
        vm.expectRevert(bytes("not requester"));
        escrow.cancel(jobId);
    }

    function test_RevertAfterReleaseOnCancelAndViceVersa() public {
        vm.prank(requester);
        escrow.deposit{value: 1 ether}(jobId);

        vm.prank(requester);
        escrow.release(jobId, provider);

        vm.prank(requester);
        vm.expectRevert(bytes("released"));
        escrow.cancel(jobId);
    }

    function test_RevertCancelThenRelease() public {
        vm.prank(requester);
        escrow.deposit{value: 1 ether}(jobId);

        vm.prank(requester);
        escrow.cancel(jobId);

        vm.prank(requester);
        vm.expectRevert(bytes("canceled"));
        escrow.release(jobId, provider);
    }
}


