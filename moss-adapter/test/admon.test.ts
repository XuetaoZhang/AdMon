import { type Change, type MossRuntime, Registry } from "@themoss/core";
import { getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  AdMonProtocol,
  AdMonSafetyProtocol,
  buildNativeTransferPreview
} from "../src/index.js";

const ACCOUNT = getAddress("0xcccccccccccccccccccccccccccccccccccccccc");
const ADVERTISER = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

function runtime(readContract: ReturnType<typeof vi.fn>): MossRuntime {
  return {
    rpcUrl: "http://offline",
    client: { readContract } as unknown as MossRuntime["client"]
  };
}

describe("AdMon Moss Protocol", () => {
  it("reads campaign terms without creating a transaction", async () => {
    const readContract = vi.fn(async () => [
      ADVERTISER,
      1,
      10_000_000_000_000_000n,
      2_000_000_000n,
      true,
      "https://example.com"
    ]);
    const registry = new Registry(runtime(readContract)).use(AdMonProtocol);
    const result = await registry.action("admon", "campaign", ACCOUNT, {
      campaignId: "1"
    });

    expect(result.kind).toBe("query");
    expect(result).toMatchObject({
      data: {
        advertiser: ADVERTISER,
        clickRewardWei: "10000000000000000",
        active: true
      }
    });
    expect(readContract).toHaveBeenCalledOnce();
  });

  it("exposes recovery state as a read-only query", async () => {
    const readContract = vi.fn(async () => 0n);
    const registry = new Registry(runtime(readContract)).use(AdMonProtocol);
    const result = await registry.action("admon", "recoveryBalance", ACCOUNT, {
      account: ACCOUNT
    });

    expect(result).toMatchObject({
      kind: "query",
      data: { account: ACCOUNT, amountWei: "0", token: "native" }
    });
  });

  it("builds a bounded unsigned transfer capability", async () => {
    const preview = await buildNativeTransferPreview({
      account: ACCOUNT,
      recipient: ADVERTISER,
      amountMon: "0.01"
    });

    expect(preview).toMatchObject({
      state: "capability-ready",
      protocol: "admon-safety",
      method: "nativeTransfer",
      risk: ["fundOut"],
      params: { recipient: ADVERTISER, amountMon: "0.01" },
      transaction: {
        from: ACCOUNT,
        to: ADVERTISER,
        data: "0x",
        value: "0x2386f26fc10000"
      },
      receipt: { state: "awaiting-execution", verifier: "nativeTransferReceipt" }
    });
  });

  it("verifies a native-transfer receipt through Moss", async () => {
    const registry = new Registry(runtime(vi.fn())).use(AdMonSafetyProtocol);
    const capability = await registry.action("admon-safety", "nativeTransfer", ACCOUNT, {
      recipient: ADVERTISER,
      amountMon: "0.01"
    });
    if (capability.kind !== "capability") throw new Error("expected Capability");
    const change = {
      kind: "nativeTransfer",
      from: ACCOUNT,
      to: ADVERTISER,
      value: "10000000000000000"
    } satisfies Change;

    expect(registry.parseReceipt(capability, [change])).toMatchObject({
      protocol: "admon-safety",
      outcome: {
        operation: "native-transfer",
        from: ACCOUNT,
        to: ADVERTISER,
        value: "10000000000000000"
      }
    });
  });
});
