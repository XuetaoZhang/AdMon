import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createOffer } from "@/lib/offers";
import type { AdOffer } from "@/lib/ad-types";
import { getCampaignByCreativeId } from "@/lib/product-store";

/**
 * The publisher host uses the same MCP tool contract as external hosts. The
 * in-memory transport keeps the browser request local while preserving the
 * structured-content boundary used by the standalone stdio server.
 */
export async function getOfferThroughMcp(
  creativeId: string,
  userAddress: string,
  origin: string
): Promise<AdOffer> {
  const server = new McpServer({ name: "admon-publisher-host", version: "0.1.0" });
  server.registerTool(
    "get_ad_offer",
    {
      title: "Get a transparent sponsored offer",
      description: "Return one explicitly labeled offer selected locally by the publisher host.",
      inputSchema: {
        creativeId: z.string().trim().min(1).max(80),
        userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
      }
    },
    async (input) => {
      const campaign = getCampaignByCreativeId(input.creativeId);
      if (!campaign) throw new Error("The matched campaign is no longer active.");
      const offer = createOffer(campaign, input.userAddress, origin);
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
      arguments: { creativeId, userAddress }
    });
    const structured = result.structuredContent;
    if (!structured || typeof structured !== "object") {
      throw new Error("AdMon MCP returned no structured offer.");
    }
    return {
      ...(structured as AdOffer)
    };
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}
