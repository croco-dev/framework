import { ContractGraphDiagnosticError } from "@croco/protocols-core";
import { describe, expect, it } from "vitest";
import { assertRouteRegistrationTable, createRouteRegistrationTable } from "../compiler";
import type { ContractGraph } from "@croco/protocols-core";
import type { RouteRegistrationEntry, RouteRegistrationTable } from "../compiler";

const graph: ContractGraph = {
  version: "croco.contract-graph.v1",
  controllers: [],
  diagnostics: [],
  routes: [
    {
      routeId: "AssetsController.read",
      operationId: "AssetsController_read",
      controllerName: "AssetsController",
      controllerPath: "/assets",
      methodName: "read",
      httpMethod: "GET",
      path: "/assets/:...file",
      sourceLocation: { path: "src/AssetsController.ts", line: 12, column: 3 },
      routeContract: null,
      params: [],
      inputSchema: null,
      inputSchemas: { body: null, path: null, query: null, headers: null },
      outputSchema: null,
      domain: null,
      access: { guards: [], roles: [] },
      entitlements: [],
    },
  ],
};

const entry: RouteRegistrationEntry = {
  id: "AssetsController.read",
  method: "GET",
  path: "/assets/:file{.+}",
  contractPath: "/assets/:...file",
  controllerName: "AssetsController",
  controllerPath: "/assets",
  handlerName: "read",
};

function table(value: RouteRegistrationEntry): RouteRegistrationTable {
  return {
    version: "croco.route-registration-table.v1",
    category: "http.controller",
    entries: [value],
  };
}

describe("route registration contract", () => {
  it.each([
    ["method", { method: "POST" }],
    ["path", { path: "/elsewhere", contractPath: "/elsewhere" }],
    ["controllerName", { controllerName: "OtherController" }],
    ["controllerPath", { controllerPath: "/other" }],
    ["handlerName", { handlerName: "remove" }],
    ["contractPath", { contractPath: "/assets/:file{.+}" }],
  ] satisfies [string, Partial<RouteRegistrationEntry>][])(
    "rejects same-ID %s drift with its source and field",
    (field, override) => {
      expect.assertions(3);
      try {
        assertRouteRegistrationTable(table({ ...entry, ...override }), graph);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractGraphDiagnosticError);
        const diagnostics = (error as ContractGraphDiagnosticError).diagnostics;
        expect(diagnostics).toContainEqual(
          expect.objectContaining({
            code: "route-registration-contract-drift",
            severity: "error",
            routeId: "AssetsController.read",
            sourceLocation: { path: "src/AssetsController.ts", line: 12, column: 3 },
          }),
        );
        expect(
          diagnostics.find((diagnostic) => diagnostic.code === "route-registration-contract-drift")
            ?.message,
        ).toContain(field);
      }
    },
  );

  it("accepts generated tables and legacy authored or runtime paths without contractPath", () => {
    const generated = createRouteRegistrationTable(
      [
        {
          className: "AssetsController",
          basePath: "/assets",
          routes: [{ method: "GET", path: "/:...file", handlerName: "read" }],
        },
      ],
      graph,
    );
    expect(generated.entries).toEqual([entry]);
    expect(() => assertRouteRegistrationTable(generated, graph)).not.toThrow();
    const { contractPath: _contractPath, ...legacyEntry } = entry;
    expect(() => assertRouteRegistrationTable(table(legacyEntry), graph)).not.toThrow();
    expect(() =>
      assertRouteRegistrationTable(table({ ...legacyEntry, path: "/assets/:...file" }), graph),
    ).not.toThrow();
    expect(() =>
      assertRouteRegistrationTable(table({ ...legacyEntry, path: "/wrong/:...file" }), graph),
    ).toThrow("route-registration-contract-drift");
  });

  it("checks every entry when a duplicate ID would hide an earlier mismatched binding", () => {
    expect(() =>
      assertRouteRegistrationTable(
        { ...table(entry), entries: [{ ...entry, method: "POST", handlerName: "remove" }, entry] },
        graph,
      ),
    ).toThrow("route-registration-contract-drift");
  });
});
