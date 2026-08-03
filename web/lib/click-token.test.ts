import { describe, expect, it } from "vitest";
import { signClickToken, verifyClickToken } from "./click-token";

const payload = {
  campaignId: 101,
  clickId: `0x${"ab".repeat(32)}`,
  user: "0x1111111111111111111111111111111111111111",
  publisher: "0x2222222222222222222222222222222222222222",
  expiresAt: Math.floor(Date.now() / 1000) + 60
};

describe("one-time click token", () => {
  it("round-trips an authenticated redirect payload", () => {
    expect(verifyClickToken(signClickToken(payload))).toEqual(payload);
  });

  it("rejects a modified signature", () => {
    const token = signClickToken(payload);
    expect(verifyClickToken(`${token.slice(0, -1)}x`)).toBeNull();
  });
});
