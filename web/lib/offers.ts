import { createHash, randomUUID } from "node:crypto";
import type { AdOffer, TopicId } from "./ad-types";
import { signClickToken } from "./click-token";
import { getCampaignForTopic, getPublisherProfile } from "./product-store";

export function createOffer(
  topicId: TopicId,
  userAddress: string,
  origin: string,
  requestedPublisher?: string
): AdOffer {
  const campaign = getCampaignForTopic(topicId);
  const publisherAddress = requestedPublisher || getPublisherProfile().wallet;
  const clickId = `0x${createHash("sha256")
    .update(randomUUID())
    .digest("hex")}` as `0x${string}`;
  const token = signClickToken({
    campaignId: campaign.campaignId,
    clickId,
    user: userAddress,
    publisher: publisherAddress,
    destinationUrl: campaign.destinationUrl,
    expiresAt: Math.floor(Date.now() / 1000) + 15 * 60
  });

  const clickReward = Number(campaign.clickRewardMon);

  return {
    type: "ad_offer",
    campaignId: campaign.campaignId,
    creativeId: campaign.id,
    advertiser: campaign.advertiser,
    title: campaign.title,
    description: campaign.description,
    domain: campaign.domain,
    rewardMon: (clickReward * 0.25).toFixed(4),
    publisherShareMon: (clickReward * 0.6).toFixed(4),
    protocolShareMon: (clickReward * 0.15).toFixed(4),
    disclosure: "Sponsored result · Settled on Monad · Click reward, not proof of attention",
    environment: "monad-testnet",
    clickId,
    topicId,
    clickUrl: `${origin}/api/click/${token}`,
    reason: `Matched by the publisher's private ${topicId} topic rule; the raw prompt was not sent to AdMon.`
  };
}
