# AdMon Risk Probe

## Current results (2026-08-03)

| Probe | Result | Evidence |
| --- | --- | --- |
| Contract deployment | Testnet pass | AdMon is deployed at `0xA423ce5FE84554217554Af834C921269c1aaef38` in transaction `0xa45be5f472adea00e2f59d00d24450a55cdcbc2ecb03155dc53460a6e0640e06`, block `50533513`. RPC reads confirm deployed code, Safe ownership/treasury, and the configured relayer. MonadVision reports a perfect source match and Monadscan reports verified. |
| Contract settlement | Testnet pass | Campaign `1` was funded with `0.16 MON` in transaction `0x0aa98d220fdbb1c883f3314e30e826fab5f226b8b8d51b818d24baa0094d42cb`. Transaction `0x0ad357b8a27c0797eb2768050dc4d1c0bddb3678e2f919b09fe0145c3425805a` finalized click `0x2822aaf4262aaf85c476efeead89497e71c13b2bf1a849943d704571fa6bf2c7`, credited `0.0025 MON` to the user, and consumed shard `7`. Claim transaction `0x15cd6072eefb56a40aaf4986f08b1eafb6c0bbc1a711d1498188550213f7c146` finalized and cleared the user's claimable balance. Replaying the click through `eth_call` reverts with selector `0x3621014b`, exactly `ClickAlreadyUsed(bytes32)`. |
| Finality display | Live UI pass | The publisher application reads both public receipts, `usedClick`, the cleared claimable balance, and Monad's `finalized` block tag in one RPC batch. It renders `Verified` only when both transactions succeeded and the claim block is finalized. Resettable activity remains separately labeled `Session preview`. |
| Wallet identity and gas preflight | Risk found | Claim transaction `0x87d7425a8091db4b395603232e04ac99c3a186e4e8af1612d0c27ce5e2f8aaf7` was mistakenly sent from the relayer, which had zero claimable balance, and reverted after using a `1,000,000` gas limit. Monad charges from the submitted gas limit, so the production flow must verify the connected account, simulate first, and apply a tight estimate before enabling submission. |
| One-time redirect | Local pass | First signed URL redirects to the controlled sponsor page; second request returns the `already-used` destination. |
| Host card rendering | Pass | Desktop and narrow-screen checks show a distinct sponsored card and readable evidence layout with no page-level horizontal overflow. |
| Codex MCP | Protocol pass | In-memory MCP client lists `get_ad_offer` and `get_click_status`; offer returns structured content and Markdown fallback. Live Codex host capture remains pending. |
| Moss adapter | Offline pass | Current GitHub Moss core builds one unsigned `claim()` Capability; Receipt tests cover the MON transfer and `RewardClaimed` event in order. Live Moss simulation remains pending because Moss targets mainnet. |
| Clean clone build | Pass | A copy excluding `node_modules`, `dist`, `.next`, contract cache, and artifacts completed `npm ci` and the root production build. The root scripts now build vendored `@themoss/core` before testing the AdMon Moss adapter. |

The deployment and proof-band transactions above are public Monad testnet evidence. Transaction values produced by the resettable interactive timeline remain deterministic Hardhat-style fixtures and are not public Monad transactions; run `npm run probe:local --workspace contracts` to regenerate the contract-side local evidence. The UI keeps those two sources visibly separate.

Run this probe before expanding the frontend. Its purpose is to prove the two highest-risk product paths: a one-time click can create a Monad credit, and a publisher application can render the AdMon card.

## Timebox

Maximum 90 minutes. After two failures on the same dependency, record the error and switch to the documented fallback rather than continuing UI work.

## Probe A: Contract settlement

1. Create a minimal `AdMon` contract with a single campaign and one test relayer.
2. Deploy it to Monad testnet.
3. Fund one campaign with native MON.
4. Call `settleClick` using a fixed `clickId` and a registered recipient EOA.
5. Confirm that `claimable[recipient]` increases.
6. Call `claim` from the recipient and record the receipt, block number, and final balance.

Pass condition: one credit and one withdrawal are both visible on Monad testnet, and submitting the same `clickId` reverts.

Fallback: retain the successful settlement transaction as recorded evidence and keep session activity isolated until the RPC or UI issue is fixed. Do not fabricate a live payout.

## Probe B: Finality display

1. Subscribe to the contract's `ClickSettled` logs through a standard WebSocket provider.
2. Render the event as `Proposed`.
3. Poll the receipt or read at the `finalized` block tag.
4. Render the result as `Finalized` only after the finalized check succeeds.

Pass condition: a single real settlement visibly transitions through both states.

Fallback: use receipt polling plus the `finalized` block tag. Do not depend on an extended Monad WebSocket API for the primary product path.

## Probe C: One-time redirect

1. Generate a `clickId` and an expiry-bound signed redirect token.
2. Open the URL once and confirm that the controlled landing page loads.
3. Open it a second time and confirm an `Already used` response.
4. Send only the campaign ID, click ID, recipient wallet, and expiry to the relayer; never send the original prompt.

Pass condition: exactly one redirect and exactly one valid settlement request are created.

Fallback: replace the HTTP redirect with a controlled confirmation screen that invokes the same receipt endpoint.

## Probe D: Host card rendering

The same MCP result can look different in different hosts. Do not make Codex CLI or Claude Code's transcript layout a primary product dependency.

1. Expose a publisher decision endpoint that returns a strict `ad_offer` object with `title`, `advertiser`, `domain`, `reason`, `reward`, `clickUrl`, and `disclosure`.
2. Call it from a useful Monad developer assistant that owns the chat UI; the end user installs nothing.
3. Render the object as the independent AdMon card and keep the ordinary answer visually separate.
4. Wrap the same endpoint with an optional MCP adapter, then install it in Codex CLI and Claude Code to observe their actual rendering. Treat this as an integration experiment, not a pass condition.
5. Confirm that ad text is rendered as untrusted data and cannot add instructions or tool calls.

Pass condition: the existing-use-case reference host shows a stable card with a working click URL, without requiring the user to install an advertising-only agent or a generic host to support a custom component.

Fallback: return a Markdown card from the MCP and use a recorded Codex/Claude Code transcript as an interoperability appendix. The publisher application remains the canonical rendering surface.

## Evidence to retain

- Contract address and verified source link when deployed.
- First settlement transaction hash.
- First claim transaction hash.
- Replayed click failure screenshot or test output.
- Timestamped screenshot of Proposed and Finalized UI states.
