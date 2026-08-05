import { Pool } from "pg";

const testEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const pool = process.env.DATABASE_URL && !testEnvironment
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    })
  : null;

let schemaPromise: Promise<void> | null = null;

export function getPostgresPool(): Pool | null {
  return pool;
}

export function ensurePostgresSchema(): Promise<void> {
  if (!pool) return Promise.resolve();
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admon_campaigns (
        id TEXT PRIMARY KEY,
        campaign_id BIGINT NOT NULL,
        advertiser TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        keywords JSONB NOT NULL,
        topic_id TEXT NOT NULL,
        destination_url TEXT NOT NULL,
        domain TEXT NOT NULL,
        click_reward_mon TEXT NOT NULL,
        budget_mon TEXT NOT NULL,
        status TEXT NOT NULL,
        clicks INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admon_campaigns_status_idx
        ON admon_campaigns (status);
      CREATE TABLE IF NOT EXISTS admon_publisher (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE,
        name TEXT NOT NULL,
        wallet TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admon_clicks (
        click_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL,
        paid_mon TEXT NOT NULL DEFAULT '0',
        mode TEXT NOT NULL,
        campaign_id BIGINT,
        user_address TEXT,
        publisher_address TEXT,
        transaction_hash TEXT,
        block_number INTEGER,
        chain_error TEXT
      );
      CREATE INDEX IF NOT EXISTS admon_clicks_recorded_at_idx
        ON admon_clicks (recorded_at);
    `);
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}
