import { NextResponse } from "next/server";
import { recordClick } from "@/lib/click-store";
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

  const click = recordClick(payload.clickId);
  if (!click) {
    return NextResponse.redirect(
      new URL(`/sponsor?status=already-used&clickId=${payload.clickId}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL(
      `/sponsor?status=recorded&campaignId=${payload.campaignId}&clickId=${payload.clickId}`,
      request.url
    )
  );
}
