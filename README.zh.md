# AdMon

[English](README.md) | [中文](README.zh.md)

AdMon 是面向 Monad AI Agent 应用的透明广告与点击结算层。Agent 先返回正常回答；当本地提取的关键词命中广告活动时，再展示一个明确标注的独立赞助卡片。用户点击一次性链接后，系统记录点击，后端 Relayer 自动在 Monad 上结算原生 MON：25% 给用户，60% 给流量主，15% 给协议，三笔分配在同一笔交易中完成。

用户不需要连接钱包，也不需要签名奖励交易。配置的钱包地址只是收款地址。AdMon 不会把用户原始问题发送给广告 API，宿主只在本地提取意图关键词并发送关键词。

## 快速开始

### 直接体验线上产品

打开线上应用：

- Home：首页：<https://ad-mon-web.vercel.app/>
- Live Agent：<https://ad-mon-web.vercel.app/demo>
- Manage：<https://ad-mon-web.vercel.app/dashboard>

线上 Live Agent 不需要安装任何东西，使用已经部署的 DeepSeek 服务和共享广告活动数据。Manage 是参考管理台，可编辑广告活动、为活动充值、登记流量主钱包，并生成 MCP 配置。

### 本地运行完整应用

要求：Node.js 20 或更高版本，以及 npm。

```bash
git clone https://github.com/XuetaoZhang/AdMon.git
cd AdMon
npm ci
npm run build
npm run dev --workspace @admon/web
```

打开 <http://localhost:3000>。本地应用包含 Home、Live Agent 和 Manage 三个页面。需要共享持久化数据时，按下面的说明配置 PostgreSQL；没有设置 `DATABASE_URL` 时，开发环境使用本地 JSON 存储。

## 产品页面

- `/`：介绍网络模型、Monad 结算优势和集成边界。
- `/demo`：运行 DeepSeek 驱动的参考 Agent。命中广告后，在回答流的下方展示独立且有明确标识的赞助卡片。
- `/dashboard`：管理广告内容、为广告活动充值、登记流量主收益钱包，并生成 MCP 配置。

广告标题、描述、跳转地址和匹配关键词保存在链下，并关联链上广告活动 ID。修改广告内容、关键词或流量主钱包不需要部署合约。为广告活动充值只是调用已有 AdMon 合约的 `createCampaign()`；新增广告不需要部署新的合约。

## 外部 Agent 如何使用 AdMon

集成由两部分组成：

1. **MCP 服务**：通过 stdio 提供 `get_ad_offer` 和 `get_click_status`，并调用共享的 AdMon HTTP API。
2. **宿主策略/Skill**：要求 Agent 在本地提取相关关键词，在正常回答后调用 `get_ad_offer`，并把返回内容渲染为独立且明确披露的赞助卡片。

仓库已经包含两个宿主所需的策略文件：

- Codex：`AGENTS.md` 和 `.agents/skills/admon-sponsored-results/`
- Claude Code：`CLAUDE.md` 和 `.claude/skills/admon-sponsored-results/`

只要在仓库根目录打开宿主，这些文件就会自动加载，不需要手动重写 `AGENTS.md` 或 `CLAUDE.md`。如果 Agent 在另一个项目中运行，则需要把对应策略/Skill 复制到那个项目，或加入等价的宿主指令。只注册 MCP 只能保证手动调用工具，不能保证 Agent 自动根据关键词触发广告。

### 从源码构建 MCP

```bash
npm ci
npm run build --workspace @admon-protocol/mcp-server
```

生成的入口文件是 `mcp-server/dist/cli.js`。`ADMON_API_URL` 应该填写公开的 AdMon 应用地址，而不是 MCP 宿主自己的 localhost：

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

宿主中只使用公开钱包地址，不需要用户私钥、Relayer 私钥、数据库密码或钱包插件。请把示例地址替换为实际收取流量主收益和用户奖励的地址。

### Claude Code

项目 `.mcp.json` 在获得信任/启用项目 MCP 服务后即可使用。对于全局配置或单独克隆的环境，也可以显式注册：

```bash
claude mcp add --transport stdio admon \
  --env ADMON_API_URL=https://ad-mon-web.vercel.app \
  --env ADMON_PUBLISHER_ADDRESS=0xYourPublisherWallet \
  --env ADMON_USER_ADDRESS=0xYourUserRewardWallet \
  -- node /absolute/path/AdMon/mcp-server/dist/cli.js
```

### Codex

在 Codex 中注册同一个 stdio 服务：

```bash
codex mcp add admon \
  --env ADMON_API_URL=https://ad-mon-web.vercel.app \
  --env ADMON_PUBLISHER_ADDRESS=0xYourPublisherWallet \
  --env ADMON_USER_ADDRESS=0xYourUserRewardWallet \
  -- node /absolute/path/AdMon/mcp-server/dist/cli.js
```

注册完成后，输入一个包含广告关键词的正常问题。宿主应先正常回答，再调用 `get_ad_offer`，返回带一次性点击链接的独立赞助卡片。部分终端客户端不会把 Markdown 链接渲染成可点击链接，MCP 返回中也包含 `Direct URL` 备用地址。

### npm 发布方式

MCP 已发布为 `@admon-protocol/mcp-server`，宿主可以直接使用：

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

源码构建方式仍适用于本地开发和参与贡献。

## 部署

### Vercel + Supabase

Vercel 托管 Next.js 页面和 API 路由，Supabase 提供 PostgreSQL。Vercel 不需要单独的 `start` 命令，也不应配置 `public` 输出目录。

Vercel 项目设置如下：

```text
Root Directory: web
Install Command: cd .. && npm ci
Build Command: cd .. && npm run build:web
Output Directory: 留空
Start Command: 留空
```

在 Vercel 中配置以下服务端环境变量：

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

`DEEPSEEK_BASE_URL` 是 LLM 请求地址，与外部 MCP 宿主使用的 `ADMON_API_URL` 无关。`ADMON_API_URL` 应填写公开的 AdMon 应用地址。应用会从请求自动推导公开来源，不需要设置 `BASE_URL`。

Supabase 的 pooler 或 direct PostgreSQL 连接串都可以作为 `DATABASE_URL`；密码中的特殊字符（例如 `@`）需要 URL 编码为 `%40`。可以把 [supabase/schema.sql](supabase/schema.sql) 粘贴到 Supabase SQL Editor 中，也可以让应用在第一次请求时自动创建相同的表结构。PostgreSQL 保存广告活动、流量主配置和点击结算状态，是共享生产环境所必需的。

### Relayer 和合约

当前 Monad 测试网合约地址为 [`0x2501155A34E0af59a21751045abB6A9056b7e1Ab`](https://testnet.monadscan.com/address/0x2501155A34E0af59a21751045abB6A9056b7e1Ab)。Relayer 是获得授权的后端签名账户（`0x52d1C1b8BE94150B282276c493C21E20017E38Cb`），负责支付 Gas 并静默提交结算交易，不是用户钱包，也不是 Safe owner 钱包。

加密 keystore 和密码必须放在 Git 仓库之外。Vercel 使用 `ADMON_RELAYER_KEYSTORE_JSON` 与 `ADMON_RELAYER_KEYSTORE_PASSWORD`；本机上的文件路径在 Vercel 容器中不存在。受控服务器支持 `ADMON_RELAYER_PRIVATE_KEY`，但不如加密 keystore 推荐。绝对不要把 Relayer 私钥或个人私钥放进 `.mcp.json`。

合约只部署一次。每个广告活动是合约中的一条记录，每次点击根据活动 ID 结算。修改广告内容、关键词、流量主钱包或用户钱包都不需要重新部署合约；点击结算前必须先为广告活动充值。

### Render 或 Docker

仓库还提供 `Dockerfile` 和 `render.yaml`。Render Blueprint 会创建 PostgreSQL 数据库和 Web 服务。首次部署前设置相同的服务端变量，然后检查 `/api/health` 并打开 `/dashboard`。自托管 Node 进程可以运行：

```bash
npm run start --workspace @admon/web -- -p 3000
```

部署完成后，把公开服务地址写入每个流量主 MCP 配置中的 `ADMON_API_URL`。

## 本地开发环境变量

把 DeepSeek 变量写入 `web/.env.local`，这样 API Key 不会发送到浏览器：

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=your-deepseek-model
```

需要链上结算时，再配置部署章节中的合约和 Relayer 变量。如果模型服务暂时不可用，参考宿主会使用确定性的本地 fallback，同时保留 MCP 广告请求路径。

## 验证和测试

```bash
npm test
npm run probe:local --workspace contracts
```

测试覆盖合约结算与重放保护、Web API 和页面流程、MCP schema/服务行为以及 Moss adapter。一次真实点击应产生一笔 Monad 交易，并同时完成用户、流量主和协议分配。同一个点击链接重复使用必须失败。

## Moss adapter

Moss adapter 为使用 Moss capability/receipt 的宿主提供只读广告活动和异常余额查询。奖励由 AdMon 后端 Relayer 和预充值合约完成，Moss 不会构造需要用户签名的奖励交易。

## 更多文档

- [部署细节](docs/DEPLOYMENT.md)
- [产品需求](docs/PRD.md)
- [端到端流程](docs/WALKTHROUGH.md)
- [风险验证](docs/RISK-PROBE.md)
- [MCP 服务指南](mcp-server/README.md)
