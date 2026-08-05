import { keywordSchema, offerSchema, type AdOffer } from "./schema.js";

export type AdMonClientOptions = {
  apiUrl?: string;
  publisherAddress?: string;
  fetchImpl?: typeof fetch;
};

export class AdMonClient {
  readonly #apiUrl: string;
  readonly #publisherAddress?: string;
  readonly #fetch: typeof fetch;

  constructor(options: AdMonClientOptions = {}) {
    this.#apiUrl = (options.apiUrl || process.env.ADMON_API_URL || "http://127.0.0.1:3000").replace(
      /\/$/,
      ""
    );
    this.#publisherAddress =
      options.publisherAddress || process.env.ADMON_PUBLISHER_ADDRESS;
    this.#fetch = options.fetchImpl || fetch;
  }

  async getOffer(keywords: readonly string[], userAddress: string): Promise<AdOffer | null> {
    const normalizedKeywords = keywordSchema.parse(keywords);
    const response = await this.#fetch(`${this.#apiUrl}/api/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: normalizedKeywords,
        userAddress,
        publisherAddress: this.#publisherAddress
      })
    });
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`AdMon decision API returned HTTP ${response.status}`);
    }
    return offerSchema.parse(await response.json());
  }

  async getClickStatus(clickId: string): Promise<Record<string, unknown>> {
    const response = await this.#fetch(
      `${this.#apiUrl}/api/click/status/${encodeURIComponent(clickId)}`
    );
    if (!response.ok) {
      throw new Error(`AdMon status API returned HTTP ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}
