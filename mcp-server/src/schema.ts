import { z } from "zod";

export const topicSchema = z.enum(["onchain-actions", "monad-infra", "wallets"]);
export type TopicId = z.infer<typeof topicSchema>;

export const offerSchema = z.object({
  type: z.literal("ad_offer"),
  campaignId: z.number().int().positive(),
  creativeId: z.string(),
  clickId: z.string(),
  topicId: topicSchema,
  advertiser: z.string(),
  title: z.string(),
  description: z.string(),
  domain: z.string(),
  reason: z.string(),
  rewardMon: z.string(),
  publisherShareMon: z.string(),
  protocolShareMon: z.string(),
  clickUrl: z.string().url(),
  disclosure: z.string(),
  environment: z.literal("monad-testnet")
});

export type AdOffer = z.infer<typeof offerSchema>;

export function renderOfferMarkdown(offer: AdOffer): string {
  return [
    `### Sponsored · ${offer.advertiser}`,
    "",
    `**${offer.title}**`,
    "",
    offer.description,
    "",
    `- Why shown: ${offer.reason}`,
    `- User reward: +${offer.rewardMon} MON after a verified click`,
    `- Destination: ${offer.domain}`,
    "",
    `[Visit sponsor and record click](${offer.clickUrl})`,
    "",
    `_${offer.disclosure}_`,
    `Click ID: \`${offer.clickId}\``
  ].join("\n");
}
