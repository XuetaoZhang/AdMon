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
    resetClick(clickId);
    vi.useRealTimers();
  });

  it("moves one click from recorded to submitted and paid", () => {
    expect(recordClick(clickId)).toMatchObject({
      state: "recorded",
      paidMon: "0",
      mode: "monad-testnet"
    });
    expect(markSettlementSubmitted(clickId, `0x${"ef".repeat(32)}`)?.state).toBe(
      "proposed"
    );
    expect(
      updateOnchainStatus(clickId, {
        state: "paid",
        paidMon: "0.0025",
        blockNumber: 123
      })
    ).toMatchObject({ state: "paid", paidMon: "0.0025", blockNumber: 123 });
  });

  it("rejects a replay of the same click ID", () => {
    expect(recordClick(clickId)).not.toBeNull();
    expect(recordClick(clickId)).toBeNull();
  });

  it("keeps the submitted state until an onchain read updates it", () => {
    expect(recordClick(clickId)).not.toBeNull();
    expect(markSettlementSubmitted(clickId, `0x${"ef".repeat(32)}`)).toMatchObject({
      mode: "monad-testnet",
      state: "proposed"
    });
    expect(getClickStatus(clickId).state).toBe("proposed");
  });

  it("allows a signed click to retry after a pre-settlement configuration failure", () => {
    expect(recordClick(clickId)).not.toBeNull();
    expect(markSettlementError(clickId, "AdMon relayer is not configured.")?.chainError).toContain(
      "not configured"
    );
    resetClick(clickId);
    expect(recordClick(clickId)).not.toBeNull();
  });
});
