import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWithDeepSeek, inferNativeTransferAction } from "./deepseek-agent";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AUTH_TOKEN;
  delete process.env.BASE_URL;
  delete process.env.MODEL;
});

describe("DeepSeek agent", () => {
  it("extracts an explicit native transfer for the offline fallback", () => {
    expect(
      inferNativeTransferAction(
        "Prepare a 0.01 MON transfer to 0xd7B64D086B397d25368B2CD3db4BBb389c494DB5 without sending."
      )
    ).toEqual({
      kind: "native-transfer",
      amountMon: "0.01",
      recipient: "0xd7B64D086B397d25368B2CD3db4BBb389c494DB5"
    });
  });

  it("returns a validated neutral response", async () => {
    process.env.AUTH_TOKEN = "test-key";
    process.env.BASE_URL = "https://deepseek.example";
    process.env.MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  topicId: "wallets",
                  answer: {
                    heading: "Review the wallet action",
                    summary: "Inspect the recipient, amount, and approval scope before asking the wallet to sign.",
                    checks: ["Verify the recipient address"],
                    receipt: ["No transaction was broadcast"]
                  }
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateWithDeepSeek("Review this wallet action");

    expect(result.provider).toBe("deepseek");
    expect(result.model).toBe("test-model");
    expect(result.topicId).toBe("wallets");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://deepseek.example/chat/completions",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.thinking).toEqual({ type: "disabled" });
    expect(requestBody.max_tokens).toBe(1200);
  });

  it("normalizes a provider JSON response with a string answer", async () => {
    process.env.AUTH_TOKEN = "test-key";
    process.env.BASE_URL = "https://deepseek.example";
    process.env.MODEL = "deepseek-v4-flash";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({
              topicId: "model-identity",
              answer: "我是一个人工智能语言模型，致力于提供帮助。",
              mossAction: "reply"
            }) } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await generateWithDeepSeek("你是什么模型？");

    expect(result.topicId).toBe("onchain-actions");
    expect(result.answer.summary).toContain("人工智能语言模型");
    expect(result.mossAction.kind).toBe("none");
  });
});
