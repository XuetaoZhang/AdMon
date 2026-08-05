import { describe, expect, it } from "vitest";
import { findCampaignForPrompt, normalizeKeywords } from "./product-store";

describe("campaign keyword matching", () => {
  it("selects the campaign with the strongest advertiser-defined keyword match", async () => {
    expect((await findCampaignForPrompt("Monad是什么"))?.id).toBe("monad-mojo");
    expect((await findCampaignForPrompt("Which RPC has the lowest latency for my agent?"))?.id).toBe(
      "monad-rpc"
    );
    expect((await findCampaignForPrompt("Help me compare a USDC swap route"))?.id).toBe(
      "kuru-liquidity"
    );
  });

  it("returns no sponsored campaign when no keyword matches", async () => {
    expect(await findCampaignForPrompt("What is the capital of France?")).toBeNull();
  });

  it("normalizes both western and Chinese keyword separators", () => {
    expect(normalizeKeywords(["deepseek，deepseek-v4-flash"])).toEqual([
      "deepseek",
      "deepseek-v4-flash"
    ]);
  });
});
