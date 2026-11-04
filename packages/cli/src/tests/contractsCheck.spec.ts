import type { ContractDiagnostic, ContractGraph } from "@croco/protocols-core";
import { describe, expect, it, vi } from "vitest";
import { runContractsCheck } from "../commands/contractsCheck.js";
import { runCroco } from "../commands/root.js";

describe("contractsCheck", () => {
  it.each(
    [
      ["contracts", "check", "--controllers", "missing.ts", "--strict-schema"],
      ["contracts", "--strict-schema", "check", "missing.ts"],
      ["--strict-schema", "contracts", "check", "missing.ts"],
    ].map((argv) => ({ argv })),
  )(
    "should reject a misspelled strict option before loading controllers: $argv",
    async ({ argv }) => {
      const stderr = vi.fn();

      expect(await runCroco(argv, { stdout: vi.fn(), stderr })).toEqual({ exitCode: 1 });
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining("Unknown option '--strict-schema'"),
      );
    },
  );

  it.each([
    { args: ["src/**/*.ts", "--unknown"], message: "Unknown option '--unknown'" },
    { args: ["src/**/*.ts", "--out"], message: "--out" },
    { args: ["--controllers", "--strict-schemas", "src/**/*.ts"], message: "--controllers" },
    { args: ["--controllers="], message: "--controllers" },
    { args: ["src/**/*.ts", "--out="], message: "--out" },
    { args: ["src/**/*.ts", "--strict-schemas=false"], message: "--strict-schemas" },
    { args: ["src/**/*.ts", "extra.ts"], message: "extra.ts" },
  ])(
    "should reject malformed arguments before invoking the loader: $args",
    async ({ args, message }) => {
      const loadContractGraph = vi.fn(async () => createGraph());
      const stderr = vi.fn();

      expect(
        await runContractsCheck(args, { loadContractGraph, io: { stdout: vi.fn(), stderr } }),
      ).toBe(1);
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining(message));
      expect(loadContractGraph).not.toHaveBeenCalled();
    },
  );

  it("should validate a contract graph with text output", async () => {
    const stdout: string[] = [];
    let loadOptions: Record<string, unknown> | null = null;

    const exitCode = await runContractsCheck(["--controllers", "src/**/*.ts", "--strict-schemas"], {
      loadContractGraph: async (_glob, options) => {
        loadOptions = options;
        return createGraph();
      },
      io: {
        stdout: (message) => stdout.push(message),
        stderr: (message) => stdout.push(message),
      },
    });

    expect(exitCode).toBe(0);
    expect(loadOptions).toEqual({ strictSchemas: true });
    expect(stdout).toEqual(["Contract graph check passed for 1 route(s) across 1 controller(s)."]);
  });

  it("should write a stable JSON snapshot report", async () => {
    const stdout: string[] = [];
    const writes = new Map<string, string>();
    const mkdirs: string[] = [];

    const exitCode = await runContractsCheck(
      ["--controllers=src/**/*.ts", "--out=artifacts/contracts.json"],
      {
        loadContractGraph: async () => createGraph(),
        io: {
          cwd: "/workspace/app",
          mkdir: (path) => mkdirs.push(path),
          writeFile: (path, content) => writes.set(path, content),
          stdout: (message) => stdout.push(message),
        },
      },
    );

    const content = writes.get("/workspace/app/artifacts/contracts.json");

    expect(exitCode).toBe(0);
    expect(mkdirs).toEqual(["/workspace/app/artifacts"]);
    expect(stdout).toEqual([
      "Wrote contract graph snapshot to /workspace/app/artifacts/contracts.json.",
    ]);
    expect(content).toBeDefined();
    expect(JSON.parse(content ?? "{}")).toMatchObject({
      snapshotVersion: "croco.contract-graph.snapshot.v1",
      routeCount: 1,
      operationIds: ["UsersController_listUsers"],
      consumerCoverage: {
        version: "croco.contract-consumer-coverage.v1",
        routeCount: 1,
        consumers: [
          expect.objectContaining({
            consumerId: "admin-generated",
            routeCount: 1,
          }),
          expect.objectContaining({
            consumerId: "openapi",
            routeCount: 1,
          }),
          expect.objectContaining({
            consumerId: "rpc-client",
            routeCount: 1,
          }),
        ],
      },
    });
  });

  it("should exit non-zero when contract graph errors exist", async () => {
    const stdout: string[] = [];
    const diagnostics: ContractDiagnostic[] = [
      {
        code: "contract-route-missing-path-param",
        severity: "error",
        target: "route",
        routeId: "UsersController.getUser",
        message: "Route path declares ':id' but no @Param(\"id\") metadata was found.",
      },
    ];

    const exitCode = await runContractsCheck(["src/**/*.ts"], {
      loadContractGraph: async () => createGraph(diagnostics),
      io: {
        stdout: (message) => stdout.push(message),
      },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      "ERROR contract-route-missing-path-param UsersController.getUser: Route path declares ':id' but no @Param(\"id\") metadata was found.",
      "Contract graph check failed with 1 error(s).",
    ]);
  });
});

function createGraph(diagnostics: ContractDiagnostic[] = []): ContractGraph {
  return {
    version: "croco.contract-graph.v1",
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
        access: { guards: [], roles: [] },
        entitlements: [],
        params: [],
        inputSchema: null,
        inputSchemas: { body: null, path: null, query: null, headers: null },
        outputSchema: null,
        routeContract: null,
        domain: null,
      },
    ],
    diagnostics,
  };
}
