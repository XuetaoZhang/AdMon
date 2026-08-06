import { readFile } from "node:fs/promises";
import {
  Contract,
  HDNodeWallet,
  Interface,
  JsonRpcProvider,
  Wallet,
  formatEther,
  type ContractRunner
} from "ethers";

const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const contractAddress =
  process.env.ADMON_CONTRACT_ADDRESS ||
  "0x2501155A34E0af59a21751045abB6A9056b7e1Ab";
const chainId = 10143;

const abi = [
  "function relayer() view returns (address)",
  "function usedClick(bytes32) view returns (bool)",
  "function settleClick(uint256,uint8,bytes32,address,address,uint64)",
  "event RewardPaid(bytes32 indexed clickId,address indexed account,uint256 amount,uint8 role,bool direct)"
];
const settlementInterface = new Interface(abi);

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

      const keystoreJson = process.env.ADMON_RELAYER_KEYSTORE_JSON;
      if (keystoreJson) {
        return (await Wallet.fromEncryptedJson(
          keystoreJson,
          process.env.ADMON_RELAYER_KEYSTORE_PASSWORD || ""
        )).connect(provider);
      }

      const keystorePath = process.env.ADMON_RELAYER_KEYSTORE_PATH;
      if (!keystorePath) {
        throw new Error(
          "AdMon relayer is not configured. Set ADMON_RELAYER_KEYSTORE_JSON, ADMON_RELAYER_KEYSTORE_PATH, or ADMON_RELAYER_PRIVATE_KEY."
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
  state: "proposed" | "paid";
  paidMon: string;
  transactionHash: `0x${string}`;
  blockNumber?: number;
  error?: string;
};

export function getChainConfig() {
  return { chainId, contractAddress, rpcUrl };
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
  userAddress: `0x${string}`
): Promise<SettlementRead> {
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!receipt) return { state: "proposed", paidMon: "0", transactionHash };
  if (receipt.status !== 1) {
    return {
      state: "proposed",
      paidMon: "0",
      transactionHash,
      blockNumber: receipt.blockNumber,
      error: "Monad settlement transaction reverted."
    };
  }

  const adMon = contract(provider);
  const [used, finalizedBlock] = await Promise.all([
    adMon.usedClick(clickId) as Promise<boolean>,
    provider.getBlock("finalized")
  ]);
  const userPayout = receipt.logs
    .filter((log) => log.address.toLowerCase() === contractAddress.toLowerCase())
    .map((log) => {
      try {
        return settlementInterface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(
      (event) =>
        event?.name === "RewardPaid" &&
        String(event.args.clickId).toLowerCase() === clickId.toLowerCase() &&
        String(event.args.account).toLowerCase() === userAddress.toLowerCase() &&
        Number(event.args.role) === 0
    );

  if (!used || !userPayout) {
    return {
      state: "proposed",
      paidMon: "0",
      transactionHash,
      blockNumber: receipt.blockNumber,
      error: "Settlement receipt does not contain the expected user payout."
    };
  }
  if (!userPayout.args.direct) {
    return {
      state: "proposed",
      paidMon: "0",
      transactionHash,
      blockNumber: receipt.blockNumber,
      error: "The reward wallet rejected native MON; payout moved to recovery balance."
    };
  }

  const finalized =
    finalizedBlock?.number != null && finalizedBlock.number >= receipt.blockNumber;
  return {
    state: finalized ? "paid" : "proposed",
    paidMon: finalized ? formatEther(userPayout.args.amount) : "0",
    transactionHash,
    blockNumber: receipt.blockNumber
  };
}
