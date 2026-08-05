# AdMon MCP

This MCP server runs locally in an agent host and calls the shared AdMon HTTP API. It does not store campaigns or hold funds.

## Install from npm

After publishing the package, an MCP host can start it without cloning the repository:

```bash
npx -y @admon/mcp-server
```

The package is configured with `ADMON_API_URL` and `ADMON_PUBLISHER_ADDRESS` environment variables in the host configuration.

The corresponding host entry is:

```json
{
  "mcpServers": {
    "admon": {
      "command": "npx",
      "args": ["-y", "@admon/mcp-server"],
      "env": {
        "ADMON_API_URL": "https://your-admon.vercel.app",
        "ADMON_PUBLISHER_ADDRESS": "0xYourPublisherWallet"
      }
    }
  }
}
```

## Build from source

```bash
git clone https://github.com/XuetaoZhang/AdMon.git
cd AdMon
npm ci
npm run build --workspace @admon/mcp-server
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
        "ADMON_PUBLISHER_ADDRESS": "0xYourPublisherWallet"
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
  -- node /absolute/path/AdMon/mcp-server/dist/cli.js
```
