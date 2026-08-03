import { createHash, randomUUID } from "node:crypto";
import type { AdOffer, TopicId } from "@/lib/ad-types";
import { signClickToken } from "@/lib/click-token";

const publisherAddress =
  "0x2222222222222222222222222222222222222222";

const campaigns: Record<
  TopicId,
  Omit<
    AdOffer,
    | "type"
    | "clickId"
    | "topicId"
    | "clickUrl"
    | "reason"
  >
> = {
  "onchain-actions": {
    campaignId: 101,
    advertiser: "Kuru · sample campaign",
    title: "Compare a Monad-native liquidity venue",
    description:
      "Inspect the venue independently, then ask Moss to simulate the exact route before signing.",
    domain: "kuru.io",
    rewardMon: "0.0025",
    publisherShareMon: "0.0060",
    protocolShareMon: "0.0015",
    disclosure: "Sponsored result · Click reward, not proof of attention",
    demoCampaign: true
  },
  "monad-infra": {
    campaignId: 102,
    advertiser: "FastLane RPC · demo advertiser",
    title: "Production RPC for latency-sensitive Monad apps",
    description:
      "Dedicated endpoints, WebSocket logs, and finalized-state reads for agent applications.",
    domain: "sponsor.admon.local",
    rewardMon: "0.0025",
    publisherShareMon: "0.0060",
    protocolShareMon: "0.0015",
    disclosure: "Sponsored result · Click reward, not proof of attention",
    demoCampaign: true
  },
  wallets: {
    campaignId: 103,
    advertiser: "ClearSign Wallet · demo advertiser",
    title: "Review intent before your Monad transaction is signed",
    description:
      "A sample wallet campaign designed to demonstrate explicit sponsorship and safe handoff.",
    domain: "sponsor.admon.local",
    rewardMon: "0.0025",
    publisherShareMon: "0.0060",
    protocolShareMon: "0.0015",
    disclosure: "Sponsored result · Click reward, not proof of attention",
    demoCampaign: true
  }
};

export function createOffer(
  topicId: TopicId,
  userAddress: string,
  origin: string
): AdOffer {
  const campaign = campaigns[topicId];
  const clickId = `0x${createHash("sha256")
    .update(randomUUID())
    .digest("hex")}` as `0x${string}`;
  const token = signClickToken({
    campaignId: campaign.campaignId,
    clickId,
    user: userAddress,
    publisher: publisherAddress,
    expiresAt: Math.floor(Date.now() / 1000) + 15 * 60
  });

  return {
    type: "ad_offer",
    ...campaign,
    clickId,
    topicId,
    clickUrl: `${origin}/api/click/${token}`,
    reason: `Matched locally to ${topicId}; the raw prompt was not sent to AdMon.`
  };
}
