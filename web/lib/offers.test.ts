import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { verifyClickToken } from "./click-token";
import { createOffer } from "./offers";
import { findCampaignForPrompt, getPublisherProfile, savePublisherProfile } from "./product-store";

const updatedPublisher = "0x33CF57293465C71430aa74a6CB3CbbA384FA4d3D";

describe("publisher payout routing", () => {
  let originalPublisher: Awaited<ReturnType<typeof getPublisherProfile>>;

  beforeAll(async () => {
    originalPublisher = await getPublisherProfile();
  });

  afterEach(async () => {
    if (originalPublisher) await savePublisherProfile(originalPublisher);
  });

  it("uses the publisher wallet saved in Manage for new click links", async () => {
    await savePublisherProfile({
      name: "Updated publisher",
      wallet: updatedPublisher
    });

    const offer = await createOffer(
      (await findCampaignForPrompt("swap MON for USDC"))!,
      "0x6BD73C2f2ae05f638E4ec39a93AA27ac8ba2F5D6",
      "http://localhost:3004"
    );
    const token = offer.clickUrl.split("/api/click/")[1];

    expect(verifyClickToken(token)?.publisher).toBe(updatedPublisher);
  });
});
