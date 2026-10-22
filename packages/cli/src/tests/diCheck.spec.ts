import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Container } from "@croco/framework-context";
import { createModuleGraphManifest } from "@croco/framework-module";
import { runCroco } from "../commands/root.js";
import { parseDiCheckArgs, runDiCheck } from "../commands/diCheck.js";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";
import type { DiCheckIo } from "../commands/diCheck.js";

describe("diCheck", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("fails manifests with graph diagnostics", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      roots: [],
      rootIds: [],
      providers: [],
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [
        {
          code: "CROCO_DI_001",
          legacyCode: "framework-context/di-missing-provider",
          severity: "error",
          token: "Token<database.url>",
          message: "Provider 'Token<database.url>' is not registered.",
          path: ["UserService", "Token<database.url>"],
        },
      ],
    };

    const exitCode = await runDiCheck(["--manifest", "di-graph.json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "CROCO_DI_001 token=Token<database.url>: Provider 'Token<database.url>' is not registered.",
      "DI graph check failed for croco.di-graph.manifest.v1 with 1 diagnostic(s).",
    ]);
  });

  it("passes ready module graph manifests", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      modules: [],
      version: "croco.module-graph.manifest.v1",
      status: "ready",
      diagnostics: [],
    };

    const exitCode = await runDiCheck(["module-graph.json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual(["DI graph check passed for croco.module-graph.manifest.v1."]);
  });

  it("writes JSON check reports", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiCheck(["di-graph.json", "--json", "--out", "reports/di.json"], {
      io: {
        ...createIo(
          JSON.stringify({
            roots: [],
            rootIds: [],
            providers: [],
            version: "croco.di-graph.manifest.v1",
            status: "ready",
            diagnostics: [],
          }),
          stdout,
          stderr,
        ),
        mkdir: () => {},
        writeFile: (path, content) => writes.set(path, content),
      },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["Wrote DI graph check report to /workspace/app/reports/di.json."]);
    expect(JSON.parse(writes.get("/workspace/app/reports/di.json") ?? "{}")).toMatchObject({
      version: "croco.di-check.report.v1",
      manifestVersion: "croco.di-graph.manifest.v1",
      status: "passed",
    });
  });

  it("wraps invalid manifests with stable CLI diagnostic codes", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runDiCheck(["di-graph.json", "--json"], {
      io: createIo("{ not json", stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      status: "failed",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckManifestInvalid,
          legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.diCheckManifestInvalid,
        },
      ],
    });
  });

  it("uses stable fallback codes for malformed manifest diagnostics", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      roots: [],
      rootIds: [],
      providers: [],
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [{ severity: "error", message: "Missing provider." }],
    };

    const exitCode = await runDiCheck(["di-graph.json", "--json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          message: "Missing provider.",
        },
      ],
    });
  });

  it("does not normalize inherited object property names as legacy graph codes", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      roots: [],
      rootIds: [],
      providers: [],
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [
        {
          code: "constructor",
          severity: "error",
          message: "Synthetic diagnostic from an untrusted manifest.",
        },
      ],
    };

    const exitCode = await runDiCheck(["di-graph.json", "--json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      diagnostics: [
        {
          code: "constructor",
          message: "Synthetic diagnostic from an untrusted manifest.",
        },
      ],
    });
  });

  it("normalizes legacy manifest diagnostic codes to stable CLI codes", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      roots: [],
      rootIds: [],
      providers: [],
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [
        {
          code: CLI_LEGACY_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          severity: "error",
          message: "Legacy DI diagnostic.",
        },
      ],
    };

    const exitCode = await runDiCheck(["di-graph.json", "--json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          message: "Legacy DI diagnostic.",
        },
      ],
    });
  });

  it("normalizes legacy DI graph diagnostic codes to stable graph codes", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      roots: [],
      rootIds: [],
      providers: [],
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [
        {
          code: "framework-context/di-missing-provider",
          severity: "error",
          message: "Missing provider.",
        },
        {
          code: "framework-context/di-circular-dependency",
          severity: "error",
          message: "Circular dependency.",
        },
        {
          code: "framework-context/di-scope-mismatch",
          severity: "error",
          message: "Scope mismatch.",
        },
        {
          code: "framework-context/di-unknown-provider",
          severity: "error",
          message: "Unknown provider.",
        },
      ],
    };

    const exitCode = await runDiCheck(["di-graph.json", "--json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      diagnostics: [
        {
          code: "CROCO_DI_001",
          legacyCode: "framework-context/di-missing-provider",
          message: "Missing provider.",
        },
        {
          code: "CROCO_DI_002",
          legacyCode: "framework-context/di-circular-dependency",
          message: "Circular dependency.",
        },
        {
          code: "CROCO_DI_003",
          legacyCode: "framework-context/di-scope-mismatch",
          message: "Scope mismatch.",
        },
        {
          code: "CROCO_DI_004",
          legacyCode: "framework-context/di-unknown-provider",
          message: "Unknown provider.",
        },
      ],
    });
  });

  it("keeps unmapped CLI slash-form diagnostics as legacy evidence", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      roots: [],
      rootIds: [],
      providers: [],
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [
        {
          code: "cli/generated-helper-returned-code",
          legacyCode: "cli/explicit-legacy-code",
          severity: "error",
          message: "Generated helper returned a legacy code.",
        },
        {
          code: "di-check/generated-helper-returned-code",
          severity: "error",
          message: "DI check helper returned a legacy code.",
        },
        {
          code: "jobs/generated-helper-returned-code",
          severity: "error",
          message: "Jobs helper returned a legacy code.",
        },
        {
          code: "ops/generated-helper-returned-code",
          severity: "error",
          message: "Ops helper returned a legacy code.",
        },
        {
          code: "project-map/generated-helper-returned-code",
          severity: "error",
          message: "Project Map helper returned a legacy code.",
        },
        {
          code: "usage-dashboard/generated-helper-returned-code",
          severity: "error",
          message: "Usage dashboard helper returned a legacy code.",
        },
      ],
    };

    const exitCode = await runDiCheck(["di-graph.json", "--json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: "cli/generated-helper-returned-code",
          message: "Generated helper returned a legacy code.",
        },
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: "di-check/generated-helper-returned-code",
          message: "DI check helper returned a legacy code.",
        },
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: "jobs/generated-helper-returned-code",
          message: "Jobs helper returned a legacy code.",
        },
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: "ops/generated-helper-returned-code",
          message: "Ops helper returned a legacy code.",
        },
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: "project-map/generated-helper-returned-code",
          message: "Project Map helper returned a legacy code.",
        },
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown,
          legacyCode: "usage-dashboard/generated-helper-returned-code",
          message: "Usage dashboard helper returned a legacy code.",
        },
      ],
    });
  });

  it.each<[string, unknown]>([
    ["empty object", {}],
    ["unrelated JSON", { version: "unrelated.config.v1", diagnostics: [] }],
    [
      "corrupt diagnostics",
      { version: "croco.di-graph.manifest.v1", status: "ready", diagnostics: "corrupt" },
    ],
    ["unknown status", { ...readyManifest(), status: "unknown" }],
    ...["version", "status", "roots", "rootIds", "providers", "diagnostics"].map(
      (field): [string, unknown] => {
        const manifest: Record<string, unknown> = readyManifest();
        delete manifest[field];
        return [`missing ${field}`, manifest];
      },
    ),
    ["array root", []],
    ["null root", null],
    ["bad roots", { ...readyManifest(), roots: [7] }],
    ["bad provider array", { ...readyManifest(), providers: {} }],
    [
      "missing modules",
      { version: "croco.module-graph.manifest.v1", status: "ready", diagnostics: [] },
    ],
    ["bad diagnostic", { ...readyManifest(), diagnostics: [null] }],
    [
      "bad severity",
      { ...readyManifest(), diagnostics: [{ severity: "info", message: "invalid" }] },
    ],
    ["bad message", { ...readyManifest(), diagnostics: [{ severity: "warning", message: 7 }] }],
  ])("rejects %s through both command boundaries", async (_name, manifest) => {
    const stdout: string[] = [];
    expect(
      await runDiCheck(["graph.json", "--json"], {
        io: createIo(JSON.stringify(manifest), stdout, []),
      }),
    ).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      status: "failed",
      diagnostics: [
        expect.objectContaining({
          code: CLI_DIAGNOSTIC_CODES.diCheckManifestInvalid,
          message: expect.any(String),
        }),
      ],
    });
    const cwd = mkdtempSync(join(tmpdir(), "croco-di-check-"));
    try {
      writeFileSync(join(cwd, "graph.json"), JSON.stringify(manifest));
      const output: string[] = [];
      expect(
        await runCroco(["di", "check", "graph.json", "--json"], {
          cwd,
          stdout: (message) => output.push(message),
          stderr: () => {},
        }),
      ).toEqual({ exitCode: 1 });
      expect(JSON.parse(output[0] ?? "{}")).toEqual(JSON.parse(stdout[0] ?? "{}"));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it.each([
    { diagnostics: [] },
    { diagnostics: [{ severity: "warning", message: "Only a warning.", code: "warning" }] },
  ])("keeps failed graph status with non-error diagnostics %j", async ({ diagnostics }) => {
    const stdout: string[] = [];
    expect(
      await runDiCheck(["graph.json", "--json"], {
        io: createIo(
          JSON.stringify({ ...readyManifest(), status: "failed", diagnostics }),
          stdout,
          [],
        ),
      }),
    ).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      status: "failed",
      diagnostics: [
        ...diagnostics,
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckManifestFailed,
          severity: "error",
        },
      ],
    });
  });

  it("accepts a real generated DI envelope and ready warnings", async () => {
    const stdout: string[] = [];
    const manifest = Container.createDependencyGraphManifest();
    expect(
      await runDiCheck(["graph.json", "--json"], {
        io: createIo(JSON.stringify(manifest), stdout, []),
      }),
    ).toBe(0);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({ status: "passed" });
    expect(
      await runDiCheck(["graph.json"], {
        io: createIo(
          JSON.stringify({
            ...readyManifest(),
            diagnostics: [{ severity: "warning", message: "Warning.", code: "warning" }],
          }),
          [],
          [],
        ),
      }),
    ).toBe(0);
  });

  it.each([
    ["ready DI", () => Container.createDependencyGraphManifest(), 0, "passed"],
    ["ready module", () => createModuleGraphManifest([]), 0, "passed"],
    [
      "failed legacy",
      () => ({
        ...readyManifest(),
        status: "failed",
        diagnostics: [
          {
            code: "framework-context/di-missing-provider",
            severity: "error",
            message: "Missing provider.",
          },
        ],
      }),
      1,
      "failed",
    ],
  ] as const)(
    "preserves %s at the root runner",
    async (_name, createManifest, exitCode, status) => {
      const cwd = mkdtempSync(join(tmpdir(), "croco-di-root-"));
      try {
        writeFileSync(join(cwd, "graph.json"), JSON.stringify(createManifest()));
        const stdout: string[] = [];
        expect(
          await runCroco(["di", "check", "graph.json", "--json"], {
            cwd,
            stdout: (message) => stdout.push(message),
            stderr: () => {},
          }),
        ).toEqual({ exitCode });
        expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({ status });
        if (exitCode === 1)
          expect(JSON.parse(stdout[0] ?? "{}").diagnostics[0]).toMatchObject({
            code: "CROCO_DI_001",
            legacyCode: "framework-context/di-missing-provider",
          });
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  );

  it("parses help and manifest arguments", () => {
    expect(parseDiCheckArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseDiCheckArgs(["--manifest", "graph.json"])).toMatchObject({
      kind: "run",
      options: { manifest: "graph.json" },
    });
  });
});

function createIo(content: string, stdout: string[], stderr: string[]): Partial<DiCheckIo> {
  return {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    readFile: () => content,
    cwd: "/workspace/app",
  };
}

function readyManifest() {
  return {
    version: "croco.di-graph.manifest.v1",
    status: "ready",
    roots: [],
    rootIds: [],
    providers: [],
    diagnostics: [],
  };
}
