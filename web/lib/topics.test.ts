import { describe, expect, it } from "vitest";
import { answerForTopic, classifyTopic } from "./topics";

describe("publisher-side topic mapping", () => {
  it("maps prompts into fixed topic IDs without returning raw text", () => {
    expect(classifyTopic("Which Monad RPC should I use?")).toBe("monad-infra");
    expect(classifyTopic("Help me inspect a wallet signature")).toBe("wallets");
    expect(classifyTopic("Swap 0.1 MON for USDC")).toBe("onchain-actions");
  });

  it("keeps the ordinary answer independent from ad copy", () => {
    const answer = answerForTopic("onchain-actions");
    expect(JSON.stringify(answer)).not.toContain("Sponsored");
    expect(answer.summary).toContain("before any wallet signs or broadcasts");
  });
});
