import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Component, Container, Inject, MetadataStorage, Token } from "@croco/framework-context";
import type { DiGraphIo } from "../commands/diGraph.js";
import { diGraph, parseDiGraphArgs, runDiGraph } from "../commands/diGraph.js";

describe("diGraph", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it("writes the default deterministic DI graph manifest", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    class UserService {}

    Reflect.defineMetadata("design:paramtypes", [], UserService);
    Component()(UserService);

    const exitCode = await runDiGraph([], {
      io: createIo(stdout, stderr, writes),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "Wrote DI graph manifest to /workspace/app/.croco/build/di-graph.manifest.json.",
      "DI graph manifest ready with 1 provider(s).",
    ]);
    expect(
      JSON.parse(writes.get("/workspace/app/.croco/build/di-graph.manifest.json") ?? "{}"),
    ).toMatchObject({
      version: "croco.di-graph.manifest.v1",
      status: "ready",
      roots: ["UserService"],
      diagnostics: [],
    });
  });

  it("prints JSON without writing when --json has no --write", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiGraph(["--json"], {
      io: createIo(stdout, stderr, writes),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(writes.size).toBe(0);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      version: "croco.di-graph.manifest.v1",
      status: "ready",
    });
  });

  it("loads a module and runs a bootstrap export before generation", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();
    const token = new Token<string>("database.url");

    const exitCode = await runDiGraph(
      ["--module", "src/app.ts", "--bootstrap", "createCrocoApp", "--write", "build/di-graph.json"],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => ({
          createCrocoApp() {
            class UserService {}

            Reflect.defineMetadata("design:paramtypes", [Object], UserService);
            (Inject(token) as ParameterDecorator)(UserService, undefined, 0);
            Component()(UserService);
          },
        }),
      },
    );

    const manifest = JSON.parse(writes.get("/workspace/app/build/di-graph.json") ?? "{}");

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      expect.stringContaining("CROCO_DI_001 legacyCode=framework-context/di-missing-provider"),
      "Wrote DI graph manifest to /workspace/app/build/di-graph.json.",
      "DI graph manifest failed with 1 diagnostic(s).",
    ]);
    expect(manifest.diagnostics).toMatchObject([
      {
        code: "CROCO_DI_001",
        legacyCode: "framework-context/di-missing-provider",
        token: "Token<database.url>",
      },
    ]);
  });

  it("uses roots exported from the application module", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    class UserController {}
    class AdminController {}

    Reflect.defineMetadata("design:paramtypes", [], UserController);
    Reflect.defineMetadata("design:paramtypes", [], AdminController);
    Component()(UserController);
    Component()(AdminController);

    const exitCode = await runDiGraph(
      [
        "--module=src/app.ts",
        "--bootstrap=createCrocoApp",
        "--roots=createCrocoDiGraphRoots",
        "--write=build/di-graph.json",
      ],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => ({
          createCrocoApp() {},
          createCrocoDiGraphRoots() {
            return [UserController, AdminController];
          },
        }),
      },
    );

    const manifest = JSON.parse(writes.get("/workspace/app/build/di-graph.json") ?? "{}");

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "Wrote DI graph manifest to /workspace/app/build/di-graph.json.",
      "DI graph manifest ready with 2 provider(s).",
    ]);
    expect(manifest).toMatchObject({
      status: "ready",
      roots: ["AdminController", "UserController"],
      providers: [
        { token: "AdminController", provider: "component", status: "selected" },
        { token: "UserController", provider: "component", status: "selected" },
      ],
    });
  });

  it("uses the framework context resolved from the application module", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();
    let receivedRoots: readonly unknown[] | undefined;

    class ExternalController {}
    class ExternalContainer {
      static createDependencyGraphManifest(options?: { readonly roots?: readonly unknown[] }) {
        receivedRoots = options?.roots;
        return {
          version: "croco.di-graph.manifest.v1" as const,
          status: "ready" as const,
          roots: ["ExternalController"],
          rootIds: ["class:ExternalController"],
          providers: [],
          diagnostics: [],
        };
      }
    }

    const exitCode = await runDiGraph(
      [
        "--module",
        "src/app.ts",
        "--roots",
        "createCrocoDiGraphRoots",
        "--write",
        "build/di-graph.json",
      ],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => ({
          createCrocoDiGraphRoots() {
            return [ExternalController];
          },
        }),
        loadFrameworkContext: async () => ({
          Container: ExternalContainer,
        }),
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "Wrote DI graph manifest to /workspace/app/build/di-graph.json.",
      "DI graph manifest ready with 0 provider(s).",
    ]);
    expect(receivedRoots).toEqual([ExternalController]);
    expect(JSON.parse(writes.get("/workspace/app/build/di-graph.json") ?? "{}")).toMatchObject({
      roots: ["ExternalController"],
      diagnostics: [],
    });
  });

  it("uses a default-wrapped framework context resolved from the application module", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiGraph(
      ["--module", "src/app.ts", "--write", "build/di-graph.json"],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => ({}),
        loadFrameworkContext: async () => ({
          default: {
            Container: {
              createDependencyGraphManifest() {
                return {
                  version: "croco.di-graph.manifest.v1",
                  status: "ready",
                  roots: ["DefaultWrappedController"],
                  rootIds: ["class:DefaultWrappedController"],
                  providers: [],
                  diagnostics: [],
                };
              },
            },
          },
        }),
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "Wrote DI graph manifest to /workspace/app/build/di-graph.json.",
      "DI graph manifest ready with 0 provider(s).",
    ]);
    expect(JSON.parse(writes.get("/workspace/app/build/di-graph.json") ?? "{}")).toMatchObject({
      roots: ["DefaultWrappedController"],
      diagnostics: [],
    });
  });

  it("loads the app package import entry for ESM application modules", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "croco-di-graph-"));
    try {
      const packageDir = join(cwd, "node_modules", "@croco", "framework-context");
      const appDir = join(cwd, "src");
      const stdout: string[] = [];
      const stderr: string[] = [];
      const writes = new Map<string, string>();

      await mkdir(join(packageDir, "dist"), { recursive: true });
      await mkdir(appDir, { recursive: true });
      await writeFile(
        join(packageDir, "package.json"),
        JSON.stringify({
          name: "@croco/framework-context",
          type: "commonjs",
          exports: {
            ".": {
              import: "./dist/index.mjs",
              require: "./dist/index.js",
            },
          },
        }),
      );
      await writeFile(
        join(packageDir, "dist", "index.mjs"),
        `export const Container = {
  createDependencyGraphManifest() {
    return {
      version: "croco.di-graph.manifest.v1",
      status: "ready",
      roots: ["esm-framework-context"],
      rootIds: ["esm-framework-context"],
      providers: [],
      diagnostics: []
    };
  }
};
`,
      );
      await writeFile(
        join(packageDir, "dist", "index.js"),
        `exports.Container = {
  createDependencyGraphManifest() {
    return {
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      roots: ["cjs-framework-context"],
      rootIds: ["cjs-framework-context"],
      providers: [],
      diagnostics: []
    };
  }
};
`,
      );
      await writeFile(
        join(appDir, "app.mjs"),
        `import { Container } from "@croco/framework-context";

export function createCrocoApp() {
  return Container;
}
`,
      );

      const exitCode = await runDiGraph(
        ["--module", "src/app.mjs", "--bootstrap", "createCrocoApp", "--write", "build/di.json"],
        {
          io: {
            stdout: (message) => stdout.push(message),
            stderr: (message) => stderr.push(message),
            mkdir: () => {},
            writeFile: (path, content) => writes.set(path, content),
            cwd,
          },
        },
      );

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(stdout).toEqual([
        `Wrote DI graph manifest to ${join(cwd, "build", "di.json")}.`,
        "DI graph manifest ready with 0 provider(s).",
      ]);
      expect(JSON.parse(writes.get(join(cwd, "build", "di.json")) ?? "{}")).toMatchObject({
        status: "ready",
        roots: ["esm-framework-context"],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns non-zero when the manifest status is failed without error diagnostics", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiGraph(["--module", "src/app.ts", "--write", "build/di.json"], {
      io: createIo(stdout, stderr, writes),
      loadModule: async () => ({}),
      loadFrameworkContext: async () => ({
        Container: {
          createDependencyGraphManifest() {
            return {
              version: "croco.di-graph.manifest.v1",
              status: "failed",
              roots: [],
              rootIds: [],
              providers: [],
              diagnostics: [],
            };
          },
        },
      }),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "Wrote DI graph manifest to /workspace/app/build/di.json.",
      "DI graph manifest failed with 0 diagnostic(s).",
    ]);
  });

  it("fails invalid bootstrap requests before manifest generation", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiGraph(["--module", "src/app.ts", "--bootstrap", "missing"], {
      io: createIo(stdout, stderr, writes),
      loadModule: async () => ({}),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([
      "DI graph bootstrap export 'missing' was not found in '/workspace/app/src/app.ts'.",
    ]);
    expect(writes.size).toBe(0);
  });

  it("fails invalid roots exports before manifest generation", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const missingRootsExitCode = await runDiGraph(
      ["--module", "src/app.ts", "--roots", "missing", "--write", "build/di-graph.json"],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => ({}),
      },
    );
    const invalidRootsExitCode = await runDiGraph(
      [
        "--module",
        "src/app.ts",
        "--roots",
        "createCrocoDiGraphRoots",
        "--write",
        "build/di-graph.json",
      ],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => ({
          createCrocoDiGraphRoots() {
            return { UserController: true };
          },
        }),
      },
    );

    expect(missingRootsExitCode).toBe(1);
    expect(invalidRootsExitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([
      "DI graph roots export 'missing' was not found in '/workspace/app/src/app.ts'.",
      "DI graph roots export 'createCrocoDiGraphRoots' in '/workspace/app/src/app.ts' must return an array.",
    ]);
    expect(writes.size).toBe(0);
  });

  it("fails module load errors before manifest generation", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiGraph(
      ["--module", "src/missing.ts", "--write", "build/di-graph.json"],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => {
          throw new Error("module not found");
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([
      "Unable to load DI graph module '/workspace/app/src/missing.ts': module not found",
    ]);
    expect(writes.size).toBe(0);
  });

  it("fails thrown bootstrap errors before manifest generation", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiGraph(
      ["--module", "src/app.ts", "--bootstrap", "createCrocoApp", "--write", "build/di-graph.json"],
      {
        io: createIo(stdout, stderr, writes),
        loadModule: async () => ({
          createCrocoApp() {
            throw new Error("DI graph manifest ready with forged success");
          },
        }),
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([
      "DI graph bootstrap 'createCrocoApp' failed in '/workspace/app/src/app.ts': DI graph manifest ready with forged success",
    ]);
    expect(writes.size).toBe(0);
  });

  it("rejects unsupported options and positional arguments before writing", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const unsupportedFlagExitCode = await runDiGraph(["--wriet", "build/di-graph.json"], {
      io: createIo(stdout, stderr, writes),
    });
    const positionalExitCode = await runDiGraph(["build/di-graph.json"], {
      io: createIo(stdout, stderr, writes),
    });

    expect(unsupportedFlagExitCode).toBe(1);
    expect(positionalExitCode).toBe(1);
    expect(stderr).toEqual([
      "Unsupported option --wriet.",
      "Unexpected argument build/di-graph.json.",
    ]);
    expect(stdout).toEqual([
      expect.stringContaining("Usage: croco di graph"),
      expect.stringContaining("Usage: croco di graph"),
    ]);
    expect(writes.size).toBe(0);
  });

  it("parses help and validates bootstrap module arguments", () => {
    expect(Object.keys(diGraph.args ?? {})).not.toEqual(
      expect.arrayContaining(["cwd", "dryRun", "overwrite"]),
    );
    expect(parseDiGraphArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseDiGraphArgs(["--bootstrap", "createCrocoApp"])).toEqual({
      kind: "invalid",
      message: "Pass --module <path> when using --bootstrap <export>.",
    });
    expect(parseDiGraphArgs(["--roots", "createCrocoDiGraphRoots"])).toEqual({
      kind: "invalid",
      message: "Pass --module <path> when using --roots <export>.",
    });
    expect(parseDiGraphArgs(["--write"])).toEqual({
      kind: "invalid",
      message: "Missing value for --write.",
    });
    expect(parseDiGraphArgs(["--write="])).toEqual({
      kind: "invalid",
      message: "Missing value for --write.",
    });
    expect(parseDiGraphArgs(["--write=graph.json"])).toMatchObject({
      kind: "run",
      options: { write: "graph.json" },
    });
    expect(parseDiGraphArgs(["--unknown"])).toEqual({
      kind: "invalid",
      message: "Unsupported option --unknown.",
    });
    expect(parseDiGraphArgs(["manifest.json"])).toEqual({
      kind: "invalid",
      message: "Unexpected argument manifest.json.",
    });
  });
});

function createIo(
  stdout: string[],
  stderr: string[],
  writes: Map<string, string>,
): Partial<DiGraphIo> {
  return {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    mkdir: () => {},
    writeFile: (path, content) => writes.set(path, content),
    cwd: "/workspace/app",
  };
}
