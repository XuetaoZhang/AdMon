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
  demoCampaign: boolean;
};

export type AgentResponse = {
  prompt: string;
  topicId: TopicId;
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
  state: "ready" | "recorded" | "proposed" | "finalized" | "claimed";
  recordedAt?: string;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  claimableMon: string;
  mode: "local-probe" | "monad-testnet";
};
