import {
  type ContractDiagnostic,
  createContractGraphSnapshot,
  stringifyContractGraphSnapshot,
  type ContractGraph,
} from "@croco/protocols-core";
import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { runContractsDiff } from "../commands/contractsDiff.js";

describe("contractsDiff", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should pass with non-breaking additive route changes", async () => {
    const stdout: string[] = [];
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );

    const exitCode = await runContractsDiff(
      ["--baseline", "contract-graph.snapshot.json", "--controllers", "src/**/*.ts"],
      {
        loadContractGraph: async () =>
          createGraph(["UsersController.listUsers", "UsersController.createUser"]),
        io: {
          cwd: "/workspace/app",
          readFile: () => baseline,
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      "NON-BREAKING contract-route-added UsersController.createUser: Route 'UsersController.createUser' was added to the contract graph.",
      "Contract graph diff found 0 breaking change(s) and 1 non-breaking change(s).",
    ]);
  });

  it("should fail with breaking route drift", async () => {
    const stdout: string[] = [];
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );

    const exitCode = await runContractsDiff(
      ["--baseline", "contract-graph.snapshot.json", "--controllers", "src/**/*.ts"],
      {
        loadContractGraph: async () => createGraph(["UsersController.listUsers"], "/v2/users"),
        io: {
          cwd: "/workspace/app",
          readFile: () => baseline,
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      "BREAKING contract-route-method-path-changed UsersController.listUsers: Route 'UsersController.listUsers' changed from GET /users to GET /v2/users.",
      "Contract graph diff found 1 breaking change(s) and 0 non-breaking change(s). Breaking contract drift must be reviewed before release.",
    ]);
  });

  it("should fail when the current contract graph has errors", async () => {
    const stdout: string[] = [];
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );
    const diagnostics: ContractDiagnostic[] = [
      {
        code: "contract-route-missing-path-param",
        severity: "error",
        target: "route",
        routeId: "UsersController.listUsers",
        message: "Route path declares ':id' but no @Param(\"id\") metadata was found.",
      },
    ];

    const exitCode = await runContractsDiff(
      ["--baseline", "contract-graph.snapshot.json", "--controllers", "src/**/*.ts"],
      {
        loadContractGraph: async () =>
          createGraph(["UsersController.listUsers"], "/users", diagnostics),
        io: {
          cwd: "/workspace/app",
          readFile: () => baseline,
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      "ERROR contract-route-missing-path-param UsersController.listUsers: Route path declares ':id' but no @Param(\"id\") metadata was found.",
      "Contract graph diff failed with 1 current graph error(s).",
    ]);
  });

  it("should write a JSON diff report", async () => {
    const stdout: string[] = [];
    const writes = new Map<string, string>();
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );

    const exitCode = await runContractsDiff(
      [
        "--baseline",
        "contract-graph.snapshot.json",
        "--controllers",
        "src/**/*.ts",
        "--json",
        "--out",
        "artifacts/diff.json",
      ],
      {
        loadContractGraph: async () =>
          createGraph(["UsersController.listUsers", "UsersController.createUser"]),
        io: {
          cwd: "/workspace/app",
          mkdir: () => {},
          readFile: () => baseline,
          writeFile: (path, content) => writes.set(path, content),
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["Wrote contract graph diff to /workspace/app/artifacts/diff.json."]);
    expect(JSON.parse(writes.get("/workspace/app/artifacts/diff.json") ?? "{}")).toMatchObject({
      breakingChangeCount: 0,
      nonBreakingChangeCount: 1,
      hasBreakingChanges: false,
    });
  });
});

function createGraph(
  routeIds: readonly string[],
  path = "/users",
  diagnostics: ContractDiagnostic[] = [],
): ContractGraph {
  const routes = routeIds.map((routeId) => {
    const [, methodName] = routeId.split(".");

    return {
      routeId,
      operationId: routeId.replace(/[^A-Za-z0-9_]+/g, "_"),
      controllerName: "UsersController",
      methodName: methodName ?? "unknown",
      httpMethod: methodName === "createUser" ? "POST" : "GET",
      path: methodName === "createUser" ? "/users" : path,
      controllerPath: "/users",
      access: { guards: [], roles: [] },
      params: [],
      inputSchema: null,
      inputSchemas: { body: null, path: null, query: null, headers: null },
      outputSchema: null,
      routeContract: null,
      domain: null,
    };
  });

  return {
    version: "croco.contract-graph.v1",
    controllers: [
      {
        name: "UsersController",
        path: "/users",
        guards: [],
        roles: [],
        routeIds,
      },
    ],
    routes,
    diagnostics,
  };
}
