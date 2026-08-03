import { NextResponse } from "next/server";
import { z } from "zod";
import { answerForTopic, classifyTopic } from "@/lib/topics";
import { createOffer } from "@/lib/offers";

const requestSchema = z.object({
  prompt: z.string().trim().min(3).max(500),
  userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A prompt and valid EVM reward address are required." },
      { status: 400 }
    );
  }

  const topicId = classifyTopic(parsed.data.prompt);
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    prompt: parsed.data.prompt,
    topicId,
    answer: answerForTopic(topicId),
    offer: createOffer(topicId, parsed.data.userAddress, origin)
  });
}
