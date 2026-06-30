import { beforeEach, describe, expect, it, vi } from "vitest";

const fileSystemImports = vi.hoisted(() => ({
  writeFile: 0,
  lastWritePath: null as string | null,
  lastWriteContents: null as string | null,
}));

const generationModuleImports = vi.hoisted(() => ({
  emitOpenAPI: 0,
  emitOpenAPIFromContractGraph: 0,
  loadControllers: 0,
  buildContractGraph: 0,
  lastBuildOptions: null as null | Record<string, unknown>,
  lastEmitOptions: null as null | Record<string, unknown>,
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

vi.mock("node:fs/promises", () => {
  return {
    writeFile: async (path: string, contents: string) => {
      fileSystemImports.writeFile += 1;
      fileSystemImports.lastWritePath = path;
      fileSystemImports.lastWriteContents = contents;
    },
  };
});

vi.mock("../libs/emitOpenAPI", () => {
  generationModuleImports.emitOpenAPI += 1;

  return {
    emitOpenAPI: () => {
      throw new Error("emitOpenAPI should not run for help or invalid arguments");
    },
    emitOpenAPIFromContractGraph: (_graph: unknown, options: Record<string, unknown>) => {
      generationModuleImports.emitOpenAPIFromContractGraph += 1;
      generationModuleImports.lastEmitOptions = options;
      return { openapi: "3.1.0", info: { title: "Croco API", version: "1.0.0" }, paths: {} };
    },
  };
});

vi.mock("../libs/loadControllers", () => {
  return {
    loadControllers: () => {
      generationModuleImports.loadControllers += 1;
      return [class UsersController {}];
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

vi.mock("@croco/protocols-core", () => {
  return {
    buildContractGraph: (_controllers: unknown, options: Record<string, unknown>) => {
      generationModuleImports.buildContractGraph += 1;
      generationModuleImports.lastBuildOptions = options;
      return generationModuleImports.graph;
    },
    formatContractDiagnostic: (diagnostic: ContractDiagnosticFixture) =>
      `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${diagnostic.routeId ? ` ${diagnostic.routeId}` : ""}: ${diagnostic.message}`,
    getContractGraphErrors: (graph: typeof generationModuleImports.graph) =>
      graph.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
  };
});

import { runCli } from "../libs/cli";

describe("openapi-spec CLI", () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    generationModuleImports.emitOpenAPI = 0;
    generationModuleImports.emitOpenAPIFromContractGraph = 0;
    generationModuleImports.loadControllers = 0;
    generationModuleImports.buildContractGraph = 0;
    generationModuleImports.lastBuildOptions = null;
    generationModuleImports.lastEmitOptions = null;
    fileSystemImports.writeFile = 0;
    fileSystemImports.lastWritePath = null;
    fileSystemImports.lastWriteContents = null;
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
    expect(stdout.join("\n")).toContain("Usage: croco-openapi-spec");
    expect(generationModuleImports).toEqual({
      emitOpenAPI: 0,
      emitOpenAPIFromContractGraph: 0,
      loadControllers: 0,
      buildContractGraph: 0,
      lastBuildOptions: null,
      lastEmitOptions: null,
      graph: generationModuleImports.graph,
    });
  });

  it.each([
    ["no arguments", []],
    ["missing controllers", ["--out", "openapi.json"]],
    ["missing output", ["--controllers", "src/controllers/**/*.ts"]],
  ])("exits with failure for %s without loading generation modules", async (_name, args) => {
    const exitCode = await runCli(args, {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("\n")).toContain("Usage: croco-openapi-spec");
    expect(generationModuleImports).toEqual({
      emitOpenAPI: 0,
      emitOpenAPIFromContractGraph: 0,
      loadControllers: 0,
      buildContractGraph: 0,
      lastBuildOptions: null,
      lastEmitOptions: null,
      graph: generationModuleImports.graph,
    });
  });

  it("validates the canonical contract graph without emitting OpenAPI", async () => {
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
    expect(generationModuleImports.loadControllers).toBe(1);
    expect(generationModuleImports.buildContractGraph).toBe(1);
    expect(generationModuleImports.lastBuildOptions).toEqual({
      strictProblemResponses: true,
      strictSchemas: true,
    });
    expect(generationModuleImports.emitOpenAPIFromContractGraph).toBe(0);
  });

  it("fails OpenAPI generation when the contract graph has errors", async () => {
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
          message: 'Route path declares ":id" but no @Param("id") metadata was found.',
          routeId: "UsersController.getUser",
        },
      ],
    };

    const exitCode = await runCli(["--controllers", "src/**/*.ts", "--out", "openapi.json"], {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toContain(
      'ERROR contract-route-missing-path-param UsersController.getUser: Route path declares ":id" but no @Param("id") metadata was found.',
    );
    expect(stdout).toContain(
      "Contract graph contains 1 error(s); fix them before generating OpenAPI.",
    );
    expect(generationModuleImports.loadControllers).toBe(1);
    expect(generationModuleImports.buildContractGraph).toBe(1);
    expect(generationModuleImports.emitOpenAPIFromContractGraph).toBe(0);
  });

  it("reports contract graph warnings before writing generated OpenAPI", async () => {
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
      ["--controllers", "src/**/*.ts", "--out", "openapi.json", "--strict-problems"],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      "WARNING contract-route-missing-problem-union UsersController.list: Declare generated client Problem responses.",
    );
    expect(generationModuleImports.lastBuildOptions).toEqual({
      strictProblemResponses: true,
      strictSchemas: false,
    });
    expect(generationModuleImports.emitOpenAPIFromContractGraph).toBe(1);
    expect(generationModuleImports.lastEmitOptions).toMatchObject({
      info: { title: "Croco API", version: "1.0.0" },
    });
    expect(fileSystemImports.writeFile).toBe(1);
    expect(fileSystemImports.lastWritePath).toBe("openapi.json");
    expect(fileSystemImports.lastWriteContents).toContain('"openapi": "3.1.0"');
  });

  it("passes the Project manifest bundle source to OpenAPI generation", async () => {
    const exitCode = await runCli(
      [
        "--controllers",
        "src/**/*.ts",
        "--out",
        "openapi.json",
        "--manifest-bundle",
        ".croco/manifest",
      ],
      {
        stdout: (message) => stdout.push(message),
      },
    );

    expect(exitCode).toBe(0);
    expect(generationModuleImports.emitOpenAPIFromContractGraph).toBe(1);
    expect(generationModuleImports.lastEmitOptions).toMatchObject({
      manifestBundlePath: ".croco/manifest",
    });
  });
});
