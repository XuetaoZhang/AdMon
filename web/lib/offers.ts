import { createHash, randomUUID } from "node:crypto";
import type { AdOffer, TopicId } from "@/lib/ad-types";
import { signClickToken } from "@/lib/click-token";

const publisherAddress =
  process.env.ADMON_PUBLISHER_ADDRESS ||
  "0x719d34102D3c79C588f6C4BA3147cF10d00E4371";

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
    campaignId: 1,
    advertiser: "Kuru",
    title: "Compare a Monad-native liquidity venue",
    description:
      "Inspect the venue independently, then ask Moss to simulate the exact route before signing.",
    domain: "kuru.io",
    rewardMon: "0.0025",
    publisherShareMon: "0.0060",
    protocolShareMon: "0.0015",
    disclosure: "Sponsored result · Monad testnet campaign · Click reward, not proof of attention",
    environment: "monad-testnet"
  },
  "monad-infra": {
    campaignId: 1,
    advertiser: "FastLane RPC",
    title: "Production RPC for latency-sensitive Monad apps",
    description:
      "Dedicated endpoints, WebSocket logs, and finalized-state reads for agent applications.",
    domain: "fastlane.xyz",
    rewardMon: "0.0025",
    publisherShareMon: "0.0060",
    protocolShareMon: "0.0015",
    disclosure: "Sponsored result · Monad testnet campaign · Click reward, not proof of attention",
    environment: "monad-testnet"
  },
  wallets: {
    campaignId: 1,
    advertiser: "ClearSign Wallet",
    title: "Review intent before your Monad transaction is signed",
    description:
      "Review the destination, transaction intent, and approval scope before handing control to a signer.",
    domain: "clearsign.app",
    rewardMon: "0.0025",
    publisherShareMon: "0.0060",
    protocolShareMon: "0.0015",
    disclosure: "Sponsored result · Monad testnet campaign · Click reward, not proof of attention",
    environment: "monad-testnet"
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
    reason: `Matched by the publisher's private ${topicId} topic rule; the raw prompt was not sent to AdMon.`
  };
}
