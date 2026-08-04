const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

describe("AdMon", function () {
  const clickReward = ethers.parseEther("0.01");
  const campaignBudget = clickReward * 16n;

  let adMon;
  let owner;
  let relayer;
  let advertiser;
  let user;
  let publisher;
  let treasury;

  beforeEach(async function () {
    [owner, relayer, advertiser, user, publisher, treasury] =
      await ethers.getSigners();

    const factory = await ethers.getContractFactory("AdMon");
    adMon = await factory.deploy(
      owner.address,
      relayer.address,
      treasury.address
    );
    await adMon.waitForDeployment();
  });

  async function createCampaign(reward = clickReward, budget = campaignBudget) {
    const block = await ethers.provider.getBlock("latest");
    const activeUntil = block.timestamp + 3600;
    await adMon
      .connect(advertiser)
      .createCampaign(1, reward, activeUntil, "https://example.com/ad", {
        value: budget
      });
    return { campaignId: 1n, activeUntil };
  }

  function clickForShard(seed = "first-click") {
    const clickId = ethers.keccak256(ethers.toUtf8Bytes(seed));
    const shardId = Number(BigInt(clickId) % 16n);
    return { clickId, shardId };
  }

  it("settles one click directly into user, publisher, and protocol wallets", async function () {
    const { campaignId, activeUntil } = await createCampaign();
    const { clickId, shardId } = clickForShard();

    const userBefore = await ethers.provider.getBalance(user.address);
    const publisherBefore = await ethers.provider.getBalance(publisher.address);
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);

    await adMon
      .connect(relayer)
      .settleClick(
        campaignId,
        shardId,
        clickId,
        user.address,
        publisher.address,
        activeUntil
      );

    assert.equal(await adMon.usedClick(clickId), true);
    assert.equal(
      await ethers.provider.getBalance(user.address) - userBefore,
      clickReward / 4n
    );
    assert.equal(
      await ethers.provider.getBalance(publisher.address) - publisherBefore,
      (clickReward * 6n) / 10n
    );
    assert.equal(
      await ethers.provider.getBalance(treasury.address) - treasuryBefore,
      (clickReward * 15n) / 100n
    );
    assert.equal(await adMon.pendingPayout(user.address), 0n);
  });

  it("keeps settlement live when a recipient rejects MON and allows recovery", async function () {
    const { campaignId, activeUntil } = await createCampaign();
    const { clickId, shardId } = clickForShard("rejecting-recipient");
    const factory = await ethers.getContractFactory("RejectingReceiver");
    const rejectingReceiver = await factory.deploy();
    await rejectingReceiver.waitForDeployment();
    const rejectingAddress = await rejectingReceiver.getAddress();

    await adMon
      .connect(relayer)
      .settleClick(
        campaignId,
        shardId,
        clickId,
        rejectingAddress,
        publisher.address,
        activeUntil
      );

    const userShare = clickReward / 4n;
    assert.equal(await adMon.pendingPayout(rejectingAddress), userShare);
    const recipientBefore = await ethers.provider.getBalance(user.address);
    await rejectingReceiver.withdrawTo(await adMon.getAddress(), user.address);
    assert.equal(await adMon.pendingPayout(rejectingAddress), 0n);
    assert.equal(
      await ethers.provider.getBalance(user.address) - recipientBefore,
      userShare
    );
  });

  it("rejects replaying the same click ID", async function () {
    const { campaignId, activeUntil } = await createCampaign();
    const { clickId, shardId } = clickForShard("replay-click");
    const settle = () =>
      adMon
        .connect(relayer)
        .settleClick(
          campaignId,
          shardId,
          clickId,
          user.address,
          publisher.address,
          activeUntil
        );

    await settle();
    await assert.rejects(settle(), /ClickAlreadyUsed/);
    assert.equal(await adMon.pendingPayout(user.address), 0n);
  });

  it("rejects a settlement from an untrusted caller", async function () {
    const { campaignId, activeUntil } = await createCampaign();
    const { clickId, shardId } = clickForShard("wrong-relayer");

    await assert.rejects(
      adMon
        .connect(advertiser)
        .settleClick(
          campaignId,
          shardId,
          clickId,
          user.address,
          publisher.address,
          activeUntil
        ),
      /OnlyRelayer/
    );
  });

  it("rejects expired click receipts", async function () {
    const { campaignId } = await createCampaign();
    const { clickId, shardId } = clickForShard("expired-click");
    const block = await ethers.provider.getBlock("latest");

    await assert.rejects(
      adMon
        .connect(relayer)
        .settleClick(
          campaignId,
          shardId,
          clickId,
          user.address,
          publisher.address,
          block.timestamp - 1
        ),
      /ClickExpired/
    );
  });

  it("rejects settlement when the selected shard cannot fund one click", async function () {
    const { campaignId, activeUntil } = await createCampaign(
      clickReward,
      clickReward
    );
    let click = clickForShard("thin-budget-0");
    for (let index = 1; click.shardId === 0; index++) {
      click = clickForShard(`thin-budget-${index}`);
    }

    await assert.rejects(
      adMon
        .connect(relayer)
        .settleClick(
          campaignId,
          click.shardId,
          click.clickId,
          user.address,
          publisher.address,
          activeUntil
        ),
      /InsufficientShardBudget/
    );
  });

  it("lets an advertiser withdraw a paused campaign shard", async function () {
    const { campaignId } = await createCampaign();
    await adMon.connect(advertiser).pauseCampaign(campaignId);

    const shardBalance = await adMon.shardBudget(campaignId, 3);
    await adMon.connect(advertiser).withdrawUnusedBudget(campaignId, 3);

    assert.equal(await adMon.shardBudget(campaignId, 3), 0n);
    assert.equal(
      await ethers.provider.getBalance(await adMon.getAddress()),
      campaignBudget - shardBalance
    );
  });
});
