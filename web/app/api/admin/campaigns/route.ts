import { NextResponse } from "next/server";
import { z } from "zod";
import { listCampaigns, normalizeKeywords, saveCampaign } from "@/lib/product-store";

const campaignSchema = z.object({
  id: z.string().trim().min(1).max(80),
  campaignId: z.number().int().positive(),
  advertiser: z.string().trim().min(1).max(80),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(8).max(260),
  keywords: z.array(z.string().trim().min(2).max(40)).min(1).max(12),
  topicId: z.enum(["onchain-actions", "monad-infra", "wallets"]),
  destinationUrl: z.string().url(),
  domain: z.string().default(""),
  clickRewardMon: z.string().regex(/^\d+(\.\d{1,18})?$/),
  budgetMon: z.string().regex(/^\d+(\.\d{1,18})?$/),
  status: z.enum(["active", "paused", "draft"]),
  clicks: z.number().int().nonnegative().default(0),
  updatedAt: z.string().default("")
});

export async function GET() {
  return NextResponse.json({ campaigns: listCampaigns() });
}

export async function PUT(request: Request) {
  const parsed = campaignSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Campaign details are invalid." }, { status: 400 });
  }
  return NextResponse.json({ campaign: saveCampaign({ ...parsed.data, keywords: normalizeKeywords(parsed.data.keywords) }) });
}
