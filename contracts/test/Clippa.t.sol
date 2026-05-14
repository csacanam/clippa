// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Clippa} from "../src/Clippa.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ClippaTest is Test {
    Clippa internal clippa;
    MockERC20 internal usdt;

    address internal owner = makeAddr("owner");
    address internal payer = makeAddr("payer");
    address internal brand = makeAddr("brand");
    address internal creator = makeAddr("creator");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant CREATION_FEE = 10e6; // $10 at 6 decimals
    uint256 internal constant MAX_PER_CLIP = 20e6; // $20 at 6 decimals

    // Campaign / clip / payout ids stand in for Supabase UUIDs encoded as bytes32.
    bytes32 internal constant CAMP = bytes32(uint256(0xC0FFEE));
    bytes32 internal constant CAMP_2 = bytes32(uint256(0xBEEF));
    bytes32 internal constant CLIP_A = keccak256("clip-a");
    bytes32 internal constant CLIP_B = keccak256("clip-b");
    bytes32 internal constant PAY_1 = bytes32(uint256(0xA1));
    bytes32 internal constant PAY_2 = bytes32(uint256(0xA2));

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);
        vm.prank(owner);
        clippa = new Clippa(address(usdt), CREATION_FEE, payer);

        usdt.mint(brand, 1_000e6);
        usdt.mint(owner, 1_000e6);
    }

    function _createFundedCampaign(bytes32 id, uint256 fundAmount) internal {
        vm.startPrank(brand);
        usdt.approve(address(clippa), CREATION_FEE + fundAmount);
        clippa.createCampaign(id, MAX_PER_CLIP);
        if (fundAmount > 0) {
            clippa.fundCampaign(id, fundAmount);
        }
        vm.stopPrank();
    }

    // --- constructor ---

    function test_constructor_setsState() public view {
        assertEq(address(clippa.usdt()), address(usdt));
        assertEq(clippa.creationFee(), CREATION_FEE);
        assertEq(clippa.payer(), payer);
        assertEq(clippa.owner(), owner);
    }

    function test_constructor_revertsOnZeroUsdt() public {
        vm.expectRevert(Clippa.ZeroAddress.selector);
        new Clippa(address(0), CREATION_FEE, payer);
    }

    function test_constructor_revertsOnZeroPayer() public {
        vm.expectRevert(Clippa.ZeroAddress.selector);
        new Clippa(address(usdt), CREATION_FEE, address(0));
    }

    // --- createCampaign ---

    function test_createCampaign_chargesFee() public {
        vm.startPrank(brand);
        usdt.approve(address(clippa), CREATION_FEE);
        clippa.createCampaign(CAMP, MAX_PER_CLIP);
        vm.stopPrank();

        assertEq(clippa.feesCollected(), CREATION_FEE);
        assertEq(usdt.balanceOf(address(clippa)), CREATION_FEE);
        assertEq(usdt.balanceOf(brand), 1_000e6 - CREATION_FEE);

        Clippa.Campaign memory c = clippa.getCampaign(CAMP);
        assertEq(c.creator, brand);
        assertEq(c.balance, 0);
        assertEq(c.maxPayoutPerClip, MAX_PER_CLIP);
        assertEq(uint8(c.status), uint8(Clippa.CampaignStatus.Active));
        assertTrue(c.exists);
    }

    function test_createCampaign_ownerPaysNothing() public {
        vm.prank(owner);
        clippa.createCampaign(CAMP, MAX_PER_CLIP);

        assertEq(clippa.feesCollected(), 0);
        assertEq(usdt.balanceOf(address(clippa)), 0);
        assertEq(clippa.getCampaign(CAMP).creator, owner);
    }

    function test_createCampaign_revertsWithoutApproval() public {
        vm.prank(brand);
        vm.expectRevert();
        clippa.createCampaign(CAMP, MAX_PER_CLIP);
    }

    function test_createCampaign_freeWhenFeeIsZero() public {
        vm.prank(owner);
        clippa.setCreationFee(0);

        vm.prank(stranger);
        clippa.createCampaign(CAMP, MAX_PER_CLIP);
        assertEq(clippa.feesCollected(), 0);
        assertEq(clippa.getCampaign(CAMP).creator, stranger);
    }

    function test_createCampaign_revertsOnZeroId() public {
        vm.prank(owner);
        vm.expectRevert(Clippa.ZeroId.selector);
        clippa.createCampaign(bytes32(0), MAX_PER_CLIP);
    }

    function test_createCampaign_revertsOnDuplicateId() public {
        vm.prank(owner);
        clippa.createCampaign(CAMP, MAX_PER_CLIP);
        vm.prank(owner);
        vm.expectRevert(Clippa.CampaignAlreadyExists.selector);
        clippa.createCampaign(CAMP, MAX_PER_CLIP);
    }

    function test_createCampaign_distinctIdsCoexist() public {
        vm.startPrank(owner);
        clippa.createCampaign(CAMP, MAX_PER_CLIP);
        clippa.createCampaign(CAMP_2, MAX_PER_CLIP);
        vm.stopPrank();
        assertTrue(clippa.getCampaign(CAMP).exists);
        assertTrue(clippa.getCampaign(CAMP_2).exists);
    }

    // --- fundCampaign ---

    function test_fundCampaign_addsBalance() public {
        _createFundedCampaign(CAMP, 100e6);

        Clippa.Campaign memory c = clippa.getCampaign(CAMP);
        assertEq(c.balance, 100e6);
        assertEq(c.totalFunded, 100e6);
        assertEq(usdt.balanceOf(address(clippa)), CREATION_FEE + 100e6);
    }

    function test_fundCampaign_anyoneCanFund() public {
        _createFundedCampaign(CAMP, 0);

        usdt.mint(stranger, 50e6);
        vm.startPrank(stranger);
        usdt.approve(address(clippa), 50e6);
        clippa.fundCampaign(CAMP, 50e6);
        vm.stopPrank();

        assertEq(clippa.getCampaign(CAMP).balance, 50e6);
    }

    function test_fundCampaign_canFundMultipleTimes() public {
        _createFundedCampaign(CAMP, 30e6);
        vm.startPrank(brand);
        usdt.approve(address(clippa), 20e6);
        clippa.fundCampaign(CAMP, 20e6);
        vm.stopPrank();
        assertEq(clippa.getCampaign(CAMP).balance, 50e6);
        assertEq(clippa.getCampaign(CAMP).totalFunded, 50e6);
    }

    function test_fundCampaign_revertsOnZeroAmount() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(brand);
        vm.expectRevert(Clippa.ZeroAmount.selector);
        clippa.fundCampaign(CAMP, 0);
    }

    function test_fundCampaign_revertsOnUnknownCampaign() public {
        vm.prank(brand);
        vm.expectRevert(Clippa.CampaignNotFound.selector);
        clippa.fundCampaign(CAMP, 10e6);
    }

    function test_fundCampaign_revertsWhenPaused() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(owner);
        clippa.pauseCampaign(CAMP);

        vm.startPrank(brand);
        usdt.approve(address(clippa), 10e6);
        vm.expectRevert(Clippa.CampaignNotActive.selector);
        clippa.fundCampaign(CAMP, 10e6);
        vm.stopPrank();
    }

    function test_fundCampaign_revertsWhenEnded() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(owner);
        clippa.endCampaign(CAMP);

        vm.startPrank(brand);
        usdt.approve(address(clippa), 10e6);
        vm.expectRevert(Clippa.CampaignNotActive.selector);
        clippa.fundCampaign(CAMP, 10e6);
        vm.stopPrank();
    }

    // --- recordPayout ---

    function test_recordPayout_paysCreator() public {
        _createFundedCampaign(CAMP, 100e6);

        vm.prank(payer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 5e6);

        assertEq(usdt.balanceOf(creator), 5e6);
        Clippa.Campaign memory c = clippa.getCampaign(CAMP);
        assertEq(c.balance, 95e6);
        assertEq(c.totalPaidOut, 5e6);
        assertEq(clippa.clipPaidOut(CAMP, CLIP_A), 5e6);
        assertEq(clippa.clipRemaining(CAMP, CLIP_A), MAX_PER_CLIP - 5e6);
        assertTrue(clippa.payoutProcessed(PAY_1));
    }

    function test_recordPayout_accumulatesPerClip() public {
        _createFundedCampaign(CAMP, 100e6);

        vm.startPrank(payer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 8e6);
        clippa.recordPayout(CAMP, CLIP_A, PAY_2, creator, 7e6);
        vm.stopPrank();

        assertEq(clippa.clipPaidOut(CAMP, CLIP_A), 15e6);
        assertEq(usdt.balanceOf(creator), 15e6);
    }

    function test_recordPayout_separateClipsTrackedIndependently() public {
        _createFundedCampaign(CAMP, 100e6);

        vm.startPrank(payer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 20e6);
        clippa.recordPayout(CAMP, CLIP_B, PAY_2, creator, 20e6);
        vm.stopPrank();

        assertEq(clippa.clipPaidOut(CAMP, CLIP_A), 20e6);
        assertEq(clippa.clipPaidOut(CAMP, CLIP_B), 20e6);
    }

    function test_recordPayout_revertsWhenClipCapExceeded() public {
        _createFundedCampaign(CAMP, 100e6);

        vm.startPrank(payer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 15e6);
        vm.expectRevert(Clippa.ClipCapExceeded.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_2, creator, 6e6); // 15 + 6 > 20
        vm.stopPrank();
    }

    function test_recordPayout_revertsWhenClipCapExceededInSingleCall() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(payer);
        vm.expectRevert(Clippa.ClipCapExceeded.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 21e6);
    }

    function test_recordPayout_revertsWhenBalanceInsufficient() public {
        _createFundedCampaign(CAMP, 3e6);
        vm.prank(payer);
        vm.expectRevert(Clippa.InsufficientCampaignBalance.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 4e6);
    }

    function test_recordPayout_revertsForNonPayer() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(stranger);
        vm.expectRevert(Clippa.NotPayer.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 1e6);
    }

    function test_recordPayout_revertsForOwnerWhoIsNotPayer() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(owner);
        vm.expectRevert(Clippa.NotPayer.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 1e6);
    }

    function test_recordPayout_revertsOnZeroRecipient() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(payer);
        vm.expectRevert(Clippa.ZeroAddress.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, address(0), 1e6);
    }

    function test_recordPayout_revertsOnZeroAmount() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(payer);
        vm.expectRevert(Clippa.ZeroAmount.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 0);
    }

    function test_recordPayout_revertsOnZeroPayoutId() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(payer);
        vm.expectRevert(Clippa.ZeroId.selector);
        clippa.recordPayout(CAMP, CLIP_A, bytes32(0), creator, 1e6);
    }

    function test_recordPayout_revertsOnDuplicatePayoutId() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.startPrank(payer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 5e6);
        // Same payoutId again — even with different clip/amount — must be rejected.
        vm.expectRevert(Clippa.PayoutAlreadyProcessed.selector);
        clippa.recordPayout(CAMP, CLIP_B, PAY_1, creator, 1e6);
        vm.stopPrank();

        // Only the first payout went through.
        assertEq(usdt.balanceOf(creator), 5e6);
        assertEq(clippa.getCampaign(CAMP).totalPaidOut, 5e6);
    }

    function test_recordPayout_revertsOnUnknownCampaign() public {
        vm.prank(payer);
        vm.expectRevert(Clippa.CampaignNotFound.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 1e6);
    }

    function test_recordPayout_revertsWhenPaused() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(owner);
        clippa.pauseCampaign(CAMP);
        vm.prank(payer);
        vm.expectRevert(Clippa.CampaignNotActive.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 1e6);
    }

    function test_recordPayout_revertsWhenEnded() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(owner);
        clippa.endCampaign(CAMP);
        vm.prank(payer);
        vm.expectRevert(Clippa.CampaignNotActive.selector);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 1e6);
    }

    // --- pauseCampaign / resumeCampaign / endCampaign ---

    function test_pauseAndResume() public {
        _createFundedCampaign(CAMP, 100e6);

        vm.prank(owner);
        clippa.pauseCampaign(CAMP);
        assertEq(uint8(clippa.getCampaign(CAMP).status), uint8(Clippa.CampaignStatus.Paused));

        vm.prank(owner);
        clippa.resumeCampaign(CAMP);
        assertEq(uint8(clippa.getCampaign(CAMP).status), uint8(Clippa.CampaignStatus.Active));
    }

    function test_pauseCampaign_revertsWhenNotActive() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(owner);
        clippa.pauseCampaign(CAMP);
        vm.prank(owner);
        vm.expectRevert(Clippa.CampaignNotActive.selector);
        clippa.pauseCampaign(CAMP);
    }

    function test_pauseCampaign_revertsForNonOwner() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        clippa.pauseCampaign(CAMP);
    }

    function test_resumeCampaign_revertsWhenNotPaused() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(owner);
        vm.expectRevert(Clippa.CampaignNotPaused.selector);
        clippa.resumeCampaign(CAMP);
    }

    function test_endCampaign_fromActive() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(owner);
        clippa.endCampaign(CAMP);
        assertEq(uint8(clippa.getCampaign(CAMP).status), uint8(Clippa.CampaignStatus.Ended));
    }

    function test_endCampaign_fromPaused() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.startPrank(owner);
        clippa.pauseCampaign(CAMP);
        clippa.endCampaign(CAMP);
        vm.stopPrank();
        assertEq(uint8(clippa.getCampaign(CAMP).status), uint8(Clippa.CampaignStatus.Ended));
    }

    function test_endCampaign_isTerminal() public {
        _createFundedCampaign(CAMP, 0);
        vm.startPrank(owner);
        clippa.endCampaign(CAMP);

        vm.expectRevert(Clippa.CampaignAlreadyEnded.selector);
        clippa.endCampaign(CAMP);

        vm.expectRevert(Clippa.CampaignNotActive.selector);
        clippa.pauseCampaign(CAMP);

        vm.expectRevert(Clippa.CampaignNotPaused.selector);
        clippa.resumeCampaign(CAMP);
        vm.stopPrank();
    }

    function test_endCampaign_revertsForNonOwner() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        clippa.endCampaign(CAMP);
    }

    // --- withdrawCampaign ---

    function test_withdrawCampaign_ownerWithdrawsFromEnded() public {
        _createFundedCampaign(CAMP, 100e6);

        vm.prank(payer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 10e6);

        vm.startPrank(owner);
        clippa.endCampaign(CAMP);
        clippa.withdrawCampaign(CAMP, 90e6, brand);
        vm.stopPrank();

        assertEq(clippa.getCampaign(CAMP).balance, 0);
        assertEq(usdt.balanceOf(brand), 1_000e6 - CREATION_FEE - 100e6 + 90e6);
    }

    function test_withdrawCampaign_ownerWithdrawsFromPaused() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.startPrank(owner);
        clippa.pauseCampaign(CAMP);
        clippa.withdrawCampaign(CAMP, 40e6, brand);
        vm.stopPrank();
        assertEq(clippa.getCampaign(CAMP).balance, 60e6);
    }

    function test_withdrawCampaign_revertsWhenActive() public {
        _createFundedCampaign(CAMP, 50e6);
        vm.prank(owner);
        vm.expectRevert(Clippa.CampaignStillActive.selector);
        clippa.withdrawCampaign(CAMP, 1e6, owner);
    }

    function test_withdrawCampaign_revertsWhenAmountExceedsBalance() public {
        _createFundedCampaign(CAMP, 50e6);
        vm.startPrank(owner);
        clippa.endCampaign(CAMP);
        vm.expectRevert(Clippa.InsufficientCampaignBalance.selector);
        clippa.withdrawCampaign(CAMP, 51e6, owner);
        vm.stopPrank();
    }

    function test_withdrawCampaign_revertsForNonOwner() public {
        _createFundedCampaign(CAMP, 50e6);
        vm.prank(brand);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, brand));
        clippa.withdrawCampaign(CAMP, 1e6, brand);
    }

    function test_withdrawCampaign_doesNotTouchFees() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.startPrank(owner);
        clippa.endCampaign(CAMP);
        clippa.withdrawCampaign(CAMP, 100e6, owner);
        vm.stopPrank();
        // creation fee still accounted separately
        assertEq(clippa.feesCollected(), CREATION_FEE);
        assertEq(usdt.balanceOf(address(clippa)), CREATION_FEE);
    }

    // --- withdrawFees ---

    function test_withdrawFees_ownerWithdraws() public {
        _createFundedCampaign(CAMP, 0); // accrues one CREATION_FEE

        vm.prank(owner);
        clippa.withdrawFees(CREATION_FEE, owner);

        assertEq(clippa.feesCollected(), 0);
        assertEq(usdt.balanceOf(owner), 1_000e6 + CREATION_FEE);
    }

    function test_withdrawFees_revertsWhenExceedsCollected() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(owner);
        vm.expectRevert(Clippa.InsufficientFees.selector);
        clippa.withdrawFees(CREATION_FEE + 1, owner);
    }

    function test_withdrawFees_revertsForNonOwner() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        clippa.withdrawFees(CREATION_FEE, stranger);
    }

    function test_withdrawFees_cannotDrainCampaignBalances() public {
        // fees accrued = CREATION_FEE only, even though campaign holds 100e6 more
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(owner);
        vm.expectRevert(Clippa.InsufficientFees.selector);
        clippa.withdrawFees(CREATION_FEE + 1, owner);
    }

    // --- setCreationFee ---

    function test_setCreationFee_updatesValue() public {
        vm.prank(owner);
        clippa.setCreationFee(25e6);
        assertEq(clippa.creationFee(), 25e6);
    }

    function test_setCreationFee_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        clippa.setCreationFee(25e6);
    }

    // --- setPayer ---

    function test_setPayer_updatesPayer() public {
        address newPayer = makeAddr("newPayer");
        vm.prank(owner);
        clippa.setPayer(newPayer);
        assertEq(clippa.payer(), newPayer);

        _createFundedCampaign(CAMP, 100e6);
        vm.prank(newPayer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 1e6);
        assertEq(usdt.balanceOf(creator), 1e6);
    }

    function test_setPayer_revertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Clippa.ZeroAddress.selector);
        clippa.setPayer(address(0));
    }

    function test_setPayer_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        clippa.setPayer(stranger);
    }

    // --- views ---

    function test_getCampaign_revertsForUnknown() public {
        vm.expectRevert(Clippa.CampaignNotFound.selector);
        clippa.getCampaign(CAMP);
    }

    function test_clipRemaining_zeroWhenCapReached() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(payer);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, MAX_PER_CLIP);
        assertEq(clippa.clipRemaining(CAMP, CLIP_A), 0);
    }

    // --- events ---

    function test_event_campaignCreated() public {
        vm.startPrank(brand);
        usdt.approve(address(clippa), CREATION_FEE);
        vm.expectEmit(true, true, false, true);
        emit Clippa.CampaignCreated(CAMP, brand, MAX_PER_CLIP, CREATION_FEE);
        clippa.createCampaign(CAMP, MAX_PER_CLIP);
        vm.stopPrank();
    }

    function test_event_payoutRecorded() public {
        _createFundedCampaign(CAMP, 100e6);
        vm.prank(payer);
        vm.expectEmit(true, true, true, true);
        emit Clippa.PayoutRecorded(CAMP, CLIP_A, PAY_1, creator, 7e6);
        clippa.recordPayout(CAMP, CLIP_A, PAY_1, creator, 7e6);
    }

    function test_event_campaignStatusChanged() public {
        _createFundedCampaign(CAMP, 0);
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Clippa.CampaignStatusChanged(CAMP, Clippa.CampaignStatus.Ended);
        clippa.endCampaign(CAMP);
    }

    // --- fuzz ---

    function testFuzz_recordPayout_neverExceedsClipCapOrBalance(bytes32 id, uint256 fund, uint256 p1, uint256 p2)
        public
    {
        vm.assume(id != bytes32(0));
        fund = bound(fund, 1, 500e6);
        _createFundedCampaign(id, fund);

        p1 = bound(p1, 1, MAX_PER_CLIP);
        vm.prank(payer);
        if (p1 > fund) {
            vm.expectRevert(Clippa.InsufficientCampaignBalance.selector);
            clippa.recordPayout(id, CLIP_A, PAY_1, creator, p1);
            return;
        }
        clippa.recordPayout(id, CLIP_A, PAY_1, creator, p1);

        p2 = bound(p2, 1, MAX_PER_CLIP);
        uint256 paidSoFar = clippa.clipPaidOut(id, CLIP_A);
        uint256 balanceSoFar = clippa.getCampaign(id).balance;
        vm.prank(payer);
        if (p2 > balanceSoFar) {
            vm.expectRevert(Clippa.InsufficientCampaignBalance.selector);
            clippa.recordPayout(id, CLIP_A, PAY_2, creator, p2);
        } else if (paidSoFar + p2 > MAX_PER_CLIP) {
            vm.expectRevert(Clippa.ClipCapExceeded.selector);
            clippa.recordPayout(id, CLIP_A, PAY_2, creator, p2);
        } else {
            clippa.recordPayout(id, CLIP_A, PAY_2, creator, p2);
        }

        assertLe(clippa.clipPaidOut(id, CLIP_A), MAX_PER_CLIP);
        assertEq(clippa.getCampaign(id).balance + clippa.getCampaign(id).totalPaidOut, fund);
    }

    function testFuzz_recordPayout_idempotentOnPayoutId(bytes32 payoutId) public {
        vm.assume(payoutId != bytes32(0));
        _createFundedCampaign(CAMP, 100e6);

        vm.startPrank(payer);
        clippa.recordPayout(CAMP, CLIP_A, payoutId, creator, 5e6);
        vm.expectRevert(Clippa.PayoutAlreadyProcessed.selector);
        clippa.recordPayout(CAMP, CLIP_A, payoutId, creator, 5e6);
        vm.stopPrank();

        assertEq(usdt.balanceOf(creator), 5e6);
    }
}
