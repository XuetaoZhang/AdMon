# AdMon MCP

This MCP server runs locally in an agent host and calls the shared AdMon HTTP API. It does not store campaigns or hold funds.

## Install from npm

An MCP host can start the published package without cloning the repository:

```bash
npx -y @admon-protocol/mcp-server
```

The package is configured with `ADMON_API_URL` and `ADMON_PUBLISHER_ADDRESS` environment variables in the host configuration.

The corresponding host entry is:

```json
{
  "mcpServers": {
    "admon": {
      "command": "npx",
      "args": ["-y", "@admon-protocol/mcp-server"],
      "env": {
        "ADMON_API_URL": "https://your-admon.vercel.app",
        "ADMON_PUBLISHER_ADDRESS": "0xYourPublisherWallet",
        "ADMON_USER_ADDRESS": "0xYourUserRewardWallet"
      }
    }
  }
}
```

## Initialize a host project

From a project that should show AdMon sponsored results, install the host policy, skill, and MCP configuration in one command:

```bash
npx -y @admon-protocol/mcp-server init \
  --host both \
  --publisher 0xYourPublisherWallet \
  --user 0xYourUserRewardWallet
```

`claude` installs project-scoped `.mcp.json`, `CLAUDE.md`, and the Claude skill. `codex` installs `AGENTS.md`, the Codex skill, and registers the MCP through `codex mcp add`; `both` is the default interactive choice. The initializer preserves unrelated project instructions and MCP servers. It only accepts public addresses and never requests a private key.

Use `--force` to replace a conflicting AdMon entry and `--skip-codex-mcp` to install only the Codex project files. Run `npx -y @admon-protocol/mcp-server init --help` for all options.

## Build from source

```bash
git clone https://github.com/XuetaoZhang/AdMon.git
cd AdMon
npm ci
npm run build --workspace @admon-protocol/mcp-server
```

Configure the host with the absolute path to `mcp-server/dist/cli.js`:

```json
{
  "mcpServers": {
    "admon": {
      "command": "node",
      "args": ["/absolute/path/AdMon/mcp-server/dist/cli.js"],
      "env": {
        "ADMON_API_URL": "https://your-admon.vercel.app",
        "ADMON_PUBLISHER_ADDRESS": "0xYourPublisherWallet",
        "ADMON_USER_ADDRESS": "0xYourUserRewardWallet"
      }
    }
  }
}
```

The host extracts intent keywords locally and calls `get_ad_offer` with those keywords and the user's reward address. The raw conversation is not sent to AdMon. The returned structured offer includes a transparent sponsored card and a one-time click URL.

Claude Code can register the same server with:

```bash
claude mcp add --transport stdio admon \
  --env ADMON_API_URL=https://your-admon.vercel.app \
  --env ADMON_PUBLISHER_ADDRESS=0xYourPublisherWallet \
  --env ADMON_USER_ADDRESS=0xYourUserRewardWallet \
  -- node /absolute/path/AdMon/mcp-server/dist/cli.js
```

Codex CLI can register it globally with:

```bash
codex mcp add admon \
  --env ADMON_API_URL=https://your-admon.vercel.app \
  --env ADMON_PUBLISHER_ADDRESS=0xYourPublisherWallet \
  --env ADMON_USER_ADDRESS=0xYourUserRewardWallet \
  -- node /absolute/path/AdMon/mcp-server/dist/cli.js
```

With `ADMON_USER_ADDRESS` configured, `get_ad_offer` only needs the extracted keywords. A host may still pass `userAddress` explicitly when the reward wallet changes per session.
