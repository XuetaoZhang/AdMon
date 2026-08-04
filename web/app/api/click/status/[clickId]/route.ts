import { NextResponse } from "next/server";
import { readSettlement } from "@/lib/chain-relayer";
import { getClickStatus, updateOnchainStatus } from "@/lib/click-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clickId: string }> }
) {
  const { clickId } = await context.params;
  const status = getClickStatus(clickId);
  if (status.mode === "monad-testnet" && status.transactionHash && status.userAddress) {
    try {
      const chain = await readSettlement(
        status.transactionHash,
        clickId as `0x${string}`,
        status.userAddress,
        status.claimTransactionHash
      );
      updateOnchainStatus(clickId, chain);
      return NextResponse.json(getClickStatus(clickId));
    } catch (error) {
      updateOnchainStatus(clickId, {
        state: status.state,
        claimableMon: status.claimableMon,
        blockNumber: status.blockNumber,
        claimTransactionHash: status.claimTransactionHash,
        chainError: error instanceof Error ? error.message : "Monad status unavailable."
      });
    }
  }
  return NextResponse.json(getClickStatus(clickId));
}
