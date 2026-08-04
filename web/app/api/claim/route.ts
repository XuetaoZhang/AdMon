import { NextResponse } from "next/server";
import { z } from "zod";
import { getChainConfig, getClaimTransaction, readSettlement } from "@/lib/chain-relayer";
import { getClickStatus, markClaimSubmitted } from "@/lib/click-store";

const claimSchema = z.object({
  clickId: z.string().regex(/^0x[0-9a-f]{64}$/),
  userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  claimTransactionHash: z.string().regex(/^0x[0-9a-f]{64}$/).optional()
});

export async function POST(request: Request) {
  const parsed = claimSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid click ID." }, { status: 400 });
  }

  const status = getClickStatus(parsed.data.clickId);
  if (parsed.data.claimTransactionHash) {
    if (status.mode !== "monad-testnet") {
      return NextResponse.json({ error: "This click is not an onchain settlement." }, { status: 409 });
    }
    if (
      !parsed.data.userAddress ||
      !status.userAddress ||
      parsed.data.userAddress.toLowerCase() !== status.userAddress.toLowerCase()
    ) {
      return NextResponse.json({ error: "The connected wallet does not match the rewarded address." }, { status: 403 });
    }
    if (!markClaimSubmitted(parsed.data.clickId, parsed.data.claimTransactionHash as `0x${string}`)) {
      return NextResponse.json({ error: "The click session is no longer available." }, { status: 404 });
    }
    return NextResponse.json(getClickStatus(parsed.data.clickId));
  }

  if (status.mode === "monad-testnet" && status.transactionHash && status.userAddress) {
    let chain;
    try {
      chain = await readSettlement(
        status.transactionHash,
        status.clickId as `0x${string}`,
        status.userAddress,
        status.claimTransactionHash
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Monad settlement status is unavailable." },
        { status: 503 }
      );
    }
    if (chain.state !== "finalized") {
      return NextResponse.json({ error: "The Monad reward is not finalized yet." }, { status: 409 });
    }
    if (
      !parsed.data.userAddress ||
      parsed.data.userAddress.toLowerCase() !== status.userAddress.toLowerCase()
    ) {
      return NextResponse.json({ error: "The connected wallet does not match the rewarded address." }, { status: 403 });
    }
    return NextResponse.json({
      mode: "monad-testnet",
      status: chain,
      transaction: getClaimTransaction(),
      contract: getChainConfig().contractAddress
    });
  }

  return NextResponse.json(
    {
      error: status.chainError
        ? "This click has no claimable balance because Monad settlement did not complete."
        : "This click is not backed by a Monad settlement."
    },
    { status: 409 }
  );
}
