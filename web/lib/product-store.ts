import type { TopicId } from "./ad-types";

export type CampaignStatus = "active" | "paused" | "draft";

export type ProductCampaign = {
  id: string;
  campaignId: number;
  advertiser: string;
  title: string;
  description: string;
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
    id: "monad-rpc",
    campaignId: 1,
    advertiser: "Kuru",
    title: "Add Monad-native liquidity routing to your app",
    description:
      "Explore market and routing infrastructure designed for applications that settle on Monad.",
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

const globalForProduct = globalThis as typeof globalThis & {
  admonProductStore?: ProductStore;
};

const store =
  globalForProduct.admonProductStore?.version === 2
    ? globalForProduct.admonProductStore
    :
  ({
    version: 2,
    campaigns: seededCampaigns,
    publisher: {
      name: "AdMon Reference Agent",
      wallet: "0x719d34102D3c79C588f6C4BA3147cF10d00E4371"
    }
  } satisfies ProductStore);

globalForProduct.admonProductStore = store;

export function listCampaigns(): ProductCampaign[] {
  return store.campaigns.map((campaign) => ({ ...campaign }));
}

export function getCampaignForTopic(topicId: TopicId): ProductCampaign {
  return (
    store.campaigns.find(
      (campaign) => campaign.topicId === topicId && campaign.status === "active"
    ) ??
    store.campaigns.find((campaign) => campaign.status === "active") ??
    seededCampaigns[0]
  );
}

export function saveCampaign(campaign: ProductCampaign): ProductCampaign {
  const next = {
    ...campaign,
    domain: new URL(campaign.destinationUrl).hostname.replace(/^www\./, ""),
    updatedAt: new Date().toISOString()
  };
  const index = store.campaigns.findIndex((item) => item.id === campaign.id);
  if (index === -1) store.campaigns.unshift(next);
  else store.campaigns[index] = next;
  return { ...next };
}

export function getPublisherProfile(): PublisherProfile {
  return { ...store.publisher };
}

export function savePublisherProfile(profile: PublisherProfile): PublisherProfile {
  store.publisher = { ...profile };
  return getPublisherProfile();
}

export function incrementCampaignClicks(campaignId: number): void {
  const campaign = store.campaigns.find(
    (item) => item.campaignId === campaignId && item.status === "active"
  );
  if (campaign) campaign.clicks += 1;
}
