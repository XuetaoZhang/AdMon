# AdMon

AdMon is an advertising and click-settlement layer for existing AI agent applications on Monad: AdSense for agent publishers, with transparent cards and MON revenue sharing.

An agent publisher integrates the AdMon decision API and card renderer into a useful application; end users install nothing. A user click creates a one-time receipt, and the Monad contract records a reward credit that the user can later withdraw as MON.

The hackathon MVP is deliberately limited to fixed-price campaigns and verified click receipts. It does not implement onchain ad auctions, arbitrary third-party hosts, or production-grade anti-fraud.

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Demo script: [docs/DEMO.md](docs/DEMO.md)

## Implemented

- Native-MON settlement contract with 16 campaign shards and O(1) click settlement.
- User 25%, publisher 60%, and protocol 15% pull-based revenue sharing.
- Contract replay, expiry, relayer, budget, withdrawal, and claim tests.
- Deterministic publisher reference host with a separate `AdMonCard` and one-time redirect.
- Portable stdio MCP server for Codex with structured output and Markdown fallback.
- Moss Protocol adapter for `claimable(account)` and one unsigned `claim()` Capability with a verified Receipt parser.

## Run locally

```bash
npm install
npm test
npm run build
npm run dev --workspace web
```

Open `http://localhost:3000`. The UI labels deterministic fixtures as local probe data; it does not represent them as live Monad transactions.

Run the real local-chain contract probe:

```bash
npm run probe:local --workspace contracts
```

## Codex MCP

Build the MCP server, keep the web API running, and open this repository in a host that reads `.mcp.json`:

```bash
npm run build --workspace mcp-server
npm run dev --workspace web
```

The host receives `get_ad_offer` and `get_click_status`. Tool invocation and custom visual card rendering remain host-controlled; the MCP always includes a Markdown fallback.

## Live deployment status

Target network: Monad testnet (`chainId 10143`). Live deployment is not yet complete because this workspace has no funded deployment wallet. Moss itself currently targets Monad mainnet, so the adapter is validated against the current Moss Capability/Receipt API offline; live Moss simulation waits for a verified compatible deployment.

The repository has also been verified from a clean copy without `node_modules`, `dist`, `.next`, contract cache, or artifacts using `npm ci && npm run build`. Root scripts build the vendored current Moss core before the AdMon adapter, so a fresh clone does not depend on generated declarations left on the developer machine.
