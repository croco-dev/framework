import { beforeEach, describe, expect, it, vi } from "vitest";

const generationModuleImports = vi.hoisted(() => ({
  generate: 0,
  generateClientFiles: 0,
  manifestChecks: 0,
  loadRoutes: 0,
  loadContractGraph: 0,
  lastLoadOptions: null as null | Record<string, unknown>,
  lastCheckedManifestPath: null as null | string,
  lastGenerateOptions: null as null | Record<string, unknown>,
  manifestCheckResult: {
    ok: true,
    status: "current",
    path: "frontend-action-manifest.json",
  } as
    | { readonly ok: true; readonly status: "current"; readonly path: string }
    | { readonly ok: false; readonly status: "missing" | "different"; readonly path: string },
  frontendActionManifest: {
    schemaVersion: "croco.frontend-action-manifest.v1",
    actions: [],
  },
  graph: {
    version: "croco.contract-graph.v1",
    controllers: [
      {
        name: "UsersController",
        path: "/users",
        guards: [],
        roles: [],
        routeIds: ["UsersController.list"],
      },
    ],
    routes: [{ routeId: "UsersController.list" }],
    diagnostics: [] as ContractDiagnosticFixture[],
  },
}));

vi.mock("../libs/generate", () => {
  generationModuleImports.generate += 1;

  return {
    generateClientFiles: () => {
      generationModuleImports.generateClientFiles += 1;
      throw new Error("generateClientFiles should not run for help or invalid arguments");
    },
    generateClientFilesFromContractGraph: (
      _graph: unknown,
      _outDir: string,
      options: Record<string, unknown>,
    ) => {
      generationModuleImports.generateClientFiles += 1;
      generationModuleImports.lastGenerateOptions = options;
      return ["client/user.ts"];
    },
    createFrontendActionManifestFromContractGraph: () => {
      return generationModuleImports.frontendActionManifest;
    },
  };
});

vi.mock("@croco/presentation-preset", () => {
  return {
    checkFrontendActionManifestFile: (_manifest: unknown, manifestPath: string) => {
      generationModuleImports.manifestChecks += 1;
      generationModuleImports.lastCheckedManifestPath = manifestPath;
      return generationModuleImports.manifestCheckResult;
    },
  };
});

type ContractDiagnosticFixture = {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly target: string;
  readonly message: string;
  readonly routeId?: string;
};

vi.mock("../libs/loadRoutes", () => {
  generationModuleImports.loadRoutes += 1;

  return {
    loadContractGraph: (_controllers: string, options: Record<string, unknown>) => {
      generationModuleImports.loadContractGraph += 1;
      generationModuleImports.lastLoadOptions = options;
      return generationModuleImports.graph;
    },
  };
});

import { runCli } from "../libs/cli";

describe("rpc-codegen CLI", () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    generationModuleImports.generate = 0;
    generationModuleImports.generateClientFiles = 0;
    generationModuleImports.manifestChecks = 0;
    generationModuleImports.loadRoutes = 0;
    generationModuleImports.loadContractGraph = 0;
    generationModuleImports.lastLoadOptions = null;
    generationModuleImports.lastCheckedManifestPath = null;
    generationModuleImports.lastGenerateOptions = null;
    generationModuleImports.manifestCheckResult = {
      ok: true,
      status: "current",
      path: "frontend-action-manifest.json",
    };
    generationModuleImports.frontendActionManifest = {
      schemaVersion: "croco.frontend-action-manifest.v1",
      actions: [],
    };
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        {
          name: "UsersController",
          path: "/users",
          guards: [],
          roles: [],
          routeIds: ["UsersController.list"],
        },
      ],
      routes: [{ routeId: "UsersController.list" }],
      diagnostics: [],
    };
  });

  it("exits successfully for help without loading generation modules", async () => {
    const exitCode = await runCli(["--help"], {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("\n")).toContain("Usage: croco-rpc-codegen");
    expect(generationModuleImports).toEqual({
      generate: 0,
      generateClientFiles: 0,
      manifestChecks: 0,
      loadRoutes: 0,
      loadContractGraph: 0,
      lastLoadOptions: null,
      lastCheckedManifestPath: null,
      lastGenerateOptions: null,
      manifestCheckResult: generationModuleImports.manifestCheckResult,
      frontendActionManifest: generationModuleImports.frontendActionManifest,
      graph: generationModuleImports.graph,
    });
  });

  it.each([
    ["no arguments", []],
    ["missing controllers", ["--out", "client"]],
    ["missing output", ["--controllers", "src/controllers/**/*.ts"]],
    [
      "invalid Problem runtime",
      ["--controllers", "src/controllers/**/*.ts", "--out", "client", "--problem-runtime", "other"],
    ],
    [
      "missing Problem runtime value",
      ["--controllers", "src/controllers/**/*.ts", "--out", "client", "--problem-runtime"],
    ],
    [
      "missing frontend action manifest path for check",
      ["--controllers", "src/controllers/**/*.ts", "--frontend-action-manifest-check"],
    ],
    [
      "conflicting schema modes",
      [
        "--controllers",
        "src/controllers/**/*.ts",
        "--out",
        "client",
        "--strict-schemas",
        "--compatibility-schemas",
      ],
    ],
    [
      "conflicting Problem modes",
      [
        "--controllers",
        "src/controllers/**/*.ts",
        "--out",
        "client",
        "--strict-problems",
        "--compatibility-problems",
      ],
    ],
  ])("exits with failure for %s without loading generation modules", async (_name, args) => {
    const exitCode = await runCli(args, {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("\n")).toContain("Usage: croco-rpc-codegen");
    expect(generationModuleImports).toEqual({
      generate: 0,
      generateClientFiles: 0,
      manifestChecks: 0,
      loadRoutes: 0,
      loadContractGraph: 0,
      lastLoadOptions: null,
      lastCheckedManifestPath: null,
      lastGenerateOptions: null,
      manifestCheckResult: generationModuleImports.manifestCheckResult,
      frontendActionManifest: generationModuleImports.frontendActionManifest,
      graph: generationModuleImports.graph,
    });
  });

  it("validates the canonical contract graph without generating clients", async () => {
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        {
          name: "HooksController",
          path: "/hooks",
          guards: [],
          roles: [],
          routeIds: ["HooksController.handle"],
        },
      ],
      routes: [{ routeId: "HooksController.handle" }],
      diagnostics: [
        {
          code: "contract-route-unsupported-all-method",
          severity: "error",
          target: "route",
          message: "Use explicit HTTP method decorators.",
          routeId: "HooksController.handle",
        },
      ],
    };

    const exitCode = await runCli(
      ["--controllers", "src/**/*.ts", "--check", "--strict-problems", "--strict-schemas"],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain(
      "ERROR contract-route-unsupported-all-method HooksController.handle: Use explicit HTTP method decorators.",
    );
    expect(stdout).toContain("Contract graph check failed with 1 error(s).");
    expect(generationModuleImports.generate).toBe(0);
    expect(generationModuleImports.generateClientFiles).toBe(0);
    expect(generationModuleImports.loadContractGraph).toBe(1);
    expect(generationModuleImports.lastLoadOptions).toEqual({
      strictProblemResponses: true,
      strictSchemas: true,
    });
  });

  it("fails client generation when the contract graph has errors", async () => {
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        {
          name: "UsersController",
          path: "/users",
          guards: [],
          roles: [],
          routeIds: ["UsersController.getUser"],
        },
      ],
      routes: [{ routeId: "UsersController.getUser" }],
      diagnostics: [
        {
          code: "contract-route-missing-path-param",
          severity: "error",
          target: "route",
          message: "Route path declares ':id' but no @Param(\"id\") metadata was found.",
          routeId: "UsersController.getUser",
        },
      ],
    };

    const exitCode = await runCli(["--controllers", "src/**/*.ts", "--out", "client"], {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toContain(
      "ERROR contract-route-missing-path-param UsersController.getUser: Route path declares ':id' but no @Param(\"id\") metadata was found.",
    );
    expect(stdout).toContain(
      "Contract graph contains 1 error(s); fix them before generating clients.",
    );
    expect(generationModuleImports.generate).toBe(0);
    expect(generationModuleImports.generateClientFiles).toBe(0);
    expect(generationModuleImports.loadContractGraph).toBe(1);
  });

  it("passes the selected frontend Problem runtime to client generation", async () => {
    const exitCode = await runCli(
      ["--controllers", "src/**/*.ts", "--out", "client", "--problem-runtime", "frontend-problems"],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["client/user.ts"]);
    expect(generationModuleImports.generateClientFiles).toBe(1);
    expect(generationModuleImports.loadContractGraph).toBe(1);
    expect(generationModuleImports.lastLoadOptions).toEqual({
      strictProblemResponses: true,
      strictSchemas: true,
    });
    expect(generationModuleImports.lastGenerateOptions).toEqual({
      problemRuntime: "frontend-problems",
      reactQuery: false,
    });
  });

  it("reports contract graph warnings before writing generated clients", async () => {
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        {
          name: "UsersController",
          path: "/users",
          guards: [],
          roles: [],
          routeIds: ["UsersController.list"],
        },
      ],
      routes: [{ routeId: "UsersController.list" }],
      diagnostics: [
        {
          code: "contract-route-missing-problem-union",
          severity: "warning",
          target: "route",
          message: "Declare generated client Problem responses.",
          routeId: "UsersController.list",
        },
      ],
    };

    const exitCode = await runCli(["--controllers", "src/**/*.ts", "--out", "client"], {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      "WARNING contract-route-missing-problem-union UsersController.list: Declare generated client Problem responses.",
      "client/user.ts",
    ]);
    expect(generationModuleImports.lastLoadOptions).toEqual({
      strictProblemResponses: true,
      strictSchemas: true,
    });
    expect(generationModuleImports.generateClientFiles).toBe(1);
  });

  it("fails client generation on warnings when diagnostics are blocking", async () => {
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        {
          name: "UsersController",
          path: "/users",
          guards: [],
          roles: [],
          routeIds: ["UsersController.list"],
        },
      ],
      routes: [{ routeId: "UsersController.list" }],
      diagnostics: [
        {
          code: "contract-route-missing-problem-union",
          severity: "warning",
          target: "route",
          message: "Declare generated client Problem responses.",
          routeId: "UsersController.list",
        },
      ],
    };

    const exitCode = await runCli(
      ["--controllers", "src/**/*.ts", "--out", "client", "--fail-on-diagnostics"],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      "WARNING contract-route-missing-problem-union UsersController.list: Declare generated client Problem responses.",
      "Contract graph contains 1 diagnostic(s); fix them before generating clients.",
    ]);
    expect(generationModuleImports.lastLoadOptions).toEqual({
      strictProblemResponses: true,
      strictSchemas: true,
    });
    expect(generationModuleImports.generate).toBe(0);
    expect(generationModuleImports.generateClientFiles).toBe(0);
  });

  it("allows compatibility mode only through explicit opt-out flags", async () => {
    const exitCode = await runCli(
      [
        "--controllers",
        "src/**/*.ts",
        "--out",
        "client",
        "--compatibility-problems",
        "--compatibility-schemas",
      ],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["client/user.ts"]);
    expect(generationModuleImports.lastLoadOptions).toEqual({
      strictProblemResponses: false,
      strictSchemas: false,
    });
    expect(generationModuleImports.generateClientFiles).toBe(1);
  });

  it("passes the frontend action manifest path to client generation", async () => {
    const exitCode = await runCli(
      [
        "--controllers",
        "src/**/*.ts",
        "--out",
        "client",
        "--frontend-action-manifest",
        "client/frontend-action-manifest.json",
      ],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["client/user.ts"]);
    expect(generationModuleImports.generateClientFiles).toBe(1);
    expect(generationModuleImports.loadContractGraph).toBe(1);
    expect(generationModuleImports.lastGenerateOptions).toEqual({
      frontendActionManifestPath: "client/frontend-action-manifest.json",
      problemRuntime: "inline",
      reactQuery: false,
    });
  });

  it("passes the Project manifest bundle source to client generation", async () => {
    const exitCode = await runCli(
      ["--controllers", "src/**/*.ts", "--out", "client", "--manifest-bundle", ".croco/manifest"],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["client/user.ts"]);
    expect(generationModuleImports.generateClientFiles).toBe(1);
    expect(generationModuleImports.lastGenerateOptions).toEqual({
      manifestBundlePath: ".croco/manifest",
      problemRuntime: "inline",
      reactQuery: false,
    });
  });

  it("fails frontend action manifest check when the committed manifest drifts", async () => {
    generationModuleImports.manifestCheckResult = {
      ok: false,
      status: "different",
      path: "client/frontend-action-manifest.json",
    };

    const exitCode = await runCli(
      [
        "--controllers",
        "src/**/*.ts",
        "--frontend-action-manifest",
        "client/frontend-action-manifest.json",
        "--frontend-action-manifest-check",
      ],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain(
      "Frontend action manifest drift detected: client/frontend-action-manifest.json. Run croco-rpc-codegen with --frontend-action-manifest client/frontend-action-manifest.json and commit the generated file.",
    );
    expect(generationModuleImports.generateClientFiles).toBe(0);
    expect(generationModuleImports.manifestChecks).toBe(1);
    expect(generationModuleImports.lastCheckedManifestPath).toBe(
      "client/frontend-action-manifest.json",
    );
  });
});
