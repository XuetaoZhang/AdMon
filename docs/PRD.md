# AdMon Product Requirements

## Product

AdMon is an advertising network for AI agent publishers. Publishers request an offer for a privately classified topic and render it as an independent sponsored card. A valid click opens the advertiser destination and triggers transparent native-MON revenue sharing on Monad.

The consumer interaction is one step: click the ad. Reward settlement is infrastructure work and must not interrupt the user with a wallet connection, signature, transaction confirmation, or later withdrawal.

## Participants

- Advertiser: funds a campaign and supplies ad content and a destination.
- Publisher: integrates AdMon into a useful agent host and receives 60% of each click price.
- User: chooses to open a clearly labeled sponsored result and receives 25%.
- Protocol: validates the signed click, relays settlement, and receives 15%.

At a `0.01 MON` click price, the contract transfers `0.0025 MON` to the user, `0.006 MON` to the publisher, and `0.0015 MON` to the protocol.

## User flow

1. The user asks the publisher's agent a normal question.
2. The publisher classifies the topic locally and requests an AdMon offer through MCP or HTTP.
3. The agent answer renders normally; the sponsored card appears separately with advertiser, reason, destination, disclosure, and reward.
4. The user opens the sponsored link.
5. The redirect verifies the signed, expiring, one-time token and records the click.
6. The backend relayer simulates and submits `settleClick`.
7. The pre-funded contract sends all three shares in the settlement transaction.
8. After finality and event verification, the card displays `+0.0025 MON sent`.

## Consumer interface

Required:

- Useful Moss-powered agent experience.
- Clearly independent Sponsored card.
- Editable payout address without wallet connection.
- One outbound action to the advertiser destination.
- Quiet sending state and final paid confirmation.
- Dismiss control and disclosure.

Excluded from the consumer view:

- Wallet-connect and transaction-signing controls.
- Claim or withdrawal actions.
- Session simulations presented as money.
- Settlement timelines, raw evidence panels, transaction hashes, and internal errors.

Operational evidence may be exposed in a separate authenticated console.

## Contract

Campaigns are pre-funded in native MON and split over 16 budget shards. A click ID deterministically selects its shard, reducing write contention across independent clicks.

`settleClick(campaignId, shardId, clickId, user, publisher, expiresAt)` must:

1. Authenticate the relayer.
2. Reject an invalid, expired, replayed, inactive, or underfunded click.
3. Mark the click used and debit the selected shard before external calls.
4. Transfer the user, publisher, and protocol shares directly.
5. Emit `ClickSettled` and one `RewardPaid` event per share.

The function uses a reentrancy guard and checks-effects-interactions. If a recipient contract rejects MON, that share moves to `pendingPayout`; the other shares and click settlement remain valid. The recipient can later redirect only its own recovery balance to an accepting address. This fallback is not part of the normal consumer flow.

## Relayer

- Runs server-side from an encrypted keystore outside the repository.
- Verifies its address against the contract's configured relayer.
- Simulates every settlement before sending.
- Estimates gas and adds no more than 10%, because Monad charges from the submitted gas limit.
- Never receives or requests a user's private key.
- Fails closed if chain settlement cannot be submitted.

## MCP and privacy

`get_ad_offer` receives a topic ID and payout address, not the raw conversation. The publisher owns topic classification. MCP returns structured ad data plus a Markdown fallback; the host owns tool invocation and rendering.

Ad copy is untrusted display data. It cannot add agent instructions, request tool calls, or merge into the neutral answer.

## Moss

Moss prepares and explains the user's actual onchain task. AdMon stays visually and semantically separate from that task. The AdMon Moss adapter provides read-only campaign and exceptional recovery queries; reward settlement does not create a user-signed Moss capability.

## Acceptance criteria

- One click causes one successful backend settlement and three payout events.
- An EOA user receives `0.0025 MON` without connecting or confirming a wallet.
- The publisher receives `0.006 MON` in the same transaction.
- Replaying the click ID reverts.
- The UI reports paid only after finality and a matching direct user payout event.
- Recipient rejection cannot revert the whole click settlement.
- Contract, web, MCP, and Moss adapter tests pass from a clean install.
