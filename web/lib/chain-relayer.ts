import { readFile } from "node:fs/promises";
import {
  Contract,
  HDNodeWallet,
  JsonRpcProvider,
  Wallet,
  formatEther,
  type ContractRunner
} from "ethers";

const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const contractAddress =
  process.env.ADMON_CONTRACT_ADDRESS ||
  "0xA423ce5FE84554217554Af834C921269c1aaef38";
const chainId = 10143;

const abi = [
  "function relayer() view returns (address)",
  "function usedClick(bytes32) view returns (bool)",
  "function claimable(address) view returns (uint256)",
  "function settleClick(uint256,uint8,bytes32,address,address,uint64)",
  "function claim()"
];

const provider = new JsonRpcProvider(rpcUrl, {
  name: "monad-testnet",
  chainId
});

let signerPromise: Promise<Wallet | HDNodeWallet> | undefined;

async function getSigner(): Promise<Wallet | HDNodeWallet> {
  if (!signerPromise) {
    signerPromise = (async () => {
      const privateKey = process.env.ADMON_RELAYER_PRIVATE_KEY;
      if (privateKey) return new Wallet(privateKey, provider);

      const keystorePath = process.env.ADMON_RELAYER_KEYSTORE_PATH;
      if (!keystorePath) {
        throw new Error(
          "AdMon relayer is not configured. Set ADMON_RELAYER_KEYSTORE_PATH or ADMON_RELAYER_PRIVATE_KEY."
        );
      }

      const encrypted = await readFile(keystorePath, "utf8");
      return (await Wallet.fromEncryptedJson(
        encrypted,
        process.env.ADMON_RELAYER_KEYSTORE_PASSWORD || ""
      )).connect(provider);
    })();
  }
  return signerPromise;
}

function contract(runner: ContractRunner): Contract {
  return new Contract(contractAddress, abi, runner);
}

export type SettlementInput = {
  campaignId: number;
  clickId: `0x${string}`;
  userAddress: `0x${string}`;
  publisherAddress: `0x${string}`;
  expiresAt: number;
};

export type SettlementSubmission = {
  transactionHash: `0x${string}`;
  shardId: number;
  relayerAddress: `0x${string}`;
  gasLimit: string;
};

export type SettlementRead = {
  state: "proposed" | "finalized" | "claimed";
  claimableMon: string;
  transactionHash: `0x${string}`;
  blockNumber?: number;
  claimTransactionHash?: `0x${string}`;
  error?: string;
};

export function getChainConfig() {
  return { chainId, contractAddress, rpcUrl };
}

export function getClaimTransaction() {
  return {
    chainId,
    to: contractAddress,
    data: new Contract(contractAddress, abi).interface.encodeFunctionData("claim"),
    gasLimit: "54397"
  };
}

export async function submitSettlement(
  input: SettlementInput
): Promise<SettlementSubmission> {
  const signer = await getSigner();
  const signerAddress = await signer.getAddress();
  const adMon = contract(signer);
  const configuredRelayer = (await adMon.relayer()) as string;
  if (configuredRelayer.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(
      `Configured signer ${signerAddress} is not the contract relayer ${configuredRelayer}.`
    );
  }

  const shardId = Number(BigInt(input.clickId) % 16n);
  const args = [
    input.campaignId,
    shardId,
    input.clickId,
    input.userAddress,
    input.publisherAddress,
    input.expiresAt
  ] as const;

  await adMon.settleClick.staticCall(...args);
  const estimate = (await adMon.settleClick.estimateGas(...args)) as bigint;
  const gasLimit = estimate + estimate / 10n;
  const tx = await adMon.settleClick(...args, { gasLimit });

  return {
    transactionHash: tx.hash as `0x${string}`,
    shardId,
    relayerAddress: signerAddress as `0x${string}`,
    gasLimit: gasLimit.toString()
  };
}

export async function readSettlement(
  transactionHash: `0x${string}`,
  clickId: `0x${string}`,
  userAddress: `0x${string}`,
  claimTransactionHash?: `0x${string}`
): Promise<SettlementRead> {
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!receipt) {
    return {
      state: "proposed",
      claimableMon: "0",
      transactionHash,
      claimTransactionHash
    };
  }
  if (receipt.status !== 1) {
    return {
      state: "proposed",
      claimableMon: "0",
      transactionHash,
      blockNumber: receipt.blockNumber,
      claimTransactionHash,
      error: "Monad settlement transaction reverted."
    };
  }

  const adMon = contract(provider);
  const [used, claimable, finalizedBlock, claimReceipt] = await Promise.all([
    adMon.usedClick(clickId) as Promise<boolean>,
    adMon.claimable(userAddress) as Promise<bigint>,
    provider.getBlock("finalized"),
    claimTransactionHash
      ? provider.getTransactionReceipt(claimTransactionHash)
      : Promise.resolve(null)
  ]);

  if (!used) {
    return {
      state: "proposed",
      claimableMon: formatEther(claimable),
      transactionHash,
      blockNumber: receipt.blockNumber,
      claimTransactionHash,
      error: "Settlement receipt exists but the click is not marked used."
    };
  }

  const finalized = finalizedBlock?.number != null && finalizedBlock.number >= receipt.blockNumber;
  const claimFinalized =
    claimReceipt?.status === 1 &&
    finalizedBlock?.number != null &&
    finalizedBlock.number >= claimReceipt.blockNumber;
  const state = claimFinalized || (finalized && claimable === 0n) ? "claimed" : finalized ? "finalized" : "proposed";

  return {
    state,
    claimableMon: formatEther(claimable),
    transactionHash,
    blockNumber: receipt.blockNumber,
    claimTransactionHash
  };
}
