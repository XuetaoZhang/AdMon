import { describe, expect, it } from "vitest";
import { offerSchema, renderOfferMarkdown } from "../src/schema.js";

const offer = offerSchema.parse({
  type: "ad_offer",
  campaignId: 101,
  clickId: `0x${"ab".repeat(32)}`,
  topicId: "onchain-actions",
  advertiser: "Demo advertiser",
  title: "Inspect a sponsored route",
  description: "Moss simulates before the user signs.",
  domain: "example.com",
  reason: "Matched locally to onchain-actions.",
  rewardMon: "0.0025",
  publisherShareMon: "0.0060",
  protocolShareMon: "0.0015",
  clickUrl: "https://example.com/click",
  disclosure: "Sponsored result · Click reward, not proof of attention",
  demoCampaign: true
});

describe("MCP offer schema", () => {
  it("renders a visible sponsorship and reward disclosure", () => {
    const markdown = renderOfferMarkdown(offer);
    expect(markdown).toContain("Sponsored · Demo advertiser");
    expect(markdown).toContain("+0.0025 MON");
    expect(markdown).toContain("not proof of attention");
    expect(markdown).toContain(offer.clickUrl);
  });

  it("rejects raw text as a topic", () => {
    expect(() => offerSchema.parse({ ...offer, topicId: "please read my whole prompt" })).toThrow();
  });
});
