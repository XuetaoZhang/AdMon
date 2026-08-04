import { NextResponse } from "next/server";
import { submitSettlement } from "@/lib/chain-relayer";
import { recordClick } from "@/lib/click-store";
import { markSettlementError, markSettlementSubmitted } from "@/lib/click-store";
import { verifyClickToken } from "@/lib/click-token";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const payload = verifyClickToken(token);
  if (!payload) {
    return new NextResponse("This AdMon click link is invalid or expired.", {
      status: 410
    });
  }

  const click = recordClick(payload.clickId, {
    campaignId: payload.campaignId,
    userAddress: payload.user as `0x${string}`,
    publisherAddress: payload.publisher as `0x${string}`
  });
  if (!click) {
    return NextResponse.redirect(
      new URL(`/sponsor?status=already-used&clickId=${payload.clickId}`, request.url)
    );
  }

  try {
    const settlement = await submitSettlement({
      campaignId: payload.campaignId,
      clickId: payload.clickId as `0x${string}`,
      userAddress: payload.user as `0x${string}`,
      publisherAddress: payload.publisher as `0x${string}`,
      expiresAt: payload.expiresAt
    });
    markSettlementSubmitted(payload.clickId, settlement.transactionHash);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monad settlement unavailable.";
    markSettlementError(payload.clickId, message);
    if (process.env.ADMON_CHAIN_SETTLEMENT_REQUIRED === "true") {
      return new NextResponse(message, { status: 503 });
    }
  }

  return NextResponse.redirect(
    new URL(
      `/sponsor?status=recorded&campaignId=${payload.campaignId}&clickId=${payload.clickId}`,
      request.url
    )
  );
}
