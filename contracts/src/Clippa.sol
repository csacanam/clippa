// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Clippa
/// @notice Escrow for pay-per-view creator campaigns. Brands fund campaigns in USDT;
///         an authorized payer records payouts to approved creators, capped per clip.
/// @dev Campaign and clip ids are the off-chain (Supabase) UUIDs encoded as bytes32
///      (the 16 UUID bytes, left-padded with zeros). The same id is used on both
///      sides, so there is no mapping table to keep in sync.
contract Clippa is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Campaign lifecycle states.
    /// - Active: accepts funding and payouts.
    /// - Paused: rejects funding and payouts; can be resumed or ended.
    /// - Ended: terminal. Rejects funding and payouts; cannot be resumed.
    enum CampaignStatus {
        Active,
        Paused,
        Ended
    }

    struct Campaign {
        address creator; // who created the campaign
        uint256 balance; // USDT currently available for payouts
        uint256 totalFunded; // lifetime USDT funded into the campaign
        uint256 totalPaidOut; // lifetime USDT paid to creators
        uint256 maxPayoutPerClip; // per-clip cap, enforced across all payouts for a clipId
        CampaignStatus status; // lifecycle state
        bool exists; // distinguishes an unset struct from a real campaign
    }

    /// @notice The USDT token used for fees, funding and payouts.
    IERC20 public immutable usdt;

    /// @notice Fee charged to create a campaign (in USDT base units). Waived for the owner.
    uint256 public creationFee;

    /// @notice Address authorized to record payouts (the payout agent / server wallet).
    address public payer;

    /// @notice Creation fees accrued and withdrawable by the owner.
    uint256 public feesCollected;

    /// @notice campaignId (Supabase UUID as bytes32) => Campaign.
    mapping(bytes32 => Campaign) public campaigns;

    /// @notice campaignId => clipId => total USDT paid out for that clip.
    mapping(bytes32 => mapping(bytes32 => uint256)) public clipPaidOut;

    /// @notice payoutId (Supabase payout UUID as bytes32) => whether it was already processed.
    /// @dev Makes `recordPayout` idempotent: a retried payout with the same id is rejected.
    mapping(bytes32 => bool) public payoutProcessed;

    event CampaignCreated(
        bytes32 indexed campaignId, address indexed creator, uint256 maxPayoutPerClip, uint256 feePaid
    );
    event CampaignFunded(bytes32 indexed campaignId, address indexed funder, uint256 amount, uint256 newBalance);
    event PayoutRecorded(
        bytes32 indexed campaignId, bytes32 indexed clipId, bytes32 indexed payoutId, address recipient, uint256 amount
    );
    event CampaignStatusChanged(bytes32 indexed campaignId, CampaignStatus status);
    event CampaignWithdrawal(bytes32 indexed campaignId, address indexed to, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event PayerUpdated(address indexed oldPayer, address indexed newPayer);

    error ZeroAddress();
    error ZeroAmount();
    error ZeroId();
    error CampaignNotFound();
    error CampaignAlreadyExists();
    error CampaignNotActive();
    error CampaignNotPaused();
    error CampaignStillActive();
    error CampaignAlreadyEnded();
    error NotPayer();
    error InsufficientCampaignBalance();
    error ClipCapExceeded();
    error InsufficientFees();
    error PayoutAlreadyProcessed();

    modifier onlyPayer() {
        if (msg.sender != payer) revert NotPayer();
        _;
    }

    /// @param _usdt USDT token address (Celo USDT).
    /// @param _creationFee Initial campaign creation fee in USDT base units (e.g. 10e6 for $10 at 6 decimals).
    /// @param _payer Address allowed to record payouts.
    constructor(address _usdt, uint256 _creationFee, address _payer) Ownable(msg.sender) {
        if (_usdt == address(0) || _payer == address(0)) revert ZeroAddress();
        usdt = IERC20(_usdt);
        creationFee = _creationFee;
        payer = _payer;
    }

    // ---------------------------------------------------------------------
    // Campaign lifecycle
    // ---------------------------------------------------------------------

    /// @notice Create a campaign. Charges `creationFee` in USDT unless the caller is the owner.
    /// @dev Caller must approve this contract for `creationFee` USDT beforehand (non-owner only).
    /// @param campaignId Off-chain campaign UUID encoded as bytes32. Must not already exist.
    /// @param maxPayoutPerClip Per-clip payout cap for this campaign (USDT base units).
    function createCampaign(bytes32 campaignId, uint256 maxPayoutPerClip) external nonReentrant {
        if (campaignId == bytes32(0)) revert ZeroId();
        if (campaigns[campaignId].exists) revert CampaignAlreadyExists();

        uint256 fee = msg.sender == owner() ? 0 : creationFee;

        campaigns[campaignId] = Campaign({
            creator: msg.sender,
            balance: 0,
            totalFunded: 0,
            totalPaidOut: 0,
            maxPayoutPerClip: maxPayoutPerClip,
            status: CampaignStatus.Active,
            exists: true
        });

        if (fee > 0) {
            feesCollected += fee;
            usdt.safeTransferFrom(msg.sender, address(this), fee);
        }

        emit CampaignCreated(campaignId, msg.sender, maxPayoutPerClip, fee);
    }

    /// @notice Add USDT to an active campaign's payout balance.
    /// @dev Caller must approve this contract for `amount` USDT beforehand.
    function fundCampaign(bytes32 campaignId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (c.status != CampaignStatus.Active) revert CampaignNotActive();

        c.balance += amount;
        c.totalFunded += amount;

        usdt.safeTransferFrom(msg.sender, address(this), amount);

        emit CampaignFunded(campaignId, msg.sender, amount, c.balance);
    }

    /// @notice Record a payout to an approved creator for a specific clip.
    /// @dev Only callable by `payer`. Enforces campaign balance and the per-clip cap.
    ///      Idempotent on `payoutId`: a retried call with the same id reverts, so a
    ///      crashed-and-retried payout job cannot double-pay.
    /// @param campaignId Target campaign.
    /// @param clipId Off-chain clip UUID encoded as bytes32.
    /// @param payoutId Off-chain payout UUID encoded as bytes32. Must be unique per payout.
    /// @param recipient Creator's wallet.
    /// @param amount USDT to pay (base units).
    function recordPayout(bytes32 campaignId, bytes32 clipId, bytes32 payoutId, address recipient, uint256 amount)
        external
        onlyPayer
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (payoutId == bytes32(0)) revert ZeroId();
        if (payoutProcessed[payoutId]) revert PayoutAlreadyProcessed();

        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (c.status != CampaignStatus.Active) revert CampaignNotActive();
        if (amount > c.balance) revert InsufficientCampaignBalance();

        uint256 newClipTotal = clipPaidOut[campaignId][clipId] + amount;
        if (newClipTotal > c.maxPayoutPerClip) revert ClipCapExceeded();

        payoutProcessed[payoutId] = true;
        c.balance -= amount;
        c.totalPaidOut += amount;
        clipPaidOut[campaignId][clipId] = newClipTotal;

        usdt.safeTransfer(recipient, amount);

        emit PayoutRecorded(campaignId, clipId, payoutId, recipient, amount);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Pause an active campaign. Paused campaigns reject funding and payouts.
    function pauseCampaign(bytes32 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (c.status != CampaignStatus.Active) revert CampaignNotActive();
        c.status = CampaignStatus.Paused;
        emit CampaignStatusChanged(campaignId, CampaignStatus.Paused);
    }

    /// @notice Resume a paused campaign back to active.
    function resumeCampaign(bytes32 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (c.status != CampaignStatus.Paused) revert CampaignNotPaused();
        c.status = CampaignStatus.Active;
        emit CampaignStatusChanged(campaignId, CampaignStatus.Active);
    }

    /// @notice End a campaign permanently. Terminal state — cannot be resumed.
    /// @dev Unspent balance can still be recovered afterwards via `withdrawCampaign`.
    function endCampaign(bytes32 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (c.status == CampaignStatus.Ended) revert CampaignAlreadyEnded();
        c.status = CampaignStatus.Ended;
        emit CampaignStatusChanged(campaignId, CampaignStatus.Ended);
    }

    /// @notice Withdraw unspent USDT from a campaign's balance.
    /// @dev Only allowed on paused or ended campaigns — an active campaign must be
    ///      paused or ended first, so funds can't be pulled out mid-campaign.
    function withdrawCampaign(bytes32 campaignId, uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (c.status == CampaignStatus.Active) revert CampaignStillActive();
        if (amount > c.balance) revert InsufficientCampaignBalance();

        c.balance -= amount;

        usdt.safeTransfer(to, amount);

        emit CampaignWithdrawal(campaignId, to, amount);
    }

    /// @notice Withdraw accrued creation fees.
    function withdrawFees(uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > feesCollected) revert InsufficientFees();

        feesCollected -= amount;

        usdt.safeTransfer(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    /// @notice Update the campaign creation fee.
    function setCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }

    /// @notice Update the address authorized to record payouts.
    function setPayer(address newPayer) external onlyOwner {
        if (newPayer == address(0)) revert ZeroAddress();
        address oldPayer = payer;
        payer = newPayer;
        emit PayerUpdated(oldPayer, newPayer);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Full campaign struct for a given id.
    function getCampaign(bytes32 campaignId) external view returns (Campaign memory) {
        Campaign memory c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        return c;
    }

    /// @notice Remaining payout headroom for a clip within its campaign.
    function clipRemaining(bytes32 campaignId, bytes32 clipId) external view returns (uint256) {
        Campaign memory c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        uint256 paid = clipPaidOut[campaignId][clipId];
        return paid >= c.maxPayoutPerClip ? 0 : c.maxPayoutPerClip - paid;
    }
}
