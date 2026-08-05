import { afterEach, describe, expect, it } from "vitest";
import { verifyClickToken } from "./click-token";
import { createOffer } from "./offers";
import { getPublisherProfile, savePublisherProfile } from "./product-store";

const updatedPublisher = "0x33CF57293465C71430aa74a6CB3CbbA384FA4d3D";

describe("publisher payout routing", () => {
  const originalPublisher = getPublisherProfile();

  afterEach(() => {
    savePublisherProfile(originalPublisher);
  });

  it("uses the publisher wallet saved in Manage for new click links", () => {
    savePublisherProfile({
      name: "Updated publisher",
      wallet: updatedPublisher
    });

    const offer = createOffer(
      "onchain-actions",
      "0x6BD73C2f2ae05f638E4ec39a93AA27ac8ba2F5D6",
      "http://localhost:3004"
    );
    const token = offer.clickUrl.split("/api/click/")[1];

    expect(verifyClickToken(token)?.publisher).toBe(updatedPublisher);
  });
});
