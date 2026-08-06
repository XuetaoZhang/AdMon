import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TopicId } from "./ad-types";
import { ensurePostgresSchema, getPostgresPool } from "./postgres";

export type CampaignStatus = "active" | "paused" | "draft";

export type ProductCampaign = {
  id: string;
  campaignId: number;
  advertiser: string;
  title: string;
  description: string;
  keywords: string[];
  topicId: TopicId;
  destinationUrl: string;
  domain: string;
  clickRewardMon: string;
  budgetMon: string;
  status: CampaignStatus;
  clicks: number;
  updatedAt: string;
};

export type PublisherProfile = {
  name: string;
  wallet: `0x${string}`;
};

type ProductStore = {
  version: number;
  campaigns: ProductCampaign[];
  publisher: PublisherProfile;
};

const seededCampaigns: ProductCampaign[] = [
  {
    id: "kuru-liquidity",
    campaignId: 1,
    advertiser: "Kuru",
    title: "Compare a Monad-native liquidity venue",
    description:
      "Inspect available markets, then ask your agent to simulate the exact route before signing.",
    keywords: ["swap", "liquidity", "trade", "usdc", "route"],
    topicId: "onchain-actions",
    destinationUrl: "https://www.kuru.io",
    domain: "kuru.io",
    clickRewardMon: "0.01",
    budgetMon: "0.16",
    status: "active",
    clicks: 1,
    updatedAt: "2026-08-04T12:00:00.000Z"
  },
  {
    id: "monad-mojo",
    campaignId: 2,
    advertiser: "Monad",
    title: "Monad",
    description:
      "Monad, 下一代以太坊兼容链，通过并行执行引擎实现 10,000 TPS、亚秒级最终确认和极低手续费。100% EVM 字节码兼容，Solidity 合约和现有工具开箱即用。",
    keywords: ["monad"],
    topicId: "monad-infra",
    destinationUrl: "https://mojo.devnads.com/",
    domain: "mojo.devnads.com",
    clickRewardMon: "0.01",
    budgetMon: "0.16",
    status: "active",
    clicks: 0,
    updatedAt: "2026-08-05T07:44:00.000Z"
  },
  {
    id: "monad-rpc",
    campaignId: 1,
    advertiser: "Kuru",
    title: "Add Monad-native liquidity routing to your app",
    description:
      "Explore market and routing infrastructure designed for applications that settle on Monad.",
    keywords: ["rpc", "node", "latency", "deploy", "indexer"],
    topicId: "monad-infra",
    destinationUrl: "https://www.kuru.io",
    domain: "kuru.io",
    clickRewardMon: "0.01",
    budgetMon: "0.16",
    status: "active",
    clicks: 0,
    updatedAt: "2026-08-04T12:00:00.000Z"
  },
  {
    id: "wallet-safety",
    campaignId: 1,
    advertiser: "Kuru",
    title: "Inspect the route before your wallet signs",
    description:
      "Compare the venue independently, simulate the route, and keep the final wallet signature explicit.",
    keywords: ["wallet", "signature", "approval", "address", "transfer"],
    topicId: "wallets",
    destinationUrl: "https://www.kuru.io",
    domain: "kuru.io",
    clickRewardMon: "0.01",
    budgetMon: "0.16",
    status: "active",
    clicks: 0,
    updatedAt: "2026-08-04T12:00:00.000Z"
  }
];

const storePath = path.join(process.cwd(), ".admon-store.json");
const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
let databaseSeedPromise: Promise<void> | null = null;

const globalForProductStore = globalThis as typeof globalThis & {
  admonLocalStore?: ProductStore;
};

function createSeedStore(): ProductStore {
  return {
    version: 4,
    campaigns: seededCampaigns.map((campaign) => ({ ...campaign, keywords: [...campaign.keywords] })),
    publisher: {
      name: "AdMon Reference Agent",
      wallet: "0x719d34102D3c79C588f6C4BA3147cF10d00E4371"
    }
  };
}

let testStore = createSeedStore();

function cloneStore(store: ProductStore): ProductStore {
  return {
    ...store,
    campaigns: store.campaigns.map((campaign) => ({ ...campaign, keywords: [...campaign.keywords] })),
    publisher: { ...store.publisher }
  };
}

function isProductStore(value: unknown): value is ProductStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProductStore>;
  return (
    candidate.version === 4 &&
    Array.isArray(candidate.campaigns) &&
    Boolean(candidate.publisher?.name) &&
    typeof candidate.publisher?.wallet === "string"
  );
}

function readLocalStore(): ProductStore {
  if (isTestEnvironment) return testStore;

  if (existsSync(storePath)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(storePath, "utf8"));
      if (isProductStore(parsed)) return parsed;
    } catch {
      // A malformed local store is replaced with a known-good initial store.
    }
  }

  const seeded = globalForProductStore.admonLocalStore ?? createSeedStore();
  globalForProductStore.admonLocalStore = cloneStore(seeded);
  writeLocalStore(seeded);
  return cloneStore(seeded);
}

function writeLocalStore(nextStore: ProductStore): void {
  if (isTestEnvironment) {
    testStore = cloneStore(nextStore);
    return;
  }

  // Rename keeps readers in sibling Next.js route runtimes from observing a
  // partially written campaign update.
  try {
    const temporaryPath = `${storePath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(nextStore, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, storePath);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "EROFS" && code !== "EACCES" && code !== "EPERM") throw error;
    // Serverless filesystems are read-only. Keep the development fallback
    // available for that runtime while shared deployments use PostgreSQL.
    globalForProductStore.admonLocalStore = cloneStore(nextStore);
  }
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeKeywords(keywords: readonly string[]): string[] {
  return Array.from(
    new Set(
      keywords
        .flatMap((keyword) => keyword.split(/[,\uFF0C\n]/g))
        .map(normalizeKeyword)
        .filter((keyword) => keyword.length >= 2)
    )
  ).slice(0, 12);
}

function campaignMatchScore(campaign: ProductCampaign, haystack: string): number {
  return normalizeKeywords(campaign.keywords).reduce(
    (score, keyword) => (haystack.includes(normalizeKeyword(keyword)) ? score + keyword.length : score),
    0
  );
}

function campaignFromRow(row: Record<string, unknown>): ProductCampaign {
  const keywords = Array.isArray(row.keywords)
    ? row.keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];
  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : String(row.updated_at);
  return {
    id: String(row.id),
    campaignId: Number(row.campaign_id),
    advertiser: String(row.advertiser),
    title: String(row.title),
    description: String(row.description),
    keywords: normalizeKeywords(keywords),
    topicId: String(row.topic_id) as TopicId,
    destinationUrl: String(row.destination_url),
    domain: String(row.domain),
    clickRewardMon: String(row.click_reward_mon),
    budgetMon: String(row.budget_mon),
    status: String(row.status) as CampaignStatus,
    clicks: Number(row.clicks),
    updatedAt
  };
}

async function getDatabase() {
  const database = getPostgresPool();
  if (!database) return null;
  await ensurePostgresSchema();
  if (!databaseSeedPromise) {
    databaseSeedPromise = (async () => {
      const campaignCount = await database.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM admon_campaigns"
      );
      if (campaignCount.rows[0]?.count !== "0") return;

      const localStore = readLocalStore();
      await database.query("BEGIN");
      try {
        for (const campaign of localStore.campaigns) {
          await database.query(
            `INSERT INTO admon_campaigns (
              id, campaign_id, advertiser, title, description, keywords, topic_id,
              destination_url, domain, click_reward_mon, budget_mon, status, clicks, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              campaign.id,
              campaign.campaignId,
              campaign.advertiser,
              campaign.title,
              campaign.description,
              JSON.stringify(normalizeKeywords(campaign.keywords)),
              campaign.topicId,
              campaign.destinationUrl,
              campaign.domain,
              campaign.clickRewardMon,
              campaign.budgetMon,
              campaign.status,
              campaign.clicks,
              campaign.updatedAt
            ]
          );
        }
        await database.query(
          `INSERT INTO admon_publisher (id, name, wallet)
           VALUES (TRUE, $1, $2)
           ON CONFLICT (id) DO NOTHING`,
          [localStore.publisher.name, localStore.publisher.wallet]
        );
        await database.query("COMMIT");
      } catch (error) {
        await database.query("ROLLBACK");
        throw error;
      }
    })();
  }
  try {
    await databaseSeedPromise;
  } finally {
    databaseSeedPromise = null;
  }
  return database;
}

export async function listCampaigns(): Promise<ProductCampaign[]> {
  const database = await getDatabase();
  if (!database) {
    return readLocalStore().campaigns.map((campaign) => ({
      ...campaign,
      keywords: normalizeKeywords(campaign.keywords)
    }));
  }
  const result = await database.query(
    "SELECT * FROM admon_campaigns ORDER BY updated_at DESC, id ASC"
  );
  return result.rows.map(campaignFromRow);
}

export async function findCampaignForPrompt(prompt: string): Promise<ProductCampaign | null> {
  const normalizedPrompt = normalizeKeyword(prompt);
  const matches = (await listCampaigns())
    .filter((campaign) => campaign.status === "active")
    .map((campaign) => ({ campaign, score: campaignMatchScore(campaign, normalizedPrompt) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  const winner = matches[0]?.campaign;
  return winner ? { ...winner, keywords: normalizeKeywords(winner.keywords) } : null;
}

export async function findCampaignForKeywords(
  keywords: readonly string[]
): Promise<ProductCampaign | null> {
  return findCampaignForPrompt(normalizeKeywords(keywords).join(" "));
}

export async function getCampaignByCreativeId(creativeId: string): Promise<ProductCampaign | null> {
  const campaign = (await listCampaigns()).find(
    (item) => item.id === creativeId && item.status === "active"
  );
  return campaign ? { ...campaign, keywords: normalizeKeywords(campaign.keywords) } : null;
}

export async function saveCampaign(campaign: ProductCampaign): Promise<ProductCampaign> {
  const next = {
    ...campaign,
    keywords: normalizeKeywords(campaign.keywords),
    domain: new URL(campaign.destinationUrl).hostname.replace(/^www\./, ""),
    updatedAt: new Date().toISOString()
  };
  const database = await getDatabase();
  if (database) {
    await database.query(
      `INSERT INTO admon_campaigns (
        id, campaign_id, advertiser, title, description, keywords, topic_id,
        destination_url, domain, click_reward_mon, budget_mon, status, clicks, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        campaign_id = EXCLUDED.campaign_id, advertiser = EXCLUDED.advertiser,
        title = EXCLUDED.title, description = EXCLUDED.description, keywords = EXCLUDED.keywords,
        topic_id = EXCLUDED.topic_id, destination_url = EXCLUDED.destination_url,
        domain = EXCLUDED.domain, click_reward_mon = EXCLUDED.click_reward_mon,
        budget_mon = EXCLUDED.budget_mon, status = EXCLUDED.status, clicks = EXCLUDED.clicks,
        updated_at = EXCLUDED.updated_at`,
      [
        next.id, next.campaignId, next.advertiser, next.title, next.description,
        JSON.stringify(next.keywords), next.topicId, next.destinationUrl, next.domain,
        next.clickRewardMon, next.budgetMon, next.status, next.clicks, next.updatedAt
      ]
    );
  } else {
    const store = readLocalStore();
    const index = store.campaigns.findIndex((item) => item.id === campaign.id);
    if (index === -1) store.campaigns.unshift(next);
    else store.campaigns[index] = next;
    writeLocalStore(store);
  }
  return { ...next, keywords: normalizeKeywords(next.keywords) };
}

export async function getPublisherProfile(): Promise<PublisherProfile> {
  const database = await getDatabase();
  if (!database) return { ...readLocalStore().publisher };
  const result = await database.query<{ name: string; wallet: string }>(
    "SELECT name, wallet FROM admon_publisher WHERE id = TRUE"
  );
  const publisher = result.rows[0];
  if (!publisher) throw new Error("AdMon publisher profile is not initialized.");
  return { name: publisher.name, wallet: publisher.wallet as `0x${string}` };
}

export async function savePublisherProfile(profile: PublisherProfile): Promise<PublisherProfile> {
  const database = await getDatabase();
  if (database) {
    await database.query(
      `INSERT INTO admon_publisher (id, name, wallet, updated_at)
       VALUES (TRUE, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, wallet = EXCLUDED.wallet,
         updated_at = EXCLUDED.updated_at`,
      [profile.name, profile.wallet]
    );
    return { ...profile };
  }
  const store = readLocalStore();
  store.publisher = { ...profile };
  writeLocalStore(store);
  return { ...store.publisher };
}

export async function incrementCampaignClicks(campaignId: number): Promise<void> {
  const database = await getDatabase();
  if (database) {
    await database.query(
      "UPDATE admon_campaigns SET clicks = clicks + 1, updated_at = NOW() WHERE campaign_id = $1 AND status = 'active'",
      [campaignId]
    );
    return;
  }
  const store = readLocalStore();
  const campaign = store.campaigns.find(
    (item) => item.campaignId === campaignId && item.status === "active"
  );
  if (campaign) {
    campaign.clicks += 1;
    writeLocalStore(store);
  }
}
