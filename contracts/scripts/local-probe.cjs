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
  const userCredit = await contract.claimable(user.address);
  assert.equal(userCredit, clickReward / 4n);

  const claimTx = await contract.connect(user).claim();
  const claimReceipt = await claimTx.wait();
  assert.equal(await contract.claimable(user.address), 0n);

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
        userCreditWei: userCredit.toString(),
        publisherCreditWei: (
          await contract.claimable(publisher.address)
        ).toString(),
        settleTransactionHash: settleTx.hash,
        settleBlockNumber: settleReceipt.blockNumber,
        claimTransactionHash: claimTx.hash,
        claimBlockNumber: claimReceipt.blockNumber,
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
