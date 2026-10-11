import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildContractGraph } from "../libs/ContractGraph";
import { diffContractGraphSnapshots } from "../libs/ContractGraphDiff";
import {
  createContractGraphSnapshot,
  createContractGraphV1,
  isContractGraphSnapshot,
  isContractGraphV1,
  parseContractGraphSnapshot,
} from "../libs/ContractGraphSnapshot";
import { REST_ROUTES_KEY } from "../libs/sharedTypes";
import { Controller, Post, ResponseSchema } from "./helpers/test-decorators";

function statusGraph(statusCode?: number, hasResponse = true) {
  @Controller("/status")
  class StatusController {
    @Post("/")
    create(): void {}
  }
  if (hasResponse) {
    ResponseSchema(z.object({ ok: z.boolean() }))(
      StatusController.prototype,
      "create",
      Object.getOwnPropertyDescriptor(StatusController.prototype, "create")!,
    );
  }
  Reflect.defineMetadata(
    REST_ROUTES_KEY,
    [
      {
        method: "POST",
        path: "/",
        methodName: "create",
        ...(statusCode === undefined ? {} : { statusCode }),
      },
    ],
    StatusController,
  );
  return buildContractGraph([StatusController]);
}

describe("contract success status", () => {
  it("preserves 201 to 202 changes in both artifacts and reports a stable breaking diagnostic", () => {
    const baselineGraph = statusGraph(201);
    const currentGraph = statusGraph(202);
    const baseline = createContractGraphSnapshot(baselineGraph);
    const current = createContractGraphSnapshot(currentGraph);
    expect(baseline.routes[0]).toMatchObject({ successStatus: 201 });
    expect(current.routes[0]).toMatchObject({ successStatus: 202 });
    expect(createContractGraphV1(baselineGraph).routes[0]).toMatchObject({ successStatus: 201 });
    expect(createContractGraphV1(currentGraph).routes[0]).toMatchObject({ successStatus: 202 });
    expect(JSON.stringify(baseline)).not.toBe(JSON.stringify(current));
    expect(JSON.stringify(createContractGraphV1(baselineGraph))).not.toBe(
      JSON.stringify(createContractGraphV1(currentGraph)),
    );
    expect(diffContractGraphSnapshots(baseline, current)).toMatchObject({
      hasBreakingChanges: true,
      breakingChangeCount: 1,
      changes: [
        {
          code: "contract-success-status-changed",
          severity: "breaking",
          routeId: "StatusController.create",
          operationId: "StatusController_create",
          location: "response",
          message: "Route 'StatusController.create' success status changed from 201 to 202.",
        },
      ],
    });
  });

  it.each([
    [true, 200],
    [false, 204],
  ] as const)(
    "treats omitted and explicit default statuses equally (response %s, status %s)",
    (hasResponse, status) => {
      const implicit = createContractGraphSnapshot(statusGraph(undefined, hasResponse));
      const explicit = createContractGraphSnapshot(statusGraph(status, hasResponse));
      expect(implicit.routes[0]).toMatchObject({ successStatus: status });
      expect(createContractGraphV1(statusGraph(undefined, hasResponse)).routes[0]).toMatchObject({
        successStatus: status,
      });
      const persisted = JSON.parse(JSON.stringify(implicit));
      delete persisted.routes[0].successStatus;
      expect(isContractGraphSnapshot(persisted)).toBe(true);
      expect(parseContractGraphSnapshot(persisted)).toEqual(implicit);
      expect(diffContractGraphSnapshots(persisted, explicit).changes).toEqual([]);
      expect(diffContractGraphSnapshots(explicit, persisted).changes).toEqual([]);
      expect(diffContractGraphSnapshots(implicit, explicit).changes).toEqual([]);
      const legacyV1 = JSON.parse(
        JSON.stringify(createContractGraphV1(statusGraph(undefined, hasResponse))),
      );
      delete legacyV1.routes[0].successStatus;
      expect(isContractGraphV1(legacyV1)).toBe(true);
      expect(
        diffContractGraphSnapshots(
          persisted,
          createContractGraphSnapshot(statusGraph(202, hasResponse)),
        ).breakingChanges,
      ).toEqual([expect.objectContaining({ code: "contract-success-status-changed" })]);
    },
  );

  it.each([null, "201", 199, 300, 201.5, NaN, Infinity])(
    "rejects invalid persisted status %s",
    (successStatus) => {
      const graph = statusGraph(201);
      const snapshot = createContractGraphSnapshot(graph);
      const invalid = {
        ...snapshot,
        routes: snapshot.routes.map((route) => ({ ...route, successStatus })),
      };
      expect(isContractGraphSnapshot(invalid)).toBe(false);
      expect(parseContractGraphSnapshot(invalid)).toBe(null);
      const v1 = createContractGraphV1(graph);
      expect(
        isContractGraphV1({
          ...v1,
          routes: v1.routes.map((route) => ({ ...route, successStatus })),
        }),
      ).toBe(false);
      const historical = JSON.parse(JSON.stringify(invalid));
      delete historical.consumerCoverage;
      delete historical.routes[0].routeContract;
      delete historical.routes[0].entitlements;
      historical.routes[0].response = null;
      expect(parseContractGraphSnapshot(historical)).toBe(null);
    },
  );

  it.each([204, 205])(
    "rejects a persisted body schema with no-content status %s",
    (successStatus) => {
      const graph = statusGraph(200);
      const snapshot = createContractGraphSnapshot(graph);
      const invalid = {
        ...snapshot,
        routes: snapshot.routes.map((route) => ({ ...route, successStatus })),
      };
      expect(isContractGraphSnapshot(invalid)).toBe(false);
      expect(parseContractGraphSnapshot(invalid)).toBe(null);
      const v1 = createContractGraphV1(graph);
      expect(
        isContractGraphV1({
          ...v1,
          routes: v1.routes.map((route) => ({ ...route, successStatus })),
        }),
      ).toBe(false);
    },
  );

  it.each([
    [null, 204],
    [{ kind: "string", typeName: "ZodString" }, 200],
  ] as const)(
    "normalizes missing statuses in historical schema metadata (%j)",
    (response, expectedStatus) => {
      const historical = JSON.parse(JSON.stringify(createContractGraphSnapshot(statusGraph())));
      delete historical.consumerCoverage;
      delete historical.routes[0].routeContract;
      delete historical.routes[0].entitlements;
      delete historical.routes[0].successStatus;
      historical.routes[0].response = response;
      expect(parseContractGraphSnapshot(historical)?.routes[0]).toMatchObject({
        successStatus: expectedStatus,
      });
      historical.routes[0].successStatus = 202;
      expect(parseContractGraphSnapshot(historical)?.routes[0]).toMatchObject({
        successStatus: 202,
      });
    },
  );

  it.each([200, 204, 205, 299])("accepts valid persisted 2xx status %s", (successStatus) => {
    const graph = statusGraph(successStatus, false);
    expect(isContractGraphSnapshot(createContractGraphSnapshot(graph))).toBe(true);
    expect(isContractGraphV1(createContractGraphV1(graph))).toBe(true);
  });
});
