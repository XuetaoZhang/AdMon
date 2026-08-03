import { offerSchema, type AdOffer, type TopicId } from "./schema.js";

export type AdMonClientOptions = {
  apiUrl?: string;
  fetchImpl?: typeof fetch;
};

export class AdMonClient {
  readonly #apiUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: AdMonClientOptions = {}) {
    this.#apiUrl = (options.apiUrl || process.env.ADMON_API_URL || "http://127.0.0.1:3000").replace(
      /\/$/,
      ""
    );
    this.#fetch = options.fetchImpl || fetch;
  }

  async getOffer(topicId: TopicId, userAddress: string): Promise<AdOffer> {
    const response = await this.#fetch(`${this.#apiUrl}/api/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, userAddress })
    });
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
