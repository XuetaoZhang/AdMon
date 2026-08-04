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
    paidMon: "0",
    mode: "monad-testnet",
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

export function updateOnchainStatus(
  clickId: string,
  status: Pick<ClickStatus, "state" | "paidMon" | "blockNumber"> & {
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
      paidMon: "0",
      mode: "monad-testnet"
    };
  }
  return click;
}

export function resetClick(clickId: string): void {
  clicks.delete(clickId);
}
