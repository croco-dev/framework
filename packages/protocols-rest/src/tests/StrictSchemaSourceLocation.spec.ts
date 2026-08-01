import "reflect-metadata";
import {
  buildContractGraph,
  formatContractDiagnostic,
  type ContractDiagnostic,
} from "@croco/protocols-core";
import { describe, expect, it } from "vitest";
import { Controller } from "../libs/decorators/Controller";
import { Get, Post } from "../libs/decorators/HttpMethod";
import { Body, Header, Param, Query } from "../libs/decorators/Params";
import { findRestDecoratorSourceLocation } from "../libs/sourceLocation";

describe("strict schema source locations", () => {
  it("should report real REST decorator source locations for weak parameter schemas", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(
        @Param("id") _id: string,
        @Query("include") _include: string,
        @Header("x-request-id") _requestId: string,
      ): void {}

      @Post("/")
      createUser(@Body() _body: { name: string }): void {}
    }

    const graph = buildContractGraph([UsersController], { strictSchemas: true });
    const paramDiagnostic = findDiagnostic(graph.diagnostics, {
      code: "contract-route-missing-named-param-schema",
      message: '@Param("id")',
    });
    const queryDiagnostic = findDiagnostic(graph.diagnostics, {
      code: "contract-route-missing-named-param-schema",
      message: '@Query("include")',
    });
    const headerDiagnostic = findDiagnostic(graph.diagnostics, {
      code: "contract-route-missing-named-param-schema",
      message: '@Header("x-request-id")',
    });
    const bodyDiagnostic = findDiagnostic(graph.diagnostics, {
      code: "contract-route-missing-body-schema",
      routeId: "UsersController.createUser",
    });

    for (const diagnostic of [paramDiagnostic, queryDiagnostic, headerDiagnostic, bodyDiagnostic]) {
      const sourceLocation = diagnostic.sourceLocation;

      expect(sourceLocation).toBeDefined();
      if (!sourceLocation) {
        throw new Error("Expected diagnostic to include source location.");
      }

      expect(sourceLocation.path.replace(/\\/g, "/")).toContain(
        "packages/protocols-rest/src/tests/StrictSchemaSourceLocation.spec.ts",
      );
      expect(sourceLocation.line).toEqual(expect.any(Number));
      expect(sourceLocation.column).toEqual(expect.any(Number));
      expect(formatContractDiagnostic(diagnostic)).toContain(sourceLocation.path);
    }
  });

  it("should skip Windows-style internal REST decorator stack frames", () => {
    const sourceLocation = findRestDecoratorSourceLocation(
      [
        "Error",
        String.raw`    at captureRestDecoratorSourceLocation (C:\repo\packages\protocols-rest\src\libs\sourceLocation.js:4:10)`,
        String.raw`    at createParamDecorator (C:\repo\packages\protocols-rest\src\libs\decorators\Params.js:23:28)`,
        String.raw`    at Param (C:\repo\packages\protocols-rest\src\libs\decorators\Params.js:56:12)`,
        String.raw`    at Object.<anonymous> (C:\repo\apps\api\src\UsersController.ts:42:8)`,
      ].join("\n"),
    );

    expect(sourceLocation).toEqual({
      path: String.raw`C:\repo\apps\api\src\UsersController.ts`,
      line: 42,
      column: 8,
    });
  });

  it("should retain user source files named Controller.ts", () => {
    const sourceLocation = findRestDecoratorSourceLocation(
      [
        "Error",
        "    at Controller (/repo/packages/protocols-rest/src/libs/decorators/Controller.js:18:28)",
        "    at Object.<anonymous> (/repo/apps/api/src/Controller.ts:12:4)",
      ].join("\n"),
    );

    expect(sourceLocation).toEqual({
      path: "/repo/apps/api/src/Controller.ts",
      line: 12,
      column: 4,
    });
  });
});

function findDiagnostic(
  diagnostics: readonly ContractDiagnostic[],
  criteria: {
    readonly code: string;
    readonly message?: string;
    readonly routeId?: string;
  },
): ContractDiagnostic {
  const diagnostic = diagnostics.find(
    (candidate) =>
      candidate.code === criteria.code &&
      (!criteria.message || candidate.message.includes(criteria.message)) &&
      (!criteria.routeId || candidate.routeId === criteria.routeId),
  );

  if (!diagnostic) {
    throw new Error(`Expected diagnostic ${criteria.code} was not found.`);
  }

  return diagnostic;
}
