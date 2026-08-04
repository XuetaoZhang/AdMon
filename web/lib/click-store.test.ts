import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimClick,
  getClickStatus,
  markSettlementError,
  markSettlementSubmitted,
  recordClick,
  resetClick
} from "./click-store";

const clickId = `0x${"cd".repeat(32)}`;

describe("session click settlement state machine", () => {
  afterEach(() => {
    resetClick(clickId);
    vi.useRealTimers();
  });

  it("moves one click from recorded to proposed, finalized, and claimed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T10:00:00.000Z"));

    expect(recordClick(clickId)).toMatchObject({
      state: "recorded",
      claimableMon: "0.0025",
      mode: "session-preview"
    });

    vi.advanceTimersByTime(500);
    expect(getClickStatus(clickId).state).toBe("proposed");

    vi.advanceTimersByTime(1_200);
    expect(getClickStatus(clickId).state).toBe("finalized");
    expect(claimClick(clickId)?.state).toBe("claimed");
    expect(getClickStatus(clickId).state).toBe("claimed");
    expect(claimClick(clickId)).toBeNull();
  });

  it("rejects a replay of the same click ID", () => {
    expect(recordClick(clickId)).not.toBeNull();
    expect(recordClick(clickId)).toBeNull();
  });

  it("does not replace an onchain state with the session timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T10:00:00.000Z"));
    expect(recordClick(clickId)).not.toBeNull();
    expect(markSettlementSubmitted(clickId, `0x${"ef".repeat(32)}`)).toMatchObject({
      mode: "monad-testnet",
      state: "proposed"
    });

    vi.advanceTimersByTime(5_000);
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
