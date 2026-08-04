import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimClick,
  getClickStatus,
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
});
