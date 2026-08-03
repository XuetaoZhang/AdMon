import type { LiveProof } from "./ad-types";

const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

export const liveProofConfig = {
  chainId: 10143 as const,
  contractAddress: "0xA423ce5FE84554217554Af834C921269c1aaef38" as const,
  clickId: "0x2822aaf4262aaf85c476efeead89497e71c13b2bf1a849943d704571fa6bf2c7" as const,
  userAddress: "0x6BD73C2f2ae05f638E4ec39a93AA27ac8ba2F5D6" as const,
  settlementTransactionHash:
    "0x0ad357b8a27c0797eb2768050dc4d1c0bddb3678e2f919b09fe0145c3425805a" as const,
  claimTransactionHash:
    "0x15cd6072eefb56a40aaf4986f08b1eafb6c0bbc1a711d1498188550213f7c146" as const
};

type RpcResult = {
  id: number;
  result?: unknown;
  error?: { message?: string };
};

type Receipt = {
  status: string;
  blockNumber: string;
};

type Block = {
  number: string;
};

function callData(selector: string, argument: string): `0x${string}` {
  return `${selector}${argument.replace(/^0x/, "").padStart(64, "0")}` as `0x${string}`;
}

function requireResult<T>(responses: Map<number, RpcResult>, id: number): T {
  const response = responses.get(id);
  if (!response || response.error || response.result == null) {
    throw new Error(response?.error?.message || `Missing RPC result ${id}.`);
  }
  return response.result as T;
}

export async function readLiveProof(
  fetchImpl: typeof fetch = fetch
): Promise<LiveProof> {
  const usedClickData = callData("0xe06acd1c", liveProofConfig.clickId);
  const claimableData = callData("0x402914f5", liveProofConfig.userAddress);
  const body = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [liveProofConfig.settlementTransactionHash]
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_getTransactionReceipt",
      params: [liveProofConfig.claimTransactionHash]
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "eth_call",
      params: [
        { to: liveProofConfig.contractAddress, data: usedClickData },
        "latest"
      ]
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "eth_call",
      params: [
        { to: liveProofConfig.contractAddress, data: claimableData },
        "latest"
      ]
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "eth_getBlockByNumber",
      params: ["finalized", false]
    }
  ];

  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Monad RPC returned ${response.status}.`);

  const payload = (await response.json()) as RpcResult[];
  if (!Array.isArray(payload)) throw new Error("Monad RPC did not return a batch response.");
  const responses = new Map(payload.map((item) => [item.id, item]));
  const settlement = requireResult<Receipt>(responses, 1);
  const claim = requireResult<Receipt>(responses, 2);
  const usedClick = requireResult<string>(responses, 3);
  const claimable = requireResult<string>(responses, 4);
  const finalized = requireResult<Block>(responses, 5);

  const settlementBlockNumber = Number.parseInt(settlement.blockNumber, 16);
  const claimBlockNumber = Number.parseInt(claim.blockNumber, 16);
  const finalizedBlockNumber = Number.parseInt(finalized.number, 16);
  const clickUsed = BigInt(usedClick) === 1n;
  const userClaimableWei = BigInt(claimable);

  if (
    settlement.status !== "0x1" ||
    claim.status !== "0x1" ||
    !clickUsed ||
    userClaimableWei !== 0n ||
    finalizedBlockNumber < claimBlockNumber
  ) {
    throw new Error("The live Monad proof is not finalized or internally consistent.");
  }

  return {
    status: "verified",
    chainId: liveProofConfig.chainId,
    contractAddress: liveProofConfig.contractAddress,
    settlementTransactionHash: liveProofConfig.settlementTransactionHash,
    claimTransactionHash: liveProofConfig.claimTransactionHash,
    settlementBlockNumber,
    claimBlockNumber,
    finalizedBlockNumber,
    clickUsed: true,
    userClaimableWei: "0",
    checkedAt: new Date().toISOString()
  };
}
