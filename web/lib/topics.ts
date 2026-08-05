import type { AgentResponse, TopicId } from "@/lib/ad-types";

const topicRules: Array<{ topicId: TopicId; terms: string[] }> = [
  {
    topicId: "wallets",
    terms: ["wallet", "钱包", "metamask", "签名", "sign"]
  },
  {
    topicId: "monad-infra",
    terms: ["rpc", "节点", "部署", "deploy", "indexer", "索引"]
  },
  {
    topicId: "onchain-actions",
    terms: ["swap", "兑换", "交易", "转账", "transfer", "mon", "usdc"]
  }
];

export function classifyTopic(prompt: string): TopicId {
  const normalized = prompt.toLowerCase();
  return (
    topicRules.find(({ terms }) =>
      terms.some((term) => normalized.includes(term))
    )?.topicId ?? "onchain-actions"
  );
}

const sponsoredIntentTerms = [
  "swap", "兑换", "交易", "转账", "transfer", "send", "trade", "bridge", "liquidity",
  "token", "usdc", "mon", "claim", "settle", "settlement", "rpc", "节点", "部署", "deploy",
  "indexer", "索引", "gas", "testnet", "mainnet", "wallet", "钱包", "metamask", "签名", "sign",
  "approval", "授权", "address", "地址", "monad"
];

export function shouldShowSponsoredOffer(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return sponsoredIntentTerms.some((term) => normalized.includes(term));
}

const answers: Record<TopicId, AgentResponse["answer"]> = {
  "onchain-actions": {
    heading: "Unsigned swap capability preview",
    summary:
      "This preview defines the checks an agent should satisfy before any wallet signs or broadcasts the action.",
    checks: [
      "Intent fixed: swap exactly 0.1 MON for USDC",
      "Maximum slippage: 0.50%",
      "No token approval requested for native MON"
    ],
    receipt: [
      "Spend: 0.1 native MON",
      "Receive: at least 0.0992 USDC",
      "Execution: preview only; no transaction broadcast"
    ]
  },
  "monad-infra": {
    heading: "Monad deployment checklist prepared",
    summary:
      "Use a chain-aware RPC, estimate a tight gas limit, and treat latest logs as proposed until the finalized block confirms them.",
    checks: [
      "Target chain ID: 10143 for the AdMon test deployment",
      "Read irreversible reward state at the finalized block tag",
      "Calculate displayed cost from gas limit, not receipt gas used"
    ],
    receipt: [
      "No transaction constructed",
      "No wallet signature requested",
      "Raw prompt remains inside the publisher application"
    ]
  },
  wallets: {
    heading: "Wallet action held for explicit review",
    summary:
      "This unsigned capability keeps the wallet as the signing boundary after simulation and intent alignment.",
    checks: [
      "Recipient must match the user-provided address",
      "No unlimited approval is included",
      "Balance and reserve requirements must be checked before signing"
    ],
    receipt: [
      "Signer: not connected",
      "Transaction: not broadcast",
      "Status: safe to inspect"
    ]
  }
};

export function answerForTopic(topicId: TopicId): AgentResponse["answer"] {
  return answers[topicId];
}
