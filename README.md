# AdMon

AdMon is an advertising and click-settlement layer for AI agent applications on Monad: transparent sponsored cards, one-time click receipts, and automatic native-MON revenue sharing.

An agent publisher integrates the AdMon decision API and card renderer into an existing application; end users install nothing. When a user opens a sponsored link, AdMon's backend relayer settles the click from the advertiser's pre-funded campaign. The contract sends 25% directly to the user, 60% to the publisher, and 15% to the protocol in the same transaction.

## Capabilities

- Native-MON campaign contract with 16 budget shards and O(1) click settlement.
- Direct user, publisher, and protocol payouts without wallet prompts or later withdrawal steps.
- Replay, expiry, relayer, budget, withdrawal, and rejecting-recipient recovery tests.
- Publisher application with private topic routing, an independent sponsored card, and a one-time redirect.
- Portable stdio MCP server with structured output and Markdown fallback.
- Read-only Moss Protocol adapter for campaign terms and exceptional payout-recovery balances.
- Commercial product surface, live reference agent, and advertiser/publisher operations console.
- Editable campaign creatives, registered publisher revenue wallets, and generated MCP configuration.

## Product surfaces

- `/` presents the network model, Monad settlement advantages, and integration boundary.
- `/demo` runs the DeepSeek-powered reference agent and renders the structured MCP offer as a native card.
- `/dashboard` manages campaign creatives, funds new onchain campaigns, registers payout wallets, and generates publisher MCP configuration.

Campaign titles, descriptions, topics, and destinations are managed offchain and linked to an onchain campaign ID. Editing creative content does not require a transaction. Funding a campaign calls `createCampaign()` on the existing AdMon contract; it never deploys another contract.

## Run locally

```bash
npm install
npm test
npm run build
npm run dev --workspace web
```

Open `http://localhost:3000`. The reference publisher host calls the same MCP offer tool used by external agent hosts, and the console lets publishers register the wallet included in newly issued click links.

The reference agent calls DeepSeek from the server. Configure the provider in `web/.env.local` so the API key never reaches the browser:

```bash
BASE_URL=https://api.deepseek.com
AUTH_TOKEN=your-deepseek-api-key
MODEL=your-deepseek-model
```

If the provider is temporarily unavailable, the host falls back to a deterministic local safety preview while keeping the MCP offer and settlement path available.

Run the contract verification separately:

```bash
npm run probe:local --workspace contracts
```

## Runtime settlement

The relayer signs settlement transactions from an encrypted keystore. Keep the keystore outside the repository and set these values in `web/.env.local`:

```bash
ADMON_CONTRACT_ADDRESS=0x...
ADMON_RELAYER_KEYSTORE_PATH=/absolute/path/to/keystore-file
ADMON_RELAYER_KEYSTORE_PASSWORD=
ADMON_CHAIN_SETTLEMENT_REQUIRED=true
```

`ADMON_CHAIN_SETTLEMENT_REQUIRED=true` makes the redirect fail closed when the relayer or campaign is unavailable. The user's wallet address is only the payout destination; AdMon never asks the user to connect a wallet or sign a reward transaction.

Monad charges for the submitted gas limit. The relayer therefore simulates each settlement, estimates gas, and submits no more than a 10% buffer.

## MCP and Moss

Build the MCP server, keep the web API running, and open the repository in a host that reads `.mcp.json`:

```bash
npm run build --workspace mcp-server
npm run dev --workspace web
```

The standalone host receives `get_ad_offer` and `get_click_status`. Tool invocation and visual rendering remain host-controlled, so the MCP includes a Markdown fallback. The reference publisher uses the same structured tool boundary through an in-memory MCP transport.

The Moss adapter exposes read-only campaign and recovery queries. Reward delivery belongs to the backend relayer and pre-funded contract, so Moss never constructs a user-signed reward action.

## Monad deployment

The direct-payout contract is deployed on Monad testnet at [`0x2501155A34E0af59a21751045abB6A9056b7e1Ab`](https://testnet.monadscan.com/address/0x2501155A34E0af59a21751045abB6A9056b7e1Ab). It is owned by the 2-of-3 Safe at `0x719d34102D3c79C588f6C4BA3147cF10d00E4371`; the same Safe is the protocol treasury, while `0x52d1C1b8BE94150B282276c493C21E20017E38Cb` is the settlement relayer. Source verification is a perfect match on MonadVision and verified on Monadscan. A live reference-host click completed all three direct payouts in [`0x55741898...e72b4a`](https://testnet.monadscan.com/tx/0x5574189851ad497fbfe76e610e28287fb080e1e5141996b0f15147fb76e72b4a).

See [docs/PRD.md](docs/PRD.md), [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md), and [docs/RISK-PROBE.md](docs/RISK-PROBE.md).
