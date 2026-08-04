// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AdMon is Ownable, ReentrancyGuard {
    uint8 public constant SHARD_COUNT = 16;
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant USER_SHARE_BPS = 2_500;
    uint16 public constant PUBLISHER_SHARE_BPS = 6_000;

    struct Campaign {
        address advertiser;
        uint32 topicId;
        uint96 clickReward;
        uint64 activeUntil;
        bool active;
        string landingUrl;
    }

    error CampaignNotActive();
    error CampaignStillActive();
    error ClickAlreadyUsed(bytes32 clickId);
    error ClickExpired();
    error DirectFundingDisabled();
    error EmptyPendingPayout();
    error InsufficientShardBudget();
    error InvalidCampaign();
    error InvalidConfiguration();
    error InvalidPublisher();
    error InvalidRecipient();
    error InvalidShard();
    error NativeTransferFailed();
    error NotAdvertiser();
    error OnlyRelayer();

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed advertiser,
        uint32 indexed topicId,
        uint96 clickReward,
        uint64 activeUntil,
        uint256 budget,
        string landingUrl
    );
    event CampaignPaused(uint256 indexed campaignId);
    event ClickSettled(
        uint256 indexed campaignId,
        uint8 indexed shardId,
        bytes32 indexed clickId,
        address user,
        address publisher,
        uint256 clickReward
    );
    event RewardPaid(
        bytes32 indexed clickId,
        address indexed account,
        uint256 amount,
        uint8 role,
        bool direct
    );
    event PendingPayoutWithdrawn(
        address indexed account,
        address indexed recipient,
        uint256 amount
    );
    event RelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event UnusedBudgetWithdrawn(
        uint256 indexed campaignId,
        uint8 indexed shardId,
        uint256 amount
    );

    address public relayer;
    address public immutable protocolTreasury;
    uint256 public nextCampaignId = 1;

    mapping(uint256 campaignId => Campaign campaign) public campaigns;
    mapping(uint256 campaignId => mapping(uint8 shardId => uint256 amount))
        public shardBudget;
    mapping(bytes32 clickId => bool used) public usedClick;
    mapping(address account => uint256 amount) public pendingPayout;

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert OnlyRelayer();
        _;
    }

    constructor(
        address initialOwner,
        address initialRelayer,
        address treasury
    ) Ownable(initialOwner) {
        if (
            initialOwner == address(0) ||
            initialRelayer == address(0) ||
            treasury == address(0)
        ) revert InvalidConfiguration();

        relayer = initialRelayer;
        protocolTreasury = treasury;
    }

    function createCampaign(
        uint32 topicId,
        uint96 clickReward,
        uint64 activeUntil,
        string calldata landingUrl
    ) external payable returns (uint256 campaignId) {
        if (
            topicId == 0 ||
            clickReward == 0 ||
            activeUntil <= block.timestamp ||
            bytes(landingUrl).length == 0 ||
            msg.value < clickReward
        ) revert InvalidConfiguration();

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            advertiser: msg.sender,
            topicId: topicId,
            clickReward: clickReward,
            activeUntil: activeUntil,
            active: true,
            landingUrl: landingUrl
        });

        uint256 amountPerShard = msg.value / SHARD_COUNT;
        for (uint8 shardId = 0; shardId < SHARD_COUNT; shardId++) {
            shardBudget[campaignId][shardId] = amountPerShard;
        }
        shardBudget[campaignId][0] += msg.value % SHARD_COUNT;

        emit CampaignCreated(
            campaignId,
            msg.sender,
            topicId,
            clickReward,
            activeUntil,
            msg.value,
            landingUrl
        );
    }

    function pauseCampaign(uint256 campaignId) external {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.advertiser == address(0)) revert InvalidCampaign();
        if (msg.sender != campaign.advertiser && msg.sender != owner()) {
            revert NotAdvertiser();
        }

        campaign.active = false;
        emit CampaignPaused(campaignId);
    }

    function settleClick(
        uint256 campaignId,
        uint8 shardId,
        bytes32 clickId,
        address user,
        address publisher,
        uint64 expiresAt
    ) external onlyRelayer nonReentrant {
        if (user == address(0)) revert InvalidRecipient();
        if (publisher == address(0)) revert InvalidPublisher();
        if (shardId >= SHARD_COUNT || shardId != uint8(uint256(clickId) % SHARD_COUNT)) {
            revert InvalidShard();
        }
        if (usedClick[clickId]) revert ClickAlreadyUsed(clickId);
        if (block.timestamp > expiresAt) revert ClickExpired();

        Campaign storage campaign = campaigns[campaignId];
        if (
            campaign.advertiser == address(0) ||
            !campaign.active ||
            block.timestamp > campaign.activeUntil
        ) revert CampaignNotActive();

        uint256 reward = campaign.clickReward;
        uint256 budget = shardBudget[campaignId][shardId];
        if (budget < reward) revert InsufficientShardBudget();

        usedClick[clickId] = true;
        shardBudget[campaignId][shardId] = budget - reward;

        uint256 userShare = (reward * USER_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 publisherShare = (reward * PUBLISHER_SHARE_BPS) /
            BPS_DENOMINATOR;
        uint256 protocolShare = reward - userShare - publisherShare;

        emit ClickSettled(
            campaignId,
            shardId,
            clickId,
            user,
            publisher,
            reward
        );
        _pay(clickId, user, userShare, 0);
        _pay(clickId, publisher, publisherShare, 1);
        _pay(clickId, protocolTreasury, protocolShare, 2);
    }

    function withdrawPendingPayout(address payable recipient) external nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = pendingPayout[msg.sender];
        if (amount == 0) revert EmptyPendingPayout();

        pendingPayout[msg.sender] = 0;
        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert NativeTransferFailed();

        emit PendingPayoutWithdrawn(msg.sender, recipient, amount);
    }

    function withdrawUnusedBudget(
        uint256 campaignId,
        uint8 shardId
    ) external nonReentrant {
        if (shardId >= SHARD_COUNT) revert InvalidShard();

        Campaign storage campaign = campaigns[campaignId];
        if (campaign.advertiser == address(0)) revert InvalidCampaign();
        if (msg.sender != campaign.advertiser) revert NotAdvertiser();
        if (campaign.active && block.timestamp <= campaign.activeUntil) {
            revert CampaignStillActive();
        }

        uint256 amount = shardBudget[campaignId][shardId];
        shardBudget[campaignId][shardId] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert NativeTransferFailed();

        emit UnusedBudgetWithdrawn(campaignId, shardId, amount);
    }

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert InvalidConfiguration();
        address previousRelayer = relayer;
        relayer = newRelayer;
        emit RelayerUpdated(previousRelayer, newRelayer);
    }

    function _pay(
        bytes32 clickId,
        address account,
        uint256 amount,
        uint8 role
    ) private {
        (bool sent, ) = payable(account).call{value: amount}("");
        if (!sent) pendingPayout[account] += amount;
        emit RewardPaid(clickId, account, amount, role, sent);
    }

    receive() external payable {
        revert DirectFundingDisabled();
    }
}
