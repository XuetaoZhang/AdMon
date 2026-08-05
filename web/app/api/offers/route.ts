import { NextResponse } from "next/server";
import { z } from "zod";
import { createOffer } from "@/lib/offers";
import { findCampaignForKeywords } from "@/lib/product-store";

const offerSchema = z.object({
  keywords: z.array(z.string().trim().min(2).max(40)).min(1).max(12),
  userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  publisherAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional()
});

export async function POST(request: Request) {
  const parsed = offerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "At least one campaign keyword and a valid EVM reward address are required." },
      { status: 400 }
    );
  }

  const campaign = await findCampaignForKeywords(parsed.data.keywords);
  if (!campaign) return new NextResponse(null, { status: 204 });

  return NextResponse.json(
    await createOffer(
      campaign,
      parsed.data.userAddress,
      new URL(request.url).origin,
      parsed.data.publisherAddress
    )
  );
}
