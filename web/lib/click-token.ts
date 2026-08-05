import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const tokenSchema = z.object({
  campaignId: z.number().int().positive(),
  clickId: z.string().regex(/^0x[0-9a-f]{64}$/),
  user: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  publisher: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  destinationUrl: z.string().url().optional(),
  expiresAt: z.number().int().positive()
});

export type ClickTokenPayload = z.infer<typeof tokenSchema>;

function secret(): string {
  return process.env.ADMON_CLICK_SECRET || "admon-development-secret";
}

export function signClickToken(payload: ClickTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyClickToken(token: string): ClickTokenPayload | null {
  const [encoded, providedSignature] = token.split(".");
  if (!encoded || !providedSignature) return null;

  const expectedSignature = createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = tokenSchema.safeParse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    );
    if (!parsed.success || parsed.data.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
