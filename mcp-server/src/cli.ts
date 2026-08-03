#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAdMonServer } from "./server.js";

const server = createAdMonServer();
await server.connect(new StdioServerTransport());
