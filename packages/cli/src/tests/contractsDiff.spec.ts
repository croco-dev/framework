import { renderUsage } from "citty";
import { Container } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ContractDiagnostic,
  createContractGraphSnapshot,
  stringifyContractGraphSnapshot,
  type ContractGraph,
} from "@croco/protocols-core";

import { contractsDiff, runContractsDiff } from "../commands/contractsDiff.js";

describe("contractsDiff", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should describe both current input modes in executable help", async () => {
    const usage = await renderUsage(contractsDiff);

    expect(usage).toContain("current snapshot or controller metadata");
    expect(usage).toContain("--current-snapshot");
    expect(usage).toContain("--controllers");
    expect(usage).toContain("mutually exclusive");
    expect(usage).toContain("CONTROLLERGLOB");
  });

  it("should pass with non-breaking additive route changes", async () => {
    const stdout: string[] = [];
    let loadOptions: Record<string, unknown> | null = null;
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );

    const exitCode = await runContractsDiff(
      [
        "--baseline",
        "contract-graph.snapshot.json",
        "--controllers",
        "src/**/*.ts",
        "--strict-schemas",
      ],
      {
        loadContractGraph: async (_glob, options) => {
          loadOptions = options;
          return createGraph(["UsersController.listUsers", "UsersController.createUser"]);
        },
        io: {
          cwd: "/workspace/app",
          readFile: () => baseline,
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(loadOptions).toEqual({ strictSchemas: true });
    expect(stdout).toEqual([
      "NON-BREAKING contract-route-added UsersController.createUser: Route 'UsersController.createUser' was added to the contract graph.",
      "Contract graph diff found 0 breaking change(s) and 1 non-breaking change(s).",
    ]);
  });

  it("should compare snapshots without loading controllers", async () => {
    const stdout: string[] = [];
    const loadContractGraph = vi.fn<() => Promise<ContractGraph>>();
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );
    const current = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(
        createGraph(["UsersController.listUsers", "UsersController.createUser"]),
      ),
    );

    const exitCode = await runContractsDiff(
      ["--baseline", "baseline.json", "--current-snapshot", "current.json"],
      {
        loadContractGraph,
        io: {
          cwd: "/workspace/app",
          readFile: (path) => (path.endsWith("baseline.json") ? baseline : current),
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(loadContractGraph).not.toHaveBeenCalled();
    expect(stdout).toEqual([
      "NON-BREAKING contract-route-added UsersController.createUser: Route 'UsersController.createUser' was added to the contract graph.",
      "Contract graph diff found 0 breaking change(s) and 1 non-breaking change(s).",
    ]);
  });

  it("should preserve the breaking exit code for snapshot comparisons", async () => {
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );
    const current = stringifyContractGraphSnapshot(createContractGraphSnapshot(createGraph([])));

    const exitCode = await runContractsDiff(
      ["--baseline", "baseline.json", "--current-snapshot", "current.json"],
      {
        io: {
          cwd: "/workspace/app",
          readFile: (path) => (path.endsWith("baseline.json") ? baseline : current),
        },
      },
    );

    expect(exitCode).toBe(1);
  });

  it("should write the existing JSON diff shape for snapshot comparisons", async () => {
    const writes = new Map<string, string>();
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );
    const current = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(
        createGraph(["UsersController.listUsers", "UsersController.createUser"]),
      ),
    );

    const exitCode = await runContractsDiff(
      [
        "--baseline",
        "baseline.json",
        "--current-snapshot",
        "current.json",
        "--json",
        "--out",
        "artifacts/diff.json",
      ],
      {
        io: {
          cwd: "/workspace/app",
          mkdir: () => {},
          readFile: (path) => (path.endsWith("baseline.json") ? baseline : current),
          writeFile: (path, content) => writes.set(path, content),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(writes.get("/workspace/app/artifacts/diff.json") ?? "{}")).toMatchObject({
      baselineRouteCount: 1,
      currentRouteCount: 2,
      breakingChangeCount: 0,
      nonBreakingChangeCount: 1,
      hasBreakingChanges: false,
    });
  });

  it("should reject multiple or missing current inputs", async () => {
    const stderr: string[] = [];
    const io = {
      stderr: (message: string) => stderr.push(message),
      stdout: () => {},
    };

    await expect(
      runContractsDiff(
        [
          "--baseline",
          "baseline.json",
          "--current-snapshot",
          "current.json",
          "--controllers",
          "src/**/*.ts",
        ],
        { io },
      ),
    ).resolves.toBe(1);
    await expect(runContractsDiff(["--baseline", "baseline.json"], { io })).resolves.toBe(1);

    expect(stderr).toEqual([
      "Current inputs are mutually exclusive. Pass either --current-snapshot <path> or --controllers <glob>/a positional controller glob, not both.",
      "Missing current input. Pass --current-snapshot <path>, --controllers <glob>, or a positional controller glob.",
    ]);
  });

  it("should reject an invalid current snapshot with its path in the error", async () => {
    const baseline = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(createGraph(["UsersController.listUsers"])),
    );

    await expect(
      runContractsDiff(["--baseline", "baseline.json", "--current-snapshot", "current.json"], {
        io: {
          cwd: "/workspace/app",
          readFile: (path) => (path.endsWith("baseline.json") ? baseline : "{}"),
        },
      }),
    ).rejects.toThrow("current.json is not a croco.contract-graph.snapshot.v1 JSON snapshot.");
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

  it("should reject malformed nested baseline snapshot rows before loading controllers", async () => {
    const baseline = createContractGraphSnapshot(createGraph(["UsersController.listUsers"]));
    const loadContractGraph = vi.fn<() => Promise<ContractGraph>>();
    const malformedBaseline = JSON.stringify({
      ...baseline,
      routes: [
        {
          ...baseline.routes[0],
          problems: [
            {
              code: "UPSTREAM_FAILURE",
              category: "InternalServerError",
              status: 500,
            },
          ],
        },
      ],
    }).replace('"status":500', '"status":1e309');

    await expect(
      runContractsDiff(
        ["--baseline", "contract-graph.snapshot.json", "--controllers", "src/**/*.ts"],
        {
          loadContractGraph,
          io: {
            cwd: "/workspace/app",
            readFile: () => malformedBaseline,
          },
        },
      ),
    ).rejects.toThrow(
      "contract-graph.snapshot.json is not a croco.contract-graph.snapshot.v1 JSON snapshot.",
    );
    expect(loadContractGraph).not.toHaveBeenCalled();
  });

  it("should reject modern baseline routes with a deleted required field", async () => {
    const baseline = createContractGraphSnapshot(createGraph(["UsersController.listUsers"]));
    const loadContractGraph = vi.fn<() => Promise<ContractGraph>>();
    const malformedRoute = { ...baseline.routes[0] } as Record<string, unknown>;
    delete malformedRoute["problems"];

    await expect(
      runContractsDiff(
        ["--baseline", "contract-graph.snapshot.json", "--controllers", "src/**/*.ts"],
        {
          loadContractGraph,
          io: {
            cwd: "/workspace/app",
            readFile: () => JSON.stringify({ ...baseline, routes: [malformedRoute] }),
          },
        },
      ),
    ).rejects.toThrow(
      "contract-graph.snapshot.json is not a croco.contract-graph.snapshot.v1 JSON snapshot.",
    );
    expect(loadContractGraph).not.toHaveBeenCalled();
  });

  it("should normalize historical v1 baselines before diffing", async () => {
    const stdout: string[] = [];
    const graph = createGraph(["UsersController.listUsers"]);
    const current = createContractGraphSnapshot(graph);
    const route = current.routes[0];

    expect(route).toBeDefined();
    if (!route) {
      return;
    }

    const legacyBaseline = JSON.stringify({
      snapshotVersion: current.snapshotVersion,
      graphVersion: current.graphVersion,
      controllerCount: current.controllerCount,
      routeCount: current.routeCount,
      operationIds: current.operationIds,
      controllers: current.controllers,
      routes: [
        {
          routeId: route.routeId,
          operationId: route.operationId,
          controllerName: route.controllerName,
          methodName: route.methodName,
          httpMethod: route.httpMethod,
          path: route.path,
          controllerPath: route.controllerPath,
          domain: route.domain,
          access: route.access,
          params: route.params,
          request: route.request,
          response: route.response,
        },
      ],
      diagnostics: current.diagnostics,
    });

    const exitCode = await runContractsDiff(
      ["--baseline", "legacy.snapshot.json", "--controllers", "src/**/*.ts"],
      {
        loadContractGraph: async () => graph,
        io: {
          cwd: "/workspace/app",
          readFile: () => legacyBaseline,
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["Contract graph diff passed with no changes (1 current route(s))."]);
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
      entitlements: [],
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
