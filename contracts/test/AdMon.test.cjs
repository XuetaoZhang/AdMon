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

  it("settles one click into user, publisher, and protocol balances", async function () {
    const { campaignId, activeUntil } = await createCampaign();
    const { clickId, shardId } = clickForShard();

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
    assert.equal(await adMon.claimable(user.address), clickReward / 4n);
    assert.equal(
      await adMon.claimable(publisher.address),
      (clickReward * 6n) / 10n
    );
    assert.equal(
      await adMon.claimable(treasury.address),
      (clickReward * 15n) / 100n
    );
  });

  it("allows the user to claim the credited MON", async function () {
    const { campaignId, activeUntil } = await createCampaign();
    const { clickId, shardId } = clickForShard("claim-click");

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

    const amount = await adMon.claimable(user.address);
    const contractBalanceBefore = await ethers.provider.getBalance(
      await adMon.getAddress()
    );
    await adMon.connect(user).claim();

    assert.equal(await adMon.claimable(user.address), 0n);
    assert.equal(
      await ethers.provider.getBalance(await adMon.getAddress()),
      contractBalanceBefore - amount
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
    assert.equal(await adMon.claimable(user.address), clickReward / 4n);
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
