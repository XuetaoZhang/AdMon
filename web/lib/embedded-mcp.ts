import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createOffer } from "@/lib/offers";
import type { AdOffer, TopicId } from "@/lib/ad-types";

const topicSchema = z.enum(["onchain-actions", "monad-infra", "wallets"]);

/**
 * The publisher host uses the same MCP tool contract as external hosts. The
 * in-memory transport keeps the browser request local while preserving the
 * structured-content boundary used by the standalone stdio server.
 */
export async function getOfferThroughMcp(
  topicId: TopicId,
  userAddress: string,
  origin: string
): Promise<AdOffer> {
  const server = new McpServer({ name: "admon-publisher-host", version: "0.1.0" });
  server.registerTool(
    "get_ad_offer",
    {
      title: "Get a transparent sponsored offer",
      description: "Return one explicitly labeled offer for a publisher-classified topic.",
      inputSchema: {
        topicId: topicSchema,
        userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
      }
    },
    async (input) => {
      const offer = createOffer(input.topicId, input.userAddress, origin);
      return {
        content: [{ type: "text", text: JSON.stringify(offer) }],
        structuredContent: offer
      };
    }
  );

  const client = new Client({ name: "admon-publisher-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: "get_ad_offer",
      arguments: { topicId, userAddress }
    });
    const structured = result.structuredContent;
    if (!structured || typeof structured !== "object") {
      throw new Error("AdMon MCP returned no structured offer.");
    }
    return {
      ...(structured as AdOffer),
      topicId: topicSchema.parse((structured as AdOffer).topicId)
    };
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}
