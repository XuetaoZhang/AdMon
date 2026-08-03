import { createHash } from "node:crypto";
import type { ClickStatus } from "@/lib/ad-types";

type StoredClick = ClickStatus & {
  recordedAtMs: number;
};

const globalForClicks = globalThis as typeof globalThis & {
  admonClicks?: Map<string, StoredClick>;
};

const clicks = globalForClicks.admonClicks ?? new Map<string, StoredClick>();
globalForClicks.admonClicks = clicks;

export function recordClick(clickId: string): StoredClick | null {
  if (clicks.has(clickId)) return null;

  const recordedAtMs = Date.now();
  const transactionHash = `0x${createHash("sha256")
    .update(`${clickId}:settlement`)
    .digest("hex")}` as `0x${string}`;
  const stored: StoredClick = {
    clickId,
    state: "recorded",
    recordedAt: new Date(recordedAtMs).toISOString(),
    recordedAtMs,
    transactionHash,
    blockNumber: 21_948_301 + clicks.size,
    claimableMon: "0.0025",
    mode: "local-probe"
  };
  clicks.set(clickId, stored);
  return stored;
}

export function getClickStatus(clickId: string): ClickStatus {
  const click = clicks.get(clickId);
  if (!click) {
    return {
      clickId,
      state: "ready",
      claimableMon: "0",
      mode: "local-probe"
    };
  }

  if (click.state !== "claimed") {
    const age = Date.now() - click.recordedAtMs;
    click.state = age >= 1_600 ? "finalized" : age >= 450 ? "proposed" : "recorded";
  }
  return click;
}

export function claimClick(clickId: string): ClickStatus | null {
  const click = clicks.get(clickId);
  if (!click || getClickStatus(clickId).state !== "finalized") return null;
  click.state = "claimed";
  return click;
}

export function resetClick(clickId: string): void {
  clicks.delete(clickId);
}
