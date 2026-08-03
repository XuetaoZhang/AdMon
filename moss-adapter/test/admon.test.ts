import {
  type Change,
  flattenCapabilityTree,
  type Hex,
  type MossRuntime,
  Registry
} from "@themoss/core";
import { encodeAbiParameters, encodeEventTopics, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { AdMonAbi, ADMON_ADDRESS, AdMonProtocol } from "../src/index.js";

const ACCOUNT = getAddress("0xcccccccccccccccccccccccccccccccccccccccc");
const runtime = { rpcUrl: "http://offline", client: {} as MossRuntime["client"] };

describe("AdMon Moss Protocol", () => {
  it("builds exactly one unsigned claim transaction", async () => {
    const registry = new Registry(runtime).use(AdMonProtocol);
    const capability = await registry.action("admon", "claim", ACCOUNT, {});
    if (capability.kind !== "capability") throw new Error("expected capability");

    const transactions = flattenCapabilityTree(capability);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.transaction).toMatchObject({
      to: ADMON_ADDRESS,
      value: "0x0"
    });
  });

  it("covers the native transfer and RewardClaimed event in order", async () => {
    const registry = new Registry(runtime).use(AdMonProtocol);
    const capability = await registry.action("admon", "claim", ACCOUNT, {});
    if (capability.kind !== "capability") throw new Error("expected capability");

    const amount = 2_500_000_000_000_000n;
    const native = {
      kind: "nativeTransfer",
      from: ADMON_ADDRESS,
      to: ACCOUNT,
      value: amount.toString()
    } satisfies Change;
    const claimed = {
      kind: "event",
      address: ADMON_ADDRESS,
      topics: encodeEventTopics({
        abi: AdMonAbi,
        eventName: "RewardClaimed",
        args: { account: ACCOUNT }
      }) as readonly Hex[],
      data: encodeAbiParameters([{ type: "uint256" }], [amount])
    } satisfies Change;

    const receipt = registry.parseReceipt(capability, [native, claimed]);
    expect(receipt.outcome).toEqual({
      operation: "claim",
      account: ACCOUNT,
      amount: amount.toString()
    });
    expect(receipt.changes).toHaveLength(2);
  });

  it("rejects a mismatched native transfer", async () => {
    const registry = new Registry(runtime).use(AdMonProtocol);
    const capability = await registry.action("admon", "claim", ACCOUNT, {});
    if (capability.kind !== "capability") throw new Error("expected capability");

    const amount = 10n;
    const native = {
      kind: "nativeTransfer",
      from: ADMON_ADDRESS,
      to: ACCOUNT,
      value: "9"
    } satisfies Change;
    const claimed = {
      kind: "event",
      address: ADMON_ADDRESS,
      topics: encodeEventTopics({
        abi: AdMonAbi,
        eventName: "RewardClaimed",
        args: { account: ACCOUNT }
      }) as readonly Hex[],
      data: encodeAbiParameters([{ type: "uint256" }], [amount])
    } satisfies Change;

    expect(() => registry.parseReceipt(capability, [native, claimed])).toThrow(
      "does not match"
    );
  });
});
