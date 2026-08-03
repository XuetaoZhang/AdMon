const { ethers } = require("hardhat");
const { writeFile } = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const relayer = process.env.ADMON_RELAYER_ADDRESS || deployer.address;
  const treasury = process.env.ADMON_TREASURY_ADDRESS || deployer.address;

  const factory = await ethers.getContractFactory("AdMon");
  const contract = await factory.deploy(deployer.address, relayer, treasury);
  await contract.waitForDeployment();

  const deploymentTransaction = contract.deploymentTransaction();
  const receipt = await deploymentTransaction.wait();
  const network = await ethers.provider.getNetwork();
  const result = {
    chainId: Number(network.chainId),
    contractAddress: await contract.getAddress(),
    deployer: deployer.address,
    relayer,
    treasury,
    transactionHash: deploymentTransaction.hash,
    blockNumber: receipt.blockNumber
  };
  const outputPath = path.resolve(
    __dirname,
    `../deployments/${network.chainId}.json`
  );
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
