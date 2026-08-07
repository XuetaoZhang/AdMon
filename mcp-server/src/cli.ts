#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runInit } from "./init.js";
import { createAdMonServer } from "./server.js";

if (process.argv[2] === "init") {
  try {
    await runInit(process.argv.slice(3));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "AdMon initialization failed."}\n`);
    process.exitCode = 1;
  }
} else {
  const server = createAdMonServer();
  await server.connect(new StdioServerTransport());
}
