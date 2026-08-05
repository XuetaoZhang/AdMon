import { NextResponse } from "next/server";
import { z } from "zod";
import { createOffer } from "@/lib/offers";

const offerSchema = z.object({
  topicId: z.enum(["onchain-actions", "monad-infra", "wallets"]),
  userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  publisherAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional()
});

export async function POST(request: Request) {
  const parsed = offerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A supported topic and valid EVM reward address are required." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    createOffer(
      parsed.data.topicId,
      parsed.data.userAddress,
      new URL(request.url).origin,
      parsed.data.publisherAddress
    )
  );
}
