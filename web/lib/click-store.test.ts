import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getClickStatus,
  markSettlementError,
  markSettlementSubmitted,
  recordClick,
  resetClick,
  updateOnchainStatus
} from "./click-store";

const clickId = `0x${"cd".repeat(32)}`;

describe("click settlement state machine", () => {
  afterEach(() => {
    void resetClick(clickId);
    vi.useRealTimers();
  });

  it("moves one click from recorded to submitted and paid", async () => {
    expect(await recordClick(clickId)).toMatchObject({
      state: "recorded",
      paidMon: "0",
      mode: "monad-testnet"
    });
    expect((await markSettlementSubmitted(clickId, `0x${"ef".repeat(32)}`))?.state).toBe(
      "proposed"
    );
    expect(
      await updateOnchainStatus(clickId, {
        state: "paid",
        paidMon: "0.0025",
        blockNumber: 123
      })
    ).toMatchObject({ state: "paid", paidMon: "0.0025", blockNumber: 123 });
  });

  it("rejects a replay of the same click ID", async () => {
    expect(await recordClick(clickId)).not.toBeNull();
    expect(await recordClick(clickId)).toBeNull();
  });

  it("keeps the submitted state until an onchain read updates it", async () => {
    expect(await recordClick(clickId)).not.toBeNull();
    expect(await markSettlementSubmitted(clickId, `0x${"ef".repeat(32)}`)).toMatchObject({
      mode: "monad-testnet",
      state: "proposed"
    });
    expect((await getClickStatus(clickId)).state).toBe("proposed");
  });

  it("allows a signed click to retry after a pre-settlement configuration failure", async () => {
    expect(await recordClick(clickId)).not.toBeNull();
    expect((await markSettlementError(clickId, "AdMon relayer is not configured."))?.chainError).toContain(
      "not configured"
    );
    await resetClick(clickId);
    expect(await recordClick(clickId)).not.toBeNull();
  });
});
