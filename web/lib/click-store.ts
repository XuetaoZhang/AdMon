import type { ClickStatus } from "@/lib/ad-types";
import { ensurePostgresSchema, getPostgresPool } from "./postgres";

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

function clickFromRow(row: Record<string, unknown>): StoredClick {
  const recordedAt = row.recorded_at instanceof Date
    ? row.recorded_at
    : new Date(String(row.recorded_at));
  return {
    clickId: String(row.click_id),
    state: String(row.state) as ClickStatus["state"],
    recordedAt: recordedAt.toISOString(),
    recordedAtMs: recordedAt.getTime(),
    paidMon: String(row.paid_mon),
    mode: String(row.mode) as ClickStatus["mode"],
    ...(row.campaign_id == null ? {} : { campaignId: Number(row.campaign_id) }),
    ...(row.user_address == null ? {} : { userAddress: String(row.user_address) as `0x${string}` }),
    ...(row.publisher_address == null ? {} : { publisherAddress: String(row.publisher_address) as `0x${string}` }),
    ...(row.transaction_hash == null ? {} : { transactionHash: String(row.transaction_hash) as `0x${string}` }),
    ...(row.block_number == null ? {} : { blockNumber: Number(row.block_number) }),
    ...(row.chain_error == null ? {} : { chainError: String(row.chain_error) })
  };
}

async function getDatabase() {
  const database = getPostgresPool();
  if (!database) return null;
  await ensurePostgresSchema();
  return database;
}

export async function recordClick(clickId: string, metadata: ClickMetadata = {}): Promise<StoredClick | null> {
  const database = await getDatabase();
  if (database) {
    const recordedAt = new Date();
    const result = await database.query(
      `INSERT INTO admon_clicks (
        click_id, state, recorded_at, paid_mon, mode, campaign_id,
        user_address, publisher_address
      ) VALUES ($1, 'recorded', $2, '0', 'monad-testnet', $3, $4, $5)
      ON CONFLICT (click_id) DO NOTHING
      RETURNING *`,
      [
        clickId,
        recordedAt,
        metadata.campaignId ?? null,
        metadata.userAddress ?? null,
        metadata.publisherAddress ?? null
      ]
    );
    return result.rows[0] ? clickFromRow(result.rows[0]) : null;
  }

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

export async function markSettlementSubmitted(
  clickId: string,
  transactionHash: `0x${string}`
): Promise<StoredClick | null> {
  const database = await getDatabase();
  if (database) {
    const result = await database.query(
      `UPDATE admon_clicks SET state = 'proposed', transaction_hash = $2, chain_error = NULL
       WHERE click_id = $1 RETURNING *`,
      [clickId, transactionHash]
    );
    return result.rows[0] ? clickFromRow(result.rows[0]) : null;
  }
  const click = clicks.get(clickId);
  if (!click) return null;
  click.state = "proposed";
  click.transactionHash = transactionHash;
  click.chainError = undefined;
  return click;
}

export async function markSettlementError(clickId: string, error: string): Promise<StoredClick | null> {
  const database = await getDatabase();
  if (database) {
    const result = await database.query(
      "UPDATE admon_clicks SET chain_error = $2 WHERE click_id = $1 RETURNING *",
      [clickId, error]
    );
    return result.rows[0] ? clickFromRow(result.rows[0]) : null;
  }
  const click = clicks.get(clickId);
  if (!click) return null;
  click.chainError = error;
  return click;
}

export async function updateOnchainStatus(
  clickId: string,
  status: Pick<ClickStatus, "state" | "paidMon" | "blockNumber"> & {
    chainError?: string;
  }
): Promise<StoredClick | null> {
  const database = await getDatabase();
  if (database) {
    const result = await database.query(
      `UPDATE admon_clicks SET state = $2, paid_mon = $3, block_number = $4, chain_error = $5
       WHERE click_id = $1 RETURNING *`,
      [clickId, status.state, status.paidMon, status.blockNumber ?? null, status.chainError ?? null]
    );
    return result.rows[0] ? clickFromRow(result.rows[0]) : null;
  }
  const click = clicks.get(clickId);
  if (!click) return null;
  Object.assign(click, status);
  return click;
}

export async function getClickStatus(clickId: string): Promise<ClickStatus> {
  const database = await getDatabase();
  if (database) {
    const result = await database.query("SELECT * FROM admon_clicks WHERE click_id = $1", [clickId]);
    return result.rows[0] ? clickFromRow(result.rows[0]) : {
      clickId,
      state: "ready",
      paidMon: "0",
      mode: "monad-testnet"
    };
  }
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

export async function resetClick(clickId: string): Promise<void> {
  const database = await getDatabase();
  if (database) {
    await database.query("DELETE FROM admon_clicks WHERE click_id = $1", [clickId]);
    return;
  }
  clicks.delete(clickId);
}
