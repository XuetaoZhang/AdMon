const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

async function main() {
  const [owner, relayer, advertiser, user, publisher, treasury] =
    await ethers.getSigners();
  const factory = await ethers.getContractFactory("AdMon");
  const contract = await factory.deploy(
    owner.address,
    relayer.address,
    treasury.address
  );
  await contract.waitForDeployment();

  const clickReward = ethers.parseEther("0.01");
  const block = await ethers.provider.getBlock("latest");
  const activeUntil = block.timestamp + 3600;
  const createTx = await contract
    .connect(advertiser)
    .createCampaign(1, clickReward, activeUntil, "https://admon.local/sponsor", {
      value: clickReward * 16n
    });
  await createTx.wait();

  const clickId = ethers.keccak256(ethers.toUtf8Bytes("admon-local-risk-probe"));
  const shardId = Number(BigInt(clickId) % 16n);
  const settleTx = await contract
    .connect(relayer)
    .settleClick(
      1,
      shardId,
      clickId,
      user.address,
      publisher.address,
      activeUntil
    );
  const settleReceipt = await settleTx.wait();
  const userBalanceBefore = await ethers.provider.getBalance(user.address);
  const publisherBalanceBefore = await ethers.provider.getBalance(publisher.address);
  const secondClickId = ethers.keccak256(ethers.toUtf8Bytes("admon-local-direct-payout"));
  const secondShardId = Number(BigInt(secondClickId) % 16n);
  const directTx = await contract.connect(relayer).settleClick(
    1,
    secondShardId,
    secondClickId,
    user.address,
    publisher.address,
    activeUntil
  );
  const directReceipt = await directTx.wait();
  const userPayout = (await ethers.provider.getBalance(user.address)) - userBalanceBefore;
  const publisherPayout = (await ethers.provider.getBalance(publisher.address)) - publisherBalanceBefore;
  assert.equal(userPayout, clickReward / 4n);
  assert.equal(publisherPayout, (clickReward * 6n) / 10n);

  let replayRejected = false;
  try {
    await contract
      .connect(relayer)
      .settleClick(
        1,
        shardId,
        clickId,
        user.address,
        publisher.address,
        activeUntil
      );
  } catch (error) {
    replayRejected = String(error).includes("ClickAlreadyUsed");
  }
  assert.equal(replayRejected, true);

  console.log(
    JSON.stringify(
      {
        mode: "hardhat-local-chain",
        contractAddress: await contract.getAddress(),
        campaignId: 1,
        clickId,
        shardId,
        userPayoutWei: userPayout.toString(),
        publisherPayoutWei: publisherPayout.toString(),
        settleTransactionHash: settleTx.hash,
        settleBlockNumber: settleReceipt.blockNumber,
        directPayoutTransactionHash: directTx.hash,
        directPayoutBlockNumber: directReceipt.blockNumber,
        directPayoutGasUsed: directReceipt.gasUsed.toString(),
        replayRejected
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
