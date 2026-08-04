import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { AdMonClient } from "../src/admon-client.js";
import { createAdMonServer } from "../src/server.js";

const fakeOffer = {
  type: "ad_offer" as const,
  campaignId: 101,
  clickId: `0x${"ab".repeat(32)}`,
  topicId: "onchain-actions" as const,
  advertiser: "Testnet advertiser",
  title: "Inspect a sponsored route",
  description: "Moss simulates before the user signs.",
  domain: "example.com",
  reason: "Matched by the publisher's private onchain-actions topic rule.",
  rewardMon: "0.0025",
  publisherShareMon: "0.0060",
  protocolShareMon: "0.0015",
  clickUrl: "https://example.com/click",
  disclosure: "Sponsored result · Click reward, not proof of attention",
  environment: "monad-testnet"
};

describe("AdMon MCP server", () => {
  const closeables: Array<{ close(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(closeables.splice(0).map((item) => item.close()));
  });

  it("exposes a portable structured offer plus Markdown fallback", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(fakeOffer), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    const server = createAdMonServer(
      new AdMonClient({ apiUrl: "https://admon.test", fetchImpl })
    );
    const client = new Client({ name: "admon-test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "get_ad_offer",
      "get_click_status"
    ]);

    const result = await client.callTool({
      name: "get_ad_offer",
      arguments: {
        topicId: "onchain-actions",
        userAddress: "0x1111111111111111111111111111111111111111"
      }
    });
    expect(result.structuredContent).toMatchObject({
      type: "ad_offer",
      advertiser: "Testnet advertiser",
      rewardMon: "0.0025"
    });
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: expect.stringContaining("Sponsored") })
      ])
    );
  });
});
