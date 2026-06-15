import { beforeEach, describe, expect, it, vi } from "vitest";

const generationModuleImports = vi.hoisted(() => ({
  generate: 0,
  generateClientFiles: 0,
  loadRoutes: 0,
  loadContractGraph: 0,
  graph: {
    version: "croco.contract-graph.v1",
    controllers: [{ name: "UsersController", path: "/users", routeIds: ["UsersController.list"] }],
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
    generateClientFilesFromContractGraph: () => {
      generationModuleImports.generateClientFiles += 1;
      throw new Error(
        "generateClientFilesFromContractGraph should not run for check or invalid contract graphs",
      );
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
    loadContractGraph: () => {
      generationModuleImports.loadContractGraph += 1;
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
    generationModuleImports.loadRoutes = 0;
    generationModuleImports.loadContractGraph = 0;
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        { name: "UsersController", path: "/users", routeIds: ["UsersController.list"] },
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
      loadRoutes: 0,
      loadContractGraph: 0,
      graph: generationModuleImports.graph,
    });
  });

  it.each([
    ["no arguments", []],
    ["missing controllers", ["--out", "client"]],
    ["missing output", ["--controllers", "src/controllers/**/*.ts"]],
  ])("exits with failure for %s without loading generation modules", async (_name, args) => {
    const exitCode = await runCli(args, {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("\n")).toContain("Usage: croco-rpc-codegen");
    expect(generationModuleImports).toEqual({
      generate: 0,
      generateClientFiles: 0,
      loadRoutes: 0,
      loadContractGraph: 0,
      graph: generationModuleImports.graph,
    });
  });

  it("validates the canonical contract graph without generating clients", async () => {
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        { name: "HooksController", path: "/hooks", routeIds: ["HooksController.handle"] },
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

    const exitCode = await runCli(["--controllers", "src/**/*.ts", "--check"], {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toContain(
      "ERROR contract-route-unsupported-all-method HooksController.handle: Use explicit HTTP method decorators.",
    );
    expect(stdout).toContain("Contract graph check failed with 1 error(s).");
    expect(generationModuleImports.generateClientFiles).toBe(0);
    expect(generationModuleImports.loadContractGraph).toBe(1);
  });

  it("fails client generation when the contract graph has errors", async () => {
    generationModuleImports.graph = {
      version: "croco.contract-graph.v1",
      controllers: [
        { name: "UsersController", path: "/users", routeIds: ["UsersController.getUser"] },
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
    expect(generationModuleImports.generateClientFiles).toBe(0);
    expect(generationModuleImports.loadContractGraph).toBe(1);
  });
});
