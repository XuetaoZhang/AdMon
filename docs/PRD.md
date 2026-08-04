# AdMon Product Requirements

| Field | Value |
| --- | --- |
| Product | AdMon |
| Version | 0.1 |
| Network | Monad testnet |
| Status | Testnet release active |

## 1. Product summary

AdMon is an advertising and settlement layer for existing agent applications: **AdSense for agent publishers, settled on Monad**. Agent developers integrate the AdMon decision API and card component into a useful product they already operate. End users do not install an advertising-only agent.

AI agents are becoming an interface for discovery, yet commercial recommendations are often opaque. AdMon turns advertisements into a distinct, opt-in source card with a visible advertiser, destination domain, match reason, and reward disclosure. The ordinary answer is generated independently; the advertisement cannot change it.

The user must click the explicitly labeled card. A one-time click receipt is settled on Monad: the advertiser's pre-funded MON budget is debited, and the user's claimable MON balance is credited. The user can then withdraw MON from the contract.

AdMon sells a **verified click receipt**, not attention or reading time. A click proves that a controlled redirect endpoint observed a one-time outbound visit; it does not prove a human read the destination page.

## 2. Problem, customer, and user story

### Problem

Useful agent applications need a business model. Today, a small agent publisher must either charge a subscription, absorb model costs, or insert opaque commercial recommendations. Users cannot distinguish an organic answer from a paid placement, while advertisers receive opaque platform reports.

### Primary customer

The primary customer is an **agent publisher or application developer**, not the end user. The publisher installs the AdMon SDK/API integration and adds the `AdMonCard` renderer to an existing chat product. The user continues using that product normally and explicitly opts in to sponsored cards and MON rebates.

### Primary user story

Lin operates a useful Monad developer assistant but has no transparent monetization path. Lin integrates AdMon into the existing application. Chen opens the assistant in a browser without installing AdMon, asks how to connect to a Monad RPC, and receives a normal technical answer. After local classification to `developer-tools`, the host may render a separate card labeled `Advertisement`, including the advertiser, destination domain, why it matched, and a 0.002 MON reward.

Chen clicks the card. The redirect validates a one-time token and sends Chen to the advertiser landing page. Within roughly one second, the card changes from `Click recorded` to `Reward finalized`; Chen can claim the credited MON, and Lin receives the publisher share. The advertiser sees the immutable click receipt and campaign spend.

### Distribution model

AdMon has three integration surfaces, in priority order:

1. **Publisher SDK/API:** the real product. Existing agent applications call the decision endpoint and render `AdMonCard`; their users install nothing.
2. **Reference integration:** a useful Monad developer assistant that documents one complete publisher integration.
3. **MCP adapter:** an optional interoperability layer for hosts that choose to invoke the tool. It is not the primary consumer distribution strategy and cannot force custom UI in Codex or Claude Code.

## 3. Why Monad

AdMon is not an ad database with a token attached. Its core proof is frequent, small, onchain click settlements across many independent users and campaigns.

| Monad capability | Product use |
| --- | --- |
| 400 ms blocks / about 800 ms finality | A click becomes a fast, visible pending-to-finalized reward state. |
| High throughput and parallel execution | Many independent campaign shards and users can settle concurrently. |
| Real-time WebSocket logs | The reference agent UI updates from actual onchain events, not polling-only fake counters. |
| `eth_sendRawTransactionSync` | The relayer can receive a settlement receipt quickly when the selected RPC supports it. |
| Low MON-denominated costs | Small click rewards are feasible to demonstrate. |
| EVM compatibility | Existing Solidity, Foundry, viem, and EVM wallets work directly. |
| Gas charged by gas limit | The contract keeps the hot path O(1) and the relayer uses an explicit, tight gas limit. |

## 4. Scope

### In scope

1. Fixed-price, native-MON campaigns on Monad testnet.
2. Local, deterministic mapping from a user request to one of three topic IDs: `monad-infra`, `developer-tools`, or `wallets`.
3. A useful Monad developer assistant reference host that renders a normal answer and a separate advertisement card.
4. A small publisher integration surface: `getAdOffer(topicId, anonymousUserId)` plus an `AdMonCard` response contract.
5. One-time signed redirect links and a controlled advertiser landing page.
6. A relayer that settles valid click receipts on Monad.
7. Onchain claimable balance and a user `claim()` withdrawal.
8. Proposed and finalized reward states in the UI.
9. A concurrent test run with at least 64 pre-authorized test sessions across multiple campaigns.
10. A replay attempt that the contract rejects.

### Explicitly out of scope

- Onchain advertiser auctions, GSP pricing, bid books, or keyword scans.
- Dark ads, hidden product placement, or ads inside the ordinary agent answer.
- A standalone advertising-only agent for end users.
- Arbitrary third-party MCP hosts and guaranteed tool invocation in every host.
- Native card injection into Codex CLI or Claude Code.
- Proof that a user read an advertiser page.
- Production anti-sybil, bot detection, KYC, or attribution.
- Stablecoin support, EIP-7702, gas sponsorship, cross-chain payments, and real advertiser integrations.
- A production privacy protocol or encrypted query matching.

### Future product track: personal rewarded inventory

`PERSONAL_REWARDED` lets a user intentionally request sponsored cards through the MCP and bind their own reward wallet without an external publisher application. Advertisers must opt into this inventory separately because reward-seeking traffic has different intent and fraud risk. It uses separate budgets, lower prices, daily caps, and rate limits. The current release supports publisher inventory only.

## 5. Actors and economic model

| Actor | Action | Economic outcome |
| --- | --- | --- |
| Advertiser | Creates and funds a campaign in MON. | Pays only for valid click receipts. |
| User | Opts in, sees a labeled card, and clicks it. | Receives a capped MON rebate after settlement. |
| Agent publisher / traffic owner | Integrates AdMon into an existing useful agent application. | Receives a share for supplying the interface and receipt. |
| AdMon protocol | Operates the settlement relayer. | Receives a protocol share. |

Default testnet split of each click reward: user 25%, host 60%, protocol 15%. The user share is deliberately modest to reduce click-farming incentives. These parameters are configurable only by the test deployment owner.

## 6. Product flow

```text
user visits an existing agent application; no AdMon installation
  -> useful agent generates its ordinary answer
  -> publisher-side local topic mapper emits topicId only
  -> publisher integration requests a campaign for topicId
  -> host renders normal answer + separate Advertisement card
  -> user clicks one-time redirect URL
  -> redirect validates clickId, records it, and returns HTTP 302
  -> relayer calls settleClick on Monad
  -> RewardCredited log appears at Proposed state
  -> UI confirms Finalized state
  -> user optionally calls claim() to receive MON
```

The topic mapper does not send the raw user request to the campaign service or to the chain. The current release uses a transparent publisher-side ruleset rather than an LLM classifier.

## 7. Onchain design

### Contract: `AdMon`

The contract uses native MON. It stores only commitments, balances, and settlement rules that require shared trust.

```solidity
struct Campaign {
    address advertiser;
    uint32 topicId;
    uint96 clickReward;
    uint64 activeUntil;
    bool active;
    string landingUrl;
}

mapping(uint256 campaignId => Campaign) public campaigns;
mapping(uint256 campaignId => mapping(uint8 shardId => uint128)) public shardBudget;
mapping(bytes32 clickId => bool) public usedClick;
mapping(address user => uint128) public claimable;
```

Required public functions:

```text
createCampaign(topicId, clickReward, activeUntil, landingUrl) payable
pauseCampaign(campaignId)
settleClick(campaignId, shardId, clickId, user, publisher, expiresAt)  // relayer only
claim()
withdrawUnusedBudget(campaignId, shardId)
```

Required events:

```text
CampaignCreated
CampaignPaused
ClickSettled
RewardCredited
RewardClaimed
ReplayRejected or a revert with ClickAlreadyUsed
```

### Settlement rules

`settleClick` must validate:

1. `clickId` has not been used.
2. The campaign is active, has the expected topic, and is not expired.
3. The selected shard has enough balance for the reward.
4. `expiresAt` has not passed.
5. The publisher address is non-zero and comes from the relayer-validated redirect token.
6. Only the designated test relayer can call it.

It must then mark the click as used, debit exactly one campaign shard, and credit the user, publisher, and protocol balances. It must not scan campaigns, loop over advertisers, or transfer MON to arbitrary receivers in the settlement path.

### Parallel-friendly budget design

Campaign funding is divided over 16 shards. The redirect calculates:

```text
shardId = uint256(clickId) % 16
```

Independent clicks therefore usually write separate `usedClick`, `claimable`, and campaign-shard slots. A single campaign can still have contention, but it is bounded and visible; the load test must distribute sessions over several campaigns and shards.

`claim()` is intentionally separate from settlement. This avoids putting arbitrary external MON transfers, receiver failures, and a shared payout path in the high-frequency click settlement transaction.

### Trust boundary

The redirect/relayer attests that it observed a valid click through its one-time link. Monad proves the resulting budget debit and payout allocation, not the semantics of a browser click. The UI and README must state this boundary plainly.

## 8. Offchain components

| Component | Responsibility | Data it must not receive |
| --- | --- | --- |
| Publisher integration SDK | Requests an offer with a topic ID and validates the response schema. | Raw user request. |
| Reference Monad assistant | Generates a useful ordinary answer, performs local topic mapping, renders the card, and connects a wallet. | No ad instructions mixed into the system prompt. |
| Campaign API | Returns a campaign for a topic ID. | Raw user request. |
| Redirect service | Validates `clickId`, records a single click, redirects to the campaign landing page. | The full conversation. |
| Relayer | Calls `settleClick`; records transaction hash and status. | Raw user request. |
| Landing page | A controlled testnet campaign destination. | Wallet private keys or agent secrets. |

Ad copy is untrusted content. The reference agent must render it as structured data in a dedicated card, never as agent instructions, tool instructions, or unfiltered HTML.

## 9. Publisher and host integration

An MCP server controls tool results, not the host's visual layout. Codex CLI and Claude Code may render an MCP result as transcript text, and a host may ignore the tool entirely. AdMon therefore does not require consumers to install an advertising-only agent or promise automatic insertion into closed hosts.

1. **Publisher SDK/API mode:** return a strict `ad_offer` object to an application that owns its UI. This is the primary integration path.
2. **Portable MCP mode:** return the same object plus a Markdown fallback. A compliant host can render it as a card, but the generic host is not promised to do so.
3. **Reference integration:** run a Monad developer assistant that demonstrates the publisher flow end to end.

The reference host calls the same API response schema and exposes the exact rendering contract that another agent publisher would implement. The MCP adapter is a thin optional wrapper around this decision API.

The reference host needs one responsive route with four fixed regions:

1. Conversation panel: useful Monad answer generated independently of advertising.
2. Advertisement card: advertiser, domain, reason, reward, click action, disclosure, and dismiss action.
3. Settlement rail: `Not clicked -> Click recorded -> Proposed -> Finalized -> Claimed`.
4. Monad evidence panel: campaign ID, transaction hash, block number, actual claimed balance, and live event stream.

The UI must never label a click as proof of attention. It must use `verified click` or `click receipt`.

## 10. Product verification scenarios

### Scenario A: one real end-to-end click

1. Open the Monad developer assistant with a pre-funded advertiser campaign and a registered user wallet.
2. Ask how to connect an application to Monad RPC infrastructure.
3. Show a useful technical answer and the separate advertisement card.
4. Click the controlled redirect link.
5. Show a real Monad transaction change from Proposed to Finalized.
6. Claim MON from the registered user wallet.

### Scenario B: Monad concurrency evidence

Run 64 pre-authorized test sessions across at least 8 campaigns and 16 shards. Show real `ClickSettled` logs, transaction throughput, median receipt latency, finalized count, and total gas-limit cost. Label this clearly as a load test, not advertiser traffic.

### Scenario C: replay rejection

Re-submit the same `clickId`. The contract must revert and the UI must show `Already settled: no second reward`.

## 11. Success metrics and acceptance criteria

The testnet release meets its acceptance criteria when all of the following are true:

- A raw user prompt is absent from network requests and chain logs; the campaign API receives only a fixed `topicId`.
- A card is visibly separate from the ordinary answer and contains advertiser, destination domain, sponsored label, and reward amount.
- One click produces one `ClickSettled` event and exactly one reward credit.
- Reusing its `clickId` fails.
- The UI shows proposed and finalized reward states from real Monad activity.
- The user can claim a real testnet MON payout.
- The 64-session script produces verifiable transaction hashes and no double credit.
- Contract tests cover happy path, expiry, invalid relayer, insufficient shard budget, replay, and withdrawal/claim accounting.

## 12. Technical risk probes

Run these before building the polished interface. Stop and switch to the fallback after two failed attempts on the same dependency.

| Probe | Pass condition | Fallback |
| --- | --- | --- |
| Monad deployment and `settleClick` | Contract deploys and one credit succeeds on testnet. | Record transactions and use a deterministic local UI while fixing the RPC. |
| WebSocket lifecycle | UI sees a log and then a finalized read. | Poll receipt plus `finalized` block tag. |
| Redirect link | One-time token redirects once and blocks the replay. | Use a controlled confirmation page with a `Record click` button. |
| Claim transaction | Registered EOA receives MON. | Keep real credit evidence and show an already-recorded claim transaction. |

## 13. Release roadmap

| Phase | Deliverable |
| --- | --- |
| Testnet foundation | Contract, tests, deployment verification, and one settled click. |
| Publisher integration | Redirect service, private topic mapper, landing page, and replay protection. |
| Settlement visibility | Finality states, transaction evidence, and concurrent settlement measurements. |
| Public release | Hosted publisher application, integration documentation, and operational monitoring. |

## 14. Service verification tiers

| Level | Definition |
| --- | --- |
| A | Real click redirect, live testnet settlement, live finality, and live claim. |
| B | Real deployed contract and transaction evidence; deterministic UI replays an already settled click. |
| C | Recorded end-to-end clip plus an interactive local UI and linked transaction hashes. |

The project cannot claim a live click if it is showing a replay.

## 15. References and attribution

AdMon is an original Monad implementation. It takes inspiration from:

- `1sh1ro/payyourattention` for the MCP-ad-reward product framing. That repository contains setup documentation, not the hosted payout service implementation.
- `Oblivionis214/AttentionMarket` for the attention-market design space. Its MIT license must be retained for any copied code; AdMon intentionally does not copy its linear keyword-scan or Base USDC deployment design.
- `nishuzumi/moss` for agent-callable Monad Capabilities and verified Receipts. The current GitHub core is vendored at its inspected commit because the npm release exposes an older API; its MIT license is retained.

## 16. Product positioning

### One-line pitch

AI agents are becoming the new search interface. AdMon makes paid recommendations explicit: users click a clearly labeled sponsored source, receive a transparent MON rebate, and every click settlement is verifiable on Monad.

### What is not claimed

- It does not prove that a user read an advertisement.
- It does not prevent all click fraud.
- It does not support every MCP host without a compliant wrapper.
- It is a Monad testnet release, not an audited production ad network.
