require("@nomicfoundation/hardhat-ethers");

const accounts = process.env.MONAD_DEPLOYER_KEY
  ? [process.env.MONAD_DEPLOYER_KEY]
  : [];

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500
      }
    }
  },
  networks: {
    monadTestnet: {
      url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts
    }
  }
};
