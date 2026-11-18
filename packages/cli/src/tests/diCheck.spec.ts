import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("checks two apps independently and writes each report relative to its app directory", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "croco-di-root-"));
    const processCwd = process.cwd();
    const chdir = vi.spyOn(process, "chdir").mockImplementation(() => {});
    try {
      const ready = readyManifest();
      const failed = { ...ready, status: "failed" };
      writeFileSync(join(cwd, "graph.json"), "{}");
      mkdirSync(join(cwd, "ready"));
      writeFileSync(join(cwd, "ready", "graph.json"), JSON.stringify(ready));
      mkdirSync(join(cwd, "failed"));
      writeFileSync(join(cwd, "failed", "graph.json"), JSON.stringify(failed));

      const [readyResult, failedResult] = await Promise.all([
        runCroco(["di", "check", "--cwd", "ready", "graph.json", "--out", "reports/di.json"], {
          cwd,
          stdout: () => {},
          stderr: () => {},
        }),
        runCroco(
          ["di", "check", "--cwd=failed", "--manifest", "graph.json", "--out", "reports/di.json"],
          {
            cwd,
            stdout: () => {},
            stderr: () => {},
          },
        ),
      ]);

      expect(readyResult).toEqual({ exitCode: 0 });
      expect(failedResult).toEqual({ exitCode: 1 });
      expect(
        JSON.parse(readFileSync(join(cwd, "ready", "reports", "di.json"), "utf-8")),
      ).toMatchObject({
        status: "passed",
      });
      expect(
        JSON.parse(readFileSync(join(cwd, "failed", "reports", "di.json"), "utf-8")),
      ).toMatchObject({
        status: "failed",
        diagnostics: [{ code: CLI_DIAGNOSTIC_CODES.diCheckManifestFailed }],
      });
      expect(existsSync(join(cwd, "reports"))).toBe(false);
      expect(process.cwd()).toBe(processCwd);
      expect(chdir).not.toHaveBeenCalled();
    } finally {
      chdir.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("accepts a directory starting with two dashes in the equals form", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "croco-di-root-"));
    try {
      mkdirSync(join(cwd, "--app"));
      writeFileSync(join(cwd, "--app", "graph.json"), JSON.stringify(readyManifest()));
      const stdout: string[] = [];

      const result = await runCroco(["di", "check", "--cwd=--app", "graph.json", "--json"], {
        cwd,
        stdout: (message) => stdout.push(message),
        stderr: () => {},
      });

      expect(result).toEqual({ exitCode: 0 });
      expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({ status: "passed" });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it.each([
    ["split", ["--cwd", "app", "di", "check"]],
    ["equals", ["--cwd=app", "di", "check"]],
    ["DI parent cwd", ["--cwd=other", "di", "--cwd", "app", "check"]],
    ["leaf cwd", ["--cwd=other", "di", "--cwd=also-other", "check", "--cwd=app"]],
    ["root separator", ["--", "di", "check", "--cwd", "app"]],
    ["DI separator", ["di", "--", "check", "--cwd", "app"]],
  ])("uses the selected cwd with %s", async (_name, args) => {
    const cwd = mkdtempSync(join(tmpdir(), "croco-di-root-"));
    try {
      mkdirSync(join(cwd, "app"));
      writeFileSync(join(cwd, "graph.json"), "{}");
      writeFileSync(join(cwd, "app", "graph.json"), JSON.stringify(readyManifest()));

      const result = await runCroco([...args, "graph.json", "--out", "report.json"], {
        cwd,
        stdout: () => {},
        stderr: () => {},
      });

      expect(result).toEqual({ exitCode: 0 });
      expect(JSON.parse(readFileSync(join(cwd, "app", "report.json"), "utf-8"))).toMatchObject({
        status: "passed",
      });
      expect(existsSync(join(cwd, "report.json"))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it.each([
    ["root", ["--cwd", "di", "check"]],
    ["DI parent", ["di", "--cwd", "check"]],
    ["misplaced report before help", ["di", "--cwd", "--out", "report.json", "check", "--help"]],
  ])("rejects cwd without a value at the %s command boundary", async (_name, args) => {
    const cwd = mkdtempSync(join(tmpdir(), "croco-di-root-"));
    try {
      writeFileSync(join(cwd, "graph.json"), JSON.stringify(readyManifest()));
      const stderr: string[] = [];
      const result = await runCroco([...args, "graph.json"], {
        cwd,
        stdout: () => {},
        stderr: (message) => stderr.push(message),
      });

      expect(result).toEqual({ exitCode: 1 });
      expect(stderr).toEqual([expect.stringContaining("Missing working directory.")]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it.each([
    ["output", ["--out", "graph.json"]],
    ["help", ["--help"]],
  ])("does not interpret the %s token after the leaf separator", async (_name, tokens) => {
    const content = JSON.stringify(readyManifest());
    const stdout: string[] = [];
    const readFile = vi.fn(() => content);
    const mkdir = vi.fn();
    const writeFile = vi.fn();
    const result = await runDiCheck(["--cwd", "app", "graph.json", "--", ...tokens], {
      io: { ...createIo(content, stdout, []), readFile, mkdir, writeFile },
    });

    expect(result).toBe(0);
    expect(readFile).toHaveBeenCalledWith("/workspace/app/app/graph.json");
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(stdout[0]).toContain("DI graph check passed");
  });

  it("preserves an explicit output before the leaf separator", () => {
    expect(parseDiCheckArgs(["--out", "report.json", "--", "--graph.json"])).toEqual({
      kind: "run",
      options: { manifest: "--graph.json", out: "report.json", json: true },
    });
  });

  it.each([
    {
      name: "later report flag",
      args: ["graph.json", "--out", "report.json", "--out", "--cwd", "app"],
      diagnostic: "Missing report output path.",
    },
    {
      name: "explicit manifest flag",
      args: ["--manifest", "--out", "graph.json", "--cwd", "app", "intended.json"],
      diagnostic: "Missing DI graph manifest.",
    },
  ])("rejects a missing path for the $name before file I/O", async ({ args, diagnostic }) => {
    const content = JSON.stringify(readyManifest());
    const stderr: string[] = [];
    const readFile = vi.fn(() => content);
    const mkdir = vi.fn();
    const writeFile = vi.fn();
    const result = await runDiCheck(args, {
      io: { ...createIo(content, [], stderr), readFile, mkdir, writeFile },
    });

    expect(result).toBe(1);
    expect(stderr).toEqual([expect.stringContaining(diagnostic)]);
    expect(readFile).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a report flag before the leaf command without changing the manifest", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "croco-di-root-"));
    try {
      const manifestPath = join(cwd, "graph.json");
      const manifest = JSON.stringify(readyManifest());
      writeFileSync(manifestPath, manifest);
      const stderr: string[] = [];
      const result = await runCroco(
        ["di", "--out", "check", "graph.json", "--manifest", "graph.json"],
        { cwd, stdout: () => {}, stderr: (message) => stderr.push(message) },
      );

      expect(result).toEqual({ exitCode: 1 });
      expect(stderr).toEqual([expect.stringContaining("Pass --out after 'di check'.")]);
      expect(readFileSync(manifestPath, "utf-8")).toBe(manifest);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it.each(["--help", "-h"])(
    "rejects a missing cwd before %s at both entry points",
    async (help) => {
      const args = ["--cwd", help];
      const stderr: string[] = [];
      const root = await runCroco(["di", "check", ...args], {
        stdout: () => {},
        stderr: (message) => stderr.push(message),
      });
      const direct = await runDiCheck(args, { io: createIo("", [], stderr) });

      expect([root.exitCode, direct]).toEqual([1, 1]);
      expect(stderr).toEqual(
        Array.from({ length: 2 }, () => expect.stringContaining("Missing working directory.")),
      );
    },
  );

  it.each([
    ["leaf help", ["di", "check", "--help"]],
    ["root help", ["--help", "di", "check"]],
    ["root help with cwd", ["-h", "di", "check", "--cwd", "."]],
  ])("prints %s without requiring a manifest", async (_name, args) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const result = await runCroco(args, {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(stderr).toEqual([]);
    expect(stdout.join("\n")).toContain("croco di check");
    expect(stdout.join("\n")).toContain("--cwd");
    expect(stdout.join("\n")).toContain("--out");
  });

  it("rejects a missing cwd when help precedes the DI subcommand", async () => {
    const stderr: string[] = [];
    const result = await runCroco(["di", "-h", "check", "--cwd"], {
      stdout: () => {},
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 1 });
    expect(stderr).toEqual([expect.stringContaining("Missing working directory.")]);
  });

  it.each([["--cwd"], ["--cwd="]])("rejects a missing cwd value with %s", async (cwdFlag) => {
    const stderr: string[] = [];
    const result = await runCroco(["di", "check", cwdFlag, "--manifest", "graph.json"], {
      stdout: () => {},
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 1 });
    expect(stderr).toEqual([
      expect.stringContaining("Missing working directory. Pass --cwd <path>."),
    ]);
  });

  it.each([
    ["explicit", ["--manifest", "graph.json", "--out", "--cwd=.", "graph.json"]],
    ["positional", ["--out", "--cwd", ".", "graph.json", "other.json"]],
  ])("rejects missing --out before --cwd and preserves the %s manifest", async (_name, args) => {
    const cwd = mkdtempSync(join(tmpdir(), "croco-di-root-"));
    try {
      const manifestPath = join(cwd, "graph.json");
      const manifest = JSON.stringify(readyManifest());
      writeFileSync(manifestPath, manifest);
      const stderr: string[] = [];

      const result = await runCroco(["di", "check", ...args], {
        cwd,
        stdout: () => {},
        stderr: (message) => stderr.push(message),
      });

      expect(result).toEqual({ exitCode: 1 });
      expect(stderr).toEqual([expect.stringContaining("Missing report output path.")]);
      expect(readFileSync(manifestPath, "utf-8")).toBe(manifest);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

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
