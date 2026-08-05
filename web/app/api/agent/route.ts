import { NextResponse } from "next/server";
import { z } from "zod";
import { buildNativeTransferPreview } from "@admon/moss-protocol";
import { getOfferThroughMcp } from "@/lib/embedded-mcp";
import { generateWithDeepSeek, inferNativeTransferAction } from "@/lib/deepseek-agent";
import { answerForTopic, classifyTopic } from "@/lib/topics";
import { findCampaignForPrompt } from "@/lib/product-store";

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

  let agentResult: Awaited<ReturnType<typeof generateWithDeepSeek>> | null = null;
  let agentMode: "deepseek" | "rules-fallback" = "deepseek";
  const fallbackMossAction = inferNativeTransferAction(parsed.data.prompt);
  try {
    agentResult = await generateWithDeepSeek(parsed.data.prompt);
  } catch (error) {
    // Keep the demo usable when the model provider is unavailable; never block
    // the independent MCP offer and click-settlement path on an LLM outage.
    console.error("DeepSeek agent unavailable; using local preview fallback.", error);
    agentMode = "rules-fallback";
  }

  const topicId = agentResult?.topicId ?? classifyTopic(parsed.data.prompt);
  let moss = null;
  const mossAction = agentResult?.mossAction ?? fallbackMossAction;
  if (mossAction.kind === "native-transfer") {
    try {
      moss = await buildNativeTransferPreview({
        account: parsed.data.userAddress,
        recipient: mossAction.recipient,
        amountMon: mossAction.amountMon
      });
    } catch (error) {
      console.error("Moss rejected the requested action preview.", error);
    }
  }
  const origin = new URL(request.url).origin;
  // Campaign keywords are matched inside the publisher host. The MCP tool
  // receives only the selected creative ID, never the user prompt.
  const matchedCampaign = await findCampaignForPrompt(parsed.data.prompt);
  const offer = matchedCampaign
    ? await getOfferThroughMcp(matchedCampaign.id, parsed.data.userAddress, origin)
    : null;
  return NextResponse.json({
    prompt: parsed.data.prompt,
    topicId,
    answer: agentResult?.answer ?? answerForTopic(topicId),
    moss,
    offer,
    adSource: offer ? "mcp:get_ad_offer" : "none",
    agent: {
      mode: agentMode,
      provider: agentResult?.provider ?? "local-rules",
      model: agentResult?.model ?? null
    }
  });
}
