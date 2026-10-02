import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const bin = join(packageRoot, "dist/bin/croco-agent.js");
const fixture = fileURLToPath(new URL("./fixtures/agentReadApplication.mjs", import.meta.url));
const setupUrl = new URL("../../examples/agent-read/setup.mjs", import.meta.url).href;
const setup = (await import(setupUrl)) as { createExampleFiles(root: string): Promise<void> };
let root: string;
let templateRoot: string;
const request = (queryId = "frontend.actions") => ({
  queryId,
  input: {},
  window: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-02T00:00:00.000Z" },
});
const environment = () => ({
  ...process.env,
  CROCO_AGENT_APPLICATION: fixture,
  CROCO_AGENT_EXAMPLE_ROOT: root,
});
function call(name: string, input: unknown) {
  return spawnSync(process.execPath, [bin, "call", name, JSON.stringify(input)], {
    env: environment(),
    encoding: "utf8",
    timeout: 10000,
  });
}

beforeAll(() => {
  if (!existsSync(bin))
    execFileSync("pnpm", ["build"], { cwd: packageRoot, stdio: "pipe", timeout: 120000 });
}, 130000);
beforeAll(async () => {
  templateRoot = await mkdtemp(join(tmpdir(), "croco-agent-template-"));
  await setup.createExampleFiles(templateRoot);
});
afterAll(async () => rm(templateRoot, { recursive: true, force: true }));
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "croco-agent-process-"));
  await cp(templateRoot, root, { recursive: true });
});
afterEach(async () => rm(root, { force: true, recursive: true }));

async function connect(extra: Record<string, string> = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bin, "stdio"],
    env: { CROCO_AGENT_APPLICATION: fixture, CROCO_AGENT_EXAMPLE_ROOT: root, ...extra },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({ name: "croco-agent-test", version: "1.0.0" });
  await client.connect(transport);
  return { client, stderr: () => stderr };
}

async function waitForFile(path: string) {
  for (let index = 0; index < 1000 && !existsSync(path); index++) await delay(10);
  expect(existsSync(path)).toBe(true);
}

describe("published agent process", () => {
  it("lists fixed read-only tools through the official SDK and keeps logs on stderr", async () => {
    const connection = await connect();
    try {
      const listed = await connection.client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toEqual([
        "listCapabilities",
        "listDefinitions",
        "listRegisteredQueries",
        "explainDefinition",
        "getVerifiedReport",
        "runRegisteredQuery",
        "getSourceRef",
      ]);
      for (const tool of listed.tools)
        expect(tool.annotations).toMatchObject({
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        });
      expect(connection.stderr()).toContain("agent fixture startup");
      expect(connection.stderr()).toContain("agent fixture info");
      expect(connection.stderr()).toContain("agent fixture debug");
    } finally {
      await connection.client.close();
    }
  });

  it.each([
    ["listCapabilities", {}],
    ["listDefinitions", {}],
    ["listRegisteredQueries", {}],
    ["explainDefinition", { id: "frontend.action-count" }],
    ["getVerifiedReport", request()],
    ["runRegisteredQuery", request("frontend.actions.live")],
    ["getSourceRef", { definitionId: "frontend.action-count", sourceRef: "frontend-manifest" }],
  ] as const)("matches CLI and SDK output for %s", async (name, input) => {
    const connection = await connect();
    try {
      const cli = call(name, input);
      expect(cli.status, cli.stderr).toBe(0);
      const response = await connection.client.callTool({ name, arguments: input });
      expect(response.isError).toBe(false);
      const content = response.content[0];
      expect(content?.type).toBe("text");
      if (content?.type !== "text") throw new TypeError("Expected JSON text");
      expect(JSON.parse(content.text)).toEqual(JSON.parse(cli.stdout));
      expect(cli.stdout.trim().split("\n")).toHaveLength(1);
      expect(cli.stderr).toContain("agent fixture startup");
    } finally {
      await connection.client.close();
    }
  });

  it.each(["unavailable", "invalid-input", "denied", "stale"])(
    "returns exit 1 for %s",
    async (status) => {
      if (status === "denied" || status === "stale") {
        const reports = JSON.parse(await readFile(join(root, "reviewed-reports.json"), "utf8"));
        if (status === "denied") reports[0].privacyEpoch = "privacy-revoked";
        else reports[0].expiresAt = "2000-01-01T00:00:00.000Z";
        await writeFile(join(root, "reviewed-reports.json"), JSON.stringify(reports));
      }
      const result =
        status === "unavailable"
          ? call("unregistered", {})
          : status === "invalid-input"
            ? call("runRegisteredQuery", { ...request(), principal: {} })
            : call("getVerifiedReport", request());
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).status).toBe(status);
    },
  );

  it("marks an unsuccessful registered tool call as an MCP error", async () => {
    const { client } = await connect();
    try {
      const response = await client.callTool({
        name: "getVerifiedReport",
        arguments: request("missing-query"),
      });
      expect(response.isError).toBe(true);
      const content = response.content[0];
      if (content?.type !== "text") throw new TypeError("Expected JSON text");
      expect(JSON.parse(content.text)).toMatchObject({ status: "unavailable" });
    } finally {
      await client.close();
    }
  });

  it("sanitizes startup failures and requires operator-selected absolute modules", async () => {
    for (const modulePath of ["", "./relative.mjs"]) {
      const result = spawnSync(process.execPath, [bin, "stdio"], {
        env: { ...environment(), CROCO_AGENT_APPLICATION: modulePath },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(JSON.parse(result.stderr).code).toBe("AGENT_READ_INVALID_APPLICATION");
    }
    const broken = join(root, "broken.mjs");
    await writeFile(broken, 'throw new TypeError("credential-secret");');
    const failed = spawnSync(process.execPath, [bin, "stdio"], {
      env: { ...environment(), CROCO_AGENT_APPLICATION: broken },
      encoding: "utf8",
    });
    expect(failed.status).toBe(1);
    expect(failed.stdout).toBe("");
    expect(failed.stderr).not.toContain("credential-secret");
    expect(JSON.parse(failed.stderr).code).toBe("AGENT_READ_STARTUP_FAILED");
  });

  it("returns a cancelled JSON outcome when a CLI call receives SIGTERM", async () => {
    const child = spawn(
      process.execPath,
      [bin, "call", "runRegisteredQuery", JSON.stringify(request("frontend.actions.live"))],
      {
        env: { ...environment(), CROCO_AGENT_TEST_DELAY: "true" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.resume();
    const closed = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    try {
      await waitForFile(join(root, "executor-started"));
      child.kill("SIGTERM");
      expect(await closed).toBe(1);
      expect(JSON.parse(stdout)).toMatchObject({ status: "cancelled" });
      await waitForFile(join(root, "executor-cancelled"));
    } finally {
      child.kill();
    }
  });

  it("propagates SDK cancellation into the shared registered executor", async () => {
    const { client } = await connect({ CROCO_AGENT_TEST_DELAY: "true" });
    try {
      const controller = new AbortController();
      const pending = client.callTool(
        { name: "runRegisteredQuery", arguments: request("frontend.actions.live") },
        { signal: controller.signal },
      );
      const rejection = expect(pending).rejects.toThrow();
      await waitForFile(join(root, "executor-started"));
      controller.abort();
      await rejection;
      await waitForFile(join(root, "executor-cancelled"));
    } finally {
      await client.close();
    }
  });
});
