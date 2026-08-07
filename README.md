# AdMon

[English](README.md) | [中文](README.zh.md)

AdMon is a transparent advertising and click-settlement layer for AI agent applications on Monad. It returns a normal agent answer first, then a clearly disclosed sponsored card when locally extracted keywords match a campaign. A one-time click URL records the click and the backend relayer settles native MON automatically: 25% to the user, 60% to the publisher, and 15% to the protocol in one Monad transaction.

The user never connects a wallet or signs a reward transaction. The configured reward wallet is only a payout destination. AdMon does not send raw user prompts to the advertising API; the host extracts intent keywords locally and sends only those keywords.

## Quick start

### Try the hosted product

Open the hosted application:

- Home: <https://ad-mon-web.vercel.app/>
- Live Agent: <https://ad-mon-web.vercel.app/demo>
- Manage: <https://ad-mon-web.vercel.app/dashboard>

The hosted Live Agent requires no installation. It uses the deployed DeepSeek provider and shared campaign store. The Manage page is a reference console for campaign creatives, campaign funding, publisher wallets, and MCP configuration.

### Run the full application locally

Requirements: Node.js 20 or newer and npm.

```bash
git clone https://github.com/XuetaoZhang/AdMon.git
cd AdMon
npm ci
npm run build
npm run dev --workspace @admon/web
```

Open <http://localhost:3000>. The local app includes Home, Live Agent, and Manage. For a shared deployment with persistent state, configure PostgreSQL as described below; without `DATABASE_URL`, development uses the local JSON store.

## Product surfaces

- `/` explains the network model, Monad settlement advantages, and integration boundary.
- `/demo` runs the DeepSeek-powered reference agent. The answer stream is followed by an independent, labeled sponsored card when a campaign matches.
- `/dashboard` manages campaign creatives, funds campaigns, registers publisher revenue wallets, and generates MCP configuration.

Campaign title, description, destination, and match keywords are stored offchain and linked to an onchain campaign ID. Editing creative content, keywords, or a publisher wallet does not deploy a contract. Funding a campaign calls `createCampaign()` on the existing AdMon contract; a new advertisement does not require a new contract deployment.

## How an external agent uses AdMon

There are two separate integration pieces:

1. **MCP server**: exposes `get_ad_offer` and `get_click_status` over stdio and calls the shared AdMon HTTP API.
2. **Host policy/skill**: tells the agent to extract relevant keywords locally, call `get_ad_offer` after the normal answer, and render the returned offer as a separate disclosed sponsored card.

The repository already contains the host policy for both supported hosts:

- Codex: `AGENTS.md` and `.agents/skills/admon-sponsored-results/`
- Claude Code: `CLAUDE.md` and `.claude/skills/admon-sponsored-results/`

If the repository is opened at its root, these files are loaded automatically. A user does not need to rewrite either file. If an agent is used from a different project, copy the policy/skill into that project or add equivalent host instructions; MCP registration alone only makes manual tool calls possible and does not guarantee natural keyword-triggered calls.

### Initialize a project in one command

The published package can install the project policy, the host skill, and MCP configuration without manually editing `AGENTS.md` or `CLAUDE.md`. Installing it is the project owner's workspace-level opt-in to clearly disclosed sponsored results; it does not send raw prompts or grant permission for unrelated actions. Run this command from the root of the project that will host AdMon:

```bash
npx -y @admon-protocol/mcp-server init \
  --host claude \
  --publisher 0xYourPublisherWallet \
  --user 0xYourUserRewardWallet
```

`--host claude` creates or merges `.mcp.json`, `CLAUDE.md`, and `.claude/skills/admon-sponsored-results/SKILL.md`; it is the default and fully project-scoped setup. `--host codex` creates or merges `AGENTS.md` and `.agents/skills/admon-sponsored-results/SKILL.md`. When Codex CLI is available, the initializer registers the stdio server automatically. When it is unavailable, initialization still succeeds and prints the exact MCP configuration to add in Codex Desktop settings. Existing project instructions and non-AdMon MCP servers are preserved; use `--force` only to replace a conflicting AdMon skill or MCP entry. Restart the host after initialization.

The command prompts for omitted values. It accepts public wallet addresses only and never requests a private key. For all options, run `npx -y @admon-protocol/mcp-server init --help`.

### Build the MCP server from source

```bash
npm ci
npm run build --workspace @admon-protocol/mcp-server
```

The generated entry point is `mcp-server/dist/cli.js`. Configure the public application URL, not the MCP host's localhost URL:

```json
{
  "mcpServers": {
    "admon": {
      "command": "node",
      "args": ["/absolute/path/AdMon/mcp-server/dist/cli.js"],
      "env": {
        "ADMON_API_URL": "https://ad-mon-web.vercel.app",
        "ADMON_PUBLISHER_ADDRESS": "0xYourPublisherWallet",
        "ADMON_USER_ADDRESS": "0xYourUserRewardWallet"
      }
    }
  }
}
```

Use public addresses only. No user private key, relayer key, database password, or wallet extension is needed in an agent host. Replace the example addresses with the address that should receive publisher revenue and the address that should receive user rewards.

### Claude Code

Claude Code can use the project `.mcp.json` after the project MCP server is trusted/enabled. For a global or separately cloned setup, register the server explicitly:

```bash
claude mcp add --transport stdio admon \
  --env ADMON_API_URL=https://ad-mon-web.vercel.app \
  --env ADMON_PUBLISHER_ADDRESS=0xYourPublisherWallet \
  --env ADMON_USER_ADDRESS=0xYourUserRewardWallet \
  -- node /absolute/path/AdMon/mcp-server/dist/cli.js
```

### Codex

Register the same stdio server in Codex:

```bash
codex mcp add admon \
  --env ADMON_API_URL=https://ad-mon-web.vercel.app \
  --env ADMON_PUBLISHER_ADDRESS=0xYourPublisherWallet \
  --env ADMON_USER_ADDRESS=0xYourUserRewardWallet \
  -- node /absolute/path/AdMon/mcp-server/dist/cli.js
```

After registration, ask a normal question containing a campaign keyword. The host should answer normally and then call `get_ad_offer`, returning a separate sponsored card with a one-time click URL. Some terminal clients do not render Markdown links as clickable; the MCP response includes a `Direct URL` fallback.

### npm distribution

The MCP package is published as `@admon-protocol/mcp-server`. A host can use:

```json
{
  "mcpServers": {
    "admon": {
      "command": "npx",
      "args": ["-y", "@admon-protocol/mcp-server"],
      "env": {
        "ADMON_API_URL": "https://your-admon-domain.example",
        "ADMON_PUBLISHER_ADDRESS": "0xYourPublisherWallet",
        "ADMON_USER_ADDRESS": "0xYourUserRewardWallet"
      }
    }
  }
}
```

The source build remains useful for local development and contributing changes.

## Deployment

### Vercel + Supabase

Vercel serves the Next.js app and API routes; Supabase provides PostgreSQL. There is no separate `start` command on Vercel, and no `public` output directory should be configured.

In Vercel project settings use:

```text
Root Directory: web
Install Command: cd .. && npm ci
Build Command: cd .. && npm run build:web
Output Directory: (unset)
Start Command: (unset)
```

Set these server environment variables in Vercel:

```text
DATABASE_URL=postgresql://...
DATABASE_SSL=true
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
ADMON_CONTRACT_ADDRESS=0x2501155A34E0af59a21751045abB6A9056b7e1Ab
ADMON_RELAYER_KEYSTORE_JSON={...}
ADMON_RELAYER_KEYSTORE_PASSWORD=...
ADMON_CHAIN_SETTLEMENT_REQUIRED=true
```

`DEEPSEEK_BASE_URL` is the LLM request endpoint. It is unrelated to `ADMON_API_URL`, which is configured in an external MCP host and points to the public AdMon application URL. The application derives its public origin from incoming requests and does not need a `BASE_URL` setting.

Use the Supabase pooler or direct PostgreSQL connection string as `DATABASE_URL`; URL-encode special password characters such as `@` (`%40`). Paste [supabase/schema.sql](supabase/schema.sql) into the Supabase SQL Editor, or let the application create the same schema on its first request. PostgreSQL stores campaigns, publisher profiles, and click settlement state; it is required for shared production state.

### Relayer and contract

The deployed Monad testnet contract is [`0x2501155A34E0af59a21751045abB6A9056b7e1Ab`](https://testnet.monadscan.com/address/0x2501155A34E0af59a21751045abB6A9056b7e1Ab). The relayer is an authorized backend signer (`0x52d1C1b8BE94150B282276c493C21E20017E38Cb`) that pays gas and submits silent settlements. It is not an end-user wallet or Safe owner key.

Keep the encrypted keystore and its password outside Git. On Vercel, use `ADMON_RELAYER_KEYSTORE_JSON` and `ADMON_RELAYER_KEYSTORE_PASSWORD`; a filesystem path from a local computer does not exist inside Vercel. A raw `ADMON_RELAYER_PRIVATE_KEY` is supported for controlled servers but is less desirable. Never put any relayer or personal private key in `.mcp.json`.

The contract is deployed once. Each campaign is a record in that contract, and each click settles against its campaign ID. Changing creatives, keywords, publisher wallets, or user wallets does not deploy another contract. The campaign must be pre-funded before clicks can settle.

### Render or Docker

The repository also includes `Dockerfile` and `render.yaml`. Render's Blueprint provisions a PostgreSQL database and web service. Set the same server variables before the first deploy, then verify `/api/health` and open `/dashboard`. A self-hosted Node process can run:

```bash
npm run start --workspace @admon/web -- -p 3000
```

After deployment, set the public service URL as `ADMON_API_URL` in every publisher's MCP configuration.

## Local development variables

Put the DeepSeek variables in `web/.env.local` so the API key never reaches the browser:

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=your-deepseek-model
```

For onchain settlement, also configure the contract and relayer variables shown in the deployment section. If the provider is temporarily unavailable, the reference host uses a deterministic local fallback while keeping the MCP offer path available.

## Verification and tests

```bash
npm test
npm run probe:local --workspace contracts
```

The test suite covers contract settlement and replay protection, the web API and UI flows, MCP schema/server behavior, and the Moss adapter. A live click should produce one Monad transaction containing the direct user, publisher, and protocol payouts. A repeated use of the same click URL must fail.

## Moss adapter

The Moss adapter exposes read-only campaign and recovery queries for hosts that use Moss capabilities/receipts. Reward delivery belongs to the AdMon backend relayer and pre-funded contract; Moss never constructs a user-signed reward action.

## Further documentation

- [Deployment details](docs/DEPLOYMENT.md)
- [Product requirements](docs/PRD.md)
- [End-to-end walkthrough](docs/WALKTHROUGH.md)
- [Risk probes](docs/RISK-PROBE.md)
- [MCP server guide](mcp-server/README.md)
