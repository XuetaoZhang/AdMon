import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_API_URL = "https://ad-mon-web.vercel.app";
const PACKAGE_NAME = "@admon-protocol/mcp-server";
const POLICY_START = "<!-- admon-sponsored-results:start -->";
const POLICY_END = "<!-- admon-sponsored-results:end -->";

type Host = "claude" | "codex" | "both";

export type InitOptions = {
  apiUrl: string;
  publisherAddress: string;
  userAddress: string;
  host: Host;
  cwd: string;
  force: boolean;
  skipCodexMcp: boolean;
};

export type InitResult = {
  files: string[];
  codexMcpRegistered: boolean;
  codexMcpNeedsManualSetup: boolean;
};

type ParsedArgs = Partial<InitOptions> & { help?: boolean };

const hostPolicy = `# AdMon host behavior

Installing this policy and the \`admon\` MCP server is the project owner's explicit opt-in to AdMon sponsored results for this workspace. Treat that configuration as continuing authorization for relevant sponsored-result lookups; do not require the end user to repeat the opt-in in every prompt.

When the \`admon\` MCP server is configured:

- Answer the user's question normally first.
- For a relevant topic such as Monad, DeepSeek, USDC, wallets, swaps, or other configured campaign keywords, extract up to five keywords locally and call \`admon/get_ad_offer\` once after the answer. Never send the raw prompt.
- Use the configured \`ADMON_USER_ADDRESS\`; do not invent a wallet or request a private key.
- Append one clearly labeled \`Sponsored\` section only when the tool returns an offer. Keep it separate from the answer and include the click URL.
- Do not call \`get_click_status\` until the user reports clicking the link. Do not claim settlement before a receipt or transaction proves it.
- Skip the tool for unrelated questions, ad-policy questions, or when AdMon is not configured.

Follow the detailed workflow in the installed \`admon-sponsored-results\` skill.`;

const skillMarkdown = `---
name: admon-sponsored-results
description: Append relevant, clearly disclosed AdMon sponsored results after a normal answer when the user has opted into AdMon and the admon MCP server is configured. Use for keyword-triggered offers in Codex, Claude Code, or another MCP-capable host; never use it to hide advertising, send raw prompts, or claim a click before the user clicks.
---

# AdMon Sponsored Results

Use the AdMon MCP as an opt-in post-answer offer channel. Keep the user's answer primary, keep sponsorship visible, and keep the click and settlement boundary explicit.

## Workspace opt-in and preconditions

- Confirm the host has an MCP server named \`admon\` with \`get_ad_offer\` available.
- Treat installation and configuration of this skill as the project owner's opt-in to relevant sponsored results for this workspace. Do not inject an offer when the AdMon policy or MCP is absent.
- Use the configured reward wallet (\`ADMON_USER_ADDRESS\`) or a valid wallet supplied by the host. Never invent an address, use a publisher wallet as the user wallet, or ask for a private key.
- Do not call the tool when the user is asking to disable ads, discussing advertising policy, or when no relevant keyword is present.

## Post-answer Workflow

1. Answer the user's question normally and completely.
2. Extract up to five concrete intent keywords locally. Normalize case and whitespace, preserve technical names such as \`Monad\`, \`DeepSeek\`, and \`USDC\`, and do not send the raw prompt or conversation to AdMon.
3. If the extracted keywords are relevant to a sponsored result, call \`admon.get_ad_offer\` once with the keywords and configured user wallet. Do not call it repeatedly to search for a better ad.
4. If the tool returns \`no_offer\`, omit any advertising section and continue the answer.
5. If the tool returns an offer, append exactly one separate section headed \`Sponsored\` after the answer. Preserve the returned title, description, destination, reward disclosure, click ID, and click URL. Never blend sponsored copy into the answer or imply editorial endorsement.
6. Include the full \`https://\` click URL on its own line when the host may not render Markdown links as clickable. Tell the user that clicking the link records the click and starts the configured settlement flow; do not ask them to sign a wallet transaction.

## Settlement Rules

- \`get_ad_offer\` creates a signed, one-time click link; it does not prove attention or settle funds by itself.
- Do not call \`get_click_status\` until the user reports clicking the link or provides a receipt to check.
- Do not claim that MON was paid, that a transaction was finalized, or that the user viewed an ad until a click receipt or onchain transaction proves it.
- Never sign, submit, or request an unrelated onchain transaction for an advertisement.

## Failure Handling

- If the MCP server is unavailable, API access fails, or the wallet is not configured, answer normally without an ad and briefly state that sponsored results are unavailable only when useful to the user's task.
- Do not retry a failed offer request in the same turn.
`;

export function parseInitArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--force") {
      parsed.force = true;
      continue;
    }
    if (arg === "--skip-codex-mcp") {
      parsed.skipCodexMcp = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
    if (arg === "--host") {
      if (value !== "claude" && value !== "codex" && value !== "both") {
        throw new Error("--host must be claude, codex, or both.");
      }
      parsed.host = value;
    } else if (arg === "--publisher") {
      parsed.publisherAddress = value;
    } else if (arg === "--user") {
      parsed.userAddress = value;
    } else if (arg === "--api-url") {
      parsed.apiUrl = value;
    } else {
      throw new Error(`Unknown option: ${arg}.`);
    }
    index += 1;
  }
  return parsed;
}

function validateAddress(name: string, value: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a valid 0x-prefixed EVM address.`);
  }
}

function validateApiUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("AdMon API URL must use http or https.");
  }
  return url.toString().replace(/\/$/, "");
}

function containsHost(host: Host, expected: Exclude<Host, "both">) {
  return host === "both" || host === expected;
}

function policyBlock() {
  return `${POLICY_START}\n${hostPolicy}\n${POLICY_END}`;
}

export function mergeHostPolicy(existing: string) {
  const start = existing.indexOf(POLICY_START);
  const end = existing.indexOf(POLICY_END);
  if (start !== -1 && end !== -1 && end > start) {
    return `${existing.slice(0, start)}${policyBlock()}${existing.slice(end + POLICY_END.length)}`;
  }
  return `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${policyBlock()}\n`;
}

export function mcpConfig(options: Pick<InitOptions, "apiUrl" | "publisherAddress" | "userAddress">) {
  return {
    command: "npx",
    args: ["-y", PACKAGE_NAME],
    env: {
      ADMON_API_URL: options.apiUrl,
      ADMON_PUBLISHER_ADDRESS: options.publisherAddress,
      ADMON_USER_ADDRESS: options.userAddress
    }
  };
}

async function readOptional(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeText(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function installSkill(cwd: string, host: Exclude<Host, "both">, force: boolean) {
  const relativePath = host === "codex"
    ? ".agents/skills/admon-sponsored-results/SKILL.md"
    : ".claude/skills/admon-sponsored-results/SKILL.md";
  const target = join(cwd, relativePath);
  const current = await readOptional(target);
  if (current && current !== skillMarkdown && !force) {
    throw new Error(`${relativePath} already exists and differs. Re-run with --force to replace it.`);
  }
  if (current !== skillMarkdown) await writeText(target, skillMarkdown);
  return relativePath;
}

async function installPolicy(cwd: string, host: Exclude<Host, "both">) {
  const relativePath = host === "codex" ? "AGENTS.md" : "CLAUDE.md";
  const target = join(cwd, relativePath);
  const current = await readOptional(target);
  const updated = mergeHostPolicy(current);
  if (current !== updated) await writeText(target, updated);
  return relativePath;
}

async function installClaudeMcp(cwd: string, options: InitOptions) {
  const target = join(cwd, ".mcp.json");
  const current = await readOptional(target);
  let document: { mcpServers?: Record<string, unknown> } = {};
  if (current.trim()) {
    try {
      document = JSON.parse(current) as { mcpServers?: Record<string, unknown> };
    } catch {
      throw new Error(".mcp.json is not valid JSON. Fix it before running AdMon init.");
    }
  }
  const servers = document.mcpServers || {};
  const proposed = mcpConfig(options);
  const existing = servers.admon;
  if (existing && JSON.stringify(existing) !== JSON.stringify(proposed) && !options.force) {
    throw new Error(".mcp.json already contains a different admon server. Re-run with --force to replace it.");
  }
  document.mcpServers = { ...servers, admon: proposed };
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  if (current !== serialized) await writeText(target, serialized);
  return ".mcp.json";
}

function codexIsAvailable() {
  const result = spawnSync("codex", ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function registerCodexMcp(options: InitOptions) {
  const result = spawnSync(
    "codex",
    [
      "mcp",
      "add",
      "admon",
      "--env",
      `ADMON_API_URL=${options.apiUrl}`,
      "--env",
      `ADMON_PUBLISHER_ADDRESS=${options.publisherAddress}`,
      "--env",
      `ADMON_USER_ADDRESS=${options.userAddress}`,
      "--",
      "npx",
      "-y",
      PACKAGE_NAME
    ],
    { stdio: "ignore" }
  );
  if (result.error || result.status !== 0) {
    throw new Error("Codex could not register the admon MCP server. If it already exists, update it with Codex MCP settings.");
  }
}

export async function installAdMon(options: InitOptions) {
  const files: string[] = [];
  if (containsHost(options.host, "codex")) {
    files.push(await installSkill(options.cwd, "codex", options.force));
    files.push(await installPolicy(options.cwd, "codex"));
  }
  if (containsHost(options.host, "claude")) {
    files.push(await installSkill(options.cwd, "claude", options.force));
    files.push(await installPolicy(options.cwd, "claude"));
    files.push(await installClaudeMcp(options.cwd, options));
  }
  const shouldRegisterCodex = containsHost(options.host, "codex") && !options.skipCodexMcp;
  let codexMcpRegistered = false;
  let codexMcpNeedsManualSetup = false;
  if (shouldRegisterCodex) {
    if (!codexIsAvailable()) {
      codexMcpNeedsManualSetup = true;
    } else {
      try {
        registerCodexMcp(options);
        codexMcpRegistered = true;
      } catch {
        codexMcpNeedsManualSetup = true;
      }
    }
  }
  return { files, codexMcpRegistered, codexMcpNeedsManualSetup } satisfies InitResult;
}

async function ask(prompt: string, fallback?: string) {
  const readline = createInterface({ input, output });
  try {
    const answer = (await readline.question(fallback ? `${prompt} [${fallback}]: ` : `${prompt}: `)).trim();
    return answer || fallback || "";
  } finally {
    readline.close();
  }
}

export const initHelp = `AdMon project initializer

Usage:
  npx -y ${PACKAGE_NAME} init [options]

Options:
  --host <claude|codex|both>  Host to configure; default: claude
  --publisher <address>        Public publisher revenue wallet
  --user <address>             Public user reward wallet
  --api-url <url>              AdMon API URL (default: ${DEFAULT_API_URL})
  --force                      Replace a conflicting AdMon skill or MCP entry
  --skip-codex-mcp             Install the Codex skill without attempting Codex MCP registration
  --help, -h                   Show this help
`;

export async function runInit(argv: string[], cwd = process.cwd()) {
  const parsed = parseInitArgs(argv);
  if (parsed.help) {
    output.write(initHelp);
    return;
  }

  const hostAnswer = parsed.host || await ask("Host (claude, codex, or both)", "claude");
  if (hostAnswer !== "claude" && hostAnswer !== "codex" && hostAnswer !== "both") {
    throw new Error("Host must be claude, codex, or both.");
  }
  const publisherAddress = parsed.publisherAddress || await ask("Publisher revenue wallet");
  const userAddress = parsed.userAddress || await ask("User reward wallet");
  const apiUrl = validateApiUrl(parsed.apiUrl || DEFAULT_API_URL);
  validateAddress("Publisher revenue wallet", publisherAddress);
  validateAddress("User reward wallet", userAddress);

  const options: InitOptions = {
    host: hostAnswer,
    publisherAddress,
    userAddress,
    apiUrl,
    cwd,
    force: Boolean(parsed.force),
    skipCodexMcp: Boolean(parsed.skipCodexMcp)
  };
  const result = await installAdMon(options);
  output.write("AdMon project initialized.\n");
  output.write(`Updated: ${result.files.join(", ")}\n`);
  if (result.codexMcpRegistered) output.write("Codex MCP server registered.\n");
  if (result.codexMcpNeedsManualSetup) {
    output.write("Codex CLI was unavailable or could not update its MCP settings. The Codex policy and skill were installed. Add this server in Codex Desktop MCP settings:\n");
    output.write(`${JSON.stringify(mcpConfig(options), null, 2)}\n`);
  }
  output.write("Restart the selected agent host before testing sponsored results.\n");
}
