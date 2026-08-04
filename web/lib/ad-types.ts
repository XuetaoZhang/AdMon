export type TopicId = "onchain-actions" | "monad-infra" | "wallets";

export type AdOffer = {
  type: "ad_offer";
  campaignId: number;
  clickId: `0x${string}`;
  topicId: TopicId;
  advertiser: string;
  title: string;
  description: string;
  domain: string;
  reason: string;
  rewardMon: string;
  publisherShareMon: string;
  protocolShareMon: string;
  clickUrl: string;
  disclosure: string;
  environment: "monad-testnet";
};

export type AgentResponse = {
  prompt: string;
  topicId: TopicId;
  adSource: "mcp:get_ad_offer";
  answer: {
    heading: string;
    summary: string;
    checks: string[];
    receipt: string[];
  };
  offer: AdOffer;
};

export type ClickStatus = {
  clickId: string;
  state: "ready" | "recorded" | "proposed" | "paid";
  recordedAt?: string;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  paidMon: string;
  mode: "monad-testnet";
  userAddress?: `0x${string}`;
  publisherAddress?: `0x${string}`;
  campaignId?: number;
  chainError?: string;
};
