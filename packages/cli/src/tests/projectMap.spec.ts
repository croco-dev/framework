import { describe, expect, it } from "vitest";
import type { PolicyTable, RuntimeCapabilityName } from "@croco/framework-context";
import type { FrameworkManifest } from "@croco/framework-routes";
import type { ContractDiagnostic, ContractGraphSnapshot } from "@croco/protocols-core";
import {
  createProjectMapManifest,
  createProjectManifestBundle,
  runProjectMap,
  stringifyProjectMapManifest,
} from "../commands/projectMap.js";
import type { ProjectMapDirent, ProjectMapIo, ProjectMapPackage } from "../commands/projectMap.js";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";

describe("projectMap", () => {
  it("writes a deterministic Project Map manifest snapshot", async () => {
    const first = stringifyProjectMapManifest(
      createProjectMapManifest({
        projectRoot: "/workspace/app",
        rootPackage: { name: "demo-app", packageManager: "pnpm@11.9.0" },
        packageGraph: [
          createPackage("@demo/api", "apps/api/package.json"),
          createPackage("demo-app", "package.json"),
        ],
        frameworkManifest: createFrameworkManifest(),
        contractGraphSnapshot: createContractSnapshot(),
        telemetryBoundaries: [
          {
            kind: "telemetry-runtime",
            id: "telemetry-runtime:apps/api/src/index.ts:3",
            source: { file: "apps/api/src/index.ts", line: 3, column: 1 },
          },
        ],
      }),
    );
    const second = stringifyProjectMapManifest(
      createProjectMapManifest({
        projectRoot: "/workspace/app",
        rootPackage: { name: "demo-app", packageManager: "pnpm@11.9.0" },
        packageGraph: [
          createPackage("demo-app", "package.json"),
          createPackage("@demo/api", "apps/api/package.json"),
        ],
        frameworkManifest: createFrameworkManifest(),
        contractGraphSnapshot: createContractSnapshot(),
        telemetryBoundaries: [
          {
            kind: "telemetry-runtime",
            id: "telemetry-runtime:apps/api/src/index.ts:3",
            source: { file: "apps/api/src/index.ts", line: 3, column: 1 },
          },
        ],
      }),
    );

    expect(first).toBe(second);

    const stdout: string[] = [];
    const writes = new Map<string, string>();
    const exitCode = await runProjectMap(
      ["--controllers", "src/**/*.ts", "--out", "croco.project-map.json"],
      {
        io: {
          ...createIo(stdout),
          mkdir: () => {},
          writeFile: (path, content) => writes.set(path, content),
        },
        loadProjectMap: async () => JSON.parse(first),
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      "Wrote Project Map manifest to /workspace/app/croco.project-map.json.",
    ]);
    expect(JSON.parse(writes.get("/workspace/app/croco.project-map.json") ?? "{}")).toMatchObject({
      version: "croco.project-map.manifest.v1",
      project: {
        packageName: "demo-app",
      },
      summary: {
        packages: 2,
        routes: 1,
        providers: 1,
        telemetryBoundaries: 1,
      },
      packageGraph: {
        packages: [{ name: "@demo/api" }, { name: "demo-app" }],
      },
      entrypoints: expect.arrayContaining([
        expect.objectContaining({
          kind: "http-route",
          id: "UsersController.listUsers",
          source: { file: "apps/api/src/controllers/UsersController.ts", line: 8, column: 3 },
        }),
      ]),
    });
  });

  it("writes a deterministic schema-versioned Project manifest bundle", async () => {
    const stdout: string[] = [];
    const writes = new Map<string, string>();
    const manifest = createProjectMapManifest({
      projectRoot: "/workspace/app",
      rootPackage: { name: "demo-app", packageManager: "pnpm@11.9.0" },
      packageGraph: [
        createPackage("demo-app", "package.json"),
        createPackage("@demo/api", "apps/api/package.json"),
      ],
      frameworkManifest: createFrameworkManifest(),
      contractGraphSnapshot: createContractSnapshot(),
      telemetryBoundaries: [
        {
          kind: "telemetry-runtime",
          id: "telemetry-runtime:apps/api/src/index.ts:3",
          source: { file: "apps/api/src/index.ts", line: 3, column: 1 },
        },
      ],
    });
    const bundle = createProjectManifestBundle(manifest);

    expect(bundle.map((artifact) => artifact.path)).toEqual([
      "contract-graph.json",
      "problems.json",
      "di-graph.json",
      "runtime.json",
      "policies.json",
      "providers.json",
    ]);
    expect(JSON.parse(bundle[0]?.content ?? "{}")).toMatchObject({
      schemaVersion: "croco.manifest.contract-graph.v1",
      source: {
        schemaVersion: "croco.project-map.manifest.v1",
        artifact: "croco.project-map.json",
        packageName: "demo-app",
      },
      routes: [
        {
          id: "UsersController.listUsers",
          source: { file: "apps/api/src/controllers/UsersController.ts", line: 8, column: 3 },
        },
      ],
    });

    const exitCode = await runProjectMap(
      [
        "--controllers",
        "src/**/*.ts",
        "--out",
        "croco.project-map.json",
        "--manifest-bundle",
        ".croco/manifest",
      ],
      {
        io: {
          ...createIo(stdout),
          mkdir: () => {},
          writeFile: (path, content) => writes.set(path, content),
        },
        loadProjectMap: async () => manifest,
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      "Wrote Project Map manifest to /workspace/app/croco.project-map.json.",
      "Wrote Project manifest bundle to /workspace/app/.croco/manifest.",
    ]);
    expect(writes.has("/workspace/app/croco.project-map.json")).toBe(true);
    expect(writes.has("/workspace/app/.croco/manifest/contract-graph.json")).toBe(true);
    expect(writes.has("/workspace/app/.croco/manifest/providers.json")).toBe(true);
  });

  it("exits non-zero when contract, runtime, and package manifest conflicts exist", async () => {
    const stdout: string[] = [];
    const manifest = createProjectMapManifest({
      projectRoot: "/workspace/app",
      rootPackage: { name: "demo-app" },
      packageGraph: [createPackage("demo-app", "package.json")],
      frameworkManifest: createFrameworkManifest(),
      contractGraphSnapshot: createContractSnapshot([
        {
          code: "contract-route-missing-path-param",
          severity: "error",
          target: "route",
          routeId: "UsersController.listUsers",
          message: "Route path declares ':id' but no @Param(\"id\") metadata was found.",
        },
      ]),
      runtimePolicyManifest: {
        path: "croco-runtime-policy.manifest.json",
        manifest: {
          runtime: { platform: "lambda" },
          table: createPolicyTable(["shutdown"]),
        },
      },
      providerProfileManifest: {
        path: "croco-saas-profile.manifest.json",
        manifest: {
          profile: { name: "saas-cloudflare" },
          packages: ["@croco/storage-r2"],
        },
      },
    });

    const exitCode = await runProjectMap(["--controllers", "src/**/*.ts"], {
      io: createIo(stdout),
      loadProjectMap: async () => manifest,
    });

    expect(exitCode).toBe(1);
    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: CLI_DIAGNOSTIC_CODES.projectMapContractGraphDiagnostic,
          legacyCode: "project-map/contract-graph-contract-route-missing-path-param",
          sourceCode: "contract-route-missing-path-param",
        }),
        expect.objectContaining({
          code: CLI_DIAGNOSTIC_CODES.projectMapPackageManifestConflict,
          legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.projectMapPackageManifestConflict,
        }),
        expect.objectContaining({
          code: CLI_DIAGNOSTIC_CODES.projectMapRuntimeCapabilityConflict,
          legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.projectMapRuntimeCapabilityConflict,
        }),
      ]),
    );
    expect(stdout).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`ERROR ${CLI_DIAGNOSTIC_CODES.projectMapContractGraphDiagnostic}`),
        expect.stringContaining(`ERROR ${CLI_DIAGNOSTIC_CODES.projectMapPackageManifestConflict}`),
        expect.stringContaining(
          `ERROR ${CLI_DIAGNOSTIC_CODES.projectMapRuntimeCapabilityConflict}`,
        ),
        "Project Map check failed with 3 error(s).",
      ]),
    );
  });

  it("reports unsupported runtime targets distinctly from missing runtime targets", async () => {
    const stdout: string[] = [];
    const manifest = createProjectMapManifest({
      projectRoot: "/workspace/app",
      rootPackage: { name: "demo-app" },
      packageGraph: [createPackage("demo-app", "package.json")],
      frameworkManifest: createFrameworkManifest(),
      runtimePolicyManifest: {
        path: "croco-runtime-policy.manifest.json",
        manifest: {
          runtime: { platform: "edge-runtime" },
          table: createPolicyTable([]),
        },
      },
    });

    const exitCode = await runProjectMap(["--controllers", "src/**/*.ts"], {
      io: createIo(stdout),
      loadProjectMap: async () => manifest,
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      `ERROR ${CLI_DIAGNOSTIC_CODES.projectMapRuntimeTargetUnsupported} artifact=croco-runtime-policy.manifest.json: Runtime policy manifest uses unsupported target runtime 'edge-runtime'.`,
      "Project Map check failed with 1 error(s).",
    ]);
  });

  it.each([
    {
      args: [
        "--framework-manifest",
        "committed-framework.json",
        "--contract-graph",
        "missing-contract.json",
      ],
      message: "Missing Contract Graph snapshot '/workspace/app/missing-contract.json'.",
    },
    {
      args: [
        "--framework-manifest",
        "committed-framework.json",
        "--runtime-policy",
        "missing-runtime.json",
      ],
      message: "Missing runtime policy manifest '/workspace/app/missing-runtime.json'.",
    },
    {
      args: [
        "--framework-manifest",
        "committed-framework.json",
        "--provider-profile",
        "missing-provider.json",
      ],
      message: "Missing provider profile manifest '/workspace/app/missing-provider.json'.",
    },
  ])("fails when explicit Project Map artifact inputs are missing", async ({ args, message }) => {
    const stdout: string[] = [];

    const exitCode = await runProjectMap(args, {
      io: createWorkspaceIo(stdout),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([message]);
  });

  it("rejects malformed nested Contract Graph snapshot rows with stable evidence", async () => {
    const stdout: string[] = [];
    const workspaceIo = createWorkspaceIo(stdout);
    const contractGraphPath = "/workspace/app/malformed-contract.json";
    const malformedSnapshot = JSON.stringify({
      ...createContractSnapshot(),
    }).replace('"status":404', '"status":1e309');

    const exitCode = await runProjectMap(
      [
        "--framework-manifest",
        "committed-framework.json",
        "--contract-graph",
        "malformed-contract.json",
      ],
      {
        io: {
          ...workspaceIo,
          exists: (path) => path === contractGraphPath || workspaceIo.exists?.(path) === true,
          readFile: (path) =>
            path === contractGraphPath ? malformedSnapshot : (workspaceIo.readFile?.(path) ?? ""),
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      `Contract Graph snapshot '${contractGraphPath}' must be croco.contract-graph.snapshot.v1.`,
    ]);
  });

  it("reads an explicit framework manifest instead of regenerating from discovered sources", async () => {
    const stdout: string[] = [];

    const exitCode = await runProjectMap(
      ["--framework-manifest", "committed-framework.json", "--json"],
      {
        io: createWorkspaceIo(stdout),
      },
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      summary: {
        routes: 1,
        providers: 1,
      },
      routeGraph: {
        routes: [
          {
            id: "UsersController.listUsers",
            source: { file: "apps/api/src/controllers/UsersController.ts", line: 8, column: 3 },
          },
        ],
      },
    });
  });

  it("fails check mode when the committed Project Map manifest is stale", async () => {
    const stdout: string[] = [];
    const manifest = createProjectMapManifest({
      projectRoot: "/workspace/app",
      rootPackage: { name: "demo-app" },
      packageGraph: [createPackage("demo-app", "package.json")],
      frameworkManifest: createFrameworkManifest(),
      contractGraphSnapshot: createContractSnapshot(),
    });
    const staleManifest = {
      ...manifest,
      project: {
        ...manifest.project,
        packageName: "old-name",
      },
    };

    const exitCode = await runProjectMap(["--check", "--manifest", "croco.project-map.json"], {
      io: {
        ...createIo(stdout),
        exists: (path) => path === "/workspace/app/croco.project-map.json",
        readFile: () => JSON.stringify(staleManifest, null, 2),
      },
      loadProjectMap: async () => manifest,
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      `ERROR ${CLI_DIAGNOSTIC_CODES.projectMapManifestDrift} artifact=/workspace/app/croco.project-map.json: Project Map manifest '/workspace/app/croco.project-map.json' is stale. Regenerate it with croco project map --out croco.project-map.json.`,
      "Project Map check failed with 1 error(s).",
    ]);
  });

  it("fails check mode when a committed Project manifest bundle artifact is stale", async () => {
    const stdout: string[] = [];
    const manifest = createProjectMapManifest({
      projectRoot: "/workspace/app",
      rootPackage: { name: "demo-app" },
      packageGraph: [createPackage("demo-app", "package.json")],
      frameworkManifest: createFrameworkManifest(),
      contractGraphSnapshot: createContractSnapshot(),
    });
    const bundleFiles = new Map(
      createProjectManifestBundle(manifest).map((artifact) => [
        `/workspace/app/.croco/manifest/${artifact.path}`,
        artifact.content,
      ]),
    );
    bundleFiles.set(
      "/workspace/app/.croco/manifest/providers.json",
      JSON.stringify({ schemaVersion: "croco.manifest.providers.v1", providerProfile: "old" }),
    );

    const exitCode = await runProjectMap(
      ["--check", "--manifest", "croco.project-map.json", "--manifest-bundle", ".croco/manifest"],
      {
        io: {
          ...createIo(stdout),
          exists: (path) =>
            path === "/workspace/app/croco.project-map.json" || bundleFiles.has(path),
          readFile: (path) =>
            path === "/workspace/app/croco.project-map.json"
              ? stringifyProjectMapManifest(manifest)
              : (bundleFiles.get(path) ?? ""),
        },
        loadProjectMap: async () => manifest,
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      `ERROR ${CLI_DIAGNOSTIC_CODES.projectMapManifestDrift} artifact=/workspace/app/.croco/manifest/providers.json: Project manifest bundle artifact '/workspace/app/.croco/manifest/providers.json' is stale. Regenerate it with croco project map --manifest-bundle .croco/manifest.`,
      "Project Map check failed with 1 error(s).",
    ]);
  });
});

function createIo(stdout: string[]): Partial<ProjectMapIo> {
  return {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stdout.push(message),
    cwd: "/workspace/app",
  };
}

function createWorkspaceIo(stdout: string[]): Partial<ProjectMapIo> {
  const files = new Map([
    [
      "/workspace/app/package.json",
      JSON.stringify({
        name: "demo-app",
        packageManager: "pnpm@11.9.0",
        scripts: {
          "project-map:check": "croco project map --check --manifest croco.project-map.json",
        },
      }),
    ],
    ["/workspace/app/committed-framework.json", JSON.stringify(createFrameworkManifest())],
    ["/workspace/app/src/telemetry.ts", "TelemetryRuntime.init();\n"],
  ]);
  const directories = new Map<string, readonly ProjectMapDirent[]>([
    ["/workspace/app", [createDirent("package.json", "file"), createDirent("src", "directory")]],
    ["/workspace/app/src", [createDirent("telemetry.ts", "file")]],
  ]);

  return {
    ...createIo(stdout),
    exists: (path) => files.has(path) || directories.has(path),
    readFile: (path) => files.get(path) ?? "",
    readDir: (path) => directories.get(path) ?? [],
    stat: (path) => ({
      isDirectory: () => directories.has(path),
      isFile: () => files.has(path),
    }),
  };
}

function createDirent(name: string, kind: "directory" | "file"): ProjectMapDirent {
  return {
    name,
    isDirectory: () => kind === "directory",
    isFile: () => kind === "file",
  };
}

function createPackage(name: string, path: string): ProjectMapPackage {
  return {
    name,
    path,
    private: true,
    scripts: ["build", "project-map:check"],
    dependencies: [],
  };
}

function createFrameworkManifest(): FrameworkManifest {
  return {
    version: "croco.framework-manifest.v1",
    schema: {
      entityVocabulary: [],
      sourceLocationFields: ["path", "line", "column"],
      consumerApis: [],
    },
    summary: {
      sourceFiles: 2,
      entities: 3,
      controllers: 1,
      routes: 1,
      providers: 1,
      eventHandlers: 0,
      domainEvents: 0,
      relationships: 0,
    },
    generatedArtifacts: [
      {
        kind: "framework-manifest",
        path: ".croco/build/framework-manifest.json",
        gitIgnored: false,
        commitPolicy: "commit-required",
      },
    ],
    sourceFiles: [],
    entities: [
      {
        kind: "di.provider",
        id: "UsersService",
        name: "UsersService",
        scope: "singleton",
        dependencies: [],
        source: { path: "apps/api/src/users.ts", line: 3, column: 1 },
      },
      {
        kind: "http.controller",
        id: "UsersController",
        name: "UsersController",
        path: "/users",
        routeIds: ["UsersController.listUsers"],
        source: { path: "apps/api/src/controllers/UsersController.ts", line: 6, column: 1 },
      },
      {
        kind: "http.route",
        id: "UsersController.listUsers",
        name: "UsersController.listUsers",
        method: "GET",
        path: "/users",
        controllerId: "UsersController",
        handlerName: "listUsers",
        source: { path: "apps/api/src/controllers/UsersController.ts", line: 8, column: 3 },
      },
    ],
    relationships: [],
    diagnostics: [],
  };
}

function createContractSnapshot(diagnostics: ContractDiagnostic[] = []): ContractGraphSnapshot {
  return {
    snapshotVersion: "croco.contract-graph.snapshot.v1",
    graphVersion: "croco.contract-graph.v1",
    controllerCount: 1,
    routeCount: 1,
    operationIds: ["UsersController_listUsers"],
    controllers: [
      {
        name: "UsersController",
        path: "/users",
        guards: [],
        roles: [],
        routeIds: ["UsersController.listUsers"],
      },
    ],
    routes: [
      {
        routeId: "UsersController.listUsers",
        operationId: "UsersController_listUsers",
        controllerName: "UsersController",
        methodName: "listUsers",
        httpMethod: "GET",
        path: "/users",
        controllerPath: "/users",
        domain: "users",
        routeContract: null,
        access: { guards: [], roles: [] },
        entitlements: [],
        params: [],
        request: { body: null, path: null, query: null, headers: null },
        response: null,
        problems: [
          {
            code: "USER_NOT_FOUND",
            category: "NOT_FOUND",
            status: 404,
          },
        ],
      },
    ],
    diagnostics,
  };
}

function createPolicyTable(requiredCapabilities: readonly RuntimeCapabilityName[]): PolicyTable {
  const target = {
    kind: "route",
    id: "UsersController",
    operation: "listUsers",
  } as const;

  return {
    plans: [
      {
        target,
        executionOrder: ["retry"],
        failurePropagation: [{ kind: "retry", failurePropagation: "retryable-operation-error" }],
        entries: [
          {
            target,
            policy: { kind: "retry", maxAttempts: 3 },
            order: 30,
            requiredCapabilities,
            failurePropagation: "retryable-operation-error",
          },
        ],
      },
    ],
  };
}
