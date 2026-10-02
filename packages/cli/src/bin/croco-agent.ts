#!/usr/bin/env node
import { isAbsolute, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createAgentReadTools } from "../libs/agentReadTools.js";
import { createAgentReadMcpServer, isAgentReadFailure } from "../libs/agentReadMcp.js";
import type { AgentReadApplication } from "../libs/agentReadTools.js";

console.log = console.error.bind(console);
console.info = console.error.bind(console);
console.debug = console.error.bind(console);

function fail(code: string): void {
  process.stderr.write(`${JSON.stringify({ status: "error", code })}\n`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(
      "Usage: croco-agent stdio | croco-agent call <tool-name> <JSON-argument>\nSet CROCO_AGENT_APPLICATION to an absolute .mjs application module.\n",
    );
    return;
  }
  const stdio = args.length === 1 && args[0] === "stdio";
  const call = args.length === 3 && args[0] === "call";
  if (!stdio && !call) {
    fail("AGENT_READ_INVALID_COMMAND");
    return;
  }
  const modulePath = process.env.CROCO_AGENT_APPLICATION;
  if (!modulePath || !isAbsolute(modulePath) || extname(modulePath) !== ".mjs") {
    fail("AGENT_READ_INVALID_APPLICATION");
    return;
  }
  let input: unknown;
  if (call) {
    try {
      input = JSON.parse(args[2] as string);
    } catch {
      fail("AGENT_READ_INVALID_JSON");
      return;
    }
  }
  const imported: { default?: unknown } = await import(pathToFileURL(modulePath).href);
  if (typeof imported.default !== "object" || imported.default === null) {
    fail("AGENT_READ_INVALID_APPLICATION");
    return;
  }
  const tools = createAgentReadTools(imported.default as AgentReadApplication);
  if (stdio) {
    serveStdio(() => createAgentReadMcpServer(tools), {
      onerror: () => fail("AGENT_READ_TRANSPORT_FAILED"),
    });
    return;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    const result = await tools.call(args[1] as string, input, controller.signal);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (isAgentReadFailure(result)) process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}

try {
  await main();
} catch {
  fail("AGENT_READ_STARTUP_FAILED");
}
