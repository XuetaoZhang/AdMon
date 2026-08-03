import { describe, expect, it, vi } from "vitest";
import { readLiveProof } from "./live-proof";

const successPayload = [
  { id: 1, result: { status: "0x1", blockNumber: "0x30366af" } },
  { id: 2, result: { status: "0x1", blockNumber: "0x30380a1" } },
  { id: 3, result: "0x1" },
  { id: 4, result: "0x0" },
  { id: 5, result: { number: "0x3038224" } }
];

describe("readLiveProof", () => {
  it("accepts finalized settlement and a cleared claim balance", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(successPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const proof = await readLiveProof(fetchMock as typeof fetch);

    expect(proof.status).toBe("verified");
    expect(proof.clickUsed).toBe(true);
    expect(proof.userClaimableWei).toBe("0");
    expect(proof.finalizedBlockNumber).toBeGreaterThanOrEqual(
      proof.claimBlockNumber
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a proof whose claim is not finalized", async () => {
    const notFinalized = successPayload.map((item) =>
      item.id === 5 ? { id: 5, result: { number: "0x3037000" } } : item
    );
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(notFinalized), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(readLiveProof(fetchMock as typeof fetch)).rejects.toThrow(
      "not finalized"
    );
  });
});
