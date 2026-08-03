# AdMon Risk Probe

## Current results (2026-08-03)

| Probe | Result | Evidence |
| --- | --- | --- |
| Contract settlement | Local pass | Hardhat probe creates a campaign, settles one click, credits 0.0025 MON to the user and 0.006 MON to the publisher, claims once, and rejects replay. |
| Finality display | Deterministic integration pass | Automated state-machine coverage verifies recorded, proposed, finalized, claimed, and second-claim rejection while the host labels the source `Local probe` / `Simulated source`; live testnet finality remains pending. |
| One-time redirect | Local pass | First signed URL redirects to the controlled sponsor page; second request returns the `already-used` destination. |
| Host card rendering | Pass | Desktop and 390 px mobile checks show a distinct sponsored card with no horizontal overflow. |
| Codex MCP | Protocol pass | In-memory MCP client lists `get_ad_offer` and `get_click_status`; offer returns structured content and Markdown fallback. Live Codex host capture remains pending. |
| Moss adapter | Offline pass | Current GitHub Moss core builds one unsigned `claim()` Capability; Receipt tests cover the MON transfer and `RewardClaimed` event in order. Live Moss simulation remains pending because Moss targets mainnet. |
| Clean clone build | Pass | A copy excluding `node_modules`, `dist`, `.next`, contract cache, and artifacts completed `npm ci` and the root production build. The root scripts now build vendored `@themoss/core` before testing the AdMon Moss adapter. |

The local-chain transaction hashes are deterministic Hardhat evidence and are not public Monad transactions. Run `npm run probe:local --workspace contracts` to regenerate them. The testnet deployment remains blocked until a funded wallet and Safe multisig are available; no local fixture is presented as public-chain evidence.

Run this probe before building a polished frontend. Its purpose is to prove the two highest-risk demo paths: a one-time click can create a Monad credit, and the host can render the AdMon card in the reference agent.

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

Fallback: retain the successful settlement transaction as recorded evidence and make the visual demo deterministic until the RPC or UI issue is fixed. Do not fabricate a live payout.

## Probe B: Finality display

1. Subscribe to the contract's `ClickSettled` logs through a standard WebSocket provider.
2. Render the event as `Proposed`.
3. Poll the receipt or read at the `finalized` block tag.
4. Render the result as `Finalized` only after the finalized check succeeds.

Pass condition: a single real settlement visibly transitions through both states.

Fallback: use receipt polling plus the `finalized` block tag. Do not depend on an extended Monad WebSocket API for the MVP.

## Probe C: One-time redirect

1. Generate a `clickId` and an expiry-bound signed redirect token.
2. Open the URL once and confirm that the controlled landing page loads.
3. Open it a second time and confirm an `Already used` response.
4. Send only the campaign ID, click ID, recipient wallet, and expiry to the relayer; never send the original prompt.

Pass condition: exactly one redirect and exactly one valid settlement request are created.

Fallback: replace the HTTP redirect with a controlled confirmation screen that invokes the same receipt endpoint.

## Probe D: Host card rendering

The same MCP result can look different in different hosts. Do not make Codex CLI or Claude Code's transcript layout the primary demo dependency.

1. Expose a publisher decision endpoint that returns a strict `ad_offer` object with `title`, `advertiser`, `domain`, `reason`, `reward`, `clickUrl`, and `disclosure`.
2. Call it from a useful Monad developer assistant that owns the chat UI; the end user installs nothing.
3. Render the object as the independent AdMon card and keep the ordinary answer visually separate.
4. Wrap the same endpoint with an optional MCP adapter, then install it in Codex CLI and Claude Code to observe their actual rendering. Treat this as an integration experiment, not a pass condition.
5. Confirm that ad text is rendered as untrusted data and cannot add instructions or tool calls.

Pass condition: the existing-use-case reference host shows a stable card with a working click URL, without requiring the user to install an advertising-only agent or a generic host to support a custom component.

Fallback: return a Markdown card from the MCP and use a recorded Codex/Claude Code transcript as an interoperability appendix. The public demo remains the reference host.

## Evidence to retain

- Contract address and verified source link when deployed.
- First settlement transaction hash.
- First claim transaction hash.
- Replayed click failure screenshot or test output.
- Timestamped screenshot of Proposed and Finalized UI states.
