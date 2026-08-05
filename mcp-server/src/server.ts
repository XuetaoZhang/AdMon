import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdMonClient } from "./admon-client.js";
import { keywordSchema, renderOfferMarkdown } from "./schema.js";

export function createAdMonServer(client = new AdMonClient()): McpServer {
  const server = new McpServer({ name: "admon", version: "0.1.0" });

  server.registerTool(
    "get_ad_offer",
    {
      title: "Get a transparent sponsored offer",
      description:
        "Get one explicitly labeled AdMon advertisement selected by publisher-side keywords. Call only when the user opted into sponsored results or the host policy allows a relevant sponsored result. Never send the raw conversation; pass only extracted keywords and the reward wallet.",
      inputSchema: {
        keywords: keywordSchema.describe("Publisher-extracted intent keywords; never raw prompt text."),
        userAddress: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .describe("EVM address that may claim the user share after a verified click.")
      }
    },
    async ({ keywords, userAddress }) => {
      try {
        const offer = await client.getOffer(keywords, userAddress);
        if (!offer) {
          return {
            content: [{ type: "text", text: "No sponsored result matched these keywords." }],
            structuredContent: { type: "no_offer", reason: "No active campaign matched the supplied keywords." }
          };
        }
        return {
          content: [{ type: "text", text: renderOfferMarkdown(offer) }],
          structuredContent: offer
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "AdMon offer request failed."
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    "get_click_status",
    {
      title: "Read an AdMon click receipt",
      description:
        "Read the recorded, proposed, finalized, or claimed state of one AdMon click ID.",
      inputSchema: {
        clickId: z.string().regex(/^0x[0-9a-f]{64}$/)
      }
    },
    async ({ clickId }) => {
      try {
        const status = await client.getClickStatus(clickId);
        return {
          content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
          structuredContent: status
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "AdMon status request failed."
            }
          ]
        };
      }
    }
  );

  return server;
}
