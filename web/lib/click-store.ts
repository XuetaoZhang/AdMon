import type { ClickStatus } from "@/lib/ad-types";

type StoredClick = ClickStatus & {
  recordedAtMs: number;
};

export type ClickMetadata = {
  campaignId?: number;
  userAddress?: `0x${string}`;
  publisherAddress?: `0x${string}`;
};

const globalForClicks = globalThis as typeof globalThis & {
  admonClicks?: Map<string, StoredClick>;
};

const clicks = globalForClicks.admonClicks ?? new Map<string, StoredClick>();
globalForClicks.admonClicks = clicks;

export function recordClick(clickId: string, metadata: ClickMetadata = {}): StoredClick | null {
  if (clicks.has(clickId)) return null;

  const recordedAtMs = Date.now();
  const stored: StoredClick = {
    clickId,
    state: "recorded",
    recordedAt: new Date(recordedAtMs).toISOString(),
    recordedAtMs,
    claimableMon: "0.0025",
    mode: "session-preview",
    ...metadata
  };
  clicks.set(clickId, stored);
  return stored;
}

export function markSettlementSubmitted(
  clickId: string,
  transactionHash: `0x${string}`
): StoredClick | null {
  const click = clicks.get(clickId);
  if (!click) return null;
  click.mode = "monad-testnet";
  click.state = "proposed";
  click.transactionHash = transactionHash;
  click.chainError = undefined;
  return click;
}

export function markSettlementError(clickId: string, error: string): StoredClick | null {
  const click = clicks.get(clickId);
  if (!click) return null;
  click.chainError = error;
  return click;
}

export function markClaimSubmitted(
  clickId: string,
  transactionHash: `0x${string}`
): StoredClick | null {
  const click = clicks.get(clickId);
  if (!click) return null;
  click.claimTransactionHash = transactionHash;
  click.state = "proposed";
  return click;
}

export function updateOnchainStatus(
  clickId: string,
  status: Pick<ClickStatus, "state" | "claimableMon" | "blockNumber" | "claimTransactionHash"> & {
    chainError?: string;
  }
): StoredClick | null {
  const click = clicks.get(clickId);
  if (!click) return null;
  Object.assign(click, status);
  return click;
}

export function getClickStatus(clickId: string): ClickStatus {
  const click = clicks.get(clickId);
  if (!click) {
    return {
      clickId,
      state: "ready",
      claimableMon: "0",
      mode: "session-preview"
    };
  }

  if (click.mode === "session-preview" && click.state !== "claimed") {
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
