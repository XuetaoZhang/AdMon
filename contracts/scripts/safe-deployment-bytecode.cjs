const { readFileSync } = require("node:fs");
const path = require("node:path");
const { AbiCoder, concat, getAddress } = require("ethers");

const owner = getAddress(process.env.ADMON_OWNER_ADDRESS);
const relayer = getAddress(process.env.ADMON_RELAYER_ADDRESS);
const treasury = getAddress(process.env.ADMON_TREASURY_ADDRESS);
const artifactPath = path.resolve(
  __dirname,
  "../artifacts/contracts/AdMon.sol/AdMon.json"
);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const constructorArgs = AbiCoder.defaultAbiCoder().encode(
  ["address", "address", "address"],
  [owner, relayer, treasury]
);

process.stdout.write(concat([artifact.bytecode, constructorArgs]));
