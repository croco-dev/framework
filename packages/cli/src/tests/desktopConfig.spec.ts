import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DESKTOP_CONFIG_POLICY_CODES,
  loadDesktopConfig,
  resolveDesktopConfigPath,
  resolveDesktopConfigPermissionFlag,
  scanDesktopConfigImportPolicy,
} from "../libs/desktopConfig.js";

import type {
  DesktopConfigSpawn,
  DesktopConfigWorkerExecution,
  DesktopConfigWorkerRequest,
} from "../libs/desktopConfig.js";

const workspaces: string[] = [];

afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

describe("desktop config paths", () => {
  it("resolves relative, POSIX, Windows-drive, and spaced paths without shell parsing", () => {
    expect(resolveDesktopConfigPath("config/croco desktop.ts", "/workspace/my app")).toBe(
      "/workspace/my app/config/croco desktop.ts",
    );
    expect(resolveDesktopConfigPath("/workspace/my app/croco.desktop.ts", "/ignored")).toBe(
      "/workspace/my app/croco.desktop.ts",
    );
    expect(resolveDesktopConfigPath("C:\\work space\\croco.desktop.ts", "/ignored")).toBe(
      "C:\\work space\\croco.desktop.ts",
    );
  });

  it.each([
    ["22.12.0", "--experimental-permission"],
    ["22.13.0", "--permission"],
    ["23.4.0", "--experimental-permission"],
    ["23.5.0", "--permission"],
    ["24.0.0", "--permission"],
  ] as const)("selects the supported permission flag for Node %s", (version, expected) => {
    expect(resolveDesktopConfigPermissionFlag(version, undefined)).toBe(expected);
  });

  it("prefers the permission flag reported by the current executable", () => {
    expect(resolveDesktopConfigPermissionFlag("22.12.0", new Set(["--permission"]))).toBe(
      "--permission",
    );
    expect(
      resolveDesktopConfigPermissionFlag("24.0.0", new Set(["--experimental-permission"])),
    ).toBe("--experimental-permission");
  });
});

describe("desktop config import policy", () => {
  it("reports direct and transitive ambient dependencies with stable codes and recovery", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts":
        "import { value } from './pure.ts';\nimport { readFile } from 'node:fs/promises';\nexport default { value };\n",
      "pure.ts":
        "import { request } from 'node:https';\nexport const value = Date.now() + Math.random();\n",
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));

    expect(findings.map((finding) => finding.code)).toEqual([
      DESKTOP_CONFIG_POLICY_CODES.filesystem,
      DESKTOP_CONFIG_POLICY_CODES.network,
      DESKTOP_CONFIG_POLICY_CODES.time,
      DESKTOP_CONFIG_POLICY_CODES.randomness,
    ]);
    expect(findings.every((finding) => finding.recovery.includes("application runtime code"))).toBe(
      true,
    );
    expect(findings.map((finding) => finding.file)).toContain(join(workspace, "pure.ts"));
  });

  it("allows pure package imports, relative modules, and type-only prohibited imports", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "import type { Stats } from 'node:fs';",
        "import { desktop } from '@croco/protocols-desktop';",
        "import { pure } from './pure.js';",
        "export default { version: 'croco.desktop-config.v1', app: desktop.app({ contracts: {}, windows: {} }), pure };",
      ].join("\n"),
      "pure.ts": "export const pure = 'value';\n",
    });

    await expect(
      scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts")),
    ).resolves.toEqual([]);
  });

  it("preserves supported external subpaths and rejects undeclared Croco subpaths", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "import { $ZodType } from 'zod/v4/core';",
        "import { missing } from '@croco/problems-core/typo';",
        "void $ZodType;",
        "export default missing;",
      ].join("\n"),
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));

    expect(findings).toMatchObject([
      {
        code: DESKTOP_CONFIG_POLICY_CODES.unsupportedPackage,
        dependency: "@croco/problems-core/typo",
      },
    ]);
  });

  it("rejects Electron, application bootstrap, and process environment dependencies", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "import { app } from 'electron';",
        "import { createApp } from '@croco/transports-http';",
        "export default process.env.DESKTOP_CONFIG;",
      ].join("\n"),
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));
    expect(findings.map((finding) => finding.code)).toEqual([
      DESKTOP_CONFIG_POLICY_CODES.electron,
      DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap,
      DESKTOP_CONFIG_POLICY_CODES.processEnv,
    ]);
  });

  it("resolves NodeNext relative JavaScript specifiers to TypeScript sources and rejects bootstrap access", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts":
        "import { value } from './pure.js';\nimport { started } from './startup.ts';\nexport default { value, started };\n",
      "pure.ts": "export const value = 1;\n",
      "startup.ts": "export const started = process.cwd();\n",
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));
    expect(findings).toMatchObject([
      {
        code: DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap,
        dependency: "./startup.ts",
      },
    ]);
  });

  it("rejects dynamic imports and require calls even with literal arguments", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": "void import('./pure.js');\nrequire('./pure.js');\nexport default {};\n",
      "pure.ts": "export const value = 1;\n",
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));
    expect(findings.map((finding) => finding.code)).toEqual([
      DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
      DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
    ]);
  });

  it("rejects import-equals and dynamic constructor access", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "import fs = require('node:fs');",
        "const DynamicFunction = (() => {}).constructor;",
        "export default { fs, DynamicFunction };",
      ].join("\n"),
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));

    expect(findings.map((finding) => finding.code)).toEqual([
      DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
      DESKTOP_CONFIG_POLICY_CODES.dynamicImport,
    ]);
  });

  it("defers computed constructor access to the code-generation-disabled worker boundary", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "const key = ['con', 'structor'].join('');",
        "const DynamicFunction = (() => {})[key];",
        "export default { DynamicFunction };",
      ].join("\n"),
    });

    await expect(
      scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts")),
    ).resolves.toEqual([]);
  });

  it("rejects aliased, computed, and process-loaded ambient capabilities", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "const filesystem = process.getBuiltinModule('node:fs');",
        "const request = globalThis['fetch'];",
        "const now = Date.now;",
        "const random = Math.random;",
        "const globals = globalThis;",
        "export default { filesystem, request, now, random, globals };",
      ].join("\n"),
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));

    expect(findings.map((finding) => finding.code)).toEqual([
      DESKTOP_CONFIG_POLICY_CODES.filesystem,
      DESKTOP_CONFIG_POLICY_CODES.network,
      DESKTOP_CONFIG_POLICY_CODES.time,
      DESKTOP_CONFIG_POLICY_CODES.randomness,
      DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap,
    ]);
  });

  it("allows locally shadowed ambient names and deterministic Math members", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "const fetch = 'local';",
        "const Date = { now: 1 };",
        "const process = { env: {} };",
        "const floor = Math.floor(1.5);",
        "const frozen = Object.freeze({ value: Number.parseInt('1', 10) });",
        "const encoded = JSON.stringify(frozen);",
        "export default { fetch, Date, process, floor, encoded };",
      ].join("\n"),
    });

    await expect(
      scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts")),
    ).resolves.toEqual([]);
  });

  it("rejects side-effect imports, runtime implementations, and packages outside the definition allowlist", async () => {
    const workspace = createWorkspace({
      "croco.desktop.ts": [
        "import './pure.js';",
        "import axios from 'axios';",
        "const app = { implement() {} };",
        "app.implement({});",
        "export default { axios };",
      ].join("\n"),
      "pure.ts": "export const value = 1;\n",
    });

    const findings = await scanDesktopConfigImportPolicy(join(workspace, "croco.desktop.ts"));
    expect(findings.map((finding) => finding.code)).toEqual([
      DESKTOP_CONFIG_POLICY_CODES.sideEffectImport,
      DESKTOP_CONFIG_POLICY_CODES.unsupportedPackage,
      DESKTOP_CONFIG_POLICY_CODES.implementation,
    ]);
  });
});

describe("desktop config isolated evaluation", () => {
  it.each([false, true])(
    "rejects ambient clock constructors before strict=%s worker evaluation",
    async (strict) => {
      const workspace = createWorkspace({
        "croco.desktop.ts": [
          "const eventTime = new Event('smoke').timeStamp;",
          "const fileTime = new File([], 'smoke').lastModified;",
          "const bytes = Buffer.allocUnsafe(1);",
          "export default { eventTime, fileTime, bytes };",
        ].join("\n"),
      });
      const spawn = vi.fn<DesktopConfigSpawn>();

      const result = await loadDesktopConfig({
        configPath: "croco.desktop.ts",
        cwd: workspace,
        strict,
        workerPath: "/worker.js",
        spawn,
      });

      expect(result).toMatchObject({
        ok: false,
        code: "CROCO_DESKTOP_CONFIG_POLICY_REJECTED",
        findings: [
          { code: DESKTOP_CONFIG_POLICY_CODES.time, dependency: "Event" },
          { code: DESKTOP_CONFIG_POLICY_CODES.time, dependency: "File" },
          {
            code: DESKTOP_CONFIG_POLICY_CODES.applicationBootstrap,
            dependency: "Buffer.allocUnsafe",
          },
        ],
      });
      expect(spawn).not.toHaveBeenCalled();
    },
  );

  it("uses two distinct worker spawns in strict mode and passes paths as argv entries", async () => {
    const workspace = createWorkspace({ "croco desktop.ts": "export default {};\n" });
    const spawn = createSpawn([successExecution("sha256:first"), successExecution("sha256:first")]);

    const result = await loadDesktopConfig({
      configPath: "croco desktop.ts",
      cwd: workspace,
      strict: true,
      workerPath: "/cli worker/desktopConfigWorker.js",
      executable: "/node path/node",
      spawn,
    });

    expect(result).toMatchObject({ ok: true, semanticHash: "sha256:first", evaluationCount: 2 });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        executable: "/node path/node",
        args: [
          resolveDesktopConfigPermissionFlag(
            process.versions.node,
            process.allowedNodeEnvironmentFlags,
          ),
          "--allow-fs-read=*",
          "--disallow-code-generation-from-strings",
          "/cli worker/desktopConfigWorker.js",
          join(workspace, "croco desktop.ts"),
        ],
        cwd: workspace,
        input: expect.stringContaining(join(workspace, "croco desktop.ts")),
      }),
    );
    expect(spawn.mock.calls[0]?.[0].args).not.toContain("--allow-worker");
    expect(spawn.mock.calls[0]?.[0]).not.toBe(spawn.mock.calls[1]?.[0]);
  });

  it("rejects unequal strict semantic hashes", async () => {
    const workspace = createWorkspace({ "croco.desktop.ts": "export default {};\n" });
    const spawn = createSpawn([
      successExecution("sha256:first"),
      successExecution("sha256:second"),
    ]);

    const result = await loadDesktopConfig({
      configPath: "croco.desktop.ts",
      cwd: workspace,
      strict: true,
      workerPath: "/worker.js",
      spawn,
    });

    expect(result).toMatchObject({ ok: false, code: "CROCO_DESKTOP_CONFIG_NONDETERMINISTIC" });
  });

  it("preserves worker exits and malformed protocol as explicit failures", async () => {
    const workspace = createWorkspace({ "croco.desktop.ts": "export default {};\n" });
    const exited = await loadDesktopConfig({
      configPath: "croco.desktop.ts",
      cwd: workspace,
      workerPath: "/worker.js",
      spawn: createSpawn([
        { exitCode: 7, signal: null, stdout: "config log", stderr: "worker failed", protocol: "" },
      ]),
    });
    const malformed = await loadDesktopConfig({
      configPath: "croco.desktop.ts",
      cwd: workspace,
      workerPath: "/worker.js",
      spawn: createSpawn([
        {
          exitCode: 0,
          signal: null,
          stdout: "config log { bad json",
          stderr: "",
          protocol: "{ bad json",
        },
      ]),
    });

    expect(exited).toMatchObject({
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_WORKER_FAILED",
      message: "worker failed",
    });
    expect(malformed).toMatchObject({
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_WORKER_PROTOCOL_INVALID",
    });
  });

  it("preserves a worker-declared invalid config failure on nonzero exit", async () => {
    const workspace = createWorkspace({ "croco.desktop.ts": "export default {};\n" });
    const result = await loadDesktopConfig({
      configPath: "croco.desktop.ts",
      cwd: workspace,
      workerPath: "/worker.js",
      spawn: createSpawn([
        {
          exitCode: 1,
          signal: null,
          stdout: "",
          stderr: "",
          protocol: JSON.stringify({
            version: "croco.desktop-config-worker.v1",
            ok: false,
            code: "CROCO_DESKTOP_CONFIG_INVALID",
            message: "invalid config",
            recovery: "correct the export",
          }),
        },
      ]),
    });

    expect(result).toEqual({
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_INVALID",
      message: "invalid config",
      recovery: "correct the export",
    });
  });

  it("returns a stable failure for a missing config file", async () => {
    const result = await loadDesktopConfig({ configPath: "/missing/croco.desktop.ts" });
    expect(result).toMatchObject({ ok: false, code: "CROCO_DESKTOP_CONFIG_UNREADABLE" });
  });

  it("reads the dedicated protocol independently of config console output", async () => {
    const workspace = createWorkspace({ "croco.desktop.ts": "export default {};\n" });
    const execution = successExecution("sha256:stable");

    const result = await loadDesktopConfig({
      configPath: "croco.desktop.ts",
      cwd: workspace,
      workerPath: "/worker.js",
      spawn: createSpawn([{ ...execution, stdout: "{not protocol}\nconfig output" }]),
    });

    expect(result).toMatchObject({ ok: true, semanticHash: "sha256:stable" });
  });
});

function createWorkspace(files: Readonly<Record<string, string>>): string {
  const workspace = mkdtempSync(join(tmpdir(), "croco-desktop-config-"));
  workspaces.push(workspace);
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(workspace, relativePath);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
  }
  return workspace;
}

function successExecution(hash: string): DesktopConfigWorkerExecution {
  return {
    exitCode: 0,
    signal: null,
    stdout: "",
    stderr: "",
    protocol: JSON.stringify({
      version: "croco.desktop-config-worker.v1",
      ok: true,
      graph: {
        version: "croco.desktop-contract-graph.v1",
        app: { contractIds: [], windowIds: [] },
        contracts: [],
        commands: [],
        events: [],
        effects: [],
        grants: [],
        problems: [],
        windows: [],
        diagnostics: [],
        semanticHash: hash,
      },
      semanticHash: hash,
    }),
  };
}

function createSpawn(executions: readonly DesktopConfigWorkerExecution[]) {
  let call = 0;
  return vi.fn<DesktopConfigSpawn>(async (_request: DesktopConfigWorkerRequest) => {
    const execution = executions[call++];
    if (!execution) throw new Error("Unexpected worker spawn.");
    return execution;
  });
}
