import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installAdMon, mcpConfig, mergeHostPolicy, parseInitArgs } from "../src/init.js";

describe("AdMon initializer", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("parses non-interactive host configuration", () => {
    expect(parseInitArgs([
      "--host",
      "claude",
      "--publisher",
      "0x1111111111111111111111111111111111111111",
      "--user",
      "0x2222222222222222222222222222222222222222",
      "--force"
    ])).toMatchObject({
      host: "claude",
      publisherAddress: "0x1111111111111111111111111111111111111111",
      userAddress: "0x2222222222222222222222222222222222222222",
      force: true
    });
  });

  it("adds an idempotent policy block without replacing host instructions", () => {
    const first = mergeHostPolicy("# Existing project instructions\n");
    const second = mergeHostPolicy(first);
    expect(first).toContain("# Existing project instructions");
    expect(second).toBe(first);
    expect(second.match(/admon-sponsored-results:start/g)).toHaveLength(1);
  });

  it("installs Claude Code files and merges the project MCP configuration", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "admon-init-"));
    directories.push(cwd);
    await writeFile(join(cwd, ".mcp.json"), JSON.stringify({
      mcpServers: { other: { command: "other-mcp" } }
    }));

    await installAdMon({
      host: "claude",
      cwd,
      force: false,
      skipCodexMcp: false,
      apiUrl: "https://ad-mon-web.vercel.app",
      publisherAddress: "0x1111111111111111111111111111111111111111",
      userAddress: "0x2222222222222222222222222222222222222222"
    });

    const config = JSON.parse(await readFile(join(cwd, ".mcp.json"), "utf8"));
    expect(config.mcpServers.other).toEqual({ command: "other-mcp" });
    expect(config.mcpServers.admon).toEqual(mcpConfig({
      apiUrl: "https://ad-mon-web.vercel.app",
      publisherAddress: "0x1111111111111111111111111111111111111111",
      userAddress: "0x2222222222222222222222222222222222222222"
    }));
    expect(await readFile(join(cwd, "CLAUDE.md"), "utf8")).toContain("admon/get_ad_offer");
    expect(await readFile(join(cwd, ".claude/skills/admon-sponsored-results/SKILL.md"), "utf8"))
      .toContain("# AdMon Sponsored Results");
  });
});
