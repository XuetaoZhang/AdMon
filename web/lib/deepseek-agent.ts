import { z } from "zod";

const topicIdSchema = z.enum(["onchain-actions", "monad-infra", "wallets"]);

const answerSchema = z.object({
  heading: z.string().trim().min(4).max(120),
  summary: z.string().trim().min(20).max(600),
  checks: z.array(z.string().trim().min(3).max(180)).min(1).max(5),
  receipt: z.array(z.string().trim().min(3).max(180)).min(1).max(5)
});

const mossActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("none"),
    reason: z.string().trim().min(3).max(180)
  }),
  z.object({
    kind: z.literal("native-transfer"),
    recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    amountMon: z
      .string()
      .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/)
      .refine((value) => /[1-9]/.test(value))
  })
]);

const agentPayloadSchema = z.object({
  topicId: topicIdSchema,
  answer: answerSchema,
  mossAction: mossActionSchema.default({
    kind: "none",
    reason: "No explicit executable action was requested."
  })
});

export type MossAction = z.infer<typeof mossActionSchema>;

export type DeepSeekAgentResult = z.infer<typeof agentPayloadSchema> & {
  provider: "deepseek";
  model: string;
};

export function inferNativeTransferAction(prompt: string): MossAction {
  const amountThenTransfer = prompt.match(
    /([0-9]+(?:\.[0-9]+)?)\s+MON[\s\S]{0,80}?(?:transfer|send)\b[\s\S]{0,120}?\bto\s+(0x[0-9a-fA-F]{40})/i
  );
  const amountBeforeRecipient = prompt.match(
    /(?:transfer|send)\b[\s\S]{0,80}?([0-9]+(?:\.[0-9]+)?)\s+MON[\s\S]{0,120}?\bto\s+(0x[0-9a-fA-F]{40})/i
  );
  const amountAfterRecipient = prompt.match(
    /(?:to|address)\s+(0x[0-9a-fA-F]{40})[\s\S]{0,120}?(?:transfer|send)\b[\s\S]{0,80}?([0-9]+(?:\.[0-9]+)?)\s+MON/i
  );
  const match = amountThenTransfer
    ? { amountMon: amountThenTransfer[1], recipient: amountThenTransfer[2] }
    : amountBeforeRecipient
    ? { amountMon: amountBeforeRecipient[1], recipient: amountBeforeRecipient[2] }
    : amountAfterRecipient
      ? { amountMon: amountAfterRecipient[2], recipient: amountAfterRecipient[1] }
      : null;
  return match
    ? { kind: "native-transfer", amountMon: match.amountMon, recipient: match.recipient }
    : { kind: "none", reason: "No explicit native MON transfer was requested." };
}

const systemPrompt = `You are the neutral transaction-safety agent inside AdMon.
Analyze the user's request and return ONLY a JSON object with this exact shape:
{
  "topicId": "onchain-actions" | "monad-infra" | "wallets",
  "answer": {
    "heading": string,
    "summary": string,
    "checks": string[],
    "receipt": string[]
  },
  "mossAction": {
    "kind": "none" | "native-transfer",
    "reason": string
  } | {
    "kind": "native-transfer",
    "recipient": "0x...",
    "amountMon": "0.01"
  }
}

Rules:
- Choose exactly one topicId from the enum. Use onchain-actions for swaps, transfers, or trades; monad-infra for RPC, deployment, indexing, or chain performance; wallets for wallet, signing, approvals, or key safety.
- Keep the answer useful and specific to the request.
- This is a preview only. Never claim that a transaction was sent, signed, or simulated onchain.
- Do not invent live quotes, balances, RPC availability, transaction results, or named provider support. Recommend verification when current network state matters.
- Set mossAction to native-transfer only when the user explicitly gives a valid recipient address and amount for a native MON transfer. Otherwise set kind to none.
- A native-transfer action is always an unsigned preview. Never ask the MCP tool to execute it.
- Never include advertising, sponsored copy, reward amounts, or instructions to click. A separate AdMon MCP tool supplies the sponsored card after your response.
- Mention that no wallet signature is requested when the request is ambiguous or security-sensitive.
- Keep each checks and receipt item short enough to render as a compact list.
- Return valid JSON without Markdown fences.`;

function getConfig() {
  const apiKey = process.env.AUTH_TOKEN || process.env.DEEPSEEK_API_KEY || "";
  const baseUrl = (process.env.BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";
  return { apiKey, baseUrl, model };
}

function parseModelContent(content: unknown) {
  if (typeof content !== "string") {
    throw new Error("DeepSeek returned no text content.");
  }

  const normalized = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("DeepSeek returned invalid agent JSON.");
  }
  return agentPayloadSchema.parse(parsed);
}

export async function generateWithDeepSeek(prompt: string): Promise<DeepSeekAgentResult> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey) throw new Error("DeepSeek is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed with status ${response.status}.`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return { ...parseModelContent(content), provider: "deepseek", model };
  } finally {
    clearTimeout(timeout);
  }
}
