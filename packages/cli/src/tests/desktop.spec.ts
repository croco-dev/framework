import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileDesktopContractGraph,
  desktop as desktopDsl,
  stringifyDesktopContractGraph,
} from "@croco/protocols-desktop";
import type { DesktopContractGraphV1 } from "@croco/protocols-desktop";
import { runDesktopCheck, runDesktopDiff, runDesktopGenerate } from "../commands/desktop.js";
import type { DesktopConfigLoadResult, LoadDesktopConfigOptions } from "../libs/desktopConfig.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("croco desktop generate and check", () => {
  it("makes generate the writer and keeps a clean check read-only", async () => {
    const cwd = createTemporaryDirectory();
    const graph = createGraph("local");
    const output = createOutput();
    const args = ["--config", "config/croco desktop.ts", "--out-dir", "generated desktop"];

    expect(await runDesktopGenerate(args, commandDependencies(cwd, graph, output))).toBe(0);
    const graphPath = join(cwd, "generated desktop", "desktop-contract-graph.json");
    const before = readFileSync(graphPath, "utf8");

    expect(await runDesktopCheck(args, commandDependencies(cwd, graph, output))).toBe(0);
    expect(readFileSync(graphPath, "utf8")).toBe(before);
    expect(output.stderrMessages).toEqual([]);
    expect(output.stdoutMessages.at(-1)).toContain("CROCO_DESKTOP_OK");
  });

  it("reports generated drift with exit 8 and the exact generation recovery command", async () => {
    const cwd = createTemporaryDirectory();
    const graph = createGraph("local");
    const output = createOutput();
    const args = ["--config", "croco.desktop.ts", "--out-dir", "generated desktop", "--json"];
    await runDesktopGenerate(args, commandDependencies(cwd, graph, createOutput()));
    const graphPath = join(cwd, "generated desktop", "desktop-contract-graph.json");
    writeFileSync(graphPath, "modified\n");

    const exitCode = await runDesktopCheck(args, commandDependencies(cwd, graph, output));
    const report = JSON.parse(output.stdoutMessages.join("\n")) as {
      readonly codes: readonly string[];
      readonly recovery: string;
      readonly drift: readonly { readonly kind: string; readonly relativePath: string }[];
    };

    expect(exitCode).toBe(8);
    expect(report.codes).toEqual(["CROCO_DESKTOP_GENERATED_DRIFT"]);
    expect(report.drift).toContainEqual({
      kind: "modified",
      relativePath: "desktop-contract-graph.json",
      expectedHash: expect.stringMatching(/^sha256:/),
      actualHash: expect.stringMatching(/^sha256:/),
    });
    expect(report.recovery).toBe(
      'Run croco desktop generate --config croco.desktop.ts --out-dir "generated desktop".',
    );
    expect(readFileSync(graphPath, "utf8")).toBe("modified\n");
  });

  it("returns exit 4 for contract diagnostics before any generated write", async () => {
    const cwd = createTemporaryDirectory();
    const graph: DesktopContractGraphV1 = {
      ...createGraph("empty"),
      diagnostics: [
        {
          code: "DESKTOP_GRAPH_DUPLICATE_ID",
          severity: "error",
          targetKind: "app",
          memberId: "app",
          contractMember: "app",
          schemaPath: [],
          message: "duplicate",
          recovery: "rename the duplicate",
        },
      ],
    };
    const output = createOutput();

    const exitCode = await runDesktopGenerate(
      ["--config", "croco.desktop.ts", "--out-dir", "generated", "--json"],
      commandDependencies(cwd, graph, output),
    );

    expect(exitCode).toBe(4);
    expect(JSON.parse(output.stdoutMessages.join("\n"))).toMatchObject({
      codes: ["CROCO_DESKTOP_CONTRACT_DIAGNOSTICS"],
      diagnostics: [{ code: "DESKTOP_GRAPH_DUPLICATE_ID" }],
    });
    expect(() => readFileSync(join(cwd, "generated", "desktop-contract-graph.json"))).toThrow();
  });

  it("preserves config policy failures as exit 16 with stable codes", async () => {
    const cwd = createTemporaryDirectory();
    const output = createOutput();
    const loadConfig = async (): Promise<DesktopConfigLoadResult> => ({
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_POLICY_REJECTED",
      message: "filesystem import rejected",
      recovery: "Remove node:fs from the config.",
    });

    const exitCode = await runDesktopCheck(["--config", "croco.desktop.ts", "--json"], {
      io: { cwd, ...output },
      loadConfig,
    });

    expect(exitCode).toBe(16);
    expect(JSON.parse(output.stdoutMessages.join("\n"))).toMatchObject({
      codes: ["CROCO_DESKTOP_CONFIG_FAILURE", "CROCO_DESKTOP_CONFIG_POLICY_REJECTED"],
      message: "filesystem import rejected",
    });
  });

  it("resolves equals-form config, output, and baseline paths from --cwd", async () => {
    const launchCwd = createTemporaryDirectory();
    const targetCwd = join(launchCwd, "workspace target");
    const graph = createGraph("empty");
    const loads: LoadDesktopConfigOptions[] = [];
    const loadConfig = async (
      options: LoadDesktopConfigOptions,
    ): Promise<DesktopConfigLoadResult> => {
      loads.push(options);
      return {
        ok: true,
        configPath: options.configPath,
        graph,
        semanticHash: graph.semanticHash,
        evaluationCount: 1,
      };
    };
    const commonArgs = ["--cwd=workspace target", "--config=config/croco desktop.ts", "--json"];

    expect(
      await runDesktopGenerate([...commonArgs, "--out-dir=generated"], {
        io: { cwd: launchCwd, ...createOutput() },
        loadConfig,
      }),
    ).toBe(0);
    expect(
      await runDesktopCheck([...commonArgs, "--out-dir=generated"], {
        io: { cwd: launchCwd, ...createOutput() },
        loadConfig,
      }),
    ).toBe(0);
    expect(
      await runDesktopDiff([...commonArgs, "--baseline=generated/desktop-contract-graph.json"], {
        io: {
          cwd: launchCwd,
          ...createOutput(),
          readFile: () => stringifyDesktopContractGraph(graph),
        },
        loadConfig,
      }),
    ).toBe(0);

    expect(loads).toHaveLength(3);
    expect(loads).toEqual(
      loads.map(() => ({
        configPath: join(targetCwd, "config", "croco desktop.ts"),
        cwd: targetCwd,
        strict: false,
      })),
    );
    expect(readFileSync(join(targetCwd, "generated", "desktop-contract-graph.json"), "utf8")).toBe(
      stringifyDesktopContractGraph(graph),
    );
  });

  it("reports unsafe generated paths with a stable exit and exact recovery command", async () => {
    const cwd = createTemporaryDirectory();
    const graph = createGraph("empty");
    const output = createOutput();
    writeFileSync(join(cwd, "generated"), "not a directory\n");

    const exitCode = await runDesktopCheck(
      ["--config", "croco.desktop.ts", "--out-dir", "generated", "--json"],
      commandDependencies(cwd, graph, output),
    );
    const report = JSON.parse(output.stdoutMessages.join("\n")) as {
      readonly codes: readonly string[];
      readonly recovery: string;
    };

    expect(exitCode).toBe(8);
    expect(report.codes).toEqual([
      "CROCO_DESKTOP_ARTIFACT_FAILURE",
      "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID",
    ]);
    expect(report.recovery).toContain(
      "Then run croco desktop check --config croco.desktop.ts --out-dir generated.",
    );
  });

  it.each([
    ["check", runDesktopCheck],
    ["generate", runDesktopGenerate],
  ] as const)(
    "rejects a hardlinked generated target during %s without changing its external peer",
    async (command, runCommand) => {
      const cwd = createTemporaryDirectory();
      const graph = createGraph("empty");
      const output = createOutput();
      const outputDirectory = join(cwd, "generated");
      const externalPath = join(cwd, "external graph.json");
      mkdirSync(outputDirectory);
      writeFileSync(externalPath, "outside\n");
      linkSync(externalPath, join(outputDirectory, "desktop-contract-graph.json"));

      const exitCode = await runCommand(
        ["--config", "croco.desktop.ts", "--out-dir", "generated", "--json"],
        commandDependencies(cwd, graph, output),
      );
      const report = JSON.parse(output.stdoutMessages.join("\n")) as {
        readonly codes: readonly string[];
        readonly recovery: string;
      };

      expect(exitCode).toBe(8);
      expect(report.codes).toEqual([
        "CROCO_DESKTOP_ARTIFACT_FAILURE",
        "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID",
      ]);
      expect(report.recovery).toContain(
        `Then run croco desktop ${command} --config croco.desktop.ts --out-dir generated.`,
      );
      expect(readFileSync(externalPath, "utf8")).toBe("outside\n");
    },
  );
});

describe("croco desktop diff", () => {
  it.each([
    ["breaking compatibility", "local", "empty", 1, ["CROCO_DESKTOP_COMPATIBILITY_BREAK"]],
    ["authority escalation", "empty", "remote", 2, ["CROCO_DESKTOP_AUTHORITY_ESCALATION"]],
    [
      "breaking compatibility and authority escalation",
      "local",
      "remote",
      3,
      ["CROCO_DESKTOP_COMPATIBILITY_BREAK", "CROCO_DESKTOP_AUTHORITY_ESCALATION"],
    ],
  ] as const)(
    "distinguishes %s",
    async (_case, baselineKind, currentKind, expectedExit, expectedCodes) => {
      const cwd = createTemporaryDirectory();
      const baseline = createGraph(baselineKind);
      const current = createGraph(currentKind);
      const output = createOutput();

      const exitCode = await runDesktopDiff(
        ["--config", "croco.desktop.ts", "--baseline", "baseline.json", "--json"],
        {
          ...commandDependencies(cwd, current, output),
          io: {
            cwd,
            ...output,
            readFile: () => stringifyDesktopContractGraph(baseline),
          },
        },
      );
      const report = JSON.parse(output.stdoutMessages.join("\n")) as {
        readonly codes: readonly string[];
      };

      expect(exitCode).toBe(expectedExit);
      expect(report.codes).toEqual(expectedCodes);
    },
  );

  it("accepts an explicitly reviewed authority fingerprint without writing", async () => {
    const cwd = createTemporaryDirectory();
    const baseline = createGraph("empty");
    const current = createGraph("remote");
    const firstOutput = createOutput();
    await runDesktopDiff(
      ["--config", "croco.desktop.ts", "--baseline", "baseline.json", "--json"],
      {
        ...commandDependencies(cwd, current, firstOutput),
        io: { cwd, ...firstOutput, readFile: () => stringifyDesktopContractGraph(baseline) },
      },
    );
    const first = JSON.parse(firstOutput.stdoutMessages.join("\n")) as {
      readonly diff: { readonly authorityEscalations: readonly { readonly fingerprint: string }[] };
    };
    const fingerprint = first.diff.authorityEscalations[0]?.fingerprint;
    expect(fingerprint).toMatch(/^sha256:/);
    if (!fingerprint) return;
    const reviewedOutput = createOutput();

    const exitCode = await runDesktopDiff(
      [
        "--config",
        "croco.desktop.ts",
        "--baseline",
        "baseline.json",
        "--reviewed-authority",
        fingerprint,
        "--json",
      ],
      {
        ...commandDependencies(cwd, current, reviewedOutput),
        io: { cwd, ...reviewedOutput, readFile: () => stringifyDesktopContractGraph(baseline) },
      },
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(reviewedOutput.stdoutMessages.join("\n"))).toMatchObject({
      codes: ["CROCO_DESKTOP_OK"],
    });
  });
});

function createGraph(kind: "empty" | "local" | "remote"): DesktopContractGraphV1 {
  if (kind === "local") {
    return compileDesktopContractGraph(
      desktopDsl.app({ contracts: {}, windows: { main: desktopDsl.window.local() } }),
    );
  }
  if (kind === "remote") {
    return compileDesktopContractGraph(
      desktopDsl.app({
        contracts: {},
        windows: {
          login: desktopDsl.window.remote({
            initialUrl: "https://login.example.com",
            allowedOrigins: ["https://login.example.com"],
          }),
        },
      }),
    );
  }
  return compileDesktopContractGraph(desktopDsl.app({ contracts: {}, windows: {} }));
}

function commandDependencies(
  cwd: string,
  graph: DesktopContractGraphV1,
  output: ReturnType<typeof createOutput>,
) {
  return {
    io: { cwd, ...output },
    loadConfig: async (): Promise<DesktopConfigLoadResult> => ({
      ok: true,
      configPath: join(cwd, "croco.desktop.ts"),
      graph,
      semanticHash: graph.semanticHash,
      evaluationCount: 1,
    }),
  };
}

function createOutput() {
  const stdoutMessages: string[] = [];
  const stderrMessages: string[] = [];
  return {
    stdoutMessages,
    stderrMessages,
    stdout: (message: string) => stdoutMessages.push(message),
    stderr: (message: string) => stderrMessages.push(message),
  };
}

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "croco-desktop-command-"));
  temporaryDirectories.push(directory);
  return directory;
}
