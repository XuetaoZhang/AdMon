import { after, NextResponse } from "next/server";
import { submitSettlement } from "@/lib/chain-relayer";
import {
  getClickStatus,
  markSettlementError,
  markSettlementSubmitted,
  recordClick,
  resetClick
} from "@/lib/click-store";
import { verifyClickToken } from "@/lib/click-token";
import { incrementCampaignClicks } from "@/lib/product-store";

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

  const existing = getClickStatus(payload.clickId);
  if (existing.chainError) {
    resetClick(payload.clickId);
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

  // Return the advertiser page immediately. Next keeps this callback alive
  // after the redirect while the relayer submits the Monad transaction.
  after(async () => {
    try {
      const settlement = await submitSettlement({
        campaignId: payload.campaignId,
        clickId: payload.clickId as `0x${string}`,
        userAddress: payload.user as `0x${string}`,
        publisherAddress: payload.publisher as `0x${string}`,
        expiresAt: payload.expiresAt
      });
      markSettlementSubmitted(payload.clickId, settlement.transactionHash);
      incrementCampaignClicks(payload.campaignId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Monad settlement unavailable.";
      markSettlementError(payload.clickId, message);
    }
  });

  return NextResponse.redirect(
    payload.destinationUrl ||
      new URL(
        `/sponsor?status=recorded&campaignId=${payload.campaignId}&clickId=${payload.clickId}`,
        request.url
      )
  );
}
