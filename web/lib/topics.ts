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

const answers: Record<TopicId, AgentResponse["answer"]> = {
  "onchain-actions": {
    heading: "Unsigned swap capability preview",
    summary:
      "This deterministic fixture shows the contract Moss must satisfy in the live integration. It is not a current-chain simulation, and nothing has been signed or sent.",
    checks: [
      "Intent fixed: swap exactly 0.1 MON for USDC",
      "Maximum slippage: 0.50%",
      "No token approval requested for native MON"
    ],
    receipt: [
      "Spend: 0.1 native MON",
      "Receive: at least 0.0992 USDC",
      "Execution: local fixture, awaiting live Moss simulation"
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
      "This fixture previews an unsigned capability. The live Moss integration keeps the wallet as the signing boundary after simulation and intent alignment.",
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
