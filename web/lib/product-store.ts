import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TopicId } from "./ad-types";

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

function readStore(): ProductStore {
  if (isTestEnvironment) return testStore;

  if (existsSync(storePath)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(storePath, "utf8"));
      if (isProductStore(parsed)) return parsed;
    } catch {
      // A malformed local store is replaced with a known-good initial store.
    }
  }

  const seeded = createSeedStore();
  writeStore(seeded);
  return seeded;
}

function writeStore(nextStore: ProductStore): void {
  if (isTestEnvironment) {
    testStore = cloneStore(nextStore);
    return;
  }

  // Rename keeps readers in sibling Next.js route runtimes from observing a
  // partially written campaign update.
  const temporaryPath = `${storePath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(nextStore, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, storePath);
}

export function listCampaigns(): ProductCampaign[] {
  const store = readStore();
  return store.campaigns.map((campaign) => ({
    ...campaign,
    keywords: normalizeKeywords(campaign.keywords)
  }));
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

export function findCampaignForPrompt(prompt: string): ProductCampaign | null {
  const normalizedPrompt = normalizeKeyword(prompt);
  const store = readStore();
  const matches = store.campaigns
    .filter((campaign) => campaign.status === "active")
    .map((campaign) => ({ campaign, score: campaignMatchScore(campaign, normalizedPrompt) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  const winner = matches[0]?.campaign;
  return winner ? { ...winner, keywords: normalizeKeywords(winner.keywords) } : null;
}

export function findCampaignForKeywords(keywords: readonly string[]): ProductCampaign | null {
  return findCampaignForPrompt(normalizeKeywords(keywords).join(" "));
}

export function getCampaignByCreativeId(creativeId: string): ProductCampaign | null {
  const store = readStore();
  const campaign = store.campaigns.find(
    (item) => item.id === creativeId && item.status === "active"
  );
  return campaign ? { ...campaign, keywords: normalizeKeywords(campaign.keywords) } : null;
}

export function saveCampaign(campaign: ProductCampaign): ProductCampaign {
  const store = readStore();
  const next = {
    ...campaign,
    keywords: normalizeKeywords(campaign.keywords),
    domain: new URL(campaign.destinationUrl).hostname.replace(/^www\./, ""),
    updatedAt: new Date().toISOString()
  };
  const index = store.campaigns.findIndex((item) => item.id === campaign.id);
  if (index === -1) store.campaigns.unshift(next);
  else store.campaigns[index] = next;
  writeStore(store);
  return { ...next, keywords: normalizeKeywords(next.keywords) };
}

export function getPublisherProfile(): PublisherProfile {
  const store = readStore();
  return { ...store.publisher };
}

export function savePublisherProfile(profile: PublisherProfile): PublisherProfile {
  const store = readStore();
  store.publisher = { ...profile };
  writeStore(store);
  return getPublisherProfile();
}

export function incrementCampaignClicks(campaignId: number): void {
  const store = readStore();
  const campaign = store.campaigns.find(
    (item) => item.campaignId === campaignId && item.status === "active"
  );
  if (campaign) {
    campaign.clicks += 1;
    writeStore(store);
  }
}
